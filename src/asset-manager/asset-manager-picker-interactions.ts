import { showContextMenu, startLongPress } from "./asset-manager-context-menu";
import type { AssetEntry } from "./asset-manager-types";

interface AssetManagerInteractionsControllerDeps {
  getFilteredEntries: () => AssetEntry[];
  getLastClickIndex: () => number;
  setLastClickIndex: (value: number) => void;
  getPreviewPath: () => string | null;
  getCurrentRequestPath: () => string;
  closePreview: (root: HTMLElement) => void;
  browse: (path: string) => void;
  deleteSelected: (root: HTMLElement) => Promise<void>;
  toggleThumbPopup: (root: HTMLElement) => Promise<void>;
  selectFile: (path: string, root: HTMLElement) => void;
  showPreview: (path: string, root: HTMLElement) => void;
  confirmSelection: (path: string) => void;
  handleContextAction: (action: string, path: string, root: HTMLElement) => void;
  handleUpload: (files: File[], root: HTMLElement) => Promise<void>;
  handleKeyboardNavigate: (key: string, root: HTMLElement) => void;
  getSelectedPath: (root: HTMLElement) => string | null;
  toggleFocusedSelection: (root: HTMLElement) => void;
  handleSelectAll: (root: HTMLElement) => void;
  handleClickSelection: (
    path: string,
    root: HTMLElement,
    options: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ) => void;
  updateSelectionStatus: (root: HTMLElement) => void;
  clearAndDeleteFolder: (path: string, root: HTMLElement) => void;
}

export class AssetManagerInteractionsController {
  constructor(private readonly deps: AssetManagerInteractionsControllerDeps) {}

  attach(root: HTMLElement): void {
    root.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;

      if (target.closest(".am-crumb-delete")) {
        void this.deps.deleteSelected(root);
        return;
      }

      if (target.closest(".am-thumb-info")) {
        void this.deps.toggleThumbPopup(root);
        return;
      }

      if (!target.closest(".am-thumb-popup")) {
        root.querySelector(".am-thumb-popup")?.remove();
      }

      const breadcrumb = target.closest<HTMLElement>("[data-am-path]");
      if (breadcrumb && breadcrumb.classList.contains("am-crumb")) {
        this.deps.browse(breadcrumb.dataset.amPath ?? "");
        return;
      }

      const deleteFolderButton = target.closest<HTMLElement>("[data-am-dir-delete]");
      if (deleteFolderButton) {
        const folderPath = deleteFolderButton.dataset.amDirDelete;
        if (folderPath) this.deps.clearAndDeleteFolder(folderPath, root);
        return;
      }

      const directoryCard = target.closest<HTMLElement>(".am-card-dir, .am-list-dir");
      if (directoryCard) {
        const path = directoryCard.dataset.amPath;
        if (path) this.deps.browse(path);
        return;
      }

      const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
      if (fileCard) {
        const path = fileCard.dataset.amPath;
        if (!path) return;

        this.deps.handleClickSelection(path, root, {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        });

        if (!(event.ctrlKey || event.metaKey || (event.shiftKey && this.deps.getLastClickIndex() >= 0))) {
          this.deps.selectFile(path, root);
          this.deps.showPreview(path, root);
          this.deps.setLastClickIndex(this.deps.getFilteredEntries().findIndex((entry) => entry.path === path));
        } else {
          this.deps.updateSelectionStatus(root);
        }
        return;
      }

      const actionButton = target.closest<HTMLElement>("[data-am-action]");
      if (actionButton) {
        const action = actionButton.dataset.amAction;
        const previewPath = this.deps.getPreviewPath();
        if (action === "copy-path" && previewPath) {
          navigator.clipboard.writeText(previewPath).catch(() => { /* ignore */ });
          actionButton.style.color = "#66bb6a";
          setTimeout(() => { actionButton.style.color = ""; }, 600);
        } else if (action === "select-file" && previewPath) {
          this.deps.confirmSelection(previewPath);
        }
        return;
      }

      if (target.closest(".am-preview-close")) {
        this.deps.closePreview(root);
      }
    });

    root.addEventListener("dblclick", (event) => {
      const target = event.target as HTMLElement;
      const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
      const path = fileCard?.dataset.amPath;
      if (path) this.deps.confirmSelection(path);
    });

    root.addEventListener("contextmenu", (event) => {
      const target = event.target as HTMLElement;
      const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
      const path = fileCard?.dataset.amPath;
      if (!path) return;

      event.preventDefault();
      showContextMenu(event.clientX, event.clientY, path, (action, filePath) => {
        this.deps.handleContextAction(action, filePath, root);
      });
    });

    root.addEventListener("touchstart", (event) => {
      const target = event.target as HTMLElement;
      const fileCard = target.closest<HTMLElement>(".am-card-file, .am-list-file");
      const path = fileCard?.dataset.amPath;
      const touch = event.touches[0];
      if (!path || !touch) return;

      const cleanup = startLongPress(touch.clientX, touch.clientY, path, (action, filePath) => {
        this.deps.handleContextAction(action, filePath, root);
      });
      const onEnd = () => {
        cleanup();
        root.removeEventListener("touchend", onEnd);
        root.removeEventListener("touchmove", onEnd);
      };
      root.addEventListener("touchend", onEnd, { once: true });
      root.addEventListener("touchmove", onEnd, { once: true });
    }, { passive: true });

    const contentWrap = root.querySelector<HTMLElement>(".am-content-wrap");
    if (contentWrap) {
      contentWrap.addEventListener("dragenter", (event) => {
        event.preventDefault();
        contentWrap.classList.add("am-drag-active");
      });
      contentWrap.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      });
      contentWrap.addEventListener("dragleave", (event) => {
        event.preventDefault();
        if (!contentWrap.contains(event.relatedTarget as Node | null)) {
          contentWrap.classList.remove("am-drag-active");
        }
      });
      contentWrap.addEventListener("drop", (event) => {
        event.preventDefault();
        contentWrap.classList.remove("am-drag-active");
        const files = event.dataTransfer?.files;
        if (files && files.length) void this.deps.handleUpload(Array.from(files), root);
      });
    }

    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", (event) => this.handleKeydown(event, root));
  }

  private handleKeydown(event: KeyboardEvent, root: HTMLElement): void {
    const key = event.key;
    const activeElement = globalThis.document?.activeElement as HTMLElement | null | undefined;
    const searchFocused = activeElement?.classList.contains("am-search");

    if (key === "/" && !searchFocused) {
      event.preventDefault();
      root.querySelector<HTMLInputElement>(".am-search")?.focus();
      return;
    }

    if (key === "Escape") {
      if (searchFocused) activeElement?.blur();
      else if (this.deps.getPreviewPath()) this.deps.closePreview(root);
      return;
    }

    if (searchFocused) return;

    if (key === "Backspace") {
      event.preventDefault();
      const parent = this.deps.getCurrentRequestPath().split("/").slice(0, -1).join("/");
      this.deps.browse(parent);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "a") {
      event.preventDefault();
      this.deps.handleSelectAll(root);
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
      event.preventDefault();
      this.deps.handleKeyboardNavigate(key, root);
      return;
    }

    if (key === "Enter") {
      event.preventDefault();
      const selectedPath = this.deps.getSelectedPath(root);
      if (!selectedPath) return;
      const entry = this.deps.getFilteredEntries().find((item) => item.path === selectedPath);
      if (entry?.isDir) this.deps.browse(selectedPath);
      else if (entry) this.deps.confirmSelection(selectedPath);
      return;
    }

    if (key === " ") {
      event.preventDefault();
      this.deps.toggleFocusedSelection(root);
    }
  }
}
