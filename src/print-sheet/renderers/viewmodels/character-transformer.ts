/**
 * Transforms CharacterData (raw extracted data) into CharacterViewModel (render-ready).
 * All formatting, escaping, and conditional logic happens here.
 */

import type {
  CharacterData,
  AbilityData,
} from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import type {
  CharacterViewModel,
  AbilityViewModel,
} from "./character-viewmodel";
import { esc, signStr } from "./character-transformer-common";
import {
  buildActions,
  buildCombatStats,
  buildSummaryContext,
} from "./character-transformer-combat";
import {
  buildSpellCards,
  buildSpellcasting,
} from "./character-transformer-spells";
import {
  buildCurrency,
  buildInventory,
} from "./character-transformer-inventory";
import {
  buildPassives,
  buildSavesWidget,
  buildSkills,
} from "./character-transformer-saves-skills";
import {
  buildFeatureGroups,
  buildProficiencies,
} from "./character-transformer-features";

/* ── Main Transformer ───────────────────────────────────────── */

export function transformCharacterToViewModel(
  data: CharacterData,
  options: PrintOptions,
): CharacterViewModel {
  const sec = options.sections;

  // Select portrait
  let portraitUrl = "";
  if (options.portrait === "portrait" && data.img) {
    portraitUrl = data.img;
  } else if (options.portrait === "token" && data.tokenImg) {
    portraitUrl = data.tokenImg;
  }

  // Build subtitle
  const classStr = data.details.classes
    .map(c => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`)
    .join(" / ") || "Adventurer";
  const subtitleParts = [
    `Level ${data.details.level} ${classStr}`,
    data.details.race,
    data.details.background,
    data.details.alignment,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" • ");

  // Build passives
  const passives = buildPassives(data.skills);

  // Build senses and defenses
  const sensesLine = buildSensesLine(data.combat.senses);
  const defensesLine = buildDefensesLine(data.traits);

  // Build combat stats
  const combat = buildCombatStats(data);

  // Build abilities
  const abilities = buildAbilities(data.abilities);

  // Build saves widget
  const saves = buildSavesWidget(data.abilities, data.features);

  // Build skills
  const skills = buildSkills(data.skills);

  // Build summary context for feature interpolation
  const summaryContext = buildSummaryContext(data);

  // Action names for filtering features
  const actionNames = new Set(
    [...data.actions.actions, ...data.actions.bonusActions, ...data.actions.reactions, ...data.actions.other]
      .map(f => f.name.toLowerCase())
  );

  // Build actions
  const actions = buildActions(data.actions, summaryContext);
  const hasActions = actions.hasWeapons || actions.otherActions.length > 0 ||
    actions.bonusActions.length > 0 || actions.reactions.length > 0;

  // Build spellcasting
  const spellcasting = data.spellcasting ? buildSpellcasting(data.spellcasting) : null;
  const spellCards = data.spellcasting ? buildSpellCards(data.spellcasting) : [];

  // Build features
  const featureGroups = buildFeatureGroups(data.features, actionNames, summaryContext);

  // Build proficiencies
  const proficiencies = buildProficiencies(data.proficiencies, data.traits.languages);

  // Build inventory
  const inventory = buildInventory(data.inventory);

  // Build currency
  const currency = buildCurrency(data.currency);

  return {
    name: esc(data.name),
    portraitUrl,
    hasPortrait: !!portraitUrl,
    subtitle: esc(subtitle),
    passives,
    shortRestCheckboxes: "☐ ☐",
    sensesLine: esc(sensesLine),
    defensesLine,
    hasDefenses: defensesLine.length > 0,
    combat,
    abilities,
    saves,
    skills,
    actions,
    hasActions,
    spellcasting,
    hasSpellcasting: !!spellcasting,
    featureGroups,
    hasFeatures: featureGroups.length > 0,
    proficiencies,
    hasProficiencies: proficiencies.hasArmor || proficiencies.hasWeapons ||
      proficiencies.hasTools || proficiencies.hasLanguages || proficiencies.hasWeaponMasteries,
    inventory,
    hasInventory: inventory.items.length > 0,
    currency,
    hasCurrency: true, // Always show currency widget
    spellCards,
    hasSpellCards: spellCards.length > 0,
    backstory: data.backstory,
    hasBackstory: !!data.backstory,
    paperClass: `fth-paper-${options.paperSize}`,
    showAbilities: sec.abilities !== false,
    showSkills: sec.skills !== false,
    showActions: sec.actions !== false,
    showSpells: sec.spells !== false,
    showFeatures: sec.features !== false,
    showInventory: sec.inventory !== false,
    showBackstory: sec.backstory !== false,
  };
}

/* ── Senses & Defenses ──────────────────────────────────────── */

function buildSensesLine(senses: { key: string; value: number | string }[]): string {
  return senses
    .map(s => `${s.key} ${s.value}${typeof s.value === "number" ? " ft" : ""}`)
    .join(", ");
}

function buildDefensesLine(traits: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; conditionImmunities: string[] }): string {
  const parts: string[] = [];
  if (traits.resistances.length) parts.push(`<strong>Resist:</strong> ${traits.resistances.map(esc).join(", ")}`);
  if (traits.immunities.length) parts.push(`<strong>Immune:</strong> ${traits.immunities.map(esc).join(", ")}`);
  if (traits.vulnerabilities.length) parts.push(`<strong>Vuln:</strong> ${traits.vulnerabilities.map(esc).join(", ")}`);
  if (traits.conditionImmunities.length) parts.push(`<strong>Cond. Immune:</strong> ${traits.conditionImmunities.map(esc).join(", ")}`);
  return parts.join(" | ");
}

/* ── Abilities ──────────────────────────────────────────────── */

function buildAbilities(abilities: AbilityData[]): AbilityViewModel[] {
  return abilities.map(a => ({
    label: esc(a.label),
    mod: signStr(a.mod),
    score: a.value,
  }));
}
