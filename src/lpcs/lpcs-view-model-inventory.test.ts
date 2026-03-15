import { describe, expect, it } from "vitest";

import { buildEncumbrance, buildInventory } from "./lpcs-view-model-inventory";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const drawerDesc = (html: string) => html.replace(/<[^>]+>/g, "").trim();

describe("lpcs view model inventory", () => {
  it("builds inventory items and nests contained items", () => {
    const actor = {
      items: [
        {
          id: "pack",
          type: "container",
          name: "Backpack",
          img: "pack.png",
          system: {
            quantity: 1,
            description: { value: "<p>Travel pack</p>" },
            capacity: { weight: { value: 30 } },
            contentsWeight: 8.5,
            currency: { gp: 12, sp: 3 },
          },
        },
        {
          id: "rope",
          type: "loot",
          name: "Rope",
          img: "rope.png",
          system: {
            quantity: 1,
            weight: { value: 10 },
            container: "pack",
            description: { value: "<p>Hempen rope</p>" },
            price: { value: 1, denomination: "gp" },
          },
        },
        {
          id: "sword",
          type: "weapon",
          name: "Longsword",
          img: "sword.png",
          system: {
            quantity: 1,
            equipped: true,
            rarity: "rare",
            description: { value: "<p>Martial weapon</p>" },
            damage: { base: { number: 1, denomination: 8, types: ["slashing"] } },
            properties: new Set(["ver"]),
            mastery: "sap",
            range: { value: 5 },
          },
        },
      ],
    };

    const inventory = buildInventory(actor, { capitalize, drawerDesc });

    expect(inventory.looseItems).toHaveLength(1);
    expect(inventory.looseItems[0]).toMatchObject({
      name: "Longsword",
      typeLabel: "Weapon",
      rarityLabel: "Rare",
    });
    expect(inventory.looseItems[0].statsBlock).toContain("1d8 slashing (Sap)");
    expect(inventory.containers).toHaveLength(1);
    expect(inventory.containers[0]).toMatchObject({
      name: "Backpack",
      contentsCount: 1,
      capacityLabel: "8.5 / 30 lb",
    });
    expect(inventory.containers[0].containerCurrency).toEqual([
      { key: "gp", amount: 12 },
      { key: "sp", amount: 3 },
    ]);
    expect(inventory.containers[0].contents[0]).toMatchObject({
      name: "Rope",
      price: { value: 1, denomination: "gp" },
    });
  });

  it("builds armor stats and item-count based container capacity", () => {
    const actor = {
      items: [
        {
          id: "satchel",
          type: "container",
          name: "Satchel",
          img: "satchel.png",
          system: {
            capacity: { count: 6 },
            contentsCount: 2,
          },
        },
        {
          id: "armor",
          type: "equipment",
          name: "Chain Shirt",
          img: "armor.png",
          system: {
            type: { value: "medium" },
            armor: { value: 13 },
            properties: { has: (key: string) => key === "mgc" },
          },
        },
      ],
    };

    const inventory = buildInventory(actor, { capitalize, drawerDesc });

    expect(inventory.containers[0].capacityLabel).toBe("2 / 6 items");
    expect(inventory.looseItems[0].statsBlock).toBe("Magical\nAC 13 · Medium Armor");
  });

  it("builds encumbrance percentages and cap state", () => {
    expect(buildEncumbrance({
      attributes: {
        encumbrance: {
          value: 75,
          max: 100,
        },
      },
    })).toEqual({
      value: 75,
      max: 100,
      pct: 75,
      encumbered: false,
    });

    expect(buildEncumbrance({
      attributes: {
        encumbrance: {
          value: 120,
          max: 100,
        },
      },
    })).toEqual({
      value: 120,
      max: 100,
      pct: 100,
      encumbered: true,
    });
  });
});
