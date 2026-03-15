import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetManagerControlsController } from "./asset-manager-picker-controls";

describe("asset manager controls controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("cycles sort settings and refreshes content", () => {
    let sortField: "name" | "size" | "type" = "name";
    let sortDir: "asc" | "desc" = "asc";
    const applySort = vi.fn();
    const applySearch = vi.fn();
    const refreshContent = vi.fn();
    const persistSort = vi.fn();
    const sortButton = { title: "" };

    const controller = new AssetManagerControlsController({
      getSearch: () => "",
      setSearch: vi.fn(),
      getCollection: () => "all",
      setCollection: vi.fn(),
      getFilters: () => [],
      setFilters: vi.fn(),
      getViewMode: () => "grid",
      setViewMode: vi.fn(),
      getDensity: () => "medium",
      setDensity: vi.fn(),
      getSortField: () => sortField,
      setSortField: (value) => { sortField = value; },
      getSortDir: () => sortDir,
      setSortDir: (value) => { sortDir = value; },
      getSidebarOpen: () => true,
      setSidebarOpen: vi.fn(),
      getPreviewPath: () => null,
      nextTagColor: vi.fn(() => "#fff"),
      applySearch,
      applySort,
      refreshUI: vi.fn(),
      refreshContent,
      setupScroller: vi.fn(),
      browse: vi.fn(),
      handleUpload: vi.fn(async () => {}),
      promptCreateFolder: vi.fn(async () => {}),
      batchOptimize: vi.fn(async () => {}),
      clearUploadQueue: vi.fn(),
      persistViewMode: vi.fn(),
      persistDensity: vi.fn(),
      persistSort,
      persistSidebarOpen: vi.fn(),
    });

    const target = {
      closest(selector: string) {
        return selector === ".am-sort-btn" ? {} : null;
      },
    } as unknown as HTMLElement;
    const root = {
      querySelector(selector: string) {
        return selector === ".am-sort-btn" ? sortButton : null;
      },
    } as unknown as HTMLElement;

    const handled = controller.handleClick(target, root);

    expect(handled).toBe(true);
    expect(sortField).toBe("name");
    expect(sortDir).toBe("desc");
    expect(persistSort).toHaveBeenCalledWith("name", "desc");
    expect(applySort).toHaveBeenCalled();
    expect(applySearch).toHaveBeenCalled();
    expect(refreshContent).toHaveBeenCalledWith(root);
    expect(sortButton.title).toBe("Sort: name desc");
  });

  it("toggles tag filters from sidebar pills and refreshes the UI", () => {
    let filters: Array<{ type: "tag"; value: string }> = [];
    const setFilters = vi.fn((value) => { filters = value; });
    const applySearch = vi.fn();
    const refreshUI = vi.fn();

    const controller = new AssetManagerControlsController({
      getSearch: () => "",
      setSearch: vi.fn(),
      getCollection: () => "all",
      setCollection: vi.fn(),
      getFilters: () => filters,
      setFilters,
      getViewMode: () => "grid",
      setViewMode: vi.fn(),
      getDensity: () => "medium",
      setDensity: vi.fn(),
      getSortField: () => "name",
      setSortField: vi.fn(),
      getSortDir: () => "asc",
      setSortDir: vi.fn(),
      getSidebarOpen: () => true,
      setSidebarOpen: vi.fn(),
      getPreviewPath: () => null,
      nextTagColor: vi.fn(() => "#fff"),
      applySearch,
      applySort: vi.fn(),
      refreshUI,
      refreshContent: vi.fn(),
      setupScroller: vi.fn(),
      browse: vi.fn(),
      handleUpload: vi.fn(async () => {}),
      promptCreateFolder: vi.fn(async () => {}),
      batchOptimize: vi.fn(async () => {}),
      clearUploadQueue: vi.fn(),
      persistViewMode: vi.fn(),
      persistDensity: vi.fn(),
      persistSort: vi.fn(),
      persistSidebarOpen: vi.fn(),
    });

    const target = {
      closest(selector: string) {
        if (selector === "[data-am-tag]") return { dataset: { amTag: "monsters" } };
        return null;
      },
    } as unknown as HTMLElement;

    const root = {} as HTMLElement;

    expect(controller.handleClick(target, root)).toBe(true);
    expect(setFilters).toHaveBeenCalledWith([{ type: "tag", value: "monsters" }]);
    expect(applySearch).toHaveBeenCalledWith();
    expect(refreshUI).toHaveBeenCalledWith(root);

    setFilters.mockClear();
    applySearch.mockClear();
    refreshUI.mockClear();

    expect(controller.handleClick(target, root)).toBe(true);
    expect(setFilters).toHaveBeenCalledWith([]);
    expect(applySearch).toHaveBeenCalledWith();
    expect(refreshUI).toHaveBeenCalledWith(root);
  });
});
