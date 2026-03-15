import { describe, expect, it, vi } from "vitest";

import {
  attachLPCSBaseRenderListeners,
  buildInventoryModalItems,
  setupClosableModalRender,
  setupHPDrawerRender,
} from "./lpcs-sheet-render";

describe("lpcs sheet render helpers", () => {
  it("wires base HP and tab listeners", () => {
    const hpInputListeners = new Map<string, EventListener>();
    const tabButtonListeners = new Map<string, EventListener>();
    const hpBarListeners = new Map<string, EventListener>();

    const hpInput = {
      addEventListener(type: string, listener: EventListener) { hpInputListeners.set(type, listener); },
      select: vi.fn(),
    };
    const tabButton = {
      dataset: { tab: "skills" },
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener(type: string, listener: EventListener) { tabButtonListeners.set(type, listener); },
    };
    const tabPanel = {
      dataset: { tab: "skills" },
      classList: { toggle() {} },
      removeAttribute() {},
      setAttribute() {},
    };
    const hpBar = {
      addEventListener(type: string, listener: EventListener) { hpBarListeners.set(type, listener); },
      click: vi.fn(),
    };

    const tabGroups = { primary: "combat" };
    const tabNavEl = {
      querySelectorAll(selector: string) {
        if (selector === ".lpcs-hp-input") return [hpInput];
        if (selector === ".lpcs-tab-btn[data-tab]") return [tabButton];
        if (selector === ".lpcs-tab[data-tab]") return [tabPanel];
        return [];
      },
      querySelector(selector: string) {
        if (selector === ".lpcs-hp-bar-widget[data-action]") return hpBar;
        if (selector === ".lpcs-tab-btn[data-tab]") return tabButton;
        return null;
      },
    } as unknown as HTMLElement;

    const onHPInputChange = vi.fn();
    attachLPCSBaseRenderListeners({ el: tabNavEl, tabGroups, onHPInputChange });

    hpInputListeners.get("change")?.({} as Event);
    hpInputListeners.get("focus")?.({} as Event);
    tabButtonListeners.get("click")?.({} as Event);
    hpBarListeners.get("keydown")?.({
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(onHPInputChange).toHaveBeenCalled();
    expect(hpInput.select).toHaveBeenCalled();
    expect(tabGroups.primary).toBe("skills");
    expect(hpBar.click).toHaveBeenCalled();
  });

  it("wires HP drawer mode and apply listeners", async () => {
    const modeListeners = new Map<string, EventListener>();
    const applyListeners = new Map<string, EventListener>();
    const amountInput = { value: "5", addEventListener: vi.fn() };
    const preview = { textContent: "" };
    const applyButton = {
      textContent: "",
      addEventListener(type: string, listener: EventListener) { applyListeners.set(type, listener); },
    };
    const modeButton = {
      dataset: { mode: "heal" },
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener(type: string, listener: EventListener) { modeListeners.set(type, listener); },
    };
    const drawer = {
      classList: { toggle() {} },
      setAttribute() {},
      dataset: {} as Record<string, string>,
      querySelectorAll(selector: string) {
        if (selector === "[data-mode]") return [modeButton];
        if (selector === "[data-preset]") return [];
        return [];
      },
      querySelector(selector: string) {
        if (selector === "[data-amount]") return amountInput;
        if (selector === "[data-preview]") return preview;
        if (selector === "[data-apply]") return applyButton;
        if (selector === "[data-clear]") return null;
        return null;
      },
    };
    const el = {
      querySelector(selector: string) {
        if (selector === "[data-hp-drawer]") return drawer;
        if (selector === ".lpcs-hp-outer") return null;
        return null;
      },
    } as unknown as HTMLElement;

    let mode: "damage" | "heal" | "temp" = "damage";
    const applyHPChange = vi.fn(async () => {});

    setupHPDrawerRender({
      el,
      previousAbortController: null,
      drawerOpen: true,
      getMode: () => mode,
      hp: { value: 10, max: 20, temp: 0 },
      setMode: (value) => { mode = value; },
      applyHPChange,
      closeHPDrawer: vi.fn(),
    });

    modeListeners.get("click")?.({} as Event);
    await applyListeners.get("click")?.({} as Event);

    expect(mode).toBe("heal");
    expect(applyHPChange).toHaveBeenCalledWith("heal", 5);
  });

  it("builds item-detail inventory candidates and wires a closable modal", () => {
    const closeListeners = new Map<string, EventListener>();
    const closeButton = {
      addEventListener(type: string, listener: EventListener) { closeListeners.set(type, listener); },
    };
    const modal = {
      classList: { toggle() {} },
      setAttribute() {},
      querySelectorAll(selector: string) {
        if (selector === "[data-modal-close]") return [closeButton];
        return [];
      },
    };
    const el = {
      querySelector(selector: string) {
        if (selector === "[data-modal]") return modal;
        return null;
      },
    } as unknown as HTMLElement;
    const closeModal = vi.fn();

    setupClosableModalRender({
      el,
      previousAbortController: null,
      selector: "[data-modal]",
      closeSelector: "[data-modal-close]",
      isOpen: true,
      closeModal,
    });

    closeListeners.get("click")?.({} as Event);

    expect(closeModal).toHaveBeenCalled();
    expect(buildInventoryModalItems({
      inventory: [{ id: "sword" }],
      containers: [{ id: "bag", contents: [{ id: "potion" }] } as { id: string; contents: Array<{ id: string }> }],
    })).toHaveLength(3);
  });
});
