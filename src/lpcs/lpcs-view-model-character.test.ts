import { describe, expect, it } from "vitest";

import {
  buildFeatures,
  buildProficiencies,
  buildSummaryContext,
  buildTraits,
} from "./lpcs-view-model-character";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const stripFoundryRefs = (html: string) => html.replace(/<[^>]+>/g, "").trim();

describe("lpcs view model character", () => {
  it("builds summary context from class levels", () => {
    const actor = {
      system: {
        details: { level: 7 },
        attributes: { prof: 3 },
      },
      items: [
        { type: "class", name: "Rogue", system: { levels: 5 } },
        { type: "class", name: "Monk", system: { levels: 2 } },
      ],
    };

    expect(buildSummaryContext(actor)).toEqual({
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

  it("builds grouped features and species traits with annotations", () => {
    const actor = {
      items: [
        {
          id: "class-1",
          type: "feat",
          name: "Action Surge",
          img: "action.png",
          system: {
            type: { value: "class", subtype: "Fighter" },
            description: { value: "<p>Take one additional action.</p>" },
            uses: { value: 1, max: 1 },
          },
        },
        {
          id: "race-1",
          type: "feat",
          name: "Darkvision",
          img: "darkvision.png",
          system: {
            type: { value: "race" },
            description: { value: "<p>See in darkness.</p>" },
          },
        },
        {
          id: "feat-1",
          type: "feat",
          name: "Alert",
          img: "alert.png",
          system: {
            type: { value: "feat" },
            description: { value: "<p>Always on guard.</p>" },
          },
        },
      ],
      system: {
        details: { level: 5 },
        attributes: { prof: 3 },
      },
    };

    const result = buildFeatures(actor, {
      stripFoundryRefs,
      getFeatureAnnotations: (itemId) => itemId === "class-1"
        ? [{ source: "Fighting Style", value: "+1", target: "ac", targetLabel: "AC", icon: "", label: "+1 Fighting Style" }]
        : [],
    });

    expect(result.mainGroups.map((group) => group.label)).toEqual(["Feats", "Fighter Features"]);
    expect(result.mainGroups[0].features[0].name).toBe("Alert");
    expect(result.mainGroups[1].features[0]).toMatchObject({
      name: "Action Surge",
      uses: { value: 1, max: 1 },
    });
    expect(result.mainGroups[1].features[0].effectAnnotations).toHaveLength(1);
    expect(result.speciesGroup[0].features[0].name).toBe("Darkvision");
  });

  it("builds traits and proficiencies from trait maps", () => {
    const system = {
      traits: {
        dr: { value: ["fire"], custom: "cold" },
        ci: { value: new Set(["poisoned"]) },
      },
    };

    expect(buildTraits(system)).toEqual([
      { key: "dr", label: "Damage Resistances", values: "cold, fire" },
      { key: "ci", label: "Condition Immunities", values: "poisoned" },
    ]);

    const actor = {
      system: {
        traits: {
          armorProf: { value: ["lgt", "shl"] },
          weaponProf: { value: new Set(["sim", "mar"]) },
          toolProf: { value: ["thief"], custom: "Lute" },
          languages: { value: ["common"], custom: "Draconic" },
        },
      },
    };

    expect(buildProficiencies(actor, { capitalize })).toEqual({
      armor: "Light Armor, Shields",
      weapons: "Simple Weapons, Martial Weapons",
      tools: "Lute, Thieves' Tools",
      languages: "Draconic, Common",
    });
  });
});
