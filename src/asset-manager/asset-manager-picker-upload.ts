import { Log, MOD } from "../logger";
import { getGame } from "../types";
import { AM_SETTINGS } from "./asset-manager-settings";
import { getBrowseCache } from "./asset-manager-browse-cache";
import { type OptPreset, UploadManager, batchOptimize, buildUploadQueueHTML, type UploadQueueItem } from "./asset-manager-upload";
import { showUploadConfirmDialog } from "./asset-manager-upload-dialog";
import { getMetadataStore } from "./asset-manager-metadata";
import { serverCreateFolder } from "./asset-manager-optimizer-client";
import { formatBytes } from "./asset-manager-preview";
import { type AssetEntry } from "./asset-manager-types";

interface AssetManagerUploadControllerDeps {
  getCurrentPath: () => string;
  getActiveSource: () => string;
  getEntries: () => AssetEntry[];
  getBatchRunning: () => boolean;
  setBatchRunning: (value: boolean) => void;
  getUploader: () => UploadManager | null;
  setUploader: (uploader: UploadManager | null) => void;
  browse: (path: string) => void;
  suppressInfoNotifications: () => () => void;
  baseFilePickerUpload: (source: string, target: string, file: File) => Promise<string>;
}

export class AssetManagerUploadController {
  constructor(private readonly deps: AssetManagerUploadControllerDeps) {}

  async handleUpload(files: File[], root: HTMLElement): Promise<void> {
    const target = this.deps.getCurrentPath();
    const dialogResult = await showUploadConfirmDialog(files, target);
    if (!dialogResult) return;

    if (dialogResult.tags.length > 0) {
      const meta = getMetadataStore();
      for (const item of dialogResult.files) {
        const fullPath = target ? `${target}/${item.outputName}` : item.outputName;
        for (const tag of dialogResult.tags) {
          meta.addTag(fullPath, tag).catch(() => { /* ignore */ });
        }
      }
      Log.info(`Upload: Applied ${dialogResult.tags.length} tag(s) to ${dialogResult.files.length} file(s)`);
    }

    if (!this.deps.getUploader()) {
      this.deps.setUploader(new UploadManager(
        (queue: UploadQueueItem[]) => {
          const queueEl = root.querySelector<HTMLElement>(".am-upload-queue");
          if (queueEl) {
            queueEl.innerHTML = buildUploadQueueHTML(queue);
            queueEl.classList.toggle("am-uq-visible", queue.length > 0);
          }
        },
        async (file: File, name: string): Promise<string> => {
          const curSource = this.deps.getActiveSource();
          const curTarget = this.deps.getCurrentPath();
          const restore = this.deps.suppressInfoNotifications();
          try {
            Log.info(`Upload: Foundry upload starting — source="${curSource}", target="${curTarget}", file="${name}" (${file.size} bytes)`);
            const uploadStart = performance.now();
            const path = await this.deps.baseFilePickerUpload(curSource, curTarget, new File([file], name, { type: file.type }));
            Log.info(`Upload: Foundry upload complete (${Math.round(performance.now() - uploadStart)}ms)`, { path });
            return path;
          } catch (err) {
            Log.warn("Upload: Foundry upload THREW", err);
            throw err;
          } finally {
            restore();
          }
        },
        () => {
          const curSource = this.deps.getActiveSource();
          const curTarget = this.deps.getCurrentPath();
          getBrowseCache().invalidate(curSource, curTarget);
          this.deps.browse(curTarget);
        },
      ));
    }

    this.deps.getUploader()?.enqueueWithOptions(dialogResult.files);
  }

  async promptCreateFolder(root: HTMLElement): Promise<void> {
    const source = this.deps.getActiveSource();
    const target = this.deps.getCurrentPath();

    const DialogClass = (globalThis as Record<string, unknown>).Dialog as
      | (new (data: Record<string, unknown>) => { render(force?: boolean): void })
      | undefined;
    if (!DialogClass) return;

    const content = `
      <form class="am-create-folder-form">
        <div style="margin-bottom: 8px;">
          <label style="display:block; margin-bottom: 4px; font-weight: 600;">Folder Name</label>
          <input type="text" name="folderName" placeholder="New Folder"
                 style="width: 100%; padding: 6px 8px;" autofocus />
        </div>
        <p class="notes" style="opacity: 0.7; font-size: 0.85em;">
          Will be created in: <code>${target || "/"}</code>
        </p>
      </form>
    `;

    new DialogClass({
      title: "Create Folder",
      content,
      buttons: {
        create: {
          icon: '<i class="fa-solid fa-folder-plus"></i>',
          label: "Create",
          callback: async (html: { 0?: ParentNode; querySelector?: (selector: string) => Element | null }) => {
            const input = html[0]?.querySelector?.('input[name="folderName"]')
              ?? html.querySelector?.('input[name="folderName"]');
            const name = ((input as HTMLInputElement | null)?.value ?? "").trim();
            if (!name) return;

            if (/[/\\]/.test(name) || name === "." || name === ".." || name.startsWith(".fth-")) {
              Log.warn("Invalid folder name");
              return;
            }

            const fullPath = target ? `${target}/${name}` : name;
            const ok = await serverCreateFolder(fullPath);
            const statusEl = root.querySelector<HTMLElement>(".am-status-text");

            if (ok) {
              getBrowseCache().invalidate(source, target);
              this.deps.browse(target);
              if (statusEl) statusEl.textContent = `Created folder: ${name}`;
            } else if (statusEl) {
              statusEl.textContent = `Failed to create folder "${name}"`;
            }
          },
        },
        cancel: {
          icon: '<i class="fa-solid fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "create",
    }).render(true);
  }

  async batchOptimize(root: HTMLElement): Promise<void> {
    if (this.deps.getBatchRunning()) return;

    const source = this.deps.getActiveSource();
    const target = this.deps.getCurrentPath();
    const optimizableFiles = this.deps.getEntries()
      .filter((entry) => !entry.isDir && (entry.type === "image" || entry.type === "audio"))
      .map((entry) => entry.path);

    if (optimizableFiles.length === 0) {
      Log.debug("Asset Manager: no optimizable files in this folder");
      return;
    }

    let preset: OptPreset = "auto";
    try {
      const game = getGame();
      preset = (game?.settings?.get?.(MOD, AM_SETTINGS.DEFAULT_PRESET) as OptPreset) ?? "auto";
    } catch {
      /* use auto */
    }

    const statusCount = root.querySelector<HTMLElement>(".am-status-count");
    const progressWrap = root.querySelector<HTMLElement>(".am-batch-progress");
    const progressFill = root.querySelector<HTMLElement>(".am-batch-progress-fill");
    const originalText = statusCount?.textContent ?? "";

    this.deps.setBatchRunning(true);
    if (progressWrap) progressWrap.style.display = "";
    if (progressFill) progressFill.style.width = "0%";

    const restoreNotifications = this.deps.suppressInfoNotifications();

    const result = await batchOptimize(
      optimizableFiles,
      preset,
      async (file: File, name: string, targetDir: string): Promise<string> => {
        if (!this.deps.getBatchRunning()) throw new Error("cancelled");
        const uploadTarget = targetDir || target;
        return this.deps.baseFilePickerUpload(source, uploadTarget, new File([file], name, { type: file.type }));
      },
      (current, total, fileName) => {
        const pct = Math.round((current / total) * 100);
        if (statusCount) statusCount.textContent = `Optimizing ${current}/${total}: ${fileName}`;
        if (progressFill) progressFill.style.width = `${pct}%`;
      },
    );

    this.deps.setBatchRunning(false);
    restoreNotifications();

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

    if (result.processed > 0) {
      getBrowseCache().invalidate(source, target);
      this.deps.browse(target);
    }
  }
}
