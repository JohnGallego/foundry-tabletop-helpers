import { dismissContextMenu } from "./asset-manager-context-menu";
import { getThumbCache } from "./asset-manager-thumb-cache";
import type { AssetEntry, AssetType } from "./asset-manager-types";

type SmartCollection = "all" | "recent" | "unoptimized" | "images" | "audio" | "video";
type ActiveFilter = { type: "tag"; value: string } | { type: "asset-type"; value: AssetType };

interface Destroyable {
  destroy: () => void;
}

interface Disconnectable {
  disconnect: () => void;
}

interface AssetManagerLifecycleControllerDeps {
  getBatchRunning: () => boolean;
  setBatchRunning: (value: boolean) => void;
  getUploader: () => Destroyable | null;
  setUploader: (value: null) => void;
  getImageObserver: () => Disconnectable | null;
  setImageObserver: (value: null) => void;
  getMutationObserver: () => Disconnectable | null;
  setMutationObserver: (value: null) => void;
  getScroller: () => Destroyable | null;
  setScroller: (value: null) => void;
  setPreviewPath: (value: string | null) => void;
  setPreviewMeta: (value: null) => void;
  setEntries: (value: AssetEntry[]) => void;
  setFilteredEntries: (value: AssetEntry[]) => void;
  getMultiSelect: () => Set<string>;
  setCollection: (value: SmartCollection) => void;
  setFilters: (value: ActiveFilter[]) => void;
  setShellPending: (value: boolean) => void;
}

type ConfirmDialogClass = {
  confirm: (options: Record<string, unknown>) => Promise<unknown>;
};

export class AssetManagerLifecycleController {
  constructor(private readonly deps: AssetManagerLifecycleControllerDeps) {}

  async confirmCloseIfNeeded(): Promise<boolean> {
    if (!this.deps.getBatchRunning()) return true;

    const DialogCls = this.getConfirmDialogClass();
    if (!DialogCls) {
      this.deps.setBatchRunning(false);
      return true;
    }

    const confirmed = await DialogCls.confirm({
      window: { title: "Optimization In Progress" },
      content: `<p>A batch optimization is currently running. Closing now will <strong>cancel</strong> the remaining files.</p><p>Files already optimized will keep their changes.</p>`,
      yes: { label: "Close Anyway", icon: "fa-solid fa-xmark" },
      no: { label: "Keep Open", icon: "fa-solid fa-spinner" },
      rejectClose: false,
    }).then((result) => result === true)
      .catch(() => false);

    if (confirmed) this.deps.setBatchRunning(false);
    return confirmed;
  }

  cleanupBeforeClose(): void {
    getThumbCache().revokeAll();
    dismissContextMenu();

    this.deps.setPreviewPath(null);
    this.deps.setPreviewMeta(null);

    const uploader = this.deps.getUploader();
    if (uploader) {
      uploader.destroy();
      this.deps.setUploader(null);
    }

    const imageObserver = this.deps.getImageObserver();
    if (imageObserver) {
      imageObserver.disconnect();
      this.deps.setImageObserver(null);
    }

    const mutationObserver = this.deps.getMutationObserver();
    if (mutationObserver) {
      mutationObserver.disconnect();
      this.deps.setMutationObserver(null);
    }

    const scroller = this.deps.getScroller();
    if (scroller) {
      scroller.destroy();
      this.deps.setScroller(null);
    }

    this.deps.setEntries([]);
    this.deps.setFilteredEntries([]);
    this.deps.getMultiSelect().clear();
    this.deps.setCollection("all");
    this.deps.setFilters([]);
    this.deps.setShellPending(false);
  }

  private getConfirmDialogClass(): ConfirmDialogClass | null {
    const foundryGlobal = globalThis as Record<string, unknown>;
    const foundryData = foundryGlobal.foundry as
      | { applications?: { api?: { DialogV2?: ConfirmDialogClass } } }
      | undefined;
    return foundryData?.applications?.api?.DialogV2 ?? null;
  }
}
