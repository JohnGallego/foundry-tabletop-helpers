import type { AbilityData, FeatureGroup, SkillData } from "../../extractors/dnd5e-types";
import type {
  PassiveScoreViewModel,
  SaveItemViewModel,
  SavesWidgetViewModel,
  SkillViewModel,
} from "./character-viewmodel";
import { esc, replaceAdvDisText, signStr } from "./character-transformer-common";

export function buildPassives(skills: SkillData[]): PassiveScoreViewModel[] {
  const perceptionSkill = skills.find((skill) => skill.key === "prc");
  const insightSkill = skills.find((skill) => skill.key === "ins");
  const investigationSkill = skills.find((skill) => skill.key === "inv");

  return [
    { value: perceptionSkill?.passive ?? 10, label: "Passive Perception" },
    { value: insightSkill?.passive ?? 10, label: "Passive Insight" },
    { value: investigationSkill?.passive ?? 10, label: "Passive Investigation" },
  ];
}

export function buildSavesWidget(abilities: AbilityData[], features: FeatureGroup[]): SavesWidgetViewModel {
  const abbrev: Record<string, string> = {
    Strength: "STR",
    Dexterity: "DEX",
    Constitution: "CON",
    Intelligence: "INT",
    Wisdom: "WIS",
    Charisma: "CHA",
  };

  const toSaveItem = (ability: AbilityData): SaveItemViewModel => {
    const abbr = abbrev[ability.label] ?? ability.label.slice(0, 3).toUpperCase();
    return {
      profIcon: ability.proficient ? "●" : "○",
      label: ability.label,
      abbr,
      value: signStr(ability.save),
    };
  };

  return {
    leftColumn: abilities.slice(0, 3).map(toSaveItem),
    rightColumn: abilities.slice(3, 6).map(toSaveItem),
    saveFeatures: extractSaveFeatures(features),
  };
}

export function buildSkills(skills: SkillData[]): SkillViewModel[] {
  const abbrev: Record<string, string> = {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
  };

  return skills.map((skill) => {
    let cssClass = "fth-skill";
    if (skill.proficiency >= 2) cssClass = "fth-skill fth-skill-expert";
    else if (skill.proficiency >= 1) cssClass = "fth-skill fth-skill-prof";

    return {
      profIcon: profIcon(skill.proficiency),
      mod: signStr(skill.total),
      name: esc(skill.label),
      ability: abbrev[skill.ability] ?? skill.ability.toUpperCase().slice(0, 3),
      cssClass,
    };
  });
}

function profIcon(level: number): string {
  if (level >= 2) return "◆";
  if (level >= 1) return "●";
  if (level >= 0.5) return "◐";
  return "○";
}

function extractSaveFeatures(features: FeatureGroup[]): string[] {
  const saveFeatures: string[] = [];
  const savePatterns = [/saving throws?/i, /\bsaves?\b/i, /save against/i, /avoid or end/i];

  for (const group of features) {
    for (const feature of group.features) {
      const description = feature.description || "";
      const mentionsSaves = savePatterns.some((pattern) => pattern.test(description));
      const mentionsAdvDis = /\b(advantage|disadvantage)\b/i.test(description);

      if (mentionsSaves && mentionsAdvDis) {
        const shortDescription = extractSaveContext(description);
        if (shortDescription) {
          saveFeatures.push(`${esc(feature.name)}: ${shortDescription}`);
        }
      }
    }
  }

  return saveFeatures;
}

function extractSaveContext(description: string): string {
  const sentences = description.split(/[.!?]+/).filter((sentence) => sentence.trim());
  for (const sentence of sentences) {
    if (/\b(advantage|disadvantage)\b/i.test(sentence) &&
        /\b(sav|frightened|charmed|poisoned|condition)\b/i.test(sentence)) {
      let clean = sentence.trim();
      if (clean.length > 80) clean = `${clean.substring(0, 77)}...`;
      return replaceAdvDisText(esc(clean));
    }
  }

  return "";
}
