import { type AssetEntry } from "./asset-manager-types";

interface AssetManagerSelectionControllerDeps {
  getFilteredEntries: () => AssetEntry[];
  getMultiSelect: () => Set<string>;
  getUnoptimizedCount: () => number;
  getViewMode: () => "grid" | "list";
  getCurrentSelectionPath: (root: HTMLElement) => string | null;
  setLastClickIndex: (index: number) => void;
  getLastClickIndex: () => number;
}

export class AssetManagerSelectionController {
  constructor(private readonly deps: AssetManagerSelectionControllerDeps) {}

  renderMultiSelect(root: HTMLElement): void {
    root.querySelectorAll(".am-multi-selected").forEach((el) => el.classList.remove("am-multi-selected"));

    for (const path of this.deps.getMultiSelect()) {
      const el = root.querySelector(`[data-am-path="${CSS.escape(path)}"]:not(.am-crumb)`);
      if (el) el.classList.add("am-multi-selected");
    }
  }

  updateStatusBar(root: HTMLElement): void {
    const statusCount = root.querySelector<HTMLElement>(".am-status-count");
    if (!statusCount) return;

    const total = this.deps.getFilteredEntries().length;
    const selCount = this.deps.getMultiSelect().size;

    if (selCount > 0) {
      statusCount.textContent = `${selCount} selected · ${total} items`;
    } else {
      const unoptimized = this.deps.getUnoptimizedCount();
      statusCount.textContent = unoptimized > 0
        ? `${total} items · ${unoptimized} unoptimized`
        : `${total} items`;
    }

    const deleteBtn = root.querySelector<HTMLElement>(".am-crumb-delete");
    if (deleteBtn) {
      const hasSelection = selCount > 0 || root.querySelector(".am-selected") !== null;
      deleteBtn.classList.toggle("am-delete-active", hasSelection);
    }
  }

  selectFile(path: string, root: HTMLElement, updateInternalSelection: (path: string) => void): void {
    root.querySelectorAll(".am-selected").forEach((el) => el.classList.remove("am-selected"));

    const card = root.querySelector(`[data-am-path="${CSS.escape(path)}"]:not(.am-crumb)`);
    if (card) card.classList.add("am-selected");

    updateInternalSelection(path);
  }

  keyboardNavigate(key: string, root: HTMLElement): void {
    const items = root.querySelectorAll<HTMLElement>("[data-am-path]:not(.am-crumb)");
    if (items.length === 0) return;

    const focused = root.querySelector<HTMLElement>(".am-kb-focus");
    let currentIdx = -1;
    if (focused) {
      items.forEach((el, i) => { if (el === focused) currentIdx = i; });
    }

    let cols = 1;
    if (this.deps.getViewMode() === "grid" && items.length >= 2) {
      const rect0 = items[0]!.getBoundingClientRect();
      const rect1 = items[1]!.getBoundingClientRect();
      if (Math.abs(rect0.top - rect1.top) < 2) {
        const rowTop = rect0.top;
        cols = 0;
        for (const item of items) {
          if (Math.abs(item.getBoundingClientRect().top - rowTop) < 2) cols++;
          else break;
        }
      }
    }

    let newIdx = currentIdx;
    switch (key) {
      case "ArrowRight": newIdx = Math.min(currentIdx + 1, items.length - 1); break;
      case "ArrowLeft": newIdx = Math.max(currentIdx - 1, 0); break;
      case "ArrowDown": newIdx = Math.min(currentIdx + cols, items.length - 1); break;
      case "ArrowUp": newIdx = Math.max(currentIdx - cols, 0); break;
    }
    if (newIdx < 0) newIdx = 0;

    if (focused) focused.classList.remove("am-kb-focus");
    const target = items[newIdx];
    if (target) {
      target.classList.add("am-kb-focus");
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  getSelectedPath(root: HTMLElement): string | null {
    const focused = root.querySelector<HTMLElement>(".am-kb-focus");
    return focused?.dataset.amPath ?? null;
  }

  handleSelectAll(root: HTMLElement): void {
    const multiSelect = this.deps.getMultiSelect();
    multiSelect.clear();
    for (const entry of this.deps.getFilteredEntries()) {
      if (!entry.isDir) multiSelect.add(entry.path);
    }
    this.renderMultiSelect(root);
    this.updateStatusBar(root);
  }

  toggleFocusedSelection(root: HTMLElement): void {
    const selectedPath = this.getSelectedPath(root);
    if (!selectedPath) return;
    const entry = this.deps.getFilteredEntries().find((f) => f.path === selectedPath);
    if (!entry || entry.isDir) return;

    const multiSelect = this.deps.getMultiSelect();
    if (multiSelect.has(selectedPath)) multiSelect.delete(selectedPath);
    else multiSelect.add(selectedPath);

    this.renderMultiSelect(root);
    this.updateStatusBar(root);
  }

  handleClickSelection(path: string, root: HTMLElement, options: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): void {
    const multiSelect = this.deps.getMultiSelect();
    const filtered = this.deps.getFilteredEntries();

    if (options.ctrlKey || options.metaKey) {
      if (multiSelect.has(path)) multiSelect.delete(path);
      else multiSelect.add(path);
      this.renderMultiSelect(root);
      this.deps.setLastClickIndex(filtered.findIndex((f) => f.path === path));
      return;
    }

    if (options.shiftKey && this.deps.getLastClickIndex() >= 0) {
      const clickIdx = filtered.findIndex((f) => f.path === path);
      if (clickIdx >= 0) {
        const start = Math.min(this.deps.getLastClickIndex(), clickIdx);
        const end = Math.max(this.deps.getLastClickIndex(), clickIdx);
        for (let i = start; i <= end; i++) {
          const entry = filtered[i];
          if (entry && !entry.isDir) multiSelect.add(entry.path);
        }
        this.renderMultiSelect(root);
      }
      return;
    }

    multiSelect.clear();
  }
}
