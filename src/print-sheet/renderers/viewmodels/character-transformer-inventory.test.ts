import { describe, expect, it } from "vitest";

import type { CurrencyData, InventoryItem } from "../../extractors/dnd5e-types";
import { buildCurrency, buildInventory } from "./character-transformer-inventory";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    name: "Backpack",
    type: "container",
    img: "backpack.png",
    quantity: 1,
    weight: 5,
    equipped: false,
    rarity: "",
    attunement: false,
    uses: null,
    isFavorite: false,
    containerId: null,
    contents: [],
    price: { value: 2, denomination: "gp" },
    ...overrides,
  };
}

describe("character transformer inventory helpers", () => {
  it("builds inventory with nested container rows and total weight", () => {
    const inventory = buildInventory([
      makeItem({
        contents: [
          makeItem({
            id: "item-2",
            name: "Torch",
            type: "consumable",
            quantity: 2,
            weight: 1,
            img: "",
            price: { value: 1, denomination: "sp" },
          }),
        ],
      }),
      makeItem({
        id: "item-3",
        name: "Rope",
        type: "loot",
        quantity: 1,
        weight: 10,
        img: "",
        isFavorite: true,
        equipped: true,
        price: null,
      }),
    ]);

    expect(inventory.totalWeight).toBe("17 lb");
    expect(inventory.items[0]).toMatchObject({
      name: "Backpack",
      isContainerGroup: true,
      cost: "2 gp",
      weight: "5 lb",
    });
    expect(inventory.items[0].containerItems[0]).toMatchObject({
      name: "Torch",
      isIndented: true,
      quantityDisplay: "×2",
      weight: "2 lb",
    });
    expect(inventory.items[1]).toMatchObject({
      eqIndicator: "■",
      favStar: "★ ",
      name: "Rope",
      isContainerGroup: false,
      weight: "10 lb",
    });
  });

  it("builds currency rows and total gp value", () => {
    const currency: CurrencyData = {
      pp: 1,
      gp: 23,
      ep: 4,
      sp: 12,
      cp: 50,
    };

    const vm = buildCurrency(currency);

    expect(vm.totalGpValue).toBe("36.7 gp");
    expect(vm.coins[0]).toMatchObject({
      type: "pp",
      amount: 1,
      hasCoins: true,
    });
    expect(vm.coins[4]).toMatchObject({
      type: "cp",
      amountDisplay: "50",
      gpValue: 0.01,
    });
  });

  it("returns empty inventory and zero currency displays when nothing is carried", () => {
    expect(buildInventory([])).toEqual({
      totalWeight: "—",
      items: [],
    });

    expect(buildCurrency({
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0,
    }).totalGpValue).toBe("0 gp");
  });
});
