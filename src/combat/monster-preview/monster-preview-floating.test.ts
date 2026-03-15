import { describe, expect, it, vi } from "vitest";

import {
  makeMonsterPreviewDraggable,
  restoreMonsterPreviewPosition,
  saveMonsterPreviewPosition,
} from "./monster-preview-floating";

class FakeHandle {
  public style = { cursor: "" };
  private listeners = new Map<string, (event?: FakePointerEvent) => void>();

  addEventListener(type: string, listener: (event?: FakePointerEvent) => void): void {
    this.listeners.set(type, listener);
  }

  trigger(type: string, event?: FakePointerEvent): void {
    this.listeners.get(type)?.(event);
  }
}

class FakePointerEvent {
  constructor(
    public clientX: number,
    public clientY: number,
    public pointerId: number,
    public target: { closest: (selector: string) => HTMLElement | null },
  ) {}

  preventDefault(): void {}
}

describe("monster preview floating helpers", () => {
  it("persists and restores floating positions", () => {
    const storage = new Map<string, string>();
    const floatingEl = {
      style: { left: "10px", top: "20px", right: "", bottom: "" },
    } as unknown as HTMLElement;

    saveMonsterPreviewPosition(floatingEl, "pos-key", {
      setItem: (key, value) => storage.set(key, value),
    });
    expect(storage.get("pos-key")).toBe(JSON.stringify({ left: "10px", top: "20px" }));

    const restored = {
      style: { left: "", top: "", right: "", bottom: "" },
    } as unknown as HTMLElement;
    restoreMonsterPreviewPosition(restored, "pos-key", {
      getItem: (key) => storage.get(key) ?? null,
    });
    expect(restored.style.left).toBe("10px");
    expect(restored.style.top).toBe("20px");
    expect(restored.style.right).toBe("auto");
  });

  it("makes the floating panel draggable and saves on pointerup", () => {
    const handle = new FakeHandle();
    const onSavePosition = vi.fn();
    const el = {
      offsetLeft: 10,
      offsetTop: 20,
      style: { left: "", top: "", right: "", bottom: "" },
      querySelector: () => handle,
    } as unknown as HTMLElement;

    makeMonsterPreviewDraggable(el, onSavePosition);

    const target = { closest: () => null } as unknown as HTMLElement;
    const downEvent = new FakePointerEvent(50, 80, 1, target);
    (handle as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture = () => {};
    (handle as unknown as HTMLElement).setPointerCapture = () => {};
    handle.trigger("pointerdown", downEvent);
    handle.trigger("pointermove", new FakePointerEvent(70, 100, 1, target));
    handle.trigger("pointerup");

    expect(el.style.left).toBe("30px");
    expect(el.style.top).toBe("40px");
    expect(handle.style.cursor).toBe("grab");
    expect(onSavePosition).toHaveBeenCalledTimes(1);
  });
});
