import { describe, expect, it, vi } from "vitest";

import {
  attachMonsterPreviewFloatingListeners,
  attachMonsterPreviewInlineListeners,
} from "./monster-preview-interactions";

class FakeButton {
  private listeners = new Map<string, () => void>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  click(): void {
    this.listeners.get("click")?.();
  }
}

describe("monster preview interactions", () => {
  it("wires inline dismiss and popout actions", () => {
    const close = new FakeButton();
    const popout = new FakeButton();
    const onDismiss = vi.fn();
    const onPopout = vi.fn();
    const el = {
      querySelector(selector: string) {
        if (selector === ".mp-close") return close;
        if (selector === ".mp-popout") return popout;
        return null;
      },
    } as unknown as HTMLElement;

    attachMonsterPreviewInlineListeners(el, { onDismiss, onPopout });
    close.click();
    popout.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPopout).toHaveBeenCalledTimes(1);
  });

  it("wires floating dismiss and dock actions", () => {
    const close = new FakeButton();
    const dock = new FakeButton();
    const onDismiss = vi.fn();
    const onDock = vi.fn();
    const el = {
      querySelector(selector: string) {
        if (selector === ".mp-close") return close;
        if (selector === ".mp-dock") return dock;
        return null;
      },
    } as unknown as HTMLElement;

    attachMonsterPreviewFloatingListeners(el, { onDismiss, onDock });
    close.click();
    dock.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDock).toHaveBeenCalledTimes(1);
  });
});
