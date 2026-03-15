import { Log } from "../logger";
import { getBrowseCache } from "./asset-manager-browse-cache";
import {
  getThumbCacheStats,
  invalidateThumbStats,
  serverDeleteFile,
  serverDeleteFolder,
} from "./asset-manager-optimizer-client";
import { formatBytes } from "./asset-manager-preview";
import { basename, type AssetEntry } from "./asset-manager-types";

interface AssetManagerActionControllerDeps {
  getEntries: () => AssetEntry[];
  getMultiSelect: () => Set<string>;
  getCurrentPath: () => string;
  getActiveSource: () => string;
  browse: (path: string) => void;
  showPreview: (path: string, root: HTMLElement) => void;
  confirmSelection: (path: string) => void;
}

type ConfirmDialogClass = {
  confirm: (options: Record<string, unknown>) => Promise<boolean>;
};

export class AssetManagerActionController {
  constructor(private readonly deps: AssetManagerActionControllerDeps) {}

  async deleteSelected(root: HTMLElement): Promise<void> {
    const targets = this.getDeleteTargets(root);
    if (targets.length === 0) return;

    const folders = targets.filter((path) => this.deps.getEntries().some((entry) => entry.path === path && entry.isDir));
    const files = targets.filter((path) => !folders.includes(path));
    const confirmed = await this.confirmDelete(folders, files);
    if (!confirmed) return;

    const statusCount = root.querySelector<HTMLElement>(".am-status-count");
    const originalText = statusCount?.textContent ?? "";
    if (statusCount) statusCount.textContent = "Deleting...";

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

    invalidateThumbStats();
    this.deps.getMultiSelect().clear();

    if (deleted > 0) {
      const source = this.deps.getActiveSource();
      const target = this.deps.getCurrentPath();
      getBrowseCache().invalidate(source, target);
      this.deps.browse(target);
      if (statusCount) {
        statusCount.textContent = `Deleted ${deleted} item${deleted > 1 ? "s" : ""}`;
        setTimeout(() => { statusCount.textContent = originalText; }, 3000);
      }
    } else if (statusCount) {
      statusCount.textContent = originalText;
    }
  }

  async toggleThumbPopup(root: HTMLElement): Promise<void> {
    const existing = root.querySelector(".am-thumb-popup");
    if (existing) {
      existing.remove();
      return;
    }

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

    const statusBar = root.querySelector<HTMLElement>(".am-status-bar");
    if (statusBar) {
      statusBar.style.position = "relative";
      statusBar.appendChild(popup);
    }
  }

  handleContextAction(action: string, filePath: string, root: HTMLElement): void {
    switch (action) {
      case "preview":
        this.deps.showPreview(filePath, root);
        break;
      case "copy-path":
        navigator.clipboard.writeText(filePath).catch(() => { /* ignore */ });
        break;
      case "select":
        this.deps.confirmSelection(filePath);
        break;
      case "delete":
        this.deps.getMultiSelect().clear();
        this.deps.getMultiSelect().add(filePath);
        void this.deleteSelected(root);
        break;
    }
  }

  private getDeleteTargets(root: HTMLElement): string[] {
    const targets = [...this.deps.getMultiSelect()];
    if (targets.length > 0) return targets;

    const selected = root.querySelector<HTMLElement>(".am-selected[data-am-path]");
    return selected?.dataset.amPath ? [selected.dataset.amPath] : [];
  }

  private async confirmDelete(folders: string[], files: string[]): Promise<boolean> {
    const Dialog = this.getConfirmDialogClass();
    if (!Dialog) return false;

    let message = "";
    if (folders.length > 0 && files.length > 0) {
      message = `Delete ${files.length} file${files.length > 1 ? "s" : ""} and ${folders.length} folder${folders.length > 1 ? "s" : ""}?\n\nFolders and all their contents will be permanently deleted. This cannot be undone.`;
    } else if (folders.length > 0) {
      const folderNames = folders.map((path) => basename(path)).join(", ");
      message = `Delete folder${folders.length > 1 ? "s" : ""}: ${folderNames}?\n\nAll contents will be permanently deleted. This cannot be undone.`;
    } else {
      const fileNames = files.length <= 5
        ? files.map((path) => basename(path)).join(", ")
        : `${files.length} files`;
      message = `Delete ${fileNames}?\n\nThis cannot be undone.`;
    }

    return Dialog.confirm({
      window: { title: "Confirm Delete" },
      content: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      yes: { label: "Delete", icon: "fa-solid fa-trash" },
      no: { label: "Cancel" },
    });
  }

  private getConfirmDialogClass(): ConfirmDialogClass | null {
    const foundryGlobal = globalThis as Record<string, unknown>;
    const foundryData = foundryGlobal.foundry as
      | { applications?: { api?: { DialogV2?: ConfirmDialogClass } } }
      | undefined;
    if (foundryData?.applications?.api?.DialogV2) return foundryData.applications.api.DialogV2;

    const dialog = foundryGlobal.Dialog as ConfirmDialogClass | undefined;
    return dialog ?? null;
  }
}
