import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browseCacheGet: vi.fn(),
  browseCacheSet: vi.fn(),
  recentFiles: vi.fn(),
  filesByTag: vi.fn(),
  allTags: vi.fn(),
}));

vi.mock("./asset-manager-browse-cache", () => ({
  getBrowseCache: () => ({
    get: mocks.browseCacheGet,
    set: mocks.browseCacheSet,
  }),
}));

vi.mock("./asset-manager-metadata", () => ({
  getMetadataStore: () => ({
    getRecentFiles: mocks.recentFiles,
    getFilesByTag: mocks.filesByTag,
    getAllTags: mocks.allTags,
  }),
}));

import { AssetManagerStateController } from "./asset-manager-picker-state";
import type { AssetEntry } from "./asset-manager-types";

describe("asset manager state controller", () => {
  beforeEach(() => {
    mocks.browseCacheGet.mockReset();
    mocks.browseCacheSet.mockReset();
    mocks.recentFiles.mockReset();
    mocks.filesByTag.mockReset();
    mocks.allTags.mockReset();
    mocks.recentFiles.mockReturnValue([]);
    mocks.filesByTag.mockReturnValue([]);
    mocks.allTags.mockReturnValue([]);
  });

  it("parses results, caches them, sorts directories first, and filters by search", () => {
    let entries: AssetEntry[] = [];
    let filtered: AssetEntry[] = [];
    let unoptimizedCount = 0;

    const controller = new AssetManagerStateController({
      getEntries: () => entries,
      setEntries: (value) => { entries = value; },
      getFilteredEntries: () => filtered,
      setFilteredEntries: (value) => { filtered = value; },
      setUnoptimizedCount: (value) => { unoptimizedCount = value; },
      getSearch: () => "gob",
      getCollection: () => "all",
      getFilters: () => [],
      getCurrentPath: () => "tokens",
      setCurrentPath: vi.fn(),
      getSortField: () => "name",
      getSortDir: () => "asc",
      getActiveSource: () => "data",
      getBrowseFn: () => undefined,
      getElementRoot: () => null,
      buildHTML: () => "",
      buildSidebar: () => "",
      buildBreadcrumbs: (path) => path,
      attachListeners: vi.fn(),
      setupScroller: vi.fn(),
      updateStatusBar: vi.fn(),
    });

    controller.parseResults({
      dirs: ["tokens/zombies"],
      files: ["tokens/goblin.png", "tokens/archer.webp", "tokens/.fth-thumbs/cache.webp"],
    });

    expect(mocks.browseCacheSet).toHaveBeenCalledWith("data", "tokens", {
      dirs: ["tokens/zombies"],
      files: ["tokens/goblin.png", "tokens/archer.webp", "tokens/.fth-thumbs/cache.webp"],
    });
    expect(entries.map((entry) => entry.path)).toEqual([
      "tokens/zombies",
      "tokens/archer.webp",
      "tokens/goblin.png",
    ]);
    expect(filtered.map((entry) => entry.path)).toEqual(["tokens/goblin.png"]);
    expect(unoptimizedCount).toBe(1);
  });

  it("shows loading UI and calls the browse function during navigation", () => {
    const browse = vi.fn();
    const content = { innerHTML: "" };
    const section = {
      innerHTML: "",
      querySelector(selector: string) {
        if (selector === ".am-sb-label") return { textContent: "Folders" };
        return null;
      },
    };
    const sidebar = {
      querySelectorAll() {
        return [section];
      },
    };
    const status = { textContent: "2 items" };
    const breadcrumbs = { innerHTML: "" };
    const root = {
      querySelector(selector: string) {
        if (selector === ".am-breadcrumbs") return breadcrumbs;
        if (selector === ".am-content") return content;
        if (selector === ".am-sidebar") return sidebar;
        if (selector === ".am-status-count") return status;
        return null;
      },
    } as unknown as HTMLElement;

    const controller = new AssetManagerStateController({
      getEntries: () => [],
      setEntries: vi.fn(),
      getFilteredEntries: () => [],
      setFilteredEntries: vi.fn(),
      setUnoptimizedCount: vi.fn(),
      getSearch: () => "",
      getCollection: () => "all",
      getFilters: () => [],
      getCurrentPath: () => "tokens",
      setCurrentPath: vi.fn(),
      getSortField: () => "name",
      getSortDir: () => "asc",
      getActiveSource: () => "data",
      getBrowseFn: () => browse,
      getElementRoot: () => root,
      buildHTML: () => "",
      buildSidebar: () => "",
      buildBreadcrumbs: (path) => `crumb:${path}`,
      attachListeners: vi.fn(),
      setupScroller: vi.fn(),
      updateStatusBar: vi.fn(),
    });

    controller.browse("tokens/monsters");

    expect(mocks.browseCacheGet).toHaveBeenCalledWith("data", "tokens/monsters");
    expect(breadcrumbs.innerHTML).toBe("crumb:tokens/monsters");
    expect(content.innerHTML).toContain("Loading files...");
    expect(section.innerHTML).toContain("Loading...");
    expect(status.textContent).toBe("Loading...");
    expect(browse).toHaveBeenCalledWith("tokens/monsters");
  });
});
