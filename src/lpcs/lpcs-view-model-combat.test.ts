import { describe, expect, it, vi } from "vitest";

import type { LPCSWeapon } from "./lpcs-types";
import {
  buildCombatContext,
  buildCombatGroups,
  buildCombatSpells,
  detectOffhandWeapons,
  getItemActivationType,
} from "./lpcs-view-model-combat";

function makeWeapon(id: string, name: string, category: LPCSWeapon["category"] = "melee"): LPCSWeapon {
  return {
    id,
    name,
    attackBonus: "+5",
    damage: "1d6 slashing",
    damageFormula: "1d6",
    damageType: "slashing",
    damageTypeIcon: "",
    damageTypeCss: "",
    category,
    range: "5 ft.",
    properties: [],
    notes: "",
    mastery: null,
    img: "",
    iconClass: "",
    effectAnnotations: [],
  };
}

describe("lpcs view model combat", () => {
  it("prefers activity activation type before legacy activation", () => {
    const item = {
      system: {
        activities: {
          foo: {
            activation: {
              type: "bonus",
            },
          },
        },
        activation: {
          type: "action",
        },
      },
    };

    expect(getItemActivationType(item)).toBe("bonus");
  });

  it("builds combat context from actor stats and rogue level", () => {
    const actor = {
      system: {
        attributes: {
          prof: 3,
          spellcasting: "wis",
        },
        abilities: {
          str: { mod: 4 },
          wis: { mod: 2 },
        },
      },
      items: [
        {
          type: "class",
          name: "Rogue",
          system: { levels: 5 },
        },
      ],
    };

    expect(buildCombatContext(actor)).toEqual({
      proficiencyBonus: 3,
      spellSaveDC: 13,
      grappleDC: 15,
      sneakAttackDice: "3d6",
    });
  });

  it("detects off-hand weapons and excludes nick mastery", () => {
    const actor = {
      items: [
        { id: "main", type: "weapon", system: { equipped: true, properties: ["lgt"] } },
        { id: "off", type: "weapon", system: { equipped: true, properties: ["lgt"] } },
        { id: "nick", type: "weapon", system: { equipped: true, properties: ["lgt"], mastery: "Nick" } },
      ],
    };

    const offhand = detectOffhandWeapons(actor, [
      makeWeapon("main", "Shortsword"),
      makeWeapon("off", "Dagger"),
      makeWeapon("nick", "Scimitar"),
    ]);

    expect(offhand).toHaveLength(1);
    expect(offhand[0].name).toBe("Dagger (Off-hand)");
  });

  it("builds combat spells with activity-derived attack/save and healing data", () => {
    const actor = {
      system: {
        attributes: {
          prof: 3,
          spellcasting: "int",
        },
        abilities: {
          int: { mod: 4 },
        },
      },
      items: [
        {
          id: "fire-bolt",
          type: "spell",
          name: "Fire Bolt",
          img: "fire.png",
          system: {
            level: 0,
            school: "evo",
            description: { value: "<p>Ranged spell attack.</p>" },
            properties: ["vocal", "somatic"],
            activation: { type: "action", value: 1 },
            range: { value: 120 },
            target: { type: "creature", value: 1 },
            duration: { units: "inst" },
            activities: {
              cast: {
                activation: { type: "action" },
                attack: { type: "rsak" },
                damage: {
                  parts: [
                    { number: 1, denomination: 10, types: ["fire"] },
                  ],
                },
              },
            },
          },
        },
        {
          id: "healing-word",
          type: "spell",
          name: "Healing Word",
          img: "heal.png",
          system: {
            level: 1,
            prepared: true,
            school: "evo",
            description: { value: "<p>Restore hit points.</p>" },
            properties: ["vocal"],
            activation: { type: "bonus", value: 1 },
            range: { value: 60 },
            duration: { units: "inst" },
            activities: {
              cast: {
                activation: { type: "bonus" },
                healing: {
                  parts: [
                    { number: 1, denomination: 4, bonus: "@mod" },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    const formatMod = (modifier: number) => (modifier >= 0 ? `+${modifier}` : String(modifier));
    const shortDesc = (html: string) => html.replace(/<[^>]+>/g, "").trim();

    const actionSpells = buildCombatSpells(actor, "action", { formatMod, shortDesc, spellAnnotations: [] });
    const bonusSpells = buildCombatSpells(actor, "bonus", { formatMod, shortDesc, spellAnnotations: [] });

    expect(actionSpells).toHaveLength(1);
    expect(actionSpells[0]).toMatchObject({
      name: "Fire Bolt",
      attackSave: "+7",
      damageFormula: "1d10",
      damageType: "fire",
      castingTime: "1A",
    });

    expect(bonusSpells).toHaveLength(1);
    expect(bonusSpells[0]).toMatchObject({
      name: "Healing Word",
      isHealing: true,
      damageFormula: "1d4+4",
      damageType: "healing",
      castingTime: "1BA",
    });
  });

  it("builds combat groups from delegated weapon and action builders", () => {
    const actor = {
      system: {
        attributes: {
          spellcasting: "wis",
          prof: 2,
        },
        abilities: {
          str: { mod: 2 },
          wis: { mod: 3 },
        },
      },
      items: [
        { id: "main", type: "weapon", system: { equipped: true, properties: ["lgt"] } },
        { id: "off", type: "weapon", system: { equipped: true, properties: ["lgt"] } },
      ],
    };

    const buildActions = vi.fn((_: Record<string, unknown>, actionType: string) => {
      if (actionType === "reaction") {
        return [{ id: "uncanny", name: "Uncanny Dodge", description: "", img: "", uses: null, recharge: null }];
      }
      return [];
    });

    const groups = buildCombatGroups(actor, {
      weapons: [makeWeapon("main", "Shortsword"), makeWeapon("off", "Dagger")],
      spellsFirst: true,
      buildActions,
      formatMod: (modifier) => (modifier >= 0 ? `+${modifier}` : String(modifier)),
      shortDesc: (html) => html,
      spellAnnotations: [],
    });

    expect(groups.map((group) => group.key)).toEqual(["action", "bonus", "reaction", "other"]);
    expect(groups[0].weaponGroups[0].weapons).toHaveLength(2);
    expect(groups[1].weaponGroups[0].weapons[0].name).toBe("Dagger (Off-hand)");
    expect(groups[2].items[0].name).toBe("Uncanny Dodge");
    expect(groups.every((group) => group.spellsFirst)).toBe(true);
  });
});
