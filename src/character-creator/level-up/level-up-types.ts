/**
 * Level-Up Manager — Type Definitions
 *
 * Interfaces for the level-up workflow, steps, and actor update engine.
 */

import type { AbilityKey } from "../character-creator-types";

/* ── Level-Up State ─────────────────────────────────────── */

/** The level-up wizard's in-memory state. */
export interface LevelUpState {
  /** The actor being leveled up. */
  actorId: string;
  /** Current character level (before level-up). */
  currentLevel: number;
  /** Target level (currentLevel + 1). */
  targetLevel: number;
  /** Step IDs in navigation order. */
  applicableSteps: string[];
  /** Index into applicableSteps. */
  currentStep: number;
  /** Per-step selections. */
  selections: LevelUpSelections;
  /** Per-step completion status. */
  stepStatus: Map<string, "pending" | "complete">;
  /** Class items on the actor (for multiclass tracking). */
  classItems: ClassItemInfo[];
}

/** Info about a class item on the actor. */
export interface ClassItemInfo {
  /** Embedded item ID on the actor. */
  itemId: string;
  /** Class name (e.g., "Fighter"). */
  name: string;
  /** System identifier (e.g., "fighter"). */
  identifier: string;
  /** Current levels in this class. */
  levels: number;
  /** Hit die denomination (e.g., "d10"). */
  hitDie: string;
  /** Subclass name (if any). */
  subclassName?: string;
  /** Advancement data from the class item. */
  advancement: AdvancementEntry[];
}

/** A single advancement entry from a class item. */
export interface AdvancementEntry {
  /** Advancement type (HitPoints, ItemGrant, ScaleValue, AbilityScoreImprovement, etc.). */
  type: string;
  /** Level at which this advancement applies. */
  level?: number;
  /** Configuration data (type-specific). */
  configuration?: Record<string, unknown>;
  /** Display title. */
  title?: string;
}

/* ── Level-Up Selections ────────────────────────────────── */

/** All level-up selections, keyed by step ID. */
export interface LevelUpSelections {
  classChoice?: LevelUpClassChoice;
  hp?: LevelUpHpChoice;
  features?: LevelUpFeaturesChoice;
  subclass?: LevelUpSubclassChoice;
  feats?: LevelUpFeatChoice;
  spells?: LevelUpSpellsChoice;
  [key: string]: unknown;
}

/** Class choice for level-up (existing or multiclass). */
export interface LevelUpClassChoice {
  /** Whether leveling an existing class or multiclassing. */
  mode: "existing" | "multiclass";
  /** Embedded item ID of the class being leveled (for existing). */
  classItemId?: string;
  /** Class name. */
  className: string;
  /** Class identifier. */
  classIdentifier: string;
  /** For multiclass: compendium UUID of the new class. */
  newClassUuid?: string;
}

/** HP choice for level-up. */
export interface LevelUpHpChoice {
  /** Method used. */
  method: "roll" | "average";
  /** HP gained this level. */
  hpGained: number;
  /** The hit die denomination used (e.g., "d10"). */
  hitDie: string;
  /** Raw roll result (if rolled). */
  rollResult?: number;
}

/** Features granted at this level. */
export interface LevelUpFeaturesChoice {
  /** UUIDs of features the player accepted (optional features may be declined). */
  acceptedFeatureUuids: string[];
  /** Feature names for display. */
  featureNames: string[];
}

/** Subclass choice during level-up. */
export interface LevelUpSubclassChoice {
  /** Compendium UUID of the chosen subclass. */
  uuid: string;
  /** Subclass name. */
  name: string;
  /** Subclass image. */
  img: string;
}

/** ASI or feat choice during level-up. */
export interface LevelUpFeatChoice {
  /** Whether choosing ASI or feat. */
  choice: "asi" | "feat";
  /** ASI: which abilities get +1 (up to 2). */
  asiAbilities?: AbilityKey[];
  /** Feat: compendium UUID. */
  featUuid?: string;
  /** Feat name. */
  featName?: string;
}

/** Spell changes during level-up. */
export interface LevelUpSpellsChoice {
  /** New spell UUIDs to learn. */
  newSpellUuids: string[];
  /** Spell UUIDs to swap out (if class allows). */
  swappedOutUuids: string[];
  /** Spell UUIDs to swap in (replacements). */
  swappedInUuids: string[];
  /** New cantrip UUIDs (if gaining cantrips at this level). */
  newCantripUuids: string[];
}

/* ── Multiclass Prerequisites ───────────────────────────── */

/** Multiclass prerequisite check result. */
export interface MulticlassPrereqResult {
  /** Whether the character meets all prerequisites. */
  met: boolean;
  /** Human-readable description of unmet prerequisites. */
  unmetReasons: string[];
}

/** Standard multiclass prerequisites by class. */
export const MULTICLASS_PREREQUISITES: Record<string, Partial<Record<AbilityKey, number>>> = {
  barbarian: { str: 13 },
  bard: { cha: 13 },
  cleric: { wis: 13 },
  druid: { wis: 13 },
  fighter: { str: 13 }, // or dex 13
  monk: { dex: 13, wis: 13 },
  paladin: { str: 13, cha: 13 },
  ranger: { dex: 13, wis: 13 },
  rogue: { dex: 13 },
  sorcerer: { cha: 13 },
  warlock: { cha: 13 },
  wizard: { int: 13 },
};
