import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dismissContextMenu: vi.fn(),
  revokeAll: vi.fn(),
}));

vi.mock("./asset-manager-context-menu", () => ({
  dismissContextMenu: mocks.dismissContextMenu,
}));

vi.mock("./asset-manager-thumb-cache", () => ({
  getThumbCache: () => ({
    revokeAll: mocks.revokeAll,
  }),
}));

import { AssetManagerLifecycleController } from "./asset-manager-picker-lifecycle";

describe("asset manager lifecycle controller", () => {
  beforeEach(() => {
    mocks.dismissContextMenu.mockReset();
    mocks.revokeAll.mockReset();
    (globalThis as Record<string, unknown>).foundry = undefined;
  });

  it("cancels close when a batch is running and the user rejects the dialog", async () => {
    let batchRunning = true;

    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        api: {
          DialogV2: {
            confirm: vi.fn().mockResolvedValue(false),
          },
        },
      },
    };

    const controller = new AssetManagerLifecycleController({
      getBatchRunning: () => batchRunning,
      setBatchRunning: (value) => { batchRunning = value; },
      getUploader: () => null,
      setUploader: vi.fn(),
      getImageObserver: () => null,
      setImageObserver: vi.fn(),
      getMutationObserver: () => null,
      setMutationObserver: vi.fn(),
      getScroller: () => null,
      setScroller: vi.fn(),
      setPreviewPath: vi.fn(),
      setPreviewMeta: vi.fn(),
      setEntries: vi.fn(),
      setFilteredEntries: vi.fn(),
      getMultiSelect: () => new Set<string>(),
      setCollection: vi.fn(),
      setFilters: vi.fn(),
      setShellPending: vi.fn(),
    });

    await expect(controller.confirmCloseIfNeeded()).resolves.toBe(false);
    expect(batchRunning).toBe(true);
  });

  it("cleans up resources and resets state before close", () => {
    let uploaderDestroyed = false;
    let imageObserverDisconnected = false;
    let mutationObserverDisconnected = false;
    let scrollerDestroyed = false;
    const multiSelect = new Set<string>(["tokens/goblin.png"]);

    const setPreviewPath = vi.fn();
    const setPreviewMeta = vi.fn();
    const setEntries = vi.fn();
    const setFilteredEntries = vi.fn();
    const setCollection = vi.fn();
    const setFilters = vi.fn();
    const setShellPending = vi.fn();

    const controller = new AssetManagerLifecycleController({
      getBatchRunning: () => false,
      setBatchRunning: vi.fn(),
      getUploader: () => ({ destroy: () => { uploaderDestroyed = true; } }),
      setUploader: vi.fn(),
      getImageObserver: () => ({ disconnect: () => { imageObserverDisconnected = true; } }),
      setImageObserver: vi.fn(),
      getMutationObserver: () => ({ disconnect: () => { mutationObserverDisconnected = true; } }),
      setMutationObserver: vi.fn(),
      getScroller: () => ({ destroy: () => { scrollerDestroyed = true; } }),
      setScroller: vi.fn(),
      setPreviewPath,
      setPreviewMeta,
      setEntries,
      setFilteredEntries,
      getMultiSelect: () => multiSelect,
      setCollection,
      setFilters,
      setShellPending,
    });

    controller.cleanupBeforeClose();

    expect(mocks.revokeAll).toHaveBeenCalled();
    expect(mocks.dismissContextMenu).toHaveBeenCalled();
    expect(uploaderDestroyed).toBe(true);
    expect(imageObserverDisconnected).toBe(true);
    expect(mutationObserverDisconnected).toBe(true);
    expect(scrollerDestroyed).toBe(true);
    expect(setPreviewPath).toHaveBeenCalledWith(null);
    expect(setPreviewMeta).toHaveBeenCalledWith(null);
    expect(setEntries).toHaveBeenCalledWith([]);
    expect(setFilteredEntries).toHaveBeenCalledWith([]);
    expect(multiSelect.size).toBe(0);
    expect(setCollection).toHaveBeenCalledWith("all");
    expect(setFilters).toHaveBeenCalledWith([]);
    expect(setShellPending).toHaveBeenCalledWith(false);
  });
});
