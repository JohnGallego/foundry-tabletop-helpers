/**
 * Asset Manager — FilePicker Replacement
 *
 * Subclasses Foundry's FilePicker via CONFIG.ux.FilePicker to provide:
 * - Virtual-scrolled thumbnail grid for large directories
 * - Dark arcane theme matching the module's design language
 * - Grid/list view toggle with density options
 * - Lazy-loaded image thumbnails
 * - Breadcrumb navigation
 *
 * The subclass is created at init time (when Foundry classes are available)
 * and registered via CONFIG.ux.FilePicker so it's used everywhere.
 */

import { Log, MOD } from "../logger";
import { getGame, isGM } from "../types";
import { AM_SETTINGS } from "./asset-manager-settings";
import { VirtualScroller } from "./virtual-scroll";
import { getThumbCache } from "./asset-manager-thumb-cache";
import { getBrowseCache } from "./asset-manager-browse-cache";
import { extractMetadata, buildPreviewHTML, isConvertible, formatBytes, type FileMetadata } from "./asset-manager-preview";
import { showContextMenu, dismissContextMenu, startLongPress } from "./asset-manager-context-menu";
import { checkOptimizerServer, isOptimizerConfigured, getServerThumbUrl, serverDeleteFile, serverDeleteFolder, getThumbCacheStats, invalidateThumbStats } from "./asset-manager-optimizer-client";
import { UploadManager, buildUploadQueueHTML, batchOptimize, type OptPreset, type UploadQueueItem } from "./asset-manager-upload";
import { getMetadataStore, type MetadataSnapshot } from "./asset-manager-metadata";
import {
  type AssetEntry,
  type AssetType,
  type GridDensity,
  type ViewMode,
  type SortField,
  type SortDir,
  classifyExt,
  basename,
  extname,
  DENSITY_SIZES,
} from "./asset-manager-types";

/* ── Notification Suppression ────────────────────────────── */

/**
 * Temporarily suppress Foundry's `ui.notifications.info` calls.
 * Returns a restore function that re-enables notifications.
 * Used during batch optimize / large uploads to avoid notification spam.
 */
function suppressInfoNotifications(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ui = (globalThis as any).ui;
  if (!ui?.notifications?.info) return () => {};
  const original = ui.notifications.info.bind(ui.notifications);
  ui.notifications.info = () => {};
  return () => { ui.notifications.info = original; };
}

/* ── Filter Types ────────────────────────────────────────── */

type SmartCollection = "all" | "recent" | "unoptimized" | "images" | "audio" | "video";
type ActiveFilter = { type: "tag"; value: string } | { type: "asset-type"; value: AssetType };

/* ── State keys for localStorage persistence ─────────────── */

const LS_DENSITY = `${MOD}:am-density`;
const LS_VIEW = `${MOD}:am-view`;
const LS_SORT = `${MOD}:am-sort`;
const LS_SIDEBAR = `${MOD}:am-sidebar`;

/* ── Module-level state ──────────────────────────────────── */

let density: GridDensity = "medium";
let viewMode: ViewMode = "grid";
let sortField: SortField = "name";
let sortDir: SortDir = "asc";
let sidebarOpen = true;

// Load persisted preferences
try {
  const d = localStorage.getItem(LS_DENSITY);
  if (d === "small" || d === "medium" || d === "large") density = d;
  const v = localStorage.getItem(LS_VIEW);
  if (v === "grid" || v === "list") viewMode = v;
  const s = localStorage.getItem(LS_SORT);
  if (s) {
    const parsed = JSON.parse(s) as { field?: string; dir?: string };
    if (parsed.field === "name" || parsed.field === "size" || parsed.field === "type") sortField = parsed.field;
    if (parsed.dir === "asc" || parsed.dir === "desc") sortDir = parsed.dir;
  }
  const sb = localStorage.getItem(LS_SIDEBAR);
  if (sb === "false") sidebarOpen = false;
} catch { /* ignore */ }

/**
 * Register the asset manager FilePicker replacement.
 * Called during `init` hook when Foundry classes are available.
 */
export function registerAssetManagerPicker(): void {
  const game = getGame();
  if (!game) return;

  // Check setting — only replace if enabled
  try {
    const enabled = game.settings?.get?.(MOD, AM_SETTINGS.ENABLE);
    if (!enabled) {
      Log.debug("Asset Manager: disabled by setting");
      return;
    }
  } catch {
    // Setting not registered yet or error — skip
    Log.debug("Asset Manager: setting not available, skipping");
    return;
  }

  // Only for GMs
  if (!isGM()) return;

  // Access the CONFIG object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CONFIG = (globalThis as any).CONFIG;
  if (!CONFIG?.ux) {
    Log.warn("Asset Manager: CONFIG.ux not found");
    return;
  }

  // Get the base FilePicker class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BaseFilePicker = CONFIG.ux.FilePicker ?? (globalThis as any).FilePicker;
  if (!BaseFilePicker) {
    Log.warn("Asset Manager: FilePicker class not found");
    return;
  }

  /**
   * FTHAssetPicker — Enhanced FilePicker with virtual scrolling,
   * thumbnail grid, and dark arcane theme.
   */
  class FTHAssetPicker extends BaseFilePicker {
    /* ── Instance state ─────────────────────────────────────── */

    /** Parsed file entries for current directory. */
    _amEntries: AssetEntry[] = [];
    /** Virtual scroller instance. */
    _amScroller: VirtualScroller | null = null;
    /** Search query. */
    _amSearch = "";
    /** Filtered entries (after search). */
    _amFiltered: AssetEntry[] = [];
    /** Currently previewed file path (null = panel closed). */
    _amPreviewPath: string | null = null;
    /** Cached metadata for currently previewed file. */
    _amPreviewMeta: FileMetadata | null = null;
    /** Upload manager instance. */
    _amUploader: UploadManager | null = null;
    /** Current upload preset. */
    _amUploadPreset: OptPreset = "auto";
    /** Drag counter for nested dragenter/dragleave. */
    _amDragCounter = 0;
    /** Active smart collection (or "all" for normal browse). */
    _amCollection: SmartCollection = "all";
    /** Active filter chips. */
    _amFilters: ActiveFilter[] = [];
    /** Whether metadata store is loaded. */
    _amMetaReady = false;
    /** Multi-selection set (paths). Empty = single selection mode. */
    _amMultiSelect: Set<string> = new Set();
    /** Index of last single-clicked file in _amFiltered (for Shift range). */
    _amLastClickIdx = -1;
    /** Whether a batch optimization is currently running. */
    _amBatchRunning = false;
    /** Precomputed count of unoptimized files in _amFiltered. */
    _amUnoptCount = 0;
    /** Whether the shell has been injected and deferred populate is pending. */
    _amShellPending = false;
    /** Stable current path — survives multiple _onRender calls per render cycle. */
    _amCurrentPath = "";
    /** Lazy-image IntersectionObserver (reused across scroller rebuilds). */
    _amImgObserver: IntersectionObserver | null = null;
    /** MutationObserver for dynamic images (reused). */
    _amMutObserver: MutationObserver | null = null;

    /* ── ApplicationV2 Overrides ────────────────────────────── */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static DEFAULT_OPTIONS = (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = foundry.utils.mergeObject((BaseFilePicker as any).DEFAULT_OPTIONS ?? {}, {
        classes: ["fth-asset-picker"],
        position: { width: 720, height: 560 },
        window: { icon: "fas fa-images", resizable: true },
      }, { inplace: false });
      // Neutralize base FilePicker action handlers — our custom AM UI
      // handles all navigation/selection. Without this, clicks on AM
      // elements can bubble to ApplicationV2's data-action delegation
      // and trigger the base pickFile/pickDirectory handlers.
      const noop = () => {};
      if (base.actions) {
        for (const key of ["pickFile", "pickDirectory", "backTraverse"]) {
          if (key in base.actions) base.actions[key] = noop;
        }
      }
      return base;
    })();

    /* ── Render Override ─────────────────────────────────────── */

    /**
     * After Foundry renders the base FilePicker, we inject our custom UI
     * into the content area, replacing the default file list.
     *
     * Loading strategy:
     * 1. First open: inject full UI shell immediately with loading spinners
     *    in the content pane and sidebar folders. Defer file parsing to next frame.
     * 2. Folder navigation: `_amBrowse` shows spinners before calling browse().
     *    When _onRender fires with results, we parse & populate.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _onRender(context: any, options: any): Promise<void> {
      await super._onRender(context, options);

      // Initialize metadata store on first render
      if (!this._amMetaReady) {
        const meta = getMetadataStore();
        meta.ready().then(() => {
          meta.loadFromSettings();
          this._amMetaReady = true;
        }).catch(() => { /* ignore */ });
      }

      // Hide base FilePicker parts immediately (must be synchronous)
      const el = this.element;
      if (!el) return;
      this._amHideBaseParts(el);

      const existing = el.querySelector(".am-root");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;

      if (!existing) {
        // First render — capture current path before shell injection reads it
        this._amCurrentPath = self.request || self.target || "";
        this._amInjectShell(el);
        this._amShellPending = true;
        // Defer the heavy work so the shell (with spinners) paints first
        setTimeout(() => {
          this._amShellPending = false;
          const root = el.querySelector(".am-root") as HTMLElement | null;
          if (!root) return;
          this._amParseResults();
          this._amSaveFolderMemory();
          this._amPopulateContent(root);
        }, 0);
      } else if (this._amShellPending) {
        // Shell was injected but deferred populate hasn't run yet.
        // Foundry re-rendered (multiple parts). Just re-hide base parts.
        return;
      } else {
        // Subsequent render (browse returned new data).
        this._amParseResults();
        this._amSaveFolderMemory();
        this._amPopulateContent(existing as HTMLElement);
      }
    }

    /** Save folder memory for context-aware navigation. */
    _amSaveFolderMemory(): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pickerType = (this as any).type ?? "any";
      const curTarget = this._amCurrentPath;
      if (curTarget) {
        getMetadataStore().setFolderMemory(pickerType, curTarget).catch(() => { /* ignore */ });
      }
    }

    /* ── Custom UI ───────────────────────────────────────────── */

    /** Parse FilePicker browse results into AssetEntry array. */
    _amParseResults(): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;
      const result = self.result ?? {};
      const files: string[] = (result.files ?? []).filter((f: string) => !f.includes(".fth-thumbs"));
      const dirs: string[] = (result.dirs ?? []).filter((d: string) => !d.includes(".fth-thumbs"));

      // Cache the browse result for fast back-navigation
      const source = self.activeSource ?? "data";
      const target = self.request || self.target || "";
      // Persist current path so it survives multiple _onRender calls
      this._amCurrentPath = target;
      if (files.length || dirs.length) {
        getBrowseCache().set(source, target, result);
      }

      const entries: AssetEntry[] = [];

      // Add directories first
      for (const dir of dirs) {
        entries.push({
          path: dir,
          name: basename(dir),
          ext: "",
          isDir: true,
          size: 0,
          type: "other",
        });
      }

      // Add files
      for (const file of files) {
        const name = basename(file);
        const ext = extname(file);
        entries.push({
          path: file,
          name,
          ext,
          isDir: false,
          size: 0,
          type: classifyExt(ext),
        });
      }

      this._amEntries = entries;
      this._amApplySort();
      this._amApplySearch();
    }

    /** Sort entries in-place (directories always first). */
    _amApplySort(): void {
      const mult = sortDir === "desc" ? -1 : 1;
      this._amEntries.sort((a, b) => {
        // Dirs always first
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        // Among dirs, alphabetical only
        if (a.isDir) return a.name.localeCompare(b.name);
        // Among files, by selected field
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "size": cmp = a.size - b.size; break;
          case "type": cmp = a.type.localeCompare(b.type) || a.name.localeCompare(b.name); break;
        }
        return cmp * mult;
      });
    }

    /** Apply search filter + active filters + smart collection. */
    _amApplySearch(): void {
      let entries = this._amEntries;

      // Smart collection filter
      if (this._amCollection === "recent") {
        const recentPaths = new Set(getMetadataStore().getRecentFiles(50));
        entries = entries.filter((e) => !e.isDir && recentPaths.has(e.path));
      } else if (this._amCollection === "unoptimized") {
        entries = entries.filter((e) => !e.isDir && isConvertible(e.ext, e.type));
      } else if (this._amCollection === "images") {
        entries = entries.filter((e) => e.isDir || e.type === "image");
      } else if (this._amCollection === "audio") {
        entries = entries.filter((e) => e.isDir || e.type === "audio");
      } else if (this._amCollection === "video") {
        entries = entries.filter((e) => e.isDir || e.type === "video");
      }

      // Active filter chips
      for (const filter of this._amFilters) {
        if (filter.type === "asset-type") {
          entries = entries.filter((e) => e.isDir || e.type === filter.value);
        } else if (filter.type === "tag") {
          const tagged = new Set(getMetadataStore().getFilesByTag(filter.value));
          entries = entries.filter((e) => e.isDir || tagged.has(e.path));
        }
      }

      // Text search — matches filename, path, and tags
      const q = this._amSearch.toLowerCase().trim();
      if (q) {
        // Build a Set of tagged paths ONCE outside the filter loop (O(t) not O(n×t))
        const meta = getMetadataStore();
        const taggedPaths = new Set<string>();
        const exactTagFiles = meta.getFilesByTag(q);
        for (const f of exactTagFiles) taggedPaths.add(f);
        // Partial tag matches
        for (const tag of meta.getAllTags()) {
          if (tag.includes(q)) {
            for (const f of meta.getFilesByTag(tag)) taggedPaths.add(f);
          }
        }

        entries = entries.filter((e) => {
          if (e.name.toLowerCase().includes(q)) return true;
          if (e.path.toLowerCase().includes(q)) return true;
          return taggedPaths.has(e.path);
        });
      }

      this._amFiltered = entries;

      // Precompute unoptimized count (avoids re-iterating 8K items on every status update)
      let unopt = 0;
      for (const e of entries) {
        if (!e.isDir && isConvertible(e.ext, e.type)) unopt++;
      }
      this._amUnoptCount = unopt;
    }

    /**
     * Hide all base FilePicker PARTS.  Must run on EVERY render because
     * super._onRender() recreates/updates parts with fresh visible elements.
     */
    _amHideBaseParts(el: HTMLElement): void {
      const windowContent = el.querySelector(".window-content") ?? el;
      const baseParts = windowContent.querySelectorAll(":scope > *:not(.am-root)");
      baseParts.forEach((child) => {
        (child as HTMLElement).style.display = "none";
        child.querySelectorAll("[data-action]").forEach((a) => a.removeAttribute("data-action"));
      });
    }

    /**
     * Inject the full UI shell — toolbar, breadcrumbs, sidebar, content area —
     * with loading spinners in the content pane and sidebar folders section.
     * Called once on first render. File data is populated later by _amPopulateContent.
     */
    _amInjectShell(el: HTMLElement): void {
      const windowContent = el.querySelector(".window-content") ?? el;

      const amRoot = document.createElement("div");
      amRoot.className = "am-root";
      amRoot.innerHTML = this._amBuildShellHTML();
      windowContent.appendChild(amRoot);

      // Attach all event listeners to the shell
      this._amAttachListeners(amRoot);

      // Async server health check
      this._amCheckServerStatus(amRoot);
    }

    /**
     * Populate the content area and sidebar with parsed file data.
     * Called after _amParseResults completes (deferred on first load,
     * immediate on subsequent navigations).
     */
    _amPopulateContent(root: HTMLElement): void {
      // Use stable stored path — Foundry's this.request/target may be stale
      const target = this._amCurrentPath;
      const breadcrumbEl = root.querySelector<HTMLElement>(".am-breadcrumbs");
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = this._amBuildBreadcrumbs(target);
      }

      // Update sidebar with real folder data and counts
      this._amRefreshSidebar(root);

      // Update content area — rebuild scroller with real data
      this._amSetupScroller(root);

      // Update status bar
      this._amUpdateStatusBar(root);
    }

    /**
     * Build the UI shell with loading spinners.
     * The toolbar, search, view/density toggles are fully functional.
     * Content pane and sidebar folders show loading spinners.
     */
    _amBuildShellHTML(): string {
      const target = this._amCurrentPath;
      const breadcrumbs = this._amBuildBreadcrumbs(target);
      const thumbSize = DENSITY_SIZES[density];
      const c = this._amCollection;
      const meta = getMetadataStore();
      const allTags = meta.getAllTags();

      const tagPills = allTags.map((tag) => {
        const color = meta.getTagColor(tag);
        const active = this._amFilters.some((f) => f.type === "tag" && f.value === tag);
        return `<button class="am-tag-pill${active ? " am-tag-active" : ""}" data-am-tag="${esc(tag)}" type="button" style="--am-tag-color: ${color};">${esc(tag)}</button>`;
      }).join("");

      const filterChips = this._amBuildFilterChips();

      return `
        <div class="am-toolbar">
          <button class="am-sidebar-toggle" type="button" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="am-search-wrap">
            <i class="fa-solid fa-magnifying-glass am-search-icon"></i>
            <input type="search" class="am-search" placeholder="Search files..." autocomplete="off" value="${esc(this._amSearch)}" />
          </div>
          <div class="am-toolbar-controls">
            <div class="am-view-toggle">
              <button class="am-view-btn ${viewMode === "grid" ? "am-active" : ""}" data-am-view="grid" type="button" title="Grid view"><i class="fa-solid fa-grid-2"></i></button>
              <button class="am-view-btn ${viewMode === "list" ? "am-active" : ""}" data-am-view="list" type="button" title="List view"><i class="fa-solid fa-list"></i></button>
            </div>
            <div class="am-density-toggle">
              <button class="am-density-btn ${density === "small" ? "am-active" : ""}" data-am-density="small" type="button" title="Small">S</button>
              <button class="am-density-btn ${density === "medium" ? "am-active" : ""}" data-am-density="medium" type="button" title="Medium">M</button>
              <button class="am-density-btn ${density === "large" ? "am-active" : ""}" data-am-density="large" type="button" title="Large">L</button>
            </div>
            <button class="am-sort-btn" type="button" title="Sort: ${sortField} ${sortDir}">
              <i class="fa-solid fa-arrow-down-short-wide"></i>
            </button>
            <button class="am-batch-btn" type="button" title="Batch optimize images in this folder">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </button>
            <button class="am-upload-btn" type="button" title="Upload files">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
        ${filterChips}
        <div class="am-breadcrumbs">${breadcrumbs}</div>
        <div class="am-body${sidebarOpen ? "" : " am-sidebar-collapsed"}">
          <div class="am-sidebar">
            <div class="am-sb-section">
              <div class="am-sb-label">Collections</div>
              <button class="am-sb-item${c === "all" ? " am-sb-active" : ""}" data-am-collection="all" type="button">
                <i class="fa-solid fa-folder-open"></i><span>All Files</span>
              </button>
              <button class="am-sb-item${c === "recent" ? " am-sb-active" : ""}" data-am-collection="recent" type="button">
                <i class="fa-solid fa-clock-rotate-left"></i><span>Recent</span>
              </button>
              <button class="am-sb-item${c === "unoptimized" ? " am-sb-active" : ""}" data-am-collection="unoptimized" type="button">
                <i class="fa-solid fa-triangle-exclamation"></i><span>Unoptimized</span>
              </button>
            </div>
            <div class="am-sb-section">
              <div class="am-sb-label">By Type</div>
              <button class="am-sb-item${c === "images" ? " am-sb-active" : ""}" data-am-collection="images" type="button">
                <i class="fa-solid fa-image"></i><span>Images</span>
              </button>
              <button class="am-sb-item${c === "audio" ? " am-sb-active" : ""}" data-am-collection="audio" type="button">
                <i class="fa-solid fa-music"></i><span>Audio</span>
              </button>
              <button class="am-sb-item${c === "video" ? " am-sb-active" : ""}" data-am-collection="video" type="button">
                <i class="fa-solid fa-film"></i><span>Video</span>
              </button>
            </div>
            <div class="am-sb-section">
              <div class="am-sb-label">Folders</div>
              <div class="am-sb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading\u2026</div>
            </div>
            <div class="am-sb-section">
              <div class="am-sb-label">Tags</div>
              <div class="am-sb-tags">
                ${tagPills || `<span class="am-sb-empty">No tags yet</span>`}
              </div>
              <button class="am-sb-item am-sb-add-tag" type="button">
                <i class="fa-solid fa-plus"></i><span>Add Tag</span>
              </button>
            </div>
            <div class="am-sb-section am-sb-actions">
              <button class="am-sb-item am-sb-export" type="button">
                <i class="fa-solid fa-download"></i><span>Export</span>
              </button>
              <button class="am-sb-item am-sb-import" type="button">
                <i class="fa-solid fa-upload"></i><span>Import</span>
              </button>
            </div>
          </div>
          <div class="am-content-wrap">
            <div class="am-content" data-density="${density}" data-view="${viewMode}" style="--am-thumb-size: ${thumbSize}px;">
              <div class="am-content-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Loading files\u2026</span>
              </div>
            </div>
            <div class="am-preview">
              <!-- Preview panel content injected dynamically -->
            </div>
            <div class="am-drop-overlay">
              <i class="fa-solid fa-cloud-arrow-up am-drop-icon"></i>
              <span class="am-drop-label">Drop files to upload</span>
              <span class="am-drop-hint">Images will be optimized automatically</span>
            </div>
          </div>
        </div>
        <div class="am-upload-queue">
          <!-- Upload queue items injected dynamically -->
        </div>
        <div class="am-status-bar">
          <span class="am-status-count">Loading\u2026</span>
          <div class="am-batch-progress" style="display:none;">
            <div class="am-batch-progress-track">
              <div class="am-batch-progress-fill"></div>
            </div>
          </div>
          <span class="am-thumb-info" title="Thumbnail cache info">
            <i class="fa-solid fa-images"></i>
            <span class="am-thumb-info-label">Thumbs</span>
          </span>
          <span class="am-server-status" title="Checking optimizer server...">
            <i class="fa-solid fa-circle am-server-dot am-server-checking"></i>
            <span class="am-server-label">Server</span>
          </span>
        </div>
      `;
    }

    /** Build the complete asset manager HTML. */
    _amBuildHTML(): string {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = (this as any).request || (this as any).target || "";
      const breadcrumbs = this._amBuildBreadcrumbs(target);
      const thumbSize = DENSITY_SIZES[density];
      const hasPreview = this._amPreviewPath !== null;
      const sidebar = this._amBuildSidebar();
      const filterChips = this._amBuildFilterChips();

      return `
        <div class="am-toolbar">
          <button class="am-sidebar-toggle" type="button" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="am-search-wrap">
            <i class="fa-solid fa-magnifying-glass am-search-icon"></i>
            <input type="search" class="am-search" placeholder="Search files..." autocomplete="off" value="${esc(this._amSearch)}" />
          </div>
          <div class="am-toolbar-controls">
            <div class="am-view-toggle">
              <button class="am-view-btn ${viewMode === "grid" ? "am-active" : ""}" data-am-view="grid" type="button" title="Grid view"><i class="fa-solid fa-grid-2"></i></button>
              <button class="am-view-btn ${viewMode === "list" ? "am-active" : ""}" data-am-view="list" type="button" title="List view"><i class="fa-solid fa-list"></i></button>
            </div>
            <div class="am-density-toggle">
              <button class="am-density-btn ${density === "small" ? "am-active" : ""}" data-am-density="small" type="button" title="Small">S</button>
              <button class="am-density-btn ${density === "medium" ? "am-active" : ""}" data-am-density="medium" type="button" title="Medium">M</button>
              <button class="am-density-btn ${density === "large" ? "am-active" : ""}" data-am-density="large" type="button" title="Large">L</button>
            </div>
            <button class="am-sort-btn" type="button" title="Sort: ${sortField} ${sortDir}">
              <i class="fa-solid fa-arrow-down-short-wide"></i>
            </button>
            <button class="am-batch-btn" type="button" title="Batch optimize images in this folder">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </button>
            <button class="am-upload-btn" type="button" title="Upload files">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
        ${filterChips}
        <div class="am-breadcrumbs">${breadcrumbs}</div>
        <div class="am-body${sidebarOpen ? "" : " am-sidebar-collapsed"}">
          ${sidebar}
          <div class="am-content-wrap${hasPreview ? " am-has-preview" : ""}">
            <div class="am-content" data-density="${density}" data-view="${viewMode}" style="--am-thumb-size: ${thumbSize}px;">
              <!-- Virtual scroller injects content here -->
            </div>
            <div class="am-preview${hasPreview ? " am-preview-open" : ""}">
              <!-- Preview panel content injected dynamically -->
            </div>
            <div class="am-drop-overlay">
              <i class="fa-solid fa-cloud-arrow-up am-drop-icon"></i>
              <span class="am-drop-label">Drop files to upload</span>
              <span class="am-drop-hint">Images will be optimized automatically</span>
            </div>
          </div>
        </div>
        <div class="am-upload-queue">
          <!-- Upload queue items injected dynamically -->
        </div>
        <div class="am-status-bar">
          <span class="am-status-count">${this._amFiltered.length} items</span>
          <div class="am-batch-progress" style="display:none;">
            <div class="am-batch-progress-track">
              <div class="am-batch-progress-fill"></div>
            </div>
          </div>
          <span class="am-thumb-info" title="Thumbnail cache info">
            <i class="fa-solid fa-images"></i>
            <span class="am-thumb-info-label">Thumbs</span>
          </span>
          <span class="am-server-status" title="Checking optimizer server...">
            <i class="fa-solid fa-circle am-server-dot am-server-checking"></i>
            <span class="am-server-label">Server</span>
          </span>
        </div>
      `;
    }

    /** Build sidebar HTML with smart collections, folders, and tags. */
    _amBuildSidebar(): string {
      const meta = getMetadataStore();
      const allTags = meta.getAllTags();
      const c = this._amCollection;

      // Single-pass counts + dir collection
      let imgCount = 0, audCount = 0, vidCount = 0, unoptCount = 0;
      const dirs: AssetEntry[] = [];
      for (const e of this._amEntries) {
        if (e.isDir) { dirs.push(e); continue; }
        if (e.type === "image") imgCount++;
        else if (e.type === "audio") audCount++;
        else if (e.type === "video") vidCount++;
        if (isConvertible(e.ext, e.type)) unoptCount++;
      }

      const tagPills = allTags.map((tag) => {
        const color = meta.getTagColor(tag);
        const active = this._amFilters.some((f) => f.type === "tag" && f.value === tag);
        return `<button class="am-tag-pill${active ? " am-tag-active" : ""}" data-am-tag="${esc(tag)}" type="button" style="--am-tag-color: ${color};">${esc(tag)}</button>`;
      }).join("");

      return `
        <div class="am-sidebar">
          <div class="am-sb-section">
            <div class="am-sb-label">Collections</div>
            <button class="am-sb-item${c === "all" ? " am-sb-active" : ""}" data-am-collection="all" type="button">
              <i class="fa-solid fa-folder-open"></i><span>All Files</span>
            </button>
            <button class="am-sb-item${c === "recent" ? " am-sb-active" : ""}" data-am-collection="recent" type="button">
              <i class="fa-solid fa-clock-rotate-left"></i><span>Recent</span>
            </button>
            <button class="am-sb-item${c === "unoptimized" ? " am-sb-active" : ""}" data-am-collection="unoptimized" type="button">
              <i class="fa-solid fa-triangle-exclamation"></i><span>Unoptimized</span>${unoptCount ? `<span class="am-sb-count">${unoptCount}</span>` : ""}
            </button>
          </div>
          <div class="am-sb-section">
            <div class="am-sb-label">By Type</div>
            <button class="am-sb-item${c === "images" ? " am-sb-active" : ""}" data-am-collection="images" type="button">
              <i class="fa-solid fa-image"></i><span>Images</span>${imgCount ? `<span class="am-sb-count">${imgCount}</span>` : ""}
            </button>
            <button class="am-sb-item${c === "audio" ? " am-sb-active" : ""}" data-am-collection="audio" type="button">
              <i class="fa-solid fa-music"></i><span>Audio</span>${audCount ? `<span class="am-sb-count">${audCount}</span>` : ""}
            </button>
            <button class="am-sb-item${c === "video" ? " am-sb-active" : ""}" data-am-collection="video" type="button">
              <i class="fa-solid fa-film"></i><span>Video</span>${vidCount ? `<span class="am-sb-count">${vidCount}</span>` : ""}
            </button>
          </div>
          ${dirs.length > 0 ? `
          <div class="am-sb-section">
            <div class="am-sb-label">Folders</div>
            ${dirs.slice(0, 15).map((d) => `
              <button class="am-sb-item am-sb-folder" data-am-path="${esc(d.path)}" type="button">
                <i class="fa-solid fa-folder"></i><span>${esc(d.name)}</span>
              </button>
            `).join("")}
            ${dirs.length > 15 ? `<span class="am-sb-more">+${dirs.length - 15} more</span>` : ""}
          </div>
          ` : ""}
          <div class="am-sb-section">
            <div class="am-sb-label">Tags</div>
            <div class="am-sb-tags">
              ${tagPills || `<span class="am-sb-empty">No tags yet</span>`}
            </div>
            <button class="am-sb-item am-sb-add-tag" type="button">
              <i class="fa-solid fa-plus"></i><span>Add Tag</span>
            </button>
          </div>
          <div class="am-sb-section am-sb-actions">
            <button class="am-sb-item am-sb-export" type="button">
              <i class="fa-solid fa-download"></i><span>Export</span>
            </button>
            <button class="am-sb-item am-sb-import" type="button">
              <i class="fa-solid fa-upload"></i><span>Import</span>
            </button>
          </div>
        </div>
      `;
    }

    /** Build active filter chips HTML. */
    _amBuildFilterChips(): string {
      if (this._amFilters.length === 0 && this._amCollection === "all") return "";

      let chips = "";

      if (this._amCollection !== "all") {
        const labels: Record<SmartCollection, string> = {
          all: "", recent: "Recent", unoptimized: "Unoptimized",
          images: "Images", audio: "Audio", video: "Video",
        };
        chips += `<span class="am-chip am-chip-collection" data-am-chip-collection="${this._amCollection}">
          ${labels[this._amCollection]}<button class="am-chip-remove" type="button"><i class="fa-solid fa-xmark"></i></button>
        </span>`;
      }

      for (const filter of this._amFilters) {
        const label = filter.type === "tag" ? filter.value : filter.value;
        chips += `<span class="am-chip am-chip-${filter.type}" data-am-chip-type="${filter.type}" data-am-chip-value="${esc(filter.value)}">
          ${esc(label)}<button class="am-chip-remove" type="button"><i class="fa-solid fa-xmark"></i></button>
        </span>`;
      }

      return `<div class="am-filter-bar">${chips}</div>`;
    }

    /** Build breadcrumb HTML from a path. */
    _amBuildBreadcrumbs(path: string): string {
      const segments = path.split("/").filter(Boolean);
      let html = `<button class="am-crumb" data-am-path="" type="button"><i class="fa-solid fa-house-chimney"></i></button>`;

      // "Up a level" button — only show when inside a subfolder
      if (segments.length > 0) {
        const parentPath = segments.slice(0, -1).join("/");
        html += `<button class="am-crumb am-crumb-up" data-am-path="${esc(parentPath)}" type="button" title="Up a level"><i class="fa-solid fa-arrow-up"></i></button>`;
      }

      let cumPath = "";
      for (const seg of segments) {
        cumPath += (cumPath ? "/" : "") + seg;
        html += `<span class="am-crumb-sep"><i class="fa-solid fa-chevron-right"></i></span>`;
        html += `<button class="am-crumb" data-am-path="${esc(cumPath)}" type="button">${esc(seg)}</button>`;
      }

      // Delete button — right-aligned, starts disabled
      html += `<button class="am-crumb-delete" type="button" title="Delete selected files"><i class="fa-solid fa-trash"></i></button>`;

      return html;
    }

    /** Get a type-specific icon for non-media file extensions. */
    _amGetFileIcon(ext: string): string {
      const codeExts = new Set(["json", "js", "ts", "html", "css", "xml", "yaml", "yml", "toml", "csv"]);
      const textExts = new Set(["txt", "md", "log", "ini", "cfg"]);
      const archiveExts = new Set(["zip", "tar", "gz", "rar", "7z"]);
      const pdfExts = new Set(["pdf"]);
      if (codeExts.has(ext)) return `<i class="fa-solid fa-file-code am-card-placeholder"></i>`;
      if (textExts.has(ext)) return `<i class="fa-solid fa-file-lines am-card-placeholder"></i>`;
      if (archiveExts.has(ext)) return `<i class="fa-solid fa-file-zipper am-card-placeholder"></i>`;
      if (pdfExts.has(ext)) return `<i class="fa-solid fa-file-pdf am-card-placeholder"></i>`;
      return `<i class="fa-solid fa-file am-card-placeholder"></i>`;
    }

    /** Render a single grid card for a file/directory. */
    _amRenderGridItem(entry: AssetEntry): string {
      if (entry.isDir) {
        return `
          <div class="am-card am-card-dir" data-am-path="${esc(entry.path)}">
            <div class="am-card-thumb am-card-thumb-dir">
              <i class="fa-solid fa-folder"></i>
              <button class="am-dir-delete" type="button" title="Delete folder" data-am-dir-delete="${esc(entry.path)}"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="am-card-name" title="${esc(entry.name)}">${esc(entry.name)}</div>
          </div>
        `;
      }

      const typeBadge = entry.type !== "other"
        ? `<span class="am-badge am-badge-${entry.type}">${entry.type.toUpperCase()}</span>`
        : "";

      // Optimization status badge
      const canConvert = isConvertible(entry.ext, entry.type);
      const optBadge = canConvert
        ? `<span class="am-opt-badge am-opt-convertible" title="Can be optimized"><i class="fa-solid fa-triangle-exclamation"></i></span>`
        : "";

      const thumbContent = entry.type === "image"
        ? `<img loading="lazy" decoding="async" data-am-src="${esc(entry.path)}" alt="" class="am-card-img" />`
        : entry.type === "audio"
          ? `<i class="fa-solid fa-music am-card-placeholder"></i>`
          : entry.type === "video"
            ? `<i class="fa-solid fa-film am-card-placeholder"></i>`
            : this._amGetFileIcon(entry.ext);

      return `
        <div class="am-card am-card-file" data-am-path="${esc(entry.path)}" data-am-type="${entry.type}">
          <div class="am-card-thumb">
            ${typeBadge}
            ${optBadge}
            ${thumbContent}
          </div>
          <div class="am-card-name" title="${esc(entry.name)}">${esc(entry.name)}</div>
        </div>
      `;
    }

    /** Render a single list row for a file/directory. */
    _amRenderListItem(entry: AssetEntry): string {
      if (entry.isDir) {
        return `
          <div class="am-list-row am-list-dir" data-am-path="${esc(entry.path)}">
            <i class="fa-solid fa-folder am-list-icon"></i>
            <span class="am-list-name">${esc(entry.name)}</span>
            <button class="am-dir-delete" type="button" title="Delete folder" data-am-dir-delete="${esc(entry.path)}"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
      }

      const thumbContent = entry.type === "image"
        ? `<img loading="lazy" decoding="async" data-am-src="${esc(entry.path)}" alt="" class="am-list-thumb-img" />`
        : "";

      return `
        <div class="am-list-row am-list-file" data-am-path="${esc(entry.path)}" data-am-type="${entry.type}">
          <div class="am-list-thumb">${thumbContent || (
            entry.type === "audio" ? `<i class="fa-solid fa-music am-list-icon-sm"></i>`
            : entry.type === "video" ? `<i class="fa-solid fa-film am-list-icon-sm"></i>`
            : `<i class="fa-solid fa-file am-list-icon-sm"></i>`
          )}</div>
          <span class="am-list-name">${esc(entry.name)}</span>
          <span class="am-list-ext">${entry.ext.toUpperCase()}</span>
          <span class="am-list-type am-badge-${entry.type}">${entry.type}</span>
        </div>
      `;
    }

    /** Setup virtual scroller for the content area. */
    _amSetupScroller(root: HTMLElement): void {
      const content = root.querySelector<HTMLElement>(".am-content");
      if (!content) return;

      // Destroy old scroller
      if (this._amScroller) {
        this._amScroller.destroy();
        this._amScroller = null;
      }

      // Clear any loading indicators or stale content before rebuilding
      content.innerHTML = "";

      const thumbSize = DENSITY_SIZES[density];
      const isGrid = viewMode === "grid";
      const gap = 6;
      const padding = 8;

      if (isGrid) {
        const containerWidth = content.clientWidth - padding * 2;
        const itemsPerRow = Math.max(1, Math.floor((containerWidth + gap) / (thumbSize + gap)));
        const cardHeight = thumbSize + 30; // thumb + name + padding
        const rowHeight = cardHeight + gap;

        this._amScroller = new VirtualScroller({
          container: content,
          rowHeight,
          itemsPerRow,
          totalItems: this._amFiltered.length,
          overscan: 2,
          renderItem: (i) => {
            const entry = this._amFiltered[i];
            return entry ? this._amRenderGridItem(entry) : "";
          },
        });
      } else {
        // List view
        const rowHeight = 44;
        this._amScroller = new VirtualScroller({
          container: content,
          rowHeight,
          itemsPerRow: 1,
          totalItems: this._amFiltered.length,
          overscan: 5,
          renderItem: (i) => {
            const entry = this._amFiltered[i];
            return entry ? this._amRenderListItem(entry) : "";
          },
        });
      }

      // Setup IntersectionObserver for lazy image loading
      this._amSetupLazyImages(content);
    }

    /**
     * Setup IntersectionObserver for lazy loading images via thumb cache.
     * Reuses observers across scroller rebuilds to avoid leaks.
     */
    _amSetupLazyImages(container: HTMLElement): void {
      // Disconnect previous observers (no leak on repeated calls)
      if (this._amImgObserver) this._amImgObserver.disconnect();
      if (this._amMutObserver) this._amMutObserver.disconnect();

      const thumbSize = DENSITY_SIZES[density];
      const cache = getThumbCache();
      const useServer = isOptimizerConfigured();

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.amSrc;
            if (!src || img.dataset.amLoading) continue;

            img.dataset.amLoading = "1";
            observer.unobserve(img);

            // Prefer server thumbnail URL (browser HTTP cache handles caching)
            if (useServer) {
              const serverUrl = getServerThumbUrl(src);
              if (serverUrl) {
                img.src = serverUrl;
                img.decode().catch(() => { /* ignore */ });
                continue;
              }
            }

            // Fallback: client-side thumb cache via Web Worker + IndexedDB
            cache.getThumbUrl(src, thumbSize).then((thumbUrl) => {
              if (thumbUrl) img.src = thumbUrl;
              else img.src = src;
              img.decode().catch(() => { /* ignore */ });
            }).catch(() => {
              img.src = src;
              img.decode().catch(() => { /* ignore */ });
            });
          }
        },
        { root: container, rootMargin: "200px" },
      );
      this._amImgObserver = observer;

      // MutationObserver to catch images injected by virtual scroller.
      // Throttled to avoid excessive queries from Foundry tooltip/DOM mutations.
      let mutPending = false;
      const mutObserver = new MutationObserver(() => {
        if (mutPending) return;
        mutPending = true;
        requestAnimationFrame(() => {
          mutPending = false;
          const images = container.querySelectorAll<HTMLImageElement>("img[data-am-src]:not([src])");
          images.forEach((img) => observer.observe(img));
        });
      });
      mutObserver.observe(container, { childList: true, subtree: true });
      this._amMutObserver = mutObserver;

      // Observe already-present images
      const images = container.querySelectorAll<HTMLImageElement>("img[data-am-src]:not([src])");
      images.forEach((img) => observer.observe(img));
    }

    /** Attach event listeners to the AM UI. */
    _amAttachListeners(root: HTMLElement): void {
      // Search
      const searchInput = root.querySelector<HTMLInputElement>(".am-search");
      if (searchInput) {
        let searchTimer: ReturnType<typeof setTimeout> | null = null;
        searchInput.addEventListener("input", () => {
          if (searchTimer) clearTimeout(searchTimer);
          searchTimer = setTimeout(() => {
            this._amSearch = searchInput.value;
            this._amApplySearch();
            this._amRefreshContent(root);
          }, 150);
        });
      }

      // Delegate all clicks on the root
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;

        // View toggle
        const viewBtn = target.closest<HTMLElement>("[data-am-view]");
        if (viewBtn) {
          const newView = viewBtn.dataset.amView as ViewMode;
          if (newView && newView !== viewMode) {
            viewMode = newView;
            try { localStorage.setItem(LS_VIEW, viewMode); } catch { /* */ }
            this._amRefreshUI(root);
          }
          return;
        }

        // Density toggle
        const densityBtn = target.closest<HTMLElement>("[data-am-density]");
        if (densityBtn) {
          const newDensity = densityBtn.dataset.amDensity as GridDensity;
          if (newDensity && newDensity !== density) {
            density = newDensity;
            try { localStorage.setItem(LS_DENSITY, density); } catch { /* */ }
            this._amRefreshUI(root);
          }
          return;
        }

        // Sort button
        if (target.closest(".am-sort-btn")) {
          // Cycle through sort options
          const fields: SortField[] = ["name", "size", "type"];
          const idx = fields.indexOf(sortField);
          if (sortDir === "asc") {
            sortDir = "desc";
          } else {
            sortDir = "asc";
            sortField = fields[(idx + 1) % fields.length]!;
          }
          try { localStorage.setItem(LS_SORT, JSON.stringify({ field: sortField, dir: sortDir })); } catch { /* */ }
          this._amApplySort();
          this._amApplySearch();
          this._amRefreshContent(root);
          // Update sort button title
          const sortBtn = root.querySelector<HTMLElement>(".am-sort-btn");
          if (sortBtn) sortBtn.title = `Sort: ${sortField} ${sortDir}`;
          return;
        }

        // Delete button in breadcrumbs
        if (target.closest(".am-crumb-delete")) {
          this._amDeleteSelected(root);
          return;
        }

        // Thumbnail cache info button
        if (target.closest(".am-thumb-info")) {
          this._amToggleThumbPopup(root);
          return;
        }

        // Dismiss thumb popup when clicking elsewhere
        if (!target.closest(".am-thumb-popup")) {
          const popup = root.querySelector(".am-thumb-popup");
          if (popup) popup.remove();
        }

        // Breadcrumb navigation
        const crumb = target.closest<HTMLElement>("[data-am-path]");
        if (crumb && crumb.classList.contains("am-crumb")) {
          const path = crumb.dataset.amPath ?? "";
          this._amBrowse(path);
          return;
        }

        // Folder delete button — intercept before directory navigation
        const dirDeleteBtn = target.closest<HTMLElement>("[data-am-dir-delete]");
        if (dirDeleteBtn) {
          const folderPath = dirDeleteBtn.dataset.amDirDelete;
          if (folderPath) {
            this._amMultiSelect.clear();
            this._amMultiSelect.add(folderPath);
            this._amDeleteSelected(root);
          }
          return;
        }

        // Directory navigation
        const dirCard = target.closest<HTMLElement>(".am-card-dir, .am-list-dir");
        if (dirCard) {
          const path = dirCard.dataset.amPath;
          if (path) this._amBrowse(path);
          return;
        }

        // File selection + preview (with multi-select support)
        const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
        if (fileCard) {
          const path = fileCard.dataset.amPath;
          if (!path) return;

          if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+click: toggle in multi-select
            if (this._amMultiSelect.has(path)) {
              this._amMultiSelect.delete(path);
            } else {
              this._amMultiSelect.add(path);
            }
            this._amRenderMultiSelect(root);
            this._amLastClickIdx = this._amFiltered.findIndex((f) => f.path === path);
          } else if (e.shiftKey && this._amLastClickIdx >= 0) {
            // Shift+click: range select
            const clickIdx = this._amFiltered.findIndex((f) => f.path === path);
            if (clickIdx >= 0) {
              const start = Math.min(this._amLastClickIdx, clickIdx);
              const end = Math.max(this._amLastClickIdx, clickIdx);
              for (let i = start; i <= end; i++) {
                const entry = this._amFiltered[i];
                if (entry && !entry.isDir) this._amMultiSelect.add(entry.path);
              }
              this._amRenderMultiSelect(root);
            }
          } else {
            // Normal click: single select
            this._amMultiSelect.clear();
            this._amSelectFile(path, root);
            this._amShowPreview(path, root);
            this._amLastClickIdx = this._amFiltered.findIndex((f) => f.path === path);
          }
          this._amUpdateStatusBar(root);
          return;
        }
      });

      // Double-click to confirm file selection
      root.addEventListener("dblclick", (e) => {
        const target = e.target as HTMLElement;
        const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
        if (fileCard) {
          const path = fileCard.dataset.amPath;
          if (path) this._amConfirmSelection(path);
        }
      });

      // Right-click context menu on files
      root.addEventListener("contextmenu", (e) => {
        const target = e.target as HTMLElement;
        const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
        if (fileCard) {
          e.preventDefault();
          const path = fileCard.dataset.amPath;
          if (path) {
            showContextMenu(e.clientX, e.clientY, path, (action, filePath) => {
              this._amHandleContextAction(action, filePath, root);
            });
          }
        }
      });

      // Long-press for touch context menu
      root.addEventListener("touchstart", (e) => {
        const target = e.target as HTMLElement;
        const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
        if (fileCard) {
          const path = fileCard.dataset.amPath;
          if (path) {
            const touch = e.touches[0];
            if (!touch) return;
            const cleanup = startLongPress(touch.clientX, touch.clientY, path, (action, filePath) => {
              this._amHandleContextAction(action, filePath, root);
            });
            const onEnd = () => {
              cleanup();
              root.removeEventListener("touchend", onEnd);
              root.removeEventListener("touchmove", onEnd);
            };
            root.addEventListener("touchend", onEnd, { once: true });
            root.addEventListener("touchmove", onEnd, { once: true });
          }
        }
      }, { passive: true });

      // Preview panel action buttons
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const actionBtn = target.closest<HTMLElement>("[data-am-action]");
        if (!actionBtn) return;

        const action = actionBtn.dataset.amAction;
        if (action === "copy-path" && this._amPreviewPath) {
          navigator.clipboard.writeText(this._amPreviewPath).catch(() => { /* ignore */ });
          // Flash feedback
          actionBtn.style.color = "#66bb6a";
          setTimeout(() => { actionBtn.style.color = ""; }, 600);
        } else if (action === "select-file" && this._amPreviewPath) {
          this._amConfirmSelection(this._amPreviewPath);
        }
      });

      // Preview close button
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".am-preview-close")) {
          this._amClosePreview(root);
        }
      });

      // Upload button — trigger hidden file input
      const uploadBtn = root.querySelector<HTMLElement>(".am-upload-btn");
      if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.style.display = "none";
          input.addEventListener("change", () => {
            const files = input.files;
            if (files && files.length) this._amHandleUpload(Array.from(files), root);
            input.remove();
          });
          document.body.appendChild(input);
          input.click();
        });
      }

      // Batch optimize button
      const batchBtn = root.querySelector<HTMLElement>(".am-batch-btn");
      if (batchBtn) {
        batchBtn.addEventListener("click", () => this._amBatchOptimize(root));
      }

      // Drag-and-drop on the content wrap
      const contentWrap = root.querySelector<HTMLElement>(".am-content-wrap");
      if (contentWrap) {
        contentWrap.addEventListener("dragenter", (e) => {
          e.preventDefault();
          this._amDragCounter++;
          contentWrap.classList.add("am-drag-active");
        });
        contentWrap.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        });
        contentWrap.addEventListener("dragleave", (e) => {
          e.preventDefault();
          this._amDragCounter--;
          if (this._amDragCounter <= 0) {
            this._amDragCounter = 0;
            contentWrap.classList.remove("am-drag-active");
          }
        });
        contentWrap.addEventListener("drop", (e) => {
          e.preventDefault();
          this._amDragCounter = 0;
          contentWrap.classList.remove("am-drag-active");
          const files = e.dataTransfer?.files;
          if (files && files.length) this._amHandleUpload(Array.from(files), root);
        });
      }

      // Upload queue close button
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".am-uq-close")) {
          const queueEl = root.querySelector<HTMLElement>(".am-upload-queue");
          if (queueEl) {
            queueEl.innerHTML = "";
            queueEl.classList.remove("am-uq-visible");
          }
          if (this._amUploader) this._amUploader.clear();
        }
      });

      // Preset selector buttons (delegated, inside upload queue)
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const presetBtn = target.closest<HTMLElement>("[data-am-preset]");
        if (presetBtn) {
          const preset = presetBtn.dataset.amPreset as OptPreset;
          if (preset) {
            this._amUploadPreset = preset;
            root.querySelectorAll(".am-preset-btn").forEach((b) => b.classList.remove("am-active"));
            presetBtn.classList.add("am-active");
          }
        }
      });

      // Sidebar toggle
      root.querySelector(".am-sidebar-toggle")?.addEventListener("click", () => {
        sidebarOpen = !sidebarOpen;
        try { localStorage.setItem(LS_SIDEBAR, String(sidebarOpen)); } catch { /* */ }
        const body = root.querySelector<HTMLElement>(".am-body");
        body?.classList.toggle("am-sidebar-collapsed", !sidebarOpen);
        // Recalculate grid after sidebar animation
        setTimeout(() => this._amSetupScroller(root), 220);
      });

      // Smart collection buttons
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const collBtn = target.closest<HTMLElement>("[data-am-collection]");
        if (collBtn) {
          this._amCollection = (collBtn.dataset.amCollection ?? "all") as SmartCollection;
          this._amApplySearch();
          this._amRefreshUI(root);
          return;
        }

        // Sidebar folder navigation
        const sbFolder = target.closest<HTMLElement>(".am-sb-folder[data-am-path]");
        if (sbFolder) {
          const path = sbFolder.dataset.amPath;
          if (path) this._amBrowse(path);
          return;
        }
      });

      // Tag pill filter toggle
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tagPill = target.closest<HTMLElement>("[data-am-tag]");
        if (tagPill) {
          const tag = tagPill.dataset.amTag;
          if (!tag) return;
          const idx = this._amFilters.findIndex((f) => f.type === "tag" && f.value === tag);
          if (idx >= 0) {
            this._amFilters.splice(idx, 1);
          } else {
            this._amFilters.push({ type: "tag", value: tag });
          }
          this._amApplySearch();
          this._amRefreshUI(root);
        }
      });

      // Filter chip removal
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const removeBtn = target.closest<HTMLElement>(".am-chip-remove");
        if (!removeBtn) return;
        const chip = removeBtn.closest<HTMLElement>(".am-chip");
        if (!chip) return;

        if (chip.classList.contains("am-chip-collection")) {
          this._amCollection = "all";
        } else {
          const chipType = chip.dataset.amChipType;
          const chipValue = chip.dataset.amChipValue;
          this._amFilters = this._amFilters.filter(
            (f) => !(f.type === chipType && f.value === chipValue),
          );
        }
        this._amApplySearch();
        this._amRefreshUI(root);
      });

      // Add tag button (prompt)
      root.querySelector(".am-sb-add-tag")?.addEventListener("click", () => {
        if (!this._amPreviewPath) {
          // Global tag creation — prompt for tag name
          const name = prompt("Enter new tag name:");
          if (!name?.trim()) return;
          const tag = name.trim().toLowerCase();
          getMetadataStore().setTagColor(tag, this._amNextTagColor()).catch(() => { /* ignore */ });
          this._amRefreshUI(root);
          return;
        }
      });

      // Export metadata
      root.querySelector(".am-sb-export")?.addEventListener("click", async () => {
        try {
          const snapshot = await getMetadataStore().exportSnapshot();
          const json = JSON.stringify(snapshot, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "fth-asset-metadata.json";
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          Log.warn("Asset Manager: export failed", err);
        }
      });

      // Import metadata
      root.querySelector(".am-sb-import")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.style.display = "none";
        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const snapshot = JSON.parse(text) as MetadataSnapshot;
            const result = await getMetadataStore().importSnapshot(snapshot);
            Log.info(`Asset Manager: imported ${result.added} new, ${result.updated} updated`);
            this._amRefreshUI(root);
          } catch (err) {
            Log.warn("Asset Manager: import failed", err);
          }
          input.remove();
        });
        document.body.appendChild(input);
        input.click();
      });

      // ── Keyboard Navigation ────────────────────────────────
      root.setAttribute("tabindex", "0");
      root.addEventListener("keydown", (e) => {
        const key = e.key;
        const searchFocused = document.activeElement?.classList.contains("am-search");

        // "/" focuses search (when not already in search)
        if (key === "/" && !searchFocused) {
          e.preventDefault();
          const search = root.querySelector<HTMLInputElement>(".am-search");
          search?.focus();
          return;
        }

        // Escape: blur search or close preview
        if (key === "Escape") {
          if (searchFocused) {
            (document.activeElement as HTMLElement)?.blur();
          } else if (this._amPreviewPath) {
            this._amClosePreview(root);
          }
          return;
        }

        // Don't handle navigation keys when search is focused
        if (searchFocused) return;

        // Backspace: go up a directory
        if (key === "Backspace") {
          e.preventDefault();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const curTarget = (this as any).request || (this as any).target || "";
          const parent = curTarget.split("/").slice(0, -1).join("/");
          this._amBrowse(parent);
          return;
        }

        // Ctrl+A / Cmd+A: select all files
        if ((e.ctrlKey || e.metaKey) && key === "a") {
          e.preventDefault();
          this._amMultiSelect.clear();
          for (const entry of this._amFiltered) {
            if (!entry.isDir) this._amMultiSelect.add(entry.path);
          }
          this._amRenderMultiSelect(root);
          this._amUpdateStatusBar(root);
          return;
        }

        // Arrow keys: navigate selection
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
          e.preventDefault();
          this._amKeyboardNavigate(key, root);
          return;
        }

        // Enter: confirm current selection / open directory
        if (key === "Enter") {
          e.preventDefault();
          const selectedPath = this._amGetSelectedPath(root);
          if (!selectedPath) return;
          const entry = this._amFiltered.find((f) => f.path === selectedPath);
          if (entry?.isDir) {
            this._amBrowse(selectedPath);
          } else if (entry) {
            this._amConfirmSelection(selectedPath);
          }
          return;
        }

        // Space: toggle multi-select on current item
        if (key === " ") {
          e.preventDefault();
          const selectedPath = this._amGetSelectedPath(root);
          if (!selectedPath) return;
          const entry = this._amFiltered.find((f) => f.path === selectedPath);
          if (entry && !entry.isDir) {
            if (this._amMultiSelect.has(selectedPath)) {
              this._amMultiSelect.delete(selectedPath);
            } else {
              this._amMultiSelect.add(selectedPath);
            }
            this._amRenderMultiSelect(root);
            this._amUpdateStatusBar(root);
          }
          return;
        }
      });
    }

    /** Navigate to a directory (with browse cache). */
    _amBrowse(path: string): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;
      if (typeof self.browse !== "function") return;

      // Store path so it survives re-entrant _onRender calls
      this._amCurrentPath = path;

      // Show loading state in content pane immediately before browse
      const root = this.element?.querySelector?.(".am-root") as HTMLElement | null;
      if (root) {
        // Update breadcrumbs to reflect the new path
        const breadcrumbEl = root.querySelector<HTMLElement>(".am-breadcrumbs");
        if (breadcrumbEl) breadcrumbEl.innerHTML = this._amBuildBreadcrumbs(path);

        // Show loading spinner in the content pane
        const content = root.querySelector<HTMLElement>(".am-content");
        if (content) {
          // Destroy old scroller to free it
          if (this._amScroller) { this._amScroller.destroy(); this._amScroller = null; }
          content.innerHTML = `<div class="am-content-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading files\u2026</span></div>`;
        }

        // Show loading in sidebar folders section
        const sidebar = root.querySelector<HTMLElement>(".am-sidebar");
        if (sidebar) {
          // Replace folder section with loading
          const folderSections = sidebar.querySelectorAll<HTMLElement>(".am-sb-section");
          for (const section of folderSections) {
            const label = section.querySelector<HTMLElement>(".am-sb-label");
            if (label?.textContent === "Folders") {
              section.innerHTML = `<div class="am-sb-label">Folders</div><div class="am-sb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading\u2026</div>`;
              break;
            }
          }
        }

        // Update status bar
        const statusCount = root.querySelector<HTMLElement>(".am-status-count");
        if (statusCount) statusCount.textContent = "Loading\u2026";
      }

      // Check browse cache for instant navigation
      const source = self.activeSource ?? "data";
      const cached = getBrowseCache().get(source, path);
      if (cached) {
        Log.debug(`Asset Manager: cache hit for ${path}`);
      }

      // Call browse to get fresh data (triggers re-render → _onRender → _amPopulateContent)
      self.browse(path);
    }

    /** Clean up resources when the picker closes. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async close(options?: any): Promise<void> {
      // Guard: warn if batch optimization is running
      if (this._amBatchRunning) {
        const confirmed = await new Promise<boolean>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const DialogCls = (globalThis as any).foundry?.applications?.api?.DialogV2;
          if (!DialogCls) { resolve(true); return; }
          DialogCls.confirm({
            window: { title: "Optimization In Progress" },
            content: `<p>A batch optimization is currently running. Closing now will <strong>cancel</strong> the remaining files.</p><p>Files already optimized will keep their changes.</p>`,
            yes: { label: "Close Anyway", icon: "fa-solid fa-xmark" },
            no: { label: "Keep Open", icon: "fa-solid fa-spinner" },
            rejectClose: false,
          }).then((result: unknown) => resolve(result === true))
            .catch(() => resolve(false));
        });
        if (!confirmed) return;
        this._amBatchRunning = false;
      }

      // Revoke thumbnail object URLs to free memory
      getThumbCache().revokeAll();

      // Dismiss any open context menu
      dismissContextMenu();

      // Clear preview state
      this._amPreviewPath = null;
      this._amPreviewMeta = null;

      // Destroy upload manager
      if (this._amUploader) {
        this._amUploader.destroy();
        this._amUploader = null;
      }

      // Disconnect observers
      if (this._amImgObserver) { this._amImgObserver.disconnect(); this._amImgObserver = null; }
      if (this._amMutObserver) { this._amMutObserver.disconnect(); this._amMutObserver = null; }

      // Destroy virtual scroller
      if (this._amScroller) {
        this._amScroller.destroy();
        this._amScroller = null;
      }

      // Release large arrays + reset state for next open
      this._amEntries = [];
      this._amFiltered = [];
      this._amMultiSelect.clear();
      this._amCollection = "all";
      this._amFilters = [];
      this._amShellPending = false;

      return super.close(options);
    }

    /** Select a file (highlight it). */
    _amSelectFile(path: string, root: HTMLElement): void {
      // Remove previous selection
      root.querySelectorAll(".am-selected").forEach((el) => el.classList.remove("am-selected"));

      // Add selection to clicked card
      const card = root.querySelector(`[data-am-path="${CSS.escape(path)}"]:not(.am-crumb)`);
      if (card) card.classList.add("am-selected");

      // Update the FilePicker's internal state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;

      // Update the input field if we have one
      if (self.field) {
        self.field.value = path;
      }

      // Store the selection
      self._result = path;

      // Enable delete button
      const deleteBtn = root.querySelector<HTMLElement>(".am-crumb-delete");
      if (deleteBtn) deleteBtn.classList.add("am-delete-active");
    }

    /** Confirm file selection (double-click or explicit submit). */
    _amConfirmSelection(path: string): void {
      // Record as recently used
      getMetadataStore().recordRecent(path).catch(() => { /* ignore */ });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;

      // Call the callback
      if (typeof self.callback === "function") {
        self.callback(path, self);
      }

      // Update the field
      if (self.field) {
        self.field.value = path;
        self.field.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Close the picker
      self.close();
    }

    /** Refresh the full UI (toolbar + content). */
    _amRefreshUI(root: HTMLElement): void {
      // Preserve server status indicator state before rebuild
      const serverDot = root.querySelector<HTMLElement>(".am-server-dot");
      const wasOnline = serverDot?.classList.contains("am-server-online");
      const wasOffline = serverDot?.classList.contains("am-server-offline");
      const serverTitle = root.querySelector<HTMLElement>(".am-server-status")?.title ?? "";

      root.innerHTML = this._amBuildHTML();
      this._amAttachListeners(root);
      this._amSetupScroller(root);

      // Restore server status (avoid re-checking)
      if (wasOnline || wasOffline) {
        const newDot = root.querySelector<HTMLElement>(".am-server-dot");
        const newWrap = root.querySelector<HTMLElement>(".am-server-status");
        if (newDot) {
          newDot.classList.remove("am-server-checking");
          newDot.classList.add(wasOnline ? "am-server-online" : "am-server-offline");
        }
        if (newWrap) newWrap.title = serverTitle;
      }
    }

    /** Refresh just the content area (after search/sort). */
    _amRefreshContent(root: HTMLElement): void {
      // Update count
      const count = root.querySelector(".am-status-count");
      if (count) count.textContent = `${this._amFiltered.length} items`;

      // Rebuild scroller with new data
      this._amSetupScroller(root);
    }

    /* ── Server Status ──────────────────────────────────────── */

    /** Check optimizer server health and update the status indicator. */
    _amCheckServerStatus(root: HTMLElement): void {
      const dot = root.querySelector<HTMLElement>(".am-server-dot");
      const label = root.querySelector<HTMLElement>(".am-server-label");
      const wrap = root.querySelector<HTMLElement>(".am-server-status");
      if (!dot || !label || !wrap) return;

      checkOptimizerServer().then((caps) => {
        if (caps) {
          const parts: string[] = [];
          if (caps.image) parts.push("images");
          if (caps.audio) parts.push("audio");
          if (caps.video) parts.push("video");
          dot.classList.remove("am-server-checking");
          dot.classList.add("am-server-online");
          label.textContent = "Server";
          wrap.title = `Optimizer server connected — ${parts.join(", ")}`;
        } else {
          dot.classList.remove("am-server-checking");
          dot.classList.add("am-server-offline");
          label.textContent = "Server";
          wrap.title = "Optimizer server unavailable — using client-side optimization";
        }
      }).catch(() => {
        if (!dot) return;
        dot.classList.remove("am-server-checking");
        dot.classList.add("am-server-offline");
        if (label) label.textContent = "Server";
        if (wrap) wrap.title = "Optimizer server unavailable — using client-side optimization";
      });
    }

    /* ── Preview Panel ───────────────────────────────────────── */

    /** Show the preview panel for a file entry. */
    _amShowPreview(path: string, root: HTMLElement): void {
      const entry = this._amEntries.find((e) => e.path === path);
      if (!entry || entry.isDir) return;

      this._amPreviewPath = path;
      this._amPreviewMeta = null;

      const preview = root.querySelector<HTMLElement>(".am-preview");
      const wrap = root.querySelector<HTMLElement>(".am-content-wrap");
      if (!preview || !wrap) return;

      // Build preview with tags section
      const renderPreview = (meta: FileMetadata | null) => {
        const baseHTML = buildPreviewHTML(entry, meta, esc);
        const tagHTML = this._amBuildPreviewTags(path);
        // Insert tags section before the actions
        return baseHTML.replace(
          `<div class="am-preview-actions">`,
          `${tagHTML}<div class="am-preview-actions">`,
        );
      };

      preview.innerHTML = renderPreview(null);
      preview.classList.add("am-preview-open");
      wrap.classList.add("am-has-preview");

      // Attach tag listeners in preview
      this._amAttachPreviewTagListeners(preview, path, root);

      // Extract metadata async and update the panel
      extractMetadata(path, entry.type, entry.ext).then((meta) => {
        if (this._amPreviewPath !== path) return;
        this._amPreviewMeta = meta;
        preview.innerHTML = renderPreview(meta);
        this._amAttachPreviewTagListeners(preview, path, root);
      }).catch(() => { /* ignore */ });
    }

    /** Build tag pills for the preview panel. */
    _amBuildPreviewTags(path: string): string {
      const meta = getMetadataStore();
      const tags = meta.getAllTags();
      const fileTags = new Set<string>();

      // Synchronous check — tags are in memory after ready()
      for (const tag of tags) {
        if (meta.getFilesByTag(tag).includes(path)) fileTags.add(tag);
      }

      const pills = tags.map((tag) => {
        const color = meta.getTagColor(tag);
        const active = fileTags.has(tag);
        return `<button class="am-ptag${active ? " am-ptag-active" : ""}" data-am-ptag="${esc(tag)}" type="button" style="--am-tag-color: ${color};">${esc(tag)}</button>`;
      }).join("");

      return `
        <div class="am-preview-tags">
          <div class="am-preview-tags-label">Tags</div>
          <div class="am-preview-tags-list">
            ${pills || `<span class="am-sb-empty">No tags</span>`}
            <button class="am-ptag-add" type="button" title="Add new tag"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
      `;
    }

    /** Attach click listeners for tag pills in the preview panel. */
    _amAttachPreviewTagListeners(preview: HTMLElement, path: string, root: HTMLElement): void {
      // Toggle tag on file
      preview.querySelectorAll<HTMLElement>("[data-am-ptag]").forEach((pill) => {
        pill.addEventListener("click", async () => {
          const tag = pill.dataset.amPtag;
          if (!tag) return;
          const meta = getMetadataStore();
          const tags = await meta.getTags(path);
          if (tags.includes(tag)) {
            await meta.removeTag(path, tag);
          } else {
            await meta.addTag(path, tag);
          }
          // Re-render preview tags
          if (this._amPreviewPath === path) {
            this._amShowPreview(path, root);
          }
        });
      });

      // Add new tag
      preview.querySelector(".am-ptag-add")?.addEventListener("click", async () => {
        const name = prompt("Enter tag name:");
        if (!name?.trim()) return;
        const tag = name.trim().toLowerCase();
        const meta = getMetadataStore();
        await meta.addTag(path, tag);
        if (!meta.getTagColor(tag) || meta.getTagColor(tag) === "#9a9590") {
          await meta.setTagColor(tag, this._amNextTagColor());
        }
        if (this._amPreviewPath === path) {
          this._amShowPreview(path, root);
        }
        // Also refresh sidebar to show new tag
        this._amRefreshSidebar(root);
      });
    }

    /** Refresh just the sidebar content. */
    _amRefreshSidebar(root: HTMLElement): void {
      const oldSidebar = root.querySelector<HTMLElement>(".am-sidebar");
      if (!oldSidebar) return;
      const temp = document.createElement("div");
      temp.innerHTML = this._amBuildSidebar();
      const newSidebar = temp.querySelector(".am-sidebar");
      if (newSidebar) oldSidebar.replaceWith(newSidebar);
    }

    /** Get next tag color from a rotating palette. */
    _amNextTagColor(): string {
      const palette = ["#42a5f5", "#66bb6a", "#ffa000", "#ab47bc", "#ef5350", "#26c6da", "#7e57c2", "#78909c", "#ec407a", "#8d6e63"];
      const used = new Set(getMetadataStore().getAllTags().map((t) => getMetadataStore().getTagColor(t)));
      return palette.find((c) => !used.has(c)) ?? palette[Math.floor(Math.random() * palette.length)]!;
    }

    /** Close the preview panel. */
    _amClosePreview(root: HTMLElement): void {
      this._amPreviewPath = null;
      this._amPreviewMeta = null;

      const preview = root.querySelector<HTMLElement>(".am-preview");
      const wrap = root.querySelector<HTMLElement>(".am-content-wrap");
      if (preview) {
        preview.classList.remove("am-preview-open");
        // Clear content after animation
        setTimeout(() => {
          if (!this._amPreviewPath) preview.innerHTML = "";
        }, 200);
      }
      if (wrap) wrap.classList.remove("am-has-preview");
    }

    /* ── Upload Handling ──────────────────────────────────────── */

    /** Handle file upload (from button or drag-and-drop). */
    _amHandleUpload(files: File[], root: HTMLElement): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;
      const source = self.activeSource ?? "data";
      const target = self.request || self.target || "";

      // Read preset from settings or use current selection
      try {
        const game = getGame();
        const settingsPreset = game?.settings?.get?.(MOD, AM_SETTINGS.DEFAULT_PRESET) as OptPreset | undefined;
        const optimizeEnabled = game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZE_ON_UPLOAD) as boolean | undefined;
        if (settingsPreset && this._amUploadPreset === "auto") this._amUploadPreset = settingsPreset;
        if (optimizeEnabled === false) this._amUploadPreset = "none";
      } catch { /* use current preset */ }

      // Create UploadManager if needed
      if (!this._amUploader) {
        this._amUploader = new UploadManager(
          // onUpdate — re-render the queue panel
          (queue: UploadQueueItem[]) => {
            const queueEl = root.querySelector<HTMLElement>(".am-upload-queue");
            if (queueEl) {
              queueEl.innerHTML = buildUploadQueueHTML(queue);
              queueEl.classList.toggle("am-uq-visible", queue.length > 0);
            }
          },
          // uploadFn — use Foundry's FilePicker.upload() (suppress per-file notifications)
          async (file: File, name: string): Promise<string> => {
            const restore = suppressInfoNotifications();
            try {
              const response = await BaseFilePicker.upload(source, target, new File([file], name, { type: file.type }), {});
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (response as any)?.path ?? "";
            } finally {
              restore();
            }
          },
          // onComplete — invalidate browse cache and refresh
          () => {
            getBrowseCache().invalidate(source, target);
            this._amBrowse(target);
          },
        );
      }

      this._amUploader.enqueue(files, this._amUploadPreset);
    }

    /** Batch optimize all images in the current directory. */
    async _amBatchOptimize(root: HTMLElement): Promise<void> {
      if (this._amBatchRunning) return; // Already running

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;
      const source = self.activeSource ?? "data";
      const target = self.request || self.target || "";

      const optimizableFiles = this._amEntries
        .filter((e) => !e.isDir && (e.type === "image" || e.type === "audio"))
        .map((e) => e.path);

      if (optimizableFiles.length === 0) {
        Log.debug("Asset Manager: no optimizable files in this folder");
        return;
      }

      // Read preset from settings
      let preset: OptPreset = "auto";
      try {
        const game = getGame();
        preset = (game?.settings?.get?.(MOD, AM_SETTINGS.DEFAULT_PRESET) as OptPreset) ?? "auto";
      } catch { /* use auto */ }

      // Show progress in status bar
      const statusCount = root.querySelector<HTMLElement>(".am-status-count");
      const progressWrap = root.querySelector<HTMLElement>(".am-batch-progress");
      const progressFill = root.querySelector<HTMLElement>(".am-batch-progress-fill");
      const originalText = statusCount?.textContent ?? "";

      this._amBatchRunning = true;
      if (progressWrap) progressWrap.style.display = "";
      if (progressFill) { progressFill.style.width = "0%"; }

      // Suppress Foundry's per-file upload notifications during batch
      const restoreNotifications = suppressInfoNotifications();

      const result = await batchOptimize(
        optimizableFiles,
        preset,
        async (file: File, name: string, targetDir: string): Promise<string> => {
          if (!this._amBatchRunning) throw new Error("cancelled");
          const uploadTarget = targetDir || target;
          const response = await BaseFilePicker.upload(source, uploadTarget, new File([file], name, { type: file.type }), {});
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (response as any)?.path ?? "";
        },
        (current, total, fileName) => {
          const pct = Math.round((current / total) * 100);
          if (statusCount) {
            statusCount.textContent = `Optimizing ${current}/${total}: ${fileName}`;
          }
          if (progressFill) progressFill.style.width = `${pct}%`;
        },
      );

      this._amBatchRunning = false;
      restoreNotifications();

      // Show results
      if (statusCount) {
        const saved = formatBytes(result.totalSaved);
        statusCount.textContent = `Done! ${result.processed} optimized, ${result.skipped} skipped, ${saved} saved`;
        if (progressFill) progressFill.style.width = "100%";
        setTimeout(() => {
          statusCount.textContent = originalText;
          if (progressWrap) progressWrap.style.display = "none";
          if (progressFill) progressFill.style.width = "0%";
        }, 5000);
      }

      // Refresh directory listing
      if (result.processed > 0) {
        getBrowseCache().invalidate(source, target);
        this._amBrowse(target);
      }
    }

    /* ── Multi-Select & Keyboard Navigation ────────────────── */

    /** Render multi-select visual highlights on cards/rows. */
    _amRenderMultiSelect(root: HTMLElement): void {
      // Clear all multi-select highlights first
      root.querySelectorAll(".am-multi-selected").forEach((el) => el.classList.remove("am-multi-selected"));

      // Apply highlight to each selected path
      for (const path of this._amMultiSelect) {
        const el = root.querySelector(`[data-am-path="${CSS.escape(path)}"]:not(.am-crumb)`);
        if (el) el.classList.add("am-multi-selected");
      }
    }

    /** Update the status bar with selection counts & stats. */
    _amUpdateStatusBar(root: HTMLElement): void {
      const statusCount = root.querySelector<HTMLElement>(".am-status-count");
      if (!statusCount) return;

      const total = this._amFiltered.length;
      const selCount = this._amMultiSelect.size;

      if (selCount > 0) {
        statusCount.textContent = `${selCount} selected · ${total} items`;
      } else {
        statusCount.textContent = this._amUnoptCount > 0
          ? `${total} items · ${this._amUnoptCount} unoptimized`
          : `${total} items`;
      }

      // Toggle delete button active state
      const deleteBtn = root.querySelector<HTMLElement>(".am-crumb-delete");
      if (deleteBtn) {
        // Active when files are selected OR a directory is keyboard-focused
        const hasSelection = selCount > 0 || root.querySelector(".am-selected") !== null;
        deleteBtn.classList.toggle("am-delete-active", hasSelection);
      }
    }

    /** Navigate grid/list via arrow keys. */
    _amKeyboardNavigate(key: string, root: HTMLElement): void {
      const items = root.querySelectorAll<HTMLElement>("[data-am-path]:not(.am-crumb)");
      if (items.length === 0) return;

      // Find the currently focused item
      const focused = root.querySelector<HTMLElement>(".am-kb-focus");
      let currentIdx = -1;
      if (focused) {
        items.forEach((el, i) => { if (el === focused) currentIdx = i; });
      }

      // Determine columns for grid navigation
      let cols = 1;
      if (viewMode === "grid" && items.length >= 2) {
        const rect0 = items[0]!.getBoundingClientRect();
        const rect1 = items[1]!.getBoundingClientRect();
        if (Math.abs(rect0.top - rect1.top) < 2) {
          // Items are on the same row — count how many share that row
          const rowTop = rect0.top;
          cols = 0;
          for (const item of items) {
            if (Math.abs(item.getBoundingClientRect().top - rowTop) < 2) cols++;
            else break;
          }
        }
      }

      // Calculate new index
      let newIdx = currentIdx;
      switch (key) {
        case "ArrowRight": newIdx = Math.min(currentIdx + 1, items.length - 1); break;
        case "ArrowLeft": newIdx = Math.max(currentIdx - 1, 0); break;
        case "ArrowDown": newIdx = Math.min(currentIdx + cols, items.length - 1); break;
        case "ArrowUp": newIdx = Math.max(currentIdx - cols, 0); break;
      }
      if (newIdx < 0) newIdx = 0;

      // Move focus
      if (focused) focused.classList.remove("am-kb-focus");
      const target = items[newIdx];
      if (target) {
        target.classList.add("am-kb-focus");
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    /** Get the path of the currently keyboard-focused item. */
    _amGetSelectedPath(root: HTMLElement): string | null {
      const focused = root.querySelector<HTMLElement>(".am-kb-focus");
      return focused?.dataset.amPath ?? null;
    }

    /** Delete selected files/folders after user confirmation. */
    async _amDeleteSelected(root: HTMLElement): Promise<void> {
      // Gather targets: multi-select files, or single selected file/dir
      const targets: string[] = [...this._amMultiSelect];
      if (targets.length === 0) {
        // Check single selected file
        const selected = root.querySelector<HTMLElement>(".am-selected[data-am-path]");
        if (selected?.dataset.amPath) targets.push(selected.dataset.amPath);
      }
      if (targets.length === 0) return;

      // Identify which are folders vs files
      const folders = targets.filter((p) => this._amEntries.some((e) => e.path === p && e.isDir));
      const files = targets.filter((p) => !folders.includes(p));

      // Build confirmation message
      let message = "";
      if (folders.length > 0 && files.length > 0) {
        message = `Delete ${files.length} file${files.length > 1 ? "s" : ""} and ${folders.length} folder${folders.length > 1 ? "s" : ""}?\n\nFolders and all their contents will be permanently deleted. This cannot be undone.`;
      } else if (folders.length > 0) {
        const folderNames = folders.map((p) => basename(p)).join(", ");
        message = `Delete folder${folders.length > 1 ? "s" : ""}: ${folderNames}?\n\nAll contents will be permanently deleted. This cannot be undone.`;
      } else {
        const fileNames = files.length <= 5
          ? files.map((p) => basename(p)).join(", ")
          : `${files.length} files`;
        message = `Delete ${fileNames}?\n\nThis cannot be undone.`;
      }

      // Use Foundry's Dialog for confirmation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Dialog = (globalThis as any).foundry?.applications?.api?.DialogV2 ?? (globalThis as any).Dialog;
      if (!Dialog) return;

      const confirmed = await Dialog.confirm({
        window: { title: "Confirm Delete" },
        content: `<p>${message.replace(/\n/g, "<br>")}</p>`,
        yes: { label: "Delete", icon: "fa-solid fa-trash" },
        no: { label: "Cancel" },
      });
      if (!confirmed) return;

      // Perform deletions
      const statusCount = root.querySelector<HTMLElement>(".am-status-count");
      const originalText = statusCount?.textContent ?? "";
      if (statusCount) statusCount.textContent = "Deleting…";

      let deleted = 0;
      for (const folderPath of folders) {
        const ok = await serverDeleteFolder(folderPath);
        if (ok) deleted++;
        else Log.warn(`Failed to delete folder: ${folderPath}`);
      }
      for (const filePath of files) {
        const ok = await serverDeleteFile(filePath);
        if (ok) deleted++;
        else Log.warn(`Failed to delete file: ${filePath}`);
      }

      // Invalidate thumb stats after deletion
      invalidateThumbStats();

      // Clear selection and refresh
      this._amMultiSelect.clear();
      if (deleted > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        const source = self.activeSource ?? "data";
        const target = this._amCurrentPath;
        getBrowseCache().invalidate(source, target);
        this._amBrowse(target);
        if (statusCount) {
          statusCount.textContent = `Deleted ${deleted} item${deleted > 1 ? "s" : ""}`;
          setTimeout(() => { statusCount.textContent = originalText; }, 3000);
        }
      } else if (statusCount) {
        statusCount.textContent = originalText;
      }
    }

    /** Toggle the thumbnail cache info popup. */
    async _amToggleThumbPopup(root: HTMLElement): Promise<void> {
      // If popup already exists, dismiss it
      const existing = root.querySelector(".am-thumb-popup");
      if (existing) {
        existing.remove();
        return;
      }

      // Fetch stats (cached unless recently invalidated)
      const stats = await getThumbCacheStats();
      const count = stats?.count ?? 0;
      const totalBytes = stats?.totalBytes ?? 0;
      const sizeStr = formatBytes(totalBytes);

      const popup = document.createElement("div");
      popup.className = "am-thumb-popup";
      popup.innerHTML = `
        <div class="am-thumb-popup-title">Thumbnail Cache</div>
        <div class="am-thumb-popup-row">
          <span>Cached thumbnails</span>
          <span class="am-thumb-popup-value">${count.toLocaleString()}</span>
        </div>
        <div class="am-thumb-popup-row">
          <span>Cache size</span>
          <span class="am-thumb-popup-value">${sizeStr}</span>
        </div>
      `;

      // Attach to the status bar (position: relative parent)
      const statusBar = root.querySelector<HTMLElement>(".am-status-bar");
      if (statusBar) {
        statusBar.style.position = "relative";
        statusBar.appendChild(popup);
      }
    }

    /** Handle context menu action. */
    _amHandleContextAction(action: string, filePath: string, root: HTMLElement): void {
      switch (action) {
        case "preview":
          this._amShowPreview(filePath, root);
          break;
        case "copy-path":
          navigator.clipboard.writeText(filePath).catch(() => { /* ignore */ });
          break;
        case "select":
          this._amConfirmSelection(filePath);
          break;
        case "delete":
          // Add to multi-select then trigger delete flow
          this._amMultiSelect.clear();
          this._amMultiSelect.add(filePath);
          this._amDeleteSelected(root);
          break;
      }
    }
  }

  // Register the override
  CONFIG.ux.FilePicker = FTHAssetPicker;
  Log.info("Asset Manager: FilePicker override registered");
}

/* ── Standalone Browse Mode ───────────────────────────────── */

/**
 * Open the Asset Manager as a standalone browsing window (no selection callback).
 * Used by the scene control button and `window.fth.assetManager()`.
 */
export function openAssetManager(): void {
  const CONFIG = (globalThis as any).CONFIG; // eslint-disable-line @typescript-eslint/no-explicit-any
  const Picker = CONFIG?.ux?.FilePicker;
  if (!Picker) return;
  const picker = new Picker({
    type: "any",
    callback: () => {},
  });
  picker.render(true, { width: 960, height: 680 });
}

/* ── Utilities ────────────────────────────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
