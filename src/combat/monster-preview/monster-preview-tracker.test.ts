import { describe, expect, it, vi } from "vitest";

import { findMonsterPreviewTrackerElement, injectMonsterPreviewIntoTracker } from "./monster-preview-tracker";

class FakeElement {
  public id = "";
  public className = "";
  public innerHTML = "";
  public children: FakeElement[] = [];
  public parentNode: FakeElement | null = null;
  public nextSibling: FakeElement | null = null;
  public queryMap = new Map<string, FakeElement | null>();

  appendChild(child: FakeElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child: FakeElement, before: FakeElement | null): void {
    child.parentNode = this;
    if (!before) {
      this.children.push(child);
      return;
    }
    const index = this.children.indexOf(before);
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  querySelector<T = FakeElement>(selector: string): T | null {
    return (this.queryMap.get(selector) ?? null) as T | null;
  }

  remove(): void {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
  }
}

describe("monster preview tracker", () => {
  it("finds the combat tracker by preferred selectors", () => {
    const combat = new FakeElement();
    const tab = new FakeElement();
    const doc = {
      querySelector: (selector: string) => {
        if (selector === "#combat") return combat;
        if (selector === "[data-tab='combat']") return tab;
        return null;
      },
    } as unknown as Document;

    expect(findMonsterPreviewTrackerElement(doc)).toBe(combat);
  });

  it("injects inline preview markup after the combatant list", () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      value: {
        createElement: () => new FakeElement(),
      },
      configurable: true,
      writable: true,
    });

    try {
      const tracker = new FakeElement();
      const listParent = new FakeElement();
      const combatantList = new FakeElement();
      listParent.appendChild(combatantList);
      tracker.queryMap.set(".combat-tracker", combatantList);
      tracker.queryMap.set("#fth-mp-inline", null);

      const attachInlineListeners = vi.fn();
      injectMonsterPreviewIntoTracker(tracker as unknown as HTMLElement, {
        cachedContentHTML: "<div>dragon</div>",
        dismissed: false,
        attachInlineListeners,
      });

      const injected = listParent.children[1];
      expect(injected.id).toBe("fth-mp-inline");
      expect(injected.className).toContain("fth-mp-inline");
      expect(injected.innerHTML).toContain("Monster Preview");
      expect(attachInlineListeners).toHaveBeenCalledWith(injected);
    } finally {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        configurable: true,
        writable: true,
      });
    }
  });
});
