import { describe, expect, it } from "vitest";

import type { FeatureGroup } from "../../extractors/dnd5e-types";
import type { SummaryContext } from "../../data/feature-summaries";
import {
  buildFeatureGroups,
  buildProficiencies,
} from "./character-transformer-features";

const summaryContext: SummaryContext = {
  level: 5,
  proficiencyBonus: 3,
  classes: [{ name: "Fighter", level: 5 }],
  sneakAttackDice: null,
  kiPoints: null,
  layOnHandsPool: null,
  sorceryPoints: null,
  bardicInspirationDie: null,
};

const features: FeatureGroup[] = [
  {
    category: "Class Features",
    features: [
      {
        name: "Second Wind",
        description: "<p>Regain hit points equal to 1d10 + fighter level.</p>",
        uses: { value: 1, max: 1, recovery: "sr" },
        isFavorite: true,
      },
      {
        name: "Attack",
        description: "<p>Standard attack action.</p>",
        uses: null,
        isFavorite: false,
      },
      {
        name: "Indomitable",
        description: "You have advantage on a saving throw you fail.",
        uses: { value: 1, max: 2, recovery: "lr" },
        isFavorite: false,
      },
    ],
  },
];

describe("character transformer feature helpers", () => {
  it("filters out action names and formats feature rows", () => {
    const groups = buildFeatureGroups(features, new Set(["attack"]), summaryContext);

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("Class Features");
    expect(groups[0].features).toHaveLength(2);
    expect(groups[0].features[0]).toMatchObject({
      favStar: "★ ",
      name: "Second Wind",
      usesDisplay: "(1/Short Rest)",
      checkboxes: "☐",
    });
    expect(groups[0].features[1]).toMatchObject({
      name: "Indomitable",
      usesDisplay: "(2/Long Rest)",
      checkboxes: "☐☐",
    });
    expect(groups[0].features[1].description).toContain("saving throw");
  });

  it("drops groups that only contain action-linked features", () => {
    const actionOnlyGroups = buildFeatureGroups([
      {
        category: "Actions",
        features: [
          {
            name: "Dash",
            description: "Move faster.",
            uses: null,
            isFavorite: false,
          },
        ],
      },
    ], new Set(["dash"]), summaryContext);

    expect(actionOnlyGroups).toEqual([]);
  });

  it("builds proficiencies with mastery and language formatting", () => {
    const vm = buildProficiencies({
      armor: ["Light Armor", "Medium Armor"],
      weapons: ["Simple Weapons", "Martial Weapons"],
      tools: ["Smith's Tools"],
      weaponMasteries: ["Longsword", "Javelin"],
    }, ["Common", "Dwarvish"]);

    expect(vm).toMatchObject({
      armor: "Light Armor, Medium Armor",
      hasArmor: true,
      weapons: "Simple Weapons, Martial Weapons",
      hasWeapons: true,
      tools: "Smith's Tools",
      hasTools: true,
      languages: "Common, Dwarvish",
      hasLanguages: true,
      weaponMasteries: "⚔ Longsword, ⚔ Javelin",
      hasWeaponMasteries: true,
    });
  });
});
