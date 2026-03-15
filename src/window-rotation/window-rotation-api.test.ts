import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as settings from "../settings";
import { buildRotationApi, rotateAllWindows, rotateTargetWindows } from "./window-rotation-api";
import type { AppV2Like } from "./index";

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (...values: string[]) => values.forEach((value) => classes.add(value)),
    remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
    contains: (value: string) => classes.has(value),
  };
}

class FakeElement {
  public id = "";
  public classList = makeClassList();

  closest(): null {
    return null;
  }
}

function makeApp(id: string, isRotatable = true): AppV2Like {
  const element = new FakeElement();
  element.id = id;
  element.classList = makeClassList(isRotatable ? ["app"] : []);
  return {
    id,
    constructor: { name: "ActorSheetV2" },
    element: element as unknown as HTMLElement,
  };
}

describe("window rotation api", () => {
  const originalHTMLElement = globalThis.HTMLElement;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLElement", {
      value: FakeElement,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: {
        getElementById: () => null,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "HTMLElement", {
      value: originalHTMLElement,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });

  it("rotates only active rotatable windows", () => {
    const onToggle = vi.fn();
    const activeApps = new Set<AppV2Like>([
      makeApp("sheet-1"),
      makeApp("sheet-2", false),
    ]);

    rotateAllWindows(activeApps, onToggle, 90, "ccw");

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(activeApps.values().next().value, { mode: 90, dir: "ccw" });
  });

  it("emits rotation payloads only when target users are configured", () => {
    const emitSocket = vi.fn();
    vi.spyOn(settings, "targetUserIds").mockReturnValue([]);
    rotateTargetWindows(emitSocket, 180, "cw");
    expect(emitSocket).not.toHaveBeenCalled();

    vi.mocked(settings.targetUserIds).mockReturnValue(["user-a"]);
    rotateTargetWindows(emitSocket, 90, "cw");
    expect(emitSocket).toHaveBeenCalledWith("module.foundry-tabletop-helpers", {
      action: "rotate",
      userIds: ["user-a"],
      mode: 90,
      dir: "cw",
    });
  });

  it("builds the public rotation api facade", () => {
    vi.spyOn(settings, "targetUserIds").mockReturnValue(["user-a"]);
    const emitSocket = vi.fn();
    const onToggle = vi.fn();
    const app = makeApp("sheet-1");
    const api = buildRotationApi({
      activeApps: new Set([app]),
      onToggle,
      emitSocket,
    });

    api.rotateAll90CW();
    api.rotateAll180();
    api.rotateTargets90CCW();

    expect(onToggle).toHaveBeenNthCalledWith(1, app, { mode: 90, dir: "cw" });
    expect(onToggle).toHaveBeenNthCalledWith(2, app, { mode: 180, dir: "cw" });
    expect(emitSocket).toHaveBeenCalledWith("module.foundry-tabletop-helpers", {
      action: "rotate",
      userIds: ["user-a"],
      mode: 90,
      dir: "ccw",
    });
  });
});
