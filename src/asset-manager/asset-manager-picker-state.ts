import { Log } from "../logger";
import { getBrowseCache } from "./asset-manager-browse-cache";
import { getMetadataStore } from "./asset-manager-metadata";
import { isConvertible } from "./asset-manager-preview";
import {
  basename,
  classifyExt,
  extname,
  type AssetEntry,
  type AssetType,
  type SortDir,
  type SortField,
} from "./asset-manager-types";

type SmartCollection = "all" | "recent" | "unoptimized" | "images" | "audio" | "video";
type ActiveFilter = { type: "tag"; value: string } | { type: "asset-type"; value: AssetType };

interface AssetManagerStateControllerDeps {
  getEntries: () => AssetEntry[];
  setEntries: (entries: AssetEntry[]) => void;
  getFilteredEntries: () => AssetEntry[];
  setFilteredEntries: (entries: AssetEntry[]) => void;
  setUnoptimizedCount: (count: number) => void;
  getSearch: () => string;
  getCollection: () => SmartCollection;
  getFilters: () => ActiveFilter[];
  getCurrentPath: () => string;
  setCurrentPath: (path: string) => void;
  getSortField: () => SortField;
  getSortDir: () => SortDir;
  getActiveSource: () => string;
  getBrowseFn: () => ((path: string) => void) | undefined;
  getElementRoot: () => HTMLElement | null;
  buildHTML: () => string;
  buildSidebar: () => string;
  buildBreadcrumbs: (path: string) => string;
  attachListeners: (root: HTMLElement) => void;
  setupScroller: (root: HTMLElement) => void;
  updateStatusBar: (root: HTMLElement) => void;
}

interface BrowseResultLike {
  files?: string[];
  dirs?: string[];
}

export class AssetManagerStateController {
  constructor(private readonly deps: AssetManagerStateControllerDeps) {}

  parseResults(result: BrowseResultLike): void {
    const files = (result.files ?? []).filter((file) => !file.includes(".fth-thumbs"));
    const dirs = (result.dirs ?? []).filter((dir) => !dir.includes(".fth-thumbs"));
    const source = this.deps.getActiveSource();
    const target = this.deps.getCurrentPath();

    if (files.length || dirs.length) {
      getBrowseCache().set(source, target, result);
    }

    const entries: AssetEntry[] = [];

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

    this.deps.setEntries(entries);
    this.applySort();
    this.applySearch();
  }

  applySort(): void {
    const mult = this.deps.getSortDir() === "desc" ? -1 : 1;
    const sorted = [...this.deps.getEntries()].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      if (a.isDir) return a.name.localeCompare(b.name);

      let cmp = 0;
      switch (this.deps.getSortField()) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "type":
          cmp = a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
          break;
      }
      return cmp * mult;
    });

    this.deps.setEntries(sorted);
  }

  applySearch(): void {
    let entries = this.deps.getEntries();
    const collection = this.deps.getCollection();
    const filters = this.deps.getFilters();

    if (collection === "recent") {
      const recentPaths = new Set(getMetadataStore().getRecentFiles(50));
      entries = entries.filter((entry) => !entry.isDir && recentPaths.has(entry.path));
    } else if (collection === "unoptimized") {
      entries = entries.filter((entry) => !entry.isDir && isConvertible(entry.ext, entry.type));
    } else if (collection === "images") {
      entries = entries.filter((entry) => entry.isDir || entry.type === "image");
    } else if (collection === "audio") {
      entries = entries.filter((entry) => entry.isDir || entry.type === "audio");
    } else if (collection === "video") {
      entries = entries.filter((entry) => entry.isDir || entry.type === "video");
    }

    for (const filter of filters) {
      if (filter.type === "asset-type") {
        entries = entries.filter((entry) => entry.isDir || entry.type === filter.value);
      } else if (filter.type === "tag") {
        const tagged = new Set(getMetadataStore().getFilesByTag(filter.value));
        entries = entries.filter((entry) => entry.isDir || tagged.has(entry.path));
      }
    }

    const query = this.deps.getSearch().toLowerCase().trim();
    if (query) {
      const meta = getMetadataStore();
      const taggedPaths = new Set<string>();

      for (const file of meta.getFilesByTag(query)) taggedPaths.add(file);
      for (const tag of meta.getAllTags()) {
        if (tag.includes(query)) {
          for (const file of meta.getFilesByTag(tag)) taggedPaths.add(file);
        }
      }

      entries = entries.filter((entry) => {
        if (entry.name.toLowerCase().includes(query)) return true;
        if (entry.path.toLowerCase().includes(query)) return true;
        return taggedPaths.has(entry.path);
      });
    }

    this.deps.setFilteredEntries(entries);

    let unoptimizedCount = 0;
    for (const entry of entries) {
      if (!entry.isDir && isConvertible(entry.ext, entry.type)) unoptimizedCount++;
    }
    this.deps.setUnoptimizedCount(unoptimizedCount);
  }

  populateContent(root: HTMLElement): void {
    const target = this.deps.getCurrentPath();
    const breadcrumbEl = root.querySelector<HTMLElement>(".am-breadcrumbs");
    if (breadcrumbEl) breadcrumbEl.innerHTML = this.deps.buildBreadcrumbs(target);

    this.refreshSidebar(root);
    this.deps.setupScroller(root);
    this.deps.updateStatusBar(root);
  }

  browse(path: string): void {
    const browse = this.deps.getBrowseFn();
    if (!browse) return;

    this.deps.setCurrentPath(path);
    const root = this.deps.getElementRoot();

    if (root) {
      const breadcrumbEl = root.querySelector<HTMLElement>(".am-breadcrumbs");
      if (breadcrumbEl) breadcrumbEl.innerHTML = this.deps.buildBreadcrumbs(path);

      const content = root.querySelector<HTMLElement>(".am-content");
      if (content) {
        content.innerHTML = `<div class="am-content-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading files...</span></div>`;
      }

      const sidebar = root.querySelector<HTMLElement>(".am-sidebar");
      if (sidebar) {
        const folderSections = sidebar.querySelectorAll<HTMLElement>(".am-sb-section");
        for (const section of folderSections) {
          const label = section.querySelector<HTMLElement>(".am-sb-label");
          if (label?.textContent === "Folders") {
            section.innerHTML = `<div class="am-sb-label">Folders</div><div class="am-sb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
            break;
          }
        }
      }

      const statusCount = root.querySelector<HTMLElement>(".am-status-count");
      if (statusCount) statusCount.textContent = "Loading...";
    }

    const source = this.deps.getActiveSource();
    const cached = getBrowseCache().get(source, path);
    if (cached) Log.debug(`Asset Manager: cache hit for ${path}`);

    browse(path);
  }

  refreshUI(root: HTMLElement): void {
    const serverDot = root.querySelector<HTMLElement>(".am-server-dot");
    const wasOnline = serverDot?.classList.contains("am-server-online");
    const wasOffline = serverDot?.classList.contains("am-server-offline");
    const serverTitle = root.querySelector<HTMLElement>(".am-server-status")?.title ?? "";

    root.innerHTML = this.deps.buildHTML();
    this.deps.attachListeners(root);
    this.deps.setupScroller(root);

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

  refreshContent(root: HTMLElement): void {
    const count = root.querySelector<HTMLElement>(".am-status-count");
    if (count) count.textContent = `${this.deps.getFilteredEntries().length} items`;
    this.deps.setupScroller(root);
  }

  refreshSidebar(root: HTMLElement): void {
    const oldSidebar = root.querySelector<HTMLElement>(".am-sidebar");
    if (!oldSidebar) return;

    const temp = document.createElement("div");
    temp.innerHTML = this.deps.buildSidebar();
    const newSidebar = temp.querySelector(".am-sidebar");
    if (newSidebar) oldSidebar.replaceWith(newSidebar);
  }
}
