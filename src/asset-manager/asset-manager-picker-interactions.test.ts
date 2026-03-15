import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetEntry } from "./asset-manager-types";

const mocks = vi.hoisted(() => ({
  showContextMenu: vi.fn(),
  startLongPress: vi.fn(),
}));

vi.mock("./asset-manager-context-menu", () => ({
  showContextMenu: mocks.showContextMenu,
  startLongPress: mocks.startLongPress,
}));

import { AssetManagerInteractionsController } from "./asset-manager-picker-interactions";

describe("asset manager interactions controller", () => {
  beforeEach(() => {
    mocks.showContextMenu.mockReset();
    mocks.startLongPress.mockReset();
  });

  function buildFileEntry(path: string): AssetEntry {
    return {
      path,
      name: path.split("/").pop() ?? path,
      ext: "png",
      isDir: false,
      size: 0,
      type: "image",
    };
  }

  it("selects and previews a file on plain click", () => {
    const handleClickSelection = vi.fn();
    const selectFile = vi.fn();
    const showPreview = vi.fn();
    const setLastClickIndex = vi.fn();
    const rootListeners = new Map<string, EventListener>();
    const root = {
      addEventListener(type: string, listener: EventListener) {
        if (!rootListeners.has(type)) rootListeners.set(type, listener);
      },
      querySelector: vi.fn(() => null),
      setAttribute: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    const controller = new AssetManagerInteractionsController({
      getFilteredEntries: () => [buildFileEntry("tokens/goblin.png")],
      getLastClickIndex: () => -1,
      setLastClickIndex,
      getPreviewPath: () => null,
      getCurrentRequestPath: () => "tokens",
      closePreview: vi.fn(),
      browse: vi.fn(),
      deleteSelected: vi.fn(async () => {}),
      toggleThumbPopup: vi.fn(async () => {}),
      selectFile,
      showPreview,
      confirmSelection: vi.fn(),
      handleContextAction: vi.fn(),
      handleUpload: vi.fn(async () => {}),
      handleKeyboardNavigate: vi.fn(),
      getSelectedPath: vi.fn(() => null),
      toggleFocusedSelection: vi.fn(),
      handleSelectAll: vi.fn(),
      handleClickSelection,
      updateSelectionStatus: vi.fn(),
      clearAndDeleteFolder: vi.fn(),
    });

    controller.attach(root);

    const clickListener = rootListeners.get("click");
    const fileCard = {
      dataset: { amPath: "tokens/goblin.png" },
    };
    const target = {
      closest(selector: string) {
        if (selector === ".am-card-file, .am-list-file") return fileCard;
        return null;
      },
    } as unknown as HTMLElement;

    clickListener?.({
      target,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    } as unknown as MouseEvent);

    expect(handleClickSelection).toHaveBeenCalledWith("tokens/goblin.png", root, {
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
    expect(selectFile).toHaveBeenCalledWith("tokens/goblin.png", root);
    expect(showPreview).toHaveBeenCalledWith("tokens/goblin.png", root);
    expect(setLastClickIndex).toHaveBeenCalledWith(0);
  });

  it("handles enter key by confirming the selected file", () => {
    const rootListeners = new Map<string, EventListener>();
    const root = {
      addEventListener(type: string, listener: EventListener) {
        if (!rootListeners.has(type)) rootListeners.set(type, listener);
      },
      querySelector: vi.fn(() => null),
      setAttribute: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const confirmSelection = vi.fn();

    const controller = new AssetManagerInteractionsController({
      getFilteredEntries: () => [buildFileEntry("tokens/goblin.png")],
      getLastClickIndex: () => -1,
      setLastClickIndex: vi.fn(),
      getPreviewPath: () => null,
      getCurrentRequestPath: () => "tokens",
      closePreview: vi.fn(),
      browse: vi.fn(),
      deleteSelected: vi.fn(async () => {}),
      toggleThumbPopup: vi.fn(async () => {}),
      selectFile: vi.fn(),
      showPreview: vi.fn(),
      confirmSelection,
      handleContextAction: vi.fn(),
      handleUpload: vi.fn(async () => {}),
      handleKeyboardNavigate: vi.fn(),
      getSelectedPath: vi.fn(() => "tokens/goblin.png"),
      toggleFocusedSelection: vi.fn(),
      handleSelectAll: vi.fn(),
      handleClickSelection: vi.fn(),
      updateSelectionStatus: vi.fn(),
      clearAndDeleteFolder: vi.fn(),
    });

    controller.attach(root);

    const keydownListener = rootListeners.get("keydown");
    const preventDefault = vi.fn();

    keydownListener?.({
      key: "Enter",
      ctrlKey: false,
      metaKey: false,
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(confirmSelection).toHaveBeenCalledWith("tokens/goblin.png");
  });
});
