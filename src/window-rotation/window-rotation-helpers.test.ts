import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as settings from "../settings";
import {
  applyRotation,
  getNextRotation,
  getPersistKey,
  isExcludedApp,
  isRotatableRoot,
  normalizeForMode,
  readPersistedRotation,
  resolveAppId,
} from "./window-rotation-helpers";
import { ensureV2RotateButton } from "./window-rotation-hook-helpers";
import type { AppV2Like } from "./index";

class FakeElement {
  public id = "";
  public dataset: Record<string, string> = {};
  public title = "";
  public type = "";
  public className = "";
  public attributes = new Map<string, string>();
  public children: FakeElement[] = [];
  public listeners = new Map<string, (event: FakeEvent) => void>();
  public parent: FakeElement | null = null;
  public queryMap = new Map<string, FakeElement | null>();
  public closestResult: FakeElement | null = null;
  public classList = makeClassList();

  constructor(public tagName = "div") {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  getAttributeNames(): string[] {
    return Array.from(this.attributes.keys());
  }

  appendChild(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  insertBefore(child: FakeElement, before: FakeElement): void {
    child.parent = this;
    const index = this.children.indexOf(before);
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(type, listener);
  }

  querySelector<T = FakeElement>(selector: string): T | null {
    if (selector === "[data-action=\"fth-rotate\"]") {
      const button = this.children.find((child) => child.dataset.action === "fth-rotate") ?? null;
      return button as T | null;
    }
    return (this.queryMap.get(selector) ?? null) as T | null;
  }

  closest(): FakeElement | null {
    return this.closestResult;
  }
}

class FakeEvent {
  public defaultPrevented = false;
  public propagationStopped = false;

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }
}

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (...values: string[]) => values.forEach((value) => classes.add(value)),
    remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
    contains: (value: string) => classes.has(value),
  };
}

function makeApp(extra: Partial<AppV2Like> = {}): AppV2Like {
  return {
    appId: 42,
    id: "app-42",
    constructor: { name: "ActorSheetV2" },
    options: {},
    ...extra,
  };
}

describe("window rotation helpers", () => {
  const localStorageState = new Map<string, string>();
  const originalHTMLElement = globalThis.HTMLElement;
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.spyOn(settings, "rotationMode").mockReturnValue(90);
    vi.spyOn(settings, "animationsEnabled").mockReturnValue(true);
    vi.spyOn(settings, "rotationLabel").mockReturnValue("Rotate 90°");

    Object.defineProperty(globalThis, "HTMLElement", {
      value: FakeElement,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: {
        createElement: (tag: string) => new FakeElement(tag),
        getElementById: () => null,
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => localStorageState.get(key) ?? null,
        setItem: (key: string, value: string) => localStorageState.set(key, value),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorageState.clear();

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
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  it("resolves persistence keys and app identifiers", () => {
    const docApp = makeApp({ document: { uuid: "Actor.abc" } });
    const packApp = makeApp({
      appId: undefined,
      id: undefined,
      collection: { metadata: { id: "world.macros" } },
    });

    expect(resolveAppId(docApp)).toBe(42);
    expect(getPersistKey(docApp)).toBe("doc:Actor.abc");
    expect(getPersistKey(packApp)).toBe("pack:world.macros");
    expect(getPersistKey(makeApp({ appId: undefined, id: "sheet-1" }))).toBe("app:ActorSheetV2:sheet-1");
  });

  it("normalizes persisted rotation and computes the next rotation", () => {
    expect(normalizeForMode(88)).toBe(90);
    expect(getNextRotation(270, 90, "cw")).toBe(0);
    expect(getNextRotation(0, 90, "ccw")).toBe(270);

    vi.mocked(settings.rotationMode).mockReturnValue(180);
    expect(normalizeForMode(90)).toBe(180);
    expect(getNextRotation(180, 180, "cw")).toBe(0);
  });

  it("reads persisted rotation and applies classes to rotatable roots", () => {
    const el = new FakeElement("section");
    el.id = "sheet-1";
    el.classList = makeClassList(["app"]);
    localStorageState.set("foundry-tabletop-helpers:rot:app:ActorSheetV2:sheet-1", "270");

    const app = makeApp({
      appId: undefined,
      id: "sheet-1",
      element: el as unknown as HTMLElement,
    });

    expect(isRotatableRoot(el as unknown as HTMLElement)).toBe(true);
    expect(readPersistedRotation(app)).toBe(270);

    applyRotation(el as unknown as HTMLElement, 270);

    expect(el.classList.contains("fth-anim")).toBe(true);
    expect(el.classList.contains("fth-rot-270")).toBe(true);
    expect(el.dataset.fthRotation).toBe("270");
  });

  it("filters excluded apps and injects the V2 rotate button once", () => {
    expect(isExcludedApp(makeApp({ constructor: { name: "TokenHUD" } }))).toBe(true);
    expect(isExcludedApp(makeApp({ hasFrame: false }))).toBe(true);
    expect(isExcludedApp(makeApp())).toBe(false);

    const header = new FakeElement("header");
    const closeButton = new FakeElement("button");
    header.queryMap.set("[data-action=\"fth-rotate\"]", null);
    const onToggle = vi.fn();
    const app = makeApp({
      window: {
        header: header as unknown as HTMLElement,
        close: closeButton as unknown as HTMLButtonElement,
      },
    });

    ensureV2RotateButton(app, onToggle);
    ensureV2RotateButton(app, onToggle);

    expect(header.children).toHaveLength(1);
    const rotateButton = header.children[0];
    const clickListener = rotateButton.listeners.get("click");
    expect(clickListener).toBeTypeOf("function");

    const event = new FakeEvent();
    clickListener?.(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.propagationStopped).toBe(true);
    expect(onToggle).toHaveBeenCalledWith(app);
  });
});
