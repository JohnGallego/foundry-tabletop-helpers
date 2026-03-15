import { describe, expect, it } from "vitest";

import type { CharacterActions, CharacterData } from "../../extractors/dnd5e-types";
import { buildActions, buildCombatStats, buildSummaryContext } from "./character-transformer-combat";

function makeCharacterData(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    name: "Tarin",
    img: "portrait.png",
    tokenImg: "token.png",
    details: {
      race: "Human",
      background: "Soldier",
      alignment: "Neutral Good",
      level: 7,
      classes: [
        { name: "Rogue", level: 5, subclass: "Thief" },
        { name: "Monk", level: 2, subclass: "" },
      ],
    },
    abilities: [],
    skills: [],
    combat: {
      ac: 16,
      hp: { value: 42, max: 42, temp: 0, tempmax: 0 },
      death: { success: 0, failure: 0 },
      initiative: 4,
      speed: [{ key: "walk", value: 35 }],
      proficiency: 3,
      inspiration: false,
      senses: [],
      hitDice: {
        d8: { value: 2, max: 5 },
        d6: { value: 1, max: 2 },
      },
    },
    actions: {
      weapons: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      other: [],
    },
    spellcasting: null,
    inventory: [],
    features: [],
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      weaponMasteries: [],
    },
    favorites: new Set(),
    backstory: "",
    traits: {
      size: "Medium",
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      languages: [],
    },
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    ...overrides,
  };
}

function makeActions(overrides: Partial<CharacterActions> = {}): CharacterActions {
  return {
    weapons: [
      {
        name: "Longsword",
        weaponType: "Melee Weapon",
        mastery: "Vex",
        hasMastery: true,
        range: "5 ft.",
        rangeType: "Reach",
        toHit: "+7",
        damage: "1d8+4",
        damageType: "slashing",
        properties: "Versatile",
        isFavorite: true,
      },
    ],
    actions: [],
    bonusActions: [],
    reactions: [],
    other: [],
    ...overrides,
  };
}

describe("character transformer combat helpers", () => {
  it("builds summary context from class levels", () => {
    expect(buildSummaryContext(makeCharacterData())).toEqual({
      level: 7,
      proficiencyBonus: 3,
      classes: [
        { name: "Rogue", level: 5 },
        { name: "Monk", level: 2 },
      ],
      sneakAttackDice: "3d6",
      kiPoints: 2,
      layOnHandsPool: null,
      sorceryPoints: null,
      bardicInspirationDie: null,
    });
  });

  it("builds combat stats with hit dice and signed bonuses", () => {
    expect(buildCombatStats(makeCharacterData())).toEqual({
      ac: 16,
      hpMax: 42,
      hitDice: "5d8, 2d6",
      hitDieType: "d8",
      hitDieIcon: "◆",
      initiative: "+4",
      speed: "35 ft walk",
      proficiency: "+3",
    });
  });

  it("builds actions, mastery descriptions, and formatted feature uses", () => {
    const ctx = buildSummaryContext(makeCharacterData());
    const actions = buildActions(makeActions({
      bonusActions: [
        {
          name: "Second Wind",
          description: "<p>Regain hit points equal to 1d10 + fighter level.</p>",
          uses: { value: 1, max: 1, recovery: "sr" },
          isFavorite: false,
        },
      ],
    }), ctx);

    expect(actions.hasWeapons).toBe(true);
    expect(actions.weapons[0]).toMatchObject({
      favStar: "★",
      name: "Longsword",
      masteryBadge: "Vex",
      hasMastery: true,
    });
    expect(actions.masteryDescriptions[0]).toMatchObject({
      name: "Mastery: Vex",
    });
    expect(actions.masteryDescriptions[0].description).toContain("fth-adv-symbol");
    expect(actions.bonusActions[0].items[0]).toMatchObject({
      name: "Second Wind",
      usesDisplay: "(1/Short Rest)",
      checkboxes: "☐",
    });
  });
});
