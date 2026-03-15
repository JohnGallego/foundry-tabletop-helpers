import { describe, expect, it } from "vitest";

import type { AbilityData, FeatureGroup, SkillData } from "../../extractors/dnd5e-types";
import {
  buildPassives,
  buildSavesWidget,
  buildSkills,
} from "./character-transformer-saves-skills";

const abilities: AbilityData[] = [
  { key: "str", label: "Strength", value: 16, mod: 3, save: 6, proficient: true },
  { key: "dex", label: "Dexterity", value: 14, mod: 2, save: 2, proficient: false },
  { key: "con", label: "Constitution", value: 15, mod: 2, save: 5, proficient: true },
  { key: "int", label: "Intelligence", value: 10, mod: 0, save: 0, proficient: false },
  { key: "wis", label: "Wisdom", value: 12, mod: 1, save: 1, proficient: false },
  { key: "cha", label: "Charisma", value: 8, mod: -1, save: -1, proficient: false },
];

const skills: SkillData[] = [
  { key: "prc", label: "Perception", total: 5, passive: 15, proficiency: 1, ability: "wis" },
  { key: "ins", label: "Insight", total: 3, passive: 13, proficiency: 0.5, ability: "wis" },
  { key: "inv", label: "Investigation", total: 7, passive: 17, proficiency: 2, ability: "int" },
  { key: "acr", label: "Acrobatics", total: 2, passive: 12, proficiency: 0, ability: "dex" },
];

const features: FeatureGroup[] = [
  {
    category: "Class Features",
    features: [
      {
        name: "Brave",
        description: "You have advantage on saving throws against being frightened.",
        uses: null,
        isFavorite: false,
      },
      {
        name: "Second Wind",
        description: "You can regain hit points.",
        uses: null,
        isFavorite: false,
      },
    ],
  },
];

describe("character transformer saves and skills helpers", () => {
  it("builds passive scores from key skills", () => {
    expect(buildPassives(skills)).toEqual([
      { value: 15, label: "Passive Perception" },
      { value: 13, label: "Passive Insight" },
      { value: 17, label: "Passive Investigation" },
    ]);
  });

  it("builds save columns and extracts save-related feature notes", () => {
    const vm = buildSavesWidget(abilities, features);

    expect(vm.leftColumn[0]).toEqual({
      profIcon: "●",
      label: "Strength",
      abbr: "STR",
      value: "+6",
    });
    expect(vm.rightColumn[2]).toEqual({
      profIcon: "○",
      label: "Charisma",
      abbr: "CHA",
      value: "-1",
    });
    expect(vm.saveFeatures).toHaveLength(1);
    expect(vm.saveFeatures[0]).toContain("Brave:");
    expect(vm.saveFeatures[0]).toContain("fth-adv-symbol");
  });

  it("builds skill rows with proficiency icons and css classes", () => {
    const vm = buildSkills(skills);

    expect(vm[0]).toMatchObject({
      profIcon: "●",
      mod: "+5",
      name: "Perception",
      ability: "WIS",
      cssClass: "fth-skill fth-skill-prof",
    });
    expect(vm[1]).toMatchObject({
      profIcon: "◐",
      cssClass: "fth-skill",
    });
    expect(vm[2]).toMatchObject({
      profIcon: "◆",
      cssClass: "fth-skill fth-skill-expert",
    });
    expect(vm[3]).toMatchObject({
      profIcon: "○",
      ability: "DEX",
    });
  });
});
