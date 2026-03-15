import { describe, expect, it, vi } from "vitest";

import { attachDamageWorkflowPanelListeners } from "./damage-workflow-dialog-interactions";

class FakeEvent {
  public defaultPrevented = false;
  constructor(public key?: string, public target?: unknown) {}
  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class FakeButton {
  public dataset: Record<string, string> = {};
  public classList = {
    add: vi.fn(),
    remove: vi.fn(),
  };
  private listeners = new Map<string, (event: FakeEvent) => void>();

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(type, listener);
  }

  trigger(type: string, event = new FakeEvent()): FakeEvent {
    this.listeners.get(type)?.(event);
    return event;
  }
}

describe("damage workflow dialog interactions", () => {
  it("wires close, action, mode, and condition change handlers", () => {
    const close = new FakeButton();
    const damage = new FakeButton();
    const heal = new FakeButton();
    const applyCondition = new FakeButton();
    const removeCondition = new FakeButton();
    const amount = new FakeButton();
    const dc = new FakeButton();
    const modeA = new FakeButton();
    modeA.dataset.mode = "flatDamage";
    const modeB = new FakeButton();
    modeB.dataset.mode = "saveForCondition";
    const condition = new FakeButton();

    const onClose = vi.fn();
    const onAction = vi.fn();
    const onModeChange = vi.fn();
    const onConditionChange = vi.fn();

    const el = {
      querySelector(selector: string) {
        if (selector === ".dwf-close") return close;
        if (selector === "[data-action='damage']") return damage;
        if (selector === "[data-action='heal']") return heal;
        if (selector === "[data-action='applyCondition']") return applyCondition;
        if (selector === "[data-action='removeCondition']") return removeCondition;
        if (selector === "#dwf-amount") return amount;
        if (selector === "#dwf-dc") return dc;
        if (selector === "#dwf-condition") return condition;
        if (selector === ".dwf-mode-tab.active") return modeB;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".dwf-mode-tab") return [modeA, modeB];
        return [];
      },
    } as unknown as HTMLElement;

    attachDamageWorkflowPanelListeners(el, { onClose, onAction, onModeChange, onConditionChange });

    close.trigger("click");
    damage.trigger("click");
    heal.trigger("click");
    applyCondition.trigger("click");
    removeCondition.trigger("click");
    modeB.trigger("click", new FakeEvent());
    condition.trigger("change", new FakeEvent(undefined, { value: "prone" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("damage");
    expect(onAction).toHaveBeenCalledWith("heal");
    expect(onAction).toHaveBeenCalledWith("applyCondition");
    expect(onAction).toHaveBeenCalledWith("removeCondition");
    expect(onModeChange).toHaveBeenCalledWith("saveForCondition");
    expect(onConditionChange).toHaveBeenCalledWith("prone");
  });

  it("routes enter key actions from amount and dc inputs", () => {
    const amount = new FakeButton();
    const dc = new FakeButton();
    const activeMode = new FakeButton();
    activeMode.dataset.mode = "saveForCondition";
    const onAction = vi.fn();

    const el = {
      querySelector(selector: string) {
        if (selector === "#dwf-amount") return amount;
        if (selector === "#dwf-dc") return dc;
        if (selector === ".dwf-mode-tab.active") return activeMode;
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as HTMLElement;

    attachDamageWorkflowPanelListeners(el, {
      onClose: vi.fn(),
      onAction,
      onModeChange: vi.fn(),
      onConditionChange: vi.fn(),
    });

    const amountEvent = amount.trigger("keydown", new FakeEvent("Enter"));
    const dcEvent = dc.trigger("keydown", new FakeEvent("Enter"));

    expect(amountEvent.defaultPrevented).toBe(true);
    expect(dcEvent.defaultPrevented).toBe(true);
    expect(onAction).toHaveBeenCalledWith("damage");
    expect(onAction).toHaveBeenCalledWith("applyCondition");
  });
});
