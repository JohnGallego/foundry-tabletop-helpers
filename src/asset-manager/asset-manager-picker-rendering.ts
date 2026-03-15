import { isConvertible } from "./asset-manager-preview";
import { type AssetEntry, type AssetType, type GridDensity, type SortDir, type SortField, type ViewMode, DENSITY_SIZES } from "./asset-manager-types";
import { getMetadataStore } from "./asset-manager-metadata";

export type SmartCollection = "all" | "recent" | "unoptimized" | "images" | "audio" | "video";
export type ActiveFilter = { type: "tag"; value: string } | { type: "asset-type"; value: AssetType };

export interface AssetManagerRenderState {
  currentPath: string;
  search: string;
  collection: SmartCollection;
  filters: ActiveFilter[];
  entries: AssetEntry[];
  filteredEntries: AssetEntry[];
  previewPath: string | null;
  unoptimizedCount: number;
  density: GridDensity;
  viewMode: ViewMode;
  sortField: SortField;
  sortDir: SortDir;
  sidebarOpen: boolean;
}

interface HtmlOptions {
  esc: (value: string) => string;
}

export function buildShellHTML(state: AssetManagerRenderState, options: HtmlOptions): string {
  const { esc } = options;
  const breadcrumbs = buildBreadcrumbs(state.currentPath, options);
  const thumbSize = DENSITY_SIZES[state.density];
  const meta = getMetadataStore();
  const allTags = meta.getAllTags();

  const tagPills = allTags.map((tag) => {
    const color = meta.getTagColor(tag);
    const active = state.filters.some((f) => f.type === "tag" && f.value === tag);
    return `<button class="am-tag-pill${active ? " am-tag-active" : ""}" data-am-tag="${esc(tag)}" type="button" style="--am-tag-color: ${color};">${esc(tag)}</button>`;
  }).join("");

  const filterChips = buildFilterChips(state, options);

  return `
    <div class="am-toolbar">
      <button class="am-sidebar-toggle" type="button" title="Toggle sidebar">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="am-search-wrap">
        <i class="fa-solid fa-magnifying-glass am-search-icon"></i>
        <input type="search" class="am-search" placeholder="Search files..." autocomplete="off" value="${esc(state.search)}" />
      </div>
      <div class="am-toolbar-controls">
        <div class="am-view-toggle">
          <button class="am-view-btn ${state.viewMode === "grid" ? "am-active" : ""}" data-am-view="grid" type="button" title="Grid view"><i class="fa-solid fa-grid-2"></i></button>
          <button class="am-view-btn ${state.viewMode === "list" ? "am-active" : ""}" data-am-view="list" type="button" title="List view"><i class="fa-solid fa-list"></i></button>
        </div>
        <div class="am-density-toggle">
          <button class="am-density-btn ${state.density === "small" ? "am-active" : ""}" data-am-density="small" type="button" title="Small">S</button>
          <button class="am-density-btn ${state.density === "medium" ? "am-active" : ""}" data-am-density="medium" type="button" title="Medium">M</button>
          <button class="am-density-btn ${state.density === "large" ? "am-active" : ""}" data-am-density="large" type="button" title="Large">L</button>
        </div>
        <button class="am-sort-btn" type="button" title="Sort: ${state.sortField} ${state.sortDir}">
          <i class="fa-solid fa-arrow-down-short-wide"></i>
        </button>
        <button class="am-batch-btn" type="button" title="Batch optimize images in this folder">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button class="am-create-folder-btn" type="button" title="Create folder">
          <i class="fa-solid fa-folder-plus"></i>
        </button>
        <button class="am-upload-btn" type="button" title="Upload files">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>
    ${filterChips}
    <div class="am-breadcrumbs">${breadcrumbs}</div>
    <div class="am-body${state.sidebarOpen ? "" : " am-sidebar-collapsed"}">
      <div class="am-sidebar">
        <div class="am-sb-section">
          <div class="am-sb-label">Collections</div>
          <button class="am-sb-item${state.collection === "all" ? " am-sb-active" : ""}" data-am-collection="all" type="button">
            <i class="fa-solid fa-folder-open"></i><span>All Files</span>
          </button>
          <button class="am-sb-item${state.collection === "recent" ? " am-sb-active" : ""}" data-am-collection="recent" type="button">
            <i class="fa-solid fa-clock-rotate-left"></i><span>Recent</span>
          </button>
          <button class="am-sb-item${state.collection === "unoptimized" ? " am-sb-active" : ""}" data-am-collection="unoptimized" type="button">
            <i class="fa-solid fa-triangle-exclamation"></i><span>Unoptimized</span>
          </button>
        </div>
        <div class="am-sb-section">
          <div class="am-sb-label">By Type</div>
          <button class="am-sb-item${state.collection === "images" ? " am-sb-active" : ""}" data-am-collection="images" type="button">
            <i class="fa-solid fa-image"></i><span>Images</span>
          </button>
          <button class="am-sb-item${state.collection === "audio" ? " am-sb-active" : ""}" data-am-collection="audio" type="button">
            <i class="fa-solid fa-music"></i><span>Audio</span>
          </button>
          <button class="am-sb-item${state.collection === "video" ? " am-sb-active" : ""}" data-am-collection="video" type="button">
            <i class="fa-solid fa-film"></i><span>Video</span>
          </button>
        </div>
        <div class="am-sb-section">
          <div class="am-sb-label">Folders</div>
          <div class="am-sb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>
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
        <div class="am-content" data-density="${state.density}" data-view="${state.viewMode}" style="--am-thumb-size: ${thumbSize}px;">
          <div class="am-content-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading files...</span>
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
      <span class="am-status-count">Loading...</span>
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

export function buildHTML(state: AssetManagerRenderState, options: HtmlOptions): string {
  const { esc } = options;
  const breadcrumbs = buildBreadcrumbs(state.currentPath, options);
  const thumbSize = DENSITY_SIZES[state.density];
  const hasPreview = state.previewPath !== null;
  const sidebar = buildSidebar(state, options);
  const filterChips = buildFilterChips(state, options);

  return `
    <div class="am-toolbar">
      <button class="am-sidebar-toggle" type="button" title="Toggle sidebar">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="am-search-wrap">
        <i class="fa-solid fa-magnifying-glass am-search-icon"></i>
        <input type="search" class="am-search" placeholder="Search files..." autocomplete="off" value="${esc(state.search)}" />
      </div>
      <div class="am-toolbar-controls">
        <div class="am-view-toggle">
          <button class="am-view-btn ${state.viewMode === "grid" ? "am-active" : ""}" data-am-view="grid" type="button" title="Grid view"><i class="fa-solid fa-grid-2"></i></button>
          <button class="am-view-btn ${state.viewMode === "list" ? "am-active" : ""}" data-am-view="list" type="button" title="List view"><i class="fa-solid fa-list"></i></button>
        </div>
        <div class="am-density-toggle">
          <button class="am-density-btn ${state.density === "small" ? "am-active" : ""}" data-am-density="small" type="button" title="Small">S</button>
          <button class="am-density-btn ${state.density === "medium" ? "am-active" : ""}" data-am-density="medium" type="button" title="Medium">M</button>
          <button class="am-density-btn ${state.density === "large" ? "am-active" : ""}" data-am-density="large" type="button" title="Large">L</button>
        </div>
        <button class="am-sort-btn" type="button" title="Sort: ${state.sortField} ${state.sortDir}">
          <i class="fa-solid fa-arrow-down-short-wide"></i>
        </button>
        <button class="am-batch-btn" type="button" title="Batch optimize images in this folder">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button class="am-create-folder-btn" type="button" title="Create folder">
          <i class="fa-solid fa-folder-plus"></i>
        </button>
        <button class="am-upload-btn" type="button" title="Upload files">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>
    ${filterChips}
    <div class="am-breadcrumbs">${breadcrumbs}</div>
    <div class="am-body${state.sidebarOpen ? "" : " am-sidebar-collapsed"}">
      ${sidebar}
      <div class="am-content-wrap${hasPreview ? " am-has-preview" : ""}">
        <div class="am-content" data-density="${state.density}" data-view="${state.viewMode}" style="--am-thumb-size: ${thumbSize}px;">
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
      <span class="am-status-count">${state.filteredEntries.length} items</span>
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

export function buildSidebar(state: AssetManagerRenderState, options: HtmlOptions): string {
  const { esc } = options;
  const meta = getMetadataStore();
  const allTags = meta.getAllTags();

  let imgCount = 0;
  let audCount = 0;
  let vidCount = 0;
  let unoptCount = 0;
  const dirs: AssetEntry[] = [];

  for (const entry of state.entries) {
    if (entry.isDir) {
      dirs.push(entry);
      continue;
    }
    if (entry.type === "image") imgCount++;
    else if (entry.type === "audio") audCount++;
    else if (entry.type === "video") vidCount++;
    if (isConvertible(entry.ext, entry.type)) unoptCount++;
  }

  const tagPills = allTags.map((tag) => {
    const color = meta.getTagColor(tag);
    const active = state.filters.some((f) => f.type === "tag" && f.value === tag);
    return `<button class="am-tag-pill${active ? " am-tag-active" : ""}" data-am-tag="${esc(tag)}" type="button" style="--am-tag-color: ${color};">${esc(tag)}</button>`;
  }).join("");

  return `
    <div class="am-sidebar">
      <div class="am-sb-section">
        <div class="am-sb-label">Collections</div>
        <button class="am-sb-item${state.collection === "all" ? " am-sb-active" : ""}" data-am-collection="all" type="button">
          <i class="fa-solid fa-folder-open"></i><span>All Files</span>
        </button>
        <button class="am-sb-item${state.collection === "recent" ? " am-sb-active" : ""}" data-am-collection="recent" type="button">
          <i class="fa-solid fa-clock-rotate-left"></i><span>Recent</span>
        </button>
        <button class="am-sb-item${state.collection === "unoptimized" ? " am-sb-active" : ""}" data-am-collection="unoptimized" type="button">
          <i class="fa-solid fa-triangle-exclamation"></i><span>Unoptimized</span>${unoptCount ? `<span class="am-sb-count">${unoptCount}</span>` : ""}
        </button>
      </div>
      <div class="am-sb-section">
        <div class="am-sb-label">By Type</div>
        <button class="am-sb-item${state.collection === "images" ? " am-sb-active" : ""}" data-am-collection="images" type="button">
          <i class="fa-solid fa-image"></i><span>Images</span>${imgCount ? `<span class="am-sb-count">${imgCount}</span>` : ""}
        </button>
        <button class="am-sb-item${state.collection === "audio" ? " am-sb-active" : ""}" data-am-collection="audio" type="button">
          <i class="fa-solid fa-music"></i><span>Audio</span>${audCount ? `<span class="am-sb-count">${audCount}</span>` : ""}
        </button>
        <button class="am-sb-item${state.collection === "video" ? " am-sb-active" : ""}" data-am-collection="video" type="button">
          <i class="fa-solid fa-film"></i><span>Video</span>${vidCount ? `<span class="am-sb-count">${vidCount}</span>` : ""}
        </button>
      </div>
      ${dirs.length > 0 ? `
      <div class="am-sb-section">
        <div class="am-sb-label">Folders</div>
        ${dirs.slice(0, 15).map((dir) => `
          <button class="am-sb-folder" data-am-path="${esc(dir.path)}" type="button" title="${esc(dir.name)}">
            <i class="fa-solid fa-folder"></i>
            <span>${esc(dir.name)}</span>
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

export function buildFilterChips(state: AssetManagerRenderState, options: HtmlOptions): string {
  const { esc } = options;
  if (state.filters.length === 0 && state.collection === "all") return "";

  let chips = "";

  if (state.collection !== "all") {
    const labels: Record<SmartCollection, string> = {
      all: "",
      recent: "Recent",
      unoptimized: "Unoptimized",
      images: "Images",
      audio: "Audio",
      video: "Video",
    };
    chips += `<span class="am-chip am-chip-collection" data-am-chip-collection="${state.collection}">
      ${labels[state.collection]}<button class="am-chip-remove" type="button"><i class="fa-solid fa-xmark"></i></button>
    </span>`;
  }

  for (const filter of state.filters) {
    chips += `<span class="am-chip am-chip-${filter.type}" data-am-chip-type="${filter.type}" data-am-chip-value="${esc(filter.value)}">
      ${esc(filter.value)}<button class="am-chip-remove" type="button"><i class="fa-solid fa-xmark"></i></button>
    </span>`;
  }

  return `<div class="am-filter-bar">${chips}</div>`;
}

export function buildBreadcrumbs(path: string, options: HtmlOptions): string {
  const { esc } = options;
  const segments = path.split("/").filter(Boolean);
  let html = `<button class="am-crumb" data-am-path="" type="button"><i class="fa-solid fa-house-chimney"></i></button>`;

  if (segments.length > 0) {
    const parentPath = segments.slice(0, -1).join("/");
    html += `<button class="am-crumb am-crumb-up" data-am-path="${esc(parentPath)}" type="button" title="Up a level"><i class="fa-solid fa-arrow-up"></i></button>`;
  }

  let cumPath = "";
  for (const segment of segments) {
    cumPath += (cumPath ? "/" : "") + segment;
    html += `<span class="am-crumb-sep"><i class="fa-solid fa-chevron-right"></i></span>`;
    html += `<button class="am-crumb" data-am-path="${esc(cumPath)}" type="button">${esc(segment)}</button>`;
  }

  html += `<button class="am-crumb-delete" type="button" title="Delete selected files"><i class="fa-solid fa-trash"></i></button>`;
  return html;
}

function getFileIcon(ext: string): string {
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

export function renderGridItem(entry: AssetEntry, options: HtmlOptions): string {
  const { esc } = options;
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

  const optBadge = isConvertible(entry.ext, entry.type)
    ? `<span class="am-opt-badge am-opt-convertible" title="Can be optimized"><i class="fa-solid fa-triangle-exclamation"></i></span>`
    : "";

  const thumbContent = entry.type === "image"
    ? `<img loading="lazy" decoding="async" data-am-src="${esc(entry.path)}" alt="" class="am-card-img" />`
    : entry.type === "audio"
      ? `<i class="fa-solid fa-music am-card-placeholder"></i>`
      : entry.type === "video"
        ? `<i class="fa-solid fa-film am-card-placeholder"></i>`
        : getFileIcon(entry.ext);

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

export function renderListItem(entry: AssetEntry, options: HtmlOptions): string {
  const { esc } = options;
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
