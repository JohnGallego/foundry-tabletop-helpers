/**
 * Character Creator — D&D 5e Constants
 *
 * Static reference data for character creation and level-up.
 * Pure data, no Foundry runtime dependencies.
 */

import type { AbilityKey, PackSourceConfig } from "../character-creator-types";

/* ── XP Thresholds ───────────────────────────────────────── */

/** XP required to reach each level (level → minimum XP). */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/* ── Ability Scores ──────────────────────────────────────── */

/** The six ability score keys in standard order. */
export const ABILITY_KEYS: readonly AbilityKey[] = [
  "str", "dex", "con", "int", "wis", "cha",
] as const;

/** Full ability names. */
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Abbreviated ability names (uppercase). */
export const ABILITY_ABBREVS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

/* ── Point Buy ───────────────────────────────────────────── */

/** Point cost for each ability score value in point buy. */
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Starting score for each ability in point buy. */
export const POINT_BUY_BASE_SCORE = 8;

/** Total points available to spend. */
export const POINT_BUY_BUDGET = 27;

/** Minimum allowed score in point buy. */
export const POINT_BUY_MIN = 8;

/** Maximum allowed score in point buy. */
export const POINT_BUY_MAX = 15;

/* ── Standard Array ──────────────────────────────────────── */

/** Fixed ability score values for the Standard Array method. */
export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8] as const;

/* ── Ability Helpers ─────────────────────────────────────── */

/** Compute ability score modifier. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Format modifier as "+2" or "-1". */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/* ── Skills ──────────────────────────────────────────────── */

/** The 18 D&D 5e skills keyed by abbreviation. */
export const SKILLS: Record<string, { label: string; ability: AbilityKey }> = {
  acr: { label: "Acrobatics", ability: "dex" },
  ani: { label: "Animal Handling", ability: "wis" },
  arc: { label: "Arcana", ability: "int" },
  ath: { label: "Athletics", ability: "str" },
  dec: { label: "Deception", ability: "cha" },
  his: { label: "History", ability: "int" },
  ins: { label: "Insight", ability: "wis" },
  itm: { label: "Intimidation", ability: "cha" },
  inv: { label: "Investigation", ability: "int" },
  med: { label: "Medicine", ability: "wis" },
  nat: { label: "Nature", ability: "int" },
  prc: { label: "Perception", ability: "wis" },
  prf: { label: "Performance", ability: "cha" },
  per: { label: "Persuasion", ability: "cha" },
  rel: { label: "Religion", ability: "int" },
  slt: { label: "Sleight of Hand", ability: "dex" },
  ste: { label: "Stealth", ability: "dex" },
  sur: { label: "Survival", ability: "wis" },
};

/* ── Languages ──────────────────────────────────────────── */

/** Standard languages available in the 2024 PHB. */
export const STANDARD_LANGUAGES: readonly { id: string; label: string }[] = [
  { id: "common", label: "Common" },
  { id: "common-sign", label: "Common Sign Language" },
  { id: "draconic", label: "Draconic" },
  { id: "dwarvish", label: "Dwarvish" },
  { id: "elvish", label: "Elvish" },
  { id: "giant", label: "Giant" },
  { id: "gnomish", label: "Gnomish" },
  { id: "goblin", label: "Goblin" },
  { id: "halfling", label: "Halfling" },
  { id: "orc", label: "Orc" },
] as const;

/** Rare languages (typically require DM approval). */
export const RARE_LANGUAGES: readonly { id: string; label: string }[] = [
  { id: "abyssal", label: "Abyssal" },
  { id: "celestial", label: "Celestial" },
  { id: "deep-speech", label: "Deep Speech" },
  { id: "infernal", label: "Infernal" },
  { id: "primordial", label: "Primordial" },
  { id: "sylvan", label: "Sylvan" },
  { id: "thieves-cant", label: "Thieves' Cant" },
  { id: "undercommon", label: "Undercommon" },
] as const;

/** Lookup map for language display names. */
export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  [...STANDARD_LANGUAGES, ...RARE_LANGUAGES].map(l => [l.id, l.label])
);

/* ── Default Pack Sources ────────────────────────────────── */

/** SRD default compendium pack sources. */
export const DEFAULT_PACK_SOURCES: PackSourceConfig = {
  classes: ["dnd5e.classes"],
  subclasses: ["dnd5e.subclasses"],
  races: ["dnd5e.races"],
  backgrounds: ["dnd5e.backgrounds"],
  feats: ["dnd5e.feats"],
  spells: ["dnd5e.spells"],
  items: ["dnd5e.items"],
};
