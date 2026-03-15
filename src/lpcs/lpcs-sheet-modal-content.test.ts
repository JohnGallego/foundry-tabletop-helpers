import { describe, expect, it, vi } from "vitest";

import type { LPCSInventoryItem } from "./lpcs-types";
import {
  populateCurrencyEditorModal,
  populateItemDetailModal,
  updateCurrencyEditorDisplayValue,
} from "./lpcs-sheet-modal-content";

function buildItem(overrides: Partial<LPCSInventoryItem> = {}): LPCSInventoryItem {
  return {
    id: "item-1",
    name: "Longsword",
    img: "longsword.webp",
    quantity: 1,
    weight: 3,
    equipped: false,
    attuned: false,
    type: "weapon",
    typeLabel: "Weapon",
    description: "A trusty blade.",
    statsBlock: "1d8 slashing",
    rarity: "common",
    rarityLabel: "Common",
    price: { value: 15, denomination: "gp" },
    priceDisplay: [],
    isContainer: false,
    contentsCount: 0,
    contents: [],
    containerCurrency: [],
    capacityLabel: "",
    contentsWeight: 0,
    capacityMax: 0,
    capacityPct: 0,
    capacityColor: "",
    containerId: null,
    isEquippable: true,
    ...overrides,
  };
}

describe("lpcs sheet modal content helpers", () => {
  it("populates item detail modal content and equip button", () => {
    const priceEl = { replaceChildren: vi.fn(), appendChild: vi.fn() };
    const equipLabel = { textContent: "" };
    const equipIcon = { className: "" };
    const equipListeners = new Map<string, EventListener>();
    const equipBtn = {
      hidden: false,
      classList: { toggle() {} },
      querySelector(selector: string) {
        if (selector === "[data-item-detail-equip-label]") return equipLabel;
        if (selector === "[data-item-detail-equip-icon]") return equipIcon;
        return null;
      },
      addEventListener(type: string, listener: EventListener) { equipListeners.set(type, listener); },
    };
    const fields = new Map<string, unknown>([
      ["[data-item-detail-name]", { textContent: "" }],
      ["[data-item-detail-type]", { textContent: "" }],
      ["[data-item-detail-desc]", { textContent: "" }],
      ["[data-item-detail-qty]", { textContent: "", hidden: false }],
      ["[data-item-detail-rarity]", { textContent: "", hidden: false, className: "" }],
      ["[data-item-detail-weight]", { textContent: "" }],
      ["[data-item-detail-price]", priceEl],
      ["[data-item-detail-stats]", { textContent: "", hidden: false }],
      ["[data-item-detail-container-info]", { hidden: false }],
      ["[data-item-detail-capacity]", { textContent: "" }],
      ["[data-item-detail-container-currency]", { replaceChildren: vi.fn(), appendChild: vi.fn() }],
      ["[data-item-detail-contents]", { hidden: false }],
      ["[data-item-detail-contents-grid]", { replaceChildren: vi.fn(), appendChild: vi.fn() }],
      ["[data-item-detail-equip]", equipBtn],
    ]);
    const modal = {
      querySelector(selector: string) {
        return (fields.get(selector) ?? null) as Element | null;
      },
    } as unknown as HTMLElement;
    const toggleEquip = vi.fn(async () => {});

    populateItemDetailModal(modal, buildItem({ price: null }), {
      onToggleEquip: toggleEquip,
      onOpenChildItem: vi.fn(),
    });

    expect((fields.get("[data-item-detail-name]") as { textContent: string }).textContent).toBe("Longsword");
    expect((fields.get("[data-item-detail-stats]") as { textContent: string }).textContent).toBe("1d8 slashing");
    expect((fields.get("[data-item-detail-weight]") as { textContent: string }).textContent).toBe("3 lb");
    expect(equipLabel.textContent).toBe("Equip");
    expect(equipIcon.className).toBe("fas fa-shield-halved");

    equipListeners.get("click")?.({} as Event);
    expect(toggleEquip).toHaveBeenCalledWith("item-1", true);
  });

  it("populates and updates the currency editor display", () => {
    const titleEl = { textContent: "" };
    const displayEl = { textContent: "" };
    const inputEl = { value: "12", focus: vi.fn() };
    const modal = {
      querySelector(selector: string) {
        if (selector === "[data-currency-editor-title]") return titleEl;
        if (selector === "[data-currency-editor-display]") return displayEl;
        if (selector === "[data-currency-editor-input]") return inputEl;
        return null;
      },
    } as unknown as HTMLElement;

    populateCurrencyEditorModal(modal, "gp", 42);
    expect(titleEl.textContent).toBe("Gold");
    expect(displayEl.textContent).toBe("42");
    expect(inputEl.value).toBe("");
    expect(inputEl.focus).toHaveBeenCalled();

    updateCurrencyEditorDisplayValue(modal, 99);
    expect(displayEl.textContent).toBe("99");
  });
});
