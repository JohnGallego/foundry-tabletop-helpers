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
import { applyRuntimePatchOnce, getRuntimePatchState } from "../runtime/runtime-patches";
import { getGame, getUI, isGM } from "../types";
import { AM_SETTINGS } from "./asset-manager-settings";
import { VirtualScroller } from "./virtual-scroll";
import { getThumbCache } from "./asset-manager-thumb-cache";
import { type FileMetadata } from "./asset-manager-preview";
import { checkOptimizerServer, isOptimizerConfigured, getServerThumbUrl } from "./asset-manager-optimizer-client";
import { UploadManager } from "./asset-manager-upload";
import { getMetadataStore } from "./asset-manager-metadata";
import { AssetManagerActionController } from "./asset-manager-picker-actions";
import { AssetManagerControlsController } from "./asset-manager-picker-controls";
import { AssetManagerInteractionsController } from "./asset-manager-picker-interactions";
import { AssetManagerLifecycleController } from "./asset-manager-picker-lifecycle";
import { AssetManagerPreviewController } from "./asset-manager-picker-preview";
import { AssetManagerSelectionController } from "./asset-manager-picker-selection";
import { AssetManagerStateController } from "./asset-manager-picker-state";
import { AssetManagerUploadController } from "./asset-manager-picker-upload";
import {
  buildBreadcrumbs,
  buildFilterChips,
  buildHTML,
  buildShellHTML,
  buildSidebar,
  renderGridItem,
  renderListItem,
} from "./asset-manager-picker-rendering";
import {
  type AssetEntry,
  type AssetType,
  type GridDensity,
  type ViewMode,
  type SortField,
  type SortDir,
  DENSITY_SIZES,
} from "./asset-manager-types";

/* ── Notification Suppression ────────────────────────────── */

type FilePickerClass = new (...args: unknown[]) => {
  render(force?: boolean, options?: Record<string, unknown>): void;
};

interface AssetManagerPatchState {
  originalFilePicker?: FilePickerClass;
  overrideFilePicker?: FilePickerClass;
  originalInfoNotification?: ((message: string, options?: Record<string, unknown>) => void) | null;
  notificationSuppressionDepth: number;
}

const ASSET_MANAGER_PATCH_KEY = `${MOD}:asset-manager-runtime`;

function getAssetManagerPatchState(): AssetManagerPatchState {
  return getRuntimePatchState<AssetManagerPatchState>(ASSET_MANAGER_PATCH_KEY, () => ({
    notificationSuppressionDepth: 0,
  }));
}

/**
 * Temporarily suppress Foundry's `ui.notifications.info` calls for asset-manager
 * driven upload/optimization flows. Uses ref counting so nested operations do not
 * restore the original notifier too early.
 */
function suppressInfoNotifications(): () => void {
  const state = getAssetManagerPatchState();
  const notifications = getUI()?.notifications;
  if (!notifications?.info) return () => {};

  state.notificationSuppressionDepth += 1;
  if (state.notificationSuppressionDepth === 1) {
    state.originalInfoNotification = notifications.info.bind(notifications);
    notifications.info = () => {};
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    state.notificationSuppressionDepth = Math.max(0, state.notificationSuppressionDepth - 1);
    if (state.notificationSuppressionDepth === 0 && state.originalInfoNotification) {
      notifications.info = state.originalInfoNotification;
      state.originalInfoNotification = null;
    }
  };
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
    // _amUploadPreset removed — dialog handles preset selection
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
    /** Preview/tag controller. */
    _amPreviewController: AssetManagerPreviewController | null = null;
    /** Upload/batch controller. */
    _amUploadController: AssetManagerUploadController | null = null;
    /** Selection/navigation controller. */
    _amSelectionController: AssetManagerSelectionController | null = null;
    /** Delete/context-action controller. */
    _amActionController: AssetManagerActionController | null = null;
    /** Toolbar/sidebar event controller. */
    _amControlsController: AssetManagerControlsController | null = null;
    /** File-grid interaction controller. */
    _amInteractionsController: AssetManagerInteractionsController | null = null;
    /** Close/cleanup lifecycle controller. */
    _amLifecycleController: AssetManagerLifecycleController | null = null;
    /** Browse/state orchestration controller. */
    _amStateController: AssetManagerStateController | null = null;

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

    _amBuildRenderState() {
      return {
        currentPath: this._amCurrentPath,
        search: this._amSearch,
        collection: this._amCollection,
        filters: this._amFilters,
        entries: this._amEntries,
        filteredEntries: this._amFiltered,
        previewPath: this._amPreviewPath,
        unoptimizedCount: this._amUnoptCount,
        density,
        viewMode,
        sortField,
        sortDir,
        sidebarOpen,
      };
    }

    _amGetPreviewController(): AssetManagerPreviewController {
      if (!this._amPreviewController) {
        this._amPreviewController = new AssetManagerPreviewController({
          findEntry: (path) => this._amEntries.find((entry) => entry.path === path),
          getPreviewPath: () => this._amPreviewPath,
          setPreviewPath: (path) => { this._amPreviewPath = path; },
          setPreviewMeta: (meta) => { this._amPreviewMeta = meta; },
          refreshSidebar: (root) => this._amRefreshSidebar(root),
          esc,
        });
      }
      return this._amPreviewController;
    }

    _amGetUploadController(): AssetManagerUploadController {
      if (!this._amUploadController) {
        this._amUploadController = new AssetManagerUploadController({
          getCurrentPath: () => this._amCurrentPath,
          getActiveSource: () => {
            const self = this as unknown as { activeSource?: string };
            return self.activeSource ?? "data";
          },
          getEntries: () => this._amEntries,
          getBatchRunning: () => this._amBatchRunning,
          setBatchRunning: (value) => { this._amBatchRunning = value; },
          getUploader: () => this._amUploader,
          setUploader: (uploader) => { this._amUploader = uploader; },
          browse: (path) => this._amBrowse(path),
          suppressInfoNotifications,
          baseFilePickerUpload: async (source, target, file) => {
            const response = await BaseFilePicker.upload(source, target, file, {});
            return (response as { path?: string } | undefined)?.path ?? "";
          },
        });
      }
      return this._amUploadController;
    }

    _amGetSelectionController(): AssetManagerSelectionController {
      if (!this._amSelectionController) {
        this._amSelectionController = new AssetManagerSelectionController({
          getFilteredEntries: () => this._amFiltered,
          getMultiSelect: () => this._amMultiSelect,
          getUnoptimizedCount: () => this._amUnoptCount,
          getViewMode: () => viewMode,
          getCurrentSelectionPath: (root) => {
            const selected = root.querySelector<HTMLElement>(".am-selected[data-am-path]");
            return selected?.dataset.amPath ?? null;
          },
          setLastClickIndex: (index) => { this._amLastClickIdx = index; },
          getLastClickIndex: () => this._amLastClickIdx,
        });
      }
      return this._amSelectionController;
    }

    _amGetActionController(): AssetManagerActionController {
      if (!this._amActionController) {
        this._amActionController = new AssetManagerActionController({
          getEntries: () => this._amEntries,
          getMultiSelect: () => this._amMultiSelect,
          getCurrentPath: () => this._amCurrentPath,
          getActiveSource: () => {
            const self = this as unknown as { activeSource?: string };
            return self.activeSource ?? "data";
          },
          browse: (path) => this._amBrowse(path),
          showPreview: (path, root) => this._amShowPreview(path, root),
          confirmSelection: (path) => this._amConfirmSelection(path),
        });
      }
      return this._amActionController;
    }

    _amGetControlsController(): AssetManagerControlsController {
      if (!this._amControlsController) {
        this._amControlsController = new AssetManagerControlsController({
          getSearch: () => this._amSearch,
          setSearch: (value) => { this._amSearch = value; },
          getCollection: () => this._amCollection,
          setCollection: (value) => { this._amCollection = value; },
          getFilters: () => this._amFilters,
          setFilters: (value) => { this._amFilters = value; },
          getViewMode: () => viewMode,
          setViewMode: (value) => { viewMode = value; },
          getDensity: () => density,
          setDensity: (value) => { density = value; },
          getSortField: () => sortField,
          setSortField: (value) => { sortField = value; },
          getSortDir: () => sortDir,
          setSortDir: (value) => { sortDir = value; },
          getSidebarOpen: () => sidebarOpen,
          setSidebarOpen: (value) => { sidebarOpen = value; },
          getPreviewPath: () => this._amPreviewPath,
          nextTagColor: () => this._amNextTagColor(),
          applySearch: () => this._amApplySearch(),
          applySort: () => this._amApplySort(),
          refreshUI: (root) => this._amRefreshUI(root),
          refreshContent: (root) => this._amRefreshContent(root),
          setupScroller: (root) => this._amSetupScroller(root),
          browse: (path) => this._amBrowse(path),
          handleUpload: (files, root) => this._amHandleUpload(files, root),
          promptCreateFolder: (root) => this._amPromptCreateFolder(root),
          batchOptimize: (root) => this._amBatchOptimize(root),
          clearUploadQueue: (root) => {
            const queueEl = root.querySelector<HTMLElement>(".am-upload-queue");
            if (queueEl) {
              queueEl.innerHTML = "";
              queueEl.classList.remove("am-uq-visible");
            }
            if (this._amUploader) this._amUploader.clear();
          },
          persistViewMode: (value) => {
            try { localStorage.setItem(LS_VIEW, value); } catch { /* ignore */ }
          },
          persistDensity: (value) => {
            try { localStorage.setItem(LS_DENSITY, value); } catch { /* ignore */ }
          },
          persistSort: (field, dir) => {
            try { localStorage.setItem(LS_SORT, JSON.stringify({ field, dir })); } catch { /* ignore */ }
          },
          persistSidebarOpen: (value) => {
            try { localStorage.setItem(LS_SIDEBAR, String(value)); } catch { /* ignore */ }
          },
        });
      }
      return this._amControlsController;
    }

    _amGetLifecycleController(): AssetManagerLifecycleController {
      if (!this._amLifecycleController) {
        this._amLifecycleController = new AssetManagerLifecycleController({
          getBatchRunning: () => this._amBatchRunning,
          setBatchRunning: (value) => { this._amBatchRunning = value; },
          getUploader: () => this._amUploader,
          setUploader: () => { this._amUploader = null; },
          getImageObserver: () => this._amImgObserver,
          setImageObserver: () => { this._amImgObserver = null; },
          getMutationObserver: () => this._amMutObserver,
          setMutationObserver: () => { this._amMutObserver = null; },
          getScroller: () => this._amScroller,
          setScroller: () => { this._amScroller = null; },
          setPreviewPath: (value) => { this._amPreviewPath = value; },
          setPreviewMeta: () => { this._amPreviewMeta = null; },
          setEntries: (value) => { this._amEntries = value; },
          setFilteredEntries: (value) => { this._amFiltered = value; },
          getMultiSelect: () => this._amMultiSelect,
          setCollection: (value) => { this._amCollection = value; },
          setFilters: (value) => { this._amFilters = value; },
          setShellPending: (value) => { this._amShellPending = value; },
        });
      }
      return this._amLifecycleController;
    }

    _amGetInteractionsController(): AssetManagerInteractionsController {
      if (!this._amInteractionsController) {
        this._amInteractionsController = new AssetManagerInteractionsController({
          getFilteredEntries: () => this._amFiltered,
          getLastClickIndex: () => this._amLastClickIdx,
          setLastClickIndex: (value) => { this._amLastClickIdx = value; },
          getPreviewPath: () => this._amPreviewPath,
          getCurrentRequestPath: () => {
            const self = this as unknown as { request?: string; target?: string };
            return self.request || self.target || "";
          },
          closePreview: (root) => this._amClosePreview(root),
          browse: (path) => this._amBrowse(path),
          deleteSelected: (root) => this._amDeleteSelected(root),
          toggleThumbPopup: (root) => this._amToggleThumbPopup(root),
          selectFile: (path, root) => this._amSelectFile(path, root),
          showPreview: (path, root) => this._amShowPreview(path, root),
          confirmSelection: (path) => this._amConfirmSelection(path),
          handleContextAction: (action, path, root) => this._amHandleContextAction(action, path, root),
          handleUpload: (files, root) => this._amHandleUpload(files, root),
          handleKeyboardNavigate: (key, root) => this._amKeyboardNavigate(key, root),
          getSelectedPath: (root) => this._amGetSelectedPath(root),
          toggleFocusedSelection: (root) => this._amGetSelectionController().toggleFocusedSelection(root),
          handleSelectAll: (root) => this._amGetSelectionController().handleSelectAll(root),
          handleClickSelection: (path, root, options) => this._amGetSelectionController().handleClickSelection(path, root, options),
          updateSelectionStatus: (root) => this._amGetSelectionController().updateStatusBar(root),
          clearAndDeleteFolder: (path, root) => {
            this._amMultiSelect.clear();
            this._amMultiSelect.add(path);
            void this._amDeleteSelected(root);
          },
        });
      }
      return this._amInteractionsController;
    }

    _amGetStateController(): AssetManagerStateController {
      if (!this._amStateController) {
        this._amStateController = new AssetManagerStateController({
          getEntries: () => this._amEntries,
          setEntries: (entries) => { this._amEntries = entries; },
          getFilteredEntries: () => this._amFiltered,
          setFilteredEntries: (entries) => { this._amFiltered = entries; },
          setUnoptimizedCount: (count) => { this._amUnoptCount = count; },
          getSearch: () => this._amSearch,
          getCollection: () => this._amCollection,
          getFilters: () => this._amFilters,
          getCurrentPath: () => this._amCurrentPath,
          setCurrentPath: (path) => { this._amCurrentPath = path; },
          getSortField: () => sortField,
          getSortDir: () => sortDir,
          getActiveSource: () => {
            const self = this as unknown as { activeSource?: string };
            return self.activeSource ?? "data";
          },
          getBrowseFn: () => {
            const self = this as unknown as { browse?: (path: string) => void };
            return typeof self.browse === "function" ? self.browse.bind(this) : undefined;
          },
          getElementRoot: () => this.element?.querySelector?.(".am-root") as HTMLElement | null,
          buildHTML: () => this._amBuildHTML(),
          buildSidebar: () => this._amBuildSidebar(),
          buildBreadcrumbs: (path) => this._amBuildBreadcrumbs(path),
          attachListeners: (root) => this._amAttachListeners(root),
          setupScroller: (root) => this._amSetupScroller(root),
          updateStatusBar: (root) => this._amUpdateStatusBar(root),
        });
      }
      return this._amStateController;
    }

    /* ── Custom UI ───────────────────────────────────────────── */

    /** Parse FilePicker browse results into AssetEntry array. */
    _amParseResults(): void {
      const self = this as unknown as { result?: { files?: string[]; dirs?: string[] }; request?: string; target?: string };
      this._amCurrentPath = self.request || self.target || "";
      this._amGetStateController().parseResults(self.result ?? {});
    }

    /** Sort entries in-place (directories always first). */
    _amApplySort(): void {
      this._amGetStateController().applySort();
    }

    /** Apply search filter + active filters + smart collection. */
    _amApplySearch(): void {
      this._amGetStateController().applySearch();
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
      this._amGetStateController().populateContent(root);
    }

    /**
     * Build the UI shell with loading spinners.
     * The toolbar, search, view/density toggles are fully functional.
     * Content pane and sidebar folders show loading spinners.
     */
    _amBuildShellHTML(): string {
      return buildShellHTML(this._amBuildRenderState(), { esc });
    }

    /** Build the complete asset manager HTML. */
    _amBuildHTML(): string {
      return buildHTML(this._amBuildRenderState(), { esc });
    }

    /** Build sidebar HTML with smart collections, folders, and tags. */
    _amBuildSidebar(): string {
      return buildSidebar(this._amBuildRenderState(), { esc });
    }

    /** Build active filter chips HTML. */
    _amBuildFilterChips(): string {
      return buildFilterChips(this._amBuildRenderState(), { esc });
    }

    /** Build breadcrumb HTML from a path. */
    _amBuildBreadcrumbs(path: string): string {
      return buildBreadcrumbs(path, { esc });
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
      return renderGridItem(entry, { esc });
    }

    /** Render a single list row for a file/directory. */
    _amRenderListItem(entry: AssetEntry): string {
      return renderListItem(entry, { esc });
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
            cache.getThumbUrl(src, 256).then((thumbUrl) => {
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
      this._amGetControlsController().attachSearch(root);
      this._amGetControlsController().attachToolbarButtons(root);
      this._amGetControlsController().attachSidebarActions(root);
      root.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (this._amGetControlsController().handleClick(target, root)) return;
      });
      this._amGetInteractionsController().attach(root);
    }

    /** Navigate to a directory (with browse cache). */
    _amBrowse(path: string): void {
      if (this._amScroller) {
        this._amScroller.destroy();
        this._amScroller = null;
      }
      this._amGetStateController().browse(path);
    }

    /** Clean up resources when the picker closes. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async close(options?: any): Promise<void> {
      const confirmed = await this._amGetLifecycleController().confirmCloseIfNeeded();
      if (!confirmed) return;

      this._amGetLifecycleController().cleanupBeforeClose();

      return super.close(options);
    }

    /** Select a file (highlight it). */
    _amSelectFile(path: string, root: HTMLElement): void {
      this._amGetSelectionController().selectFile(path, root, (selectedPath) => {
        const self = this as unknown as { field?: HTMLInputElement; _result?: string };
        if (self.field) self.field.value = selectedPath;
        self._result = selectedPath;
        const deleteBtn = root.querySelector<HTMLElement>(".am-crumb-delete");
        if (deleteBtn) deleteBtn.classList.add("am-delete-active");
      });
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
      this._amGetStateController().refreshUI(root);
    }

    /** Refresh just the content area (after search/sort). */
    _amRefreshContent(root: HTMLElement): void {
      this._amGetStateController().refreshContent(root);
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
      this._amGetPreviewController().showPreview(path, root);
    }

    /** Build tag pills for the preview panel. */
    _amBuildPreviewTags(path: string): string {
      return this._amGetPreviewController().buildPreviewTags(path);
    }

    /** Attach click listeners for tag pills in the preview panel. */
    _amAttachPreviewTagListeners(preview: HTMLElement, path: string, root: HTMLElement): void {
      this._amGetPreviewController().attachPreviewTagListeners(preview, path, root);
    }

    /** Refresh just the sidebar content. */
    _amRefreshSidebar(root: HTMLElement): void {
      this._amGetStateController().refreshSidebar(root);
    }

    /** Get next tag color from a rotating palette. */
    _amNextTagColor(): string {
      const palette = ["#42a5f5", "#66bb6a", "#ffa000", "#ab47bc", "#ef5350", "#26c6da", "#7e57c2", "#78909c", "#ec407a", "#8d6e63"];
      const used = new Set(getMetadataStore().getAllTags().map((t) => getMetadataStore().getTagColor(t)));
      return palette.find((c) => !used.has(c)) ?? palette[Math.floor(Math.random() * palette.length)]!;
    }

    /** Close the preview panel. */
    _amClosePreview(root: HTMLElement): void {
      this._amGetPreviewController().closePreview(root);
    }

    /* ── Upload Handling ──────────────────────────────────────── */

    /** Handle file upload (from button or drag-and-drop). */
    async _amHandleUpload(files: File[], root: HTMLElement): Promise<void> {
      await this._amGetUploadController().handleUpload(files, root);
    }

    /** Batch optimize all images in the current directory. */
    /** Prompt for a folder name, then create it via the optimizer server. */
    async _amPromptCreateFolder(root: HTMLElement): Promise<void> {
      await this._amGetUploadController().promptCreateFolder(root);
    }

    async _amBatchOptimize(root: HTMLElement): Promise<void> {
      await this._amGetUploadController().batchOptimize(root);
    }

    /* ── Multi-Select & Keyboard Navigation ────────────────── */

    /** Render multi-select visual highlights on cards/rows. */
    _amRenderMultiSelect(root: HTMLElement): void {
      this._amGetSelectionController().renderMultiSelect(root);
    }

    /** Update the status bar with selection counts & stats. */
    _amUpdateStatusBar(root: HTMLElement): void {
      this._amGetSelectionController().updateStatusBar(root);
    }

    /** Navigate grid/list via arrow keys. */
    _amKeyboardNavigate(key: string, root: HTMLElement): void {
      this._amGetSelectionController().keyboardNavigate(key, root);
    }

    /** Get the path of the currently keyboard-focused item. */
    _amGetSelectedPath(root: HTMLElement): string | null {
      return this._amGetSelectionController().getSelectedPath(root);
    }

    /** Delete selected files/folders after user confirmation. */
    async _amDeleteSelected(root: HTMLElement): Promise<void> {
      await this._amGetActionController().deleteSelected(root);
    }

    /** Toggle the thumbnail cache info popup. */
    async _amToggleThumbPopup(root: HTMLElement): Promise<void> {
      await this._amGetActionController().toggleThumbPopup(root);
    }

    /** Handle context menu action. */
    _amHandleContextAction(action: string, filePath: string, root: HTMLElement): void {
      this._amGetActionController().handleContextAction(action, filePath, root);
    }
  }

  const { applied } = applyRuntimePatchOnce<AssetManagerPatchState>(
    ASSET_MANAGER_PATCH_KEY,
    () => ({
      originalFilePicker: BaseFilePicker as FilePickerClass,
      overrideFilePicker: FTHAssetPicker as unknown as FilePickerClass,
      originalInfoNotification: null,
      notificationSuppressionDepth: 0,
    }),
    (state) => {
      state.originalFilePicker = BaseFilePicker as FilePickerClass;
      state.overrideFilePicker = FTHAssetPicker as unknown as FilePickerClass;
      CONFIG.ux.FilePicker = FTHAssetPicker;
    }
  );

  if (!applied) {
    Log.debug("Asset Manager: FilePicker override already registered");
    return;
  }

  Log.info("Asset Manager: FilePicker override registered");
}

/* ── Standalone Browse Mode ───────────────────────────────── */

/**
 * Open the Asset Manager as a standalone browsing window (no selection callback).
 * Used by the scene control button and `window.fth.assetManager()`.
 */
export function openAssetManager(): void {
  const CONFIG = (globalThis as any).CONFIG; // eslint-disable-line @typescript-eslint/no-explicit-any
  const state = getAssetManagerPatchState();
  const Picker = (state.overrideFilePicker ?? CONFIG?.ux?.FilePicker) as FilePickerClass | undefined;
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

export const __assetManagerInternals = {
  getAssetManagerPatchState,
  suppressInfoNotifications,
};
