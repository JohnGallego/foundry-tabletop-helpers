import { Log } from "../logger";
import { getMetadataStore, type MetadataSnapshot } from "./asset-manager-metadata";
import type { AssetType, GridDensity, SortDir, SortField, ViewMode } from "./asset-manager-types";

type SmartCollection = "all" | "recent" | "unoptimized" | "images" | "audio" | "video";
type ActiveFilter = { type: "tag"; value: string } | { type: "asset-type"; value: AssetType };

interface AssetManagerControlsControllerDeps {
  getSearch: () => string;
  setSearch: (value: string) => void;
  getCollection: () => SmartCollection;
  setCollection: (value: SmartCollection) => void;
  getFilters: () => ActiveFilter[];
  setFilters: (value: ActiveFilter[]) => void;
  getViewMode: () => ViewMode;
  setViewMode: (value: ViewMode) => void;
  getDensity: () => GridDensity;
  setDensity: (value: GridDensity) => void;
  getSortField: () => SortField;
  setSortField: (value: SortField) => void;
  getSortDir: () => SortDir;
  setSortDir: (value: SortDir) => void;
  getSidebarOpen: () => boolean;
  setSidebarOpen: (value: boolean) => void;
  getPreviewPath: () => string | null;
  nextTagColor: () => string;
  applySearch: () => void;
  applySort: () => void;
  refreshUI: (root: HTMLElement) => void;
  refreshContent: (root: HTMLElement) => void;
  setupScroller: (root: HTMLElement) => void;
  browse: (path: string) => void;
  handleUpload: (files: File[], root: HTMLElement) => Promise<void>;
  promptCreateFolder: (root: HTMLElement) => Promise<void>;
  batchOptimize: (root: HTMLElement) => Promise<void>;
  clearUploadQueue: (root: HTMLElement) => void;
  persistViewMode: (value: ViewMode) => void;
  persistDensity: (value: GridDensity) => void;
  persistSort: (field: SortField, dir: SortDir) => void;
  persistSidebarOpen: (value: boolean) => void;
}

export class AssetManagerControlsController {
  constructor(private readonly deps: AssetManagerControlsControllerDeps) {}

  attachSearch(root: HTMLElement): void {
    const searchInput = root.querySelector<HTMLInputElement>(".am-search");
    if (!searchInput) return;

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.deps.setSearch(searchInput.value);
        this.deps.applySearch();
        this.deps.refreshContent(root);
      }, 150);
    });
  }

  attachToolbarButtons(root: HTMLElement): void {
    const uploadBtn = root.querySelector<HTMLElement>(".am-upload-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.style.display = "none";
        input.addEventListener("change", () => {
          const files = input.files;
          if (files && files.length) void this.deps.handleUpload(Array.from(files), root);
          input.remove();
        });
        document.body.appendChild(input);
        input.click();
      });
    }

    root.querySelector<HTMLElement>(".am-create-folder-btn")
      ?.addEventListener("click", () => { void this.deps.promptCreateFolder(root); });

    root.querySelector<HTMLElement>(".am-batch-btn")
      ?.addEventListener("click", () => { void this.deps.batchOptimize(root); });
  }

  attachSidebarActions(root: HTMLElement): void {
    root.querySelector(".am-sidebar-toggle")?.addEventListener("click", () => {
      const next = !this.deps.getSidebarOpen();
      this.deps.setSidebarOpen(next);
      this.deps.persistSidebarOpen(next);
      const body = root.querySelector<HTMLElement>(".am-body");
      body?.classList.toggle("am-sidebar-collapsed", !next);
      setTimeout(() => this.deps.setupScroller(root), 220);
    });

    root.querySelector(".am-sb-add-tag")?.addEventListener("click", () => {
      if (this.deps.getPreviewPath()) return;
      const name = prompt("Enter new tag name:");
      if (!name?.trim()) return;
      const tag = name.trim().toLowerCase();
      getMetadataStore().setTagColor(tag, this.deps.nextTagColor()).catch(() => { /* ignore */ });
      this.deps.refreshUI(root);
    });

    root.querySelector(".am-sb-export")?.addEventListener("click", async () => {
      try {
        const snapshot = await getMetadataStore().exportSnapshot();
        const json = JSON.stringify(snapshot, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "fth-asset-metadata.json";
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        Log.warn("Asset Manager: export failed", err);
      }
    });

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
          this.deps.refreshUI(root);
        } catch (err) {
          Log.warn("Asset Manager: import failed", err);
        }
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  handleClick(target: HTMLElement, root: HTMLElement): boolean {
    const viewBtn = target.closest<HTMLElement>("[data-am-view]");
    if (viewBtn) {
      const newView = viewBtn.dataset.amView as ViewMode;
      if (newView && newView !== this.deps.getViewMode()) {
        this.deps.setViewMode(newView);
        this.deps.persistViewMode(newView);
        this.deps.refreshUI(root);
      }
      return true;
    }

    const densityBtn = target.closest<HTMLElement>("[data-am-density]");
    if (densityBtn) {
      const newDensity = densityBtn.dataset.amDensity as GridDensity;
      if (newDensity && newDensity !== this.deps.getDensity()) {
        this.deps.setDensity(newDensity);
        this.deps.persistDensity(newDensity);
        this.deps.refreshUI(root);
      }
      return true;
    }

    if (target.closest(".am-sort-btn")) {
      const fields: SortField[] = ["name", "size", "type"];
      const idx = fields.indexOf(this.deps.getSortField());
      if (this.deps.getSortDir() === "asc") {
        this.deps.setSortDir("desc");
      } else {
        this.deps.setSortDir("asc");
        this.deps.setSortField(fields[(idx + 1) % fields.length]!);
      }
      this.deps.persistSort(this.deps.getSortField(), this.deps.getSortDir());
      this.deps.applySort();
      this.deps.applySearch();
      this.deps.refreshContent(root);
      const sortBtn = root.querySelector<HTMLElement>(".am-sort-btn");
      if (sortBtn) sortBtn.title = `Sort: ${this.deps.getSortField()} ${this.deps.getSortDir()}`;
      return true;
    }

    if (target.closest(".am-uq-close")) {
      this.deps.clearUploadQueue(root);
      return true;
    }

    const collectionBtn = target.closest<HTMLElement>("[data-am-collection]");
    if (collectionBtn) {
      this.deps.setCollection((collectionBtn.dataset.amCollection ?? "all") as SmartCollection);
      this.deps.applySearch();
      this.deps.refreshUI(root);
      return true;
    }

    const sidebarFolder = target.closest<HTMLElement>(".am-sb-folder[data-am-path]");
    if (sidebarFolder) {
      const path = sidebarFolder.dataset.amPath;
      if (path) this.deps.browse(path);
      return true;
    }

    const tagPill = target.closest<HTMLElement>("[data-am-tag]");
    if (tagPill) {
      const tag = tagPill.dataset.amTag;
      if (!tag) return true;
      const filters = [...this.deps.getFilters()];
      const idx = filters.findIndex((filter) => filter.type === "tag" && filter.value === tag);
      if (idx >= 0) filters.splice(idx, 1);
      else filters.push({ type: "tag", value: tag });
      this.deps.setFilters(filters);
      this.deps.applySearch();
      this.deps.refreshUI(root);
      return true;
    }

    const removeBtn = target.closest<HTMLElement>(".am-chip-remove");
    if (removeBtn) {
      const chip = removeBtn.closest<HTMLElement>(".am-chip");
      if (!chip) return true;

      if (chip.classList.contains("am-chip-collection")) {
        this.deps.setCollection("all");
      } else {
        const chipType = chip.dataset.amChipType;
        const chipValue = chip.dataset.amChipValue;
        this.deps.setFilters(
          this.deps.getFilters().filter((filter) => !(filter.type === chipType && filter.value === chipValue)),
        );
      }
      this.deps.applySearch();
      this.deps.refreshUI(root);
      return true;
    }

    return false;
  }
}
