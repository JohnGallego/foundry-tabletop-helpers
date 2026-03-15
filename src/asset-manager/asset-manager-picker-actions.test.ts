import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateBrowseCache: vi.fn(),
  serverDeleteFile: vi.fn(),
  serverDeleteFolder: vi.fn(),
  invalidateThumbStats: vi.fn(),
}));

vi.mock("./asset-manager-browse-cache", () => ({
  getBrowseCache: () => ({
    invalidate: mocks.invalidateBrowseCache,
  }),
}));

vi.mock("./asset-manager-optimizer-client", () => ({
  getThumbCacheStats: vi.fn(),
  invalidateThumbStats: mocks.invalidateThumbStats,
  serverDeleteFile: mocks.serverDeleteFile,
  serverDeleteFolder: mocks.serverDeleteFolder,
}));

import { AssetManagerActionController } from "./asset-manager-picker-actions";

describe("asset manager action controller", () => {
  beforeEach(() => {
    mocks.invalidateBrowseCache.mockReset();
    mocks.serverDeleteFile.mockReset();
    mocks.serverDeleteFolder.mockReset();
    mocks.invalidateThumbStats.mockReset();
    (globalThis as Record<string, unknown>).Dialog = undefined;
    (globalThis as Record<string, unknown>).foundry = undefined;
  });

  it("routes preview and select context actions through the provided callbacks", () => {
    const preview = vi.fn();
    const confirm = vi.fn();
    const controller = new AssetManagerActionController({
      getEntries: () => [],
      getMultiSelect: () => new Set<string>(),
      getCurrentPath: () => "",
      getActiveSource: () => "data",
      browse: vi.fn(),
      showPreview: preview,
      confirmSelection: confirm,
    });

    const root = { querySelector: vi.fn() } as unknown as HTMLElement;
    controller.handleContextAction("preview", "art/token.webp", root);
    controller.handleContextAction("select", "art/token.webp", root);

    expect(preview).toHaveBeenCalledWith("art/token.webp", root);
    expect(confirm).toHaveBeenCalledWith("art/token.webp");
  });

  it("deletes the selected file, invalidates caches, and refreshes the browse view", async () => {
    mocks.serverDeleteFile.mockResolvedValue(true);

    (globalThis as Record<string, unknown>).Dialog = {
      confirm: vi.fn().mockResolvedValue(true),
    };

    const multiSelect = new Set<string>();
    const browse = vi.fn();
    const statusCount = { textContent: "4 items" };
    const selected = { dataset: { amPath: "tokens/goblin.webp" } };

    const root = {
      querySelector(selector: string) {
        if (selector === ".am-status-count") return statusCount;
        if (selector === ".am-selected[data-am-path]") return selected;
        return null;
      },
    } as unknown as HTMLElement;

    const controller = new AssetManagerActionController({
      getEntries: () => [
        { path: "tokens/goblin.webp", isDir: false, name: "goblin.webp", ext: "webp", size: 123, type: "image" },
      ],
      getMultiSelect: () => multiSelect,
      getCurrentPath: () => "tokens",
      getActiveSource: () => "data",
      browse,
      showPreview: vi.fn(),
      confirmSelection: vi.fn(),
    });

    await controller.deleteSelected(root);

    expect(mocks.serverDeleteFile).toHaveBeenCalledWith("tokens/goblin.webp");
    expect(mocks.serverDeleteFolder).not.toHaveBeenCalled();
    expect(mocks.invalidateThumbStats).toHaveBeenCalled();
    expect(mocks.invalidateBrowseCache).toHaveBeenCalledWith("data", "tokens");
    expect(browse).toHaveBeenCalledWith("tokens");
    expect(statusCount.textContent).toBe("Deleted 1 item");
  });
});
