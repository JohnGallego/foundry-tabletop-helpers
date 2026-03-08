/**
 * Shared types for the Combat Command Center feature suite.
 *
 * These types are used across Batch Initiative, Token Health Indicators,
 * Damage/Save Workflows, Monster Preview, and Party Summary.
 */

/* ── Advantage Mode (mirrors D20Roll.ADV_MODE) ────────────── */

export const ADV_MODE = { NORMAL: 0, ADVANTAGE: 1, DISADVANTAGE: -1 } as const;
export type AdvMode = (typeof ADV_MODE)[keyof typeof ADV_MODE];

/* ── Combatant Groups ─────────────────────────────────────── */

/** Predefined groupings for batch operations on combatants. */
export type CombatantGroup = "party" | "enemies" | "selected";

/* ── Health Tiers ─────────────────────────────────────────── */

/** HP-percentage-based condition tiers for token health indicators. */
export interface HealthTier {
  id: "healthy" | "wounded" | "bloodied" | "critical" | "defeated";
  label: string;
  /** Font Awesome icon class (e.g., "fa-heart"). */
  icon: string;
  /** CSS color value for the tier. */
  color: string;
  /** Minimum HP percentage (inclusive) for this tier. */
  minPercent: number;
  /** Maximum HP percentage (inclusive) for this tier. */
  maxPercent: number;
}

/** All health tiers from highest to lowest HP percentage. */
export const HEALTH_TIERS: readonly HealthTier[] = [
  { id: "healthy",  label: "Healthy",  icon: "fa-heart",            color: "#4caf50", minPercent: 76, maxPercent: 100 },
  { id: "wounded",  label: "Wounded",  icon: "fa-heart-crack",      color: "#c8a75d", minPercent: 51, maxPercent: 75 },
  { id: "bloodied", label: "Bloodied", icon: "fa-droplet",          color: "#e65100", minPercent: 26, maxPercent: 50 },
  { id: "critical", label: "Critical", icon: "fa-skull-crossbones", color: "#b71c1c", minPercent: 1,  maxPercent: 25 },
  { id: "defeated", label: "Defeated", icon: "fa-skull",            color: "#5a5550", minPercent: 0,  maxPercent: 0 },
] as const;

/**
 * Resolve the health tier for a given HP percentage.
 * @param hpPercent 0-100 inclusive, clamped internally.
 */
export function getHealthTier(hpPercent: number): HealthTier {
  const pct = Math.max(0, Math.min(100, Math.round(hpPercent)));
  if (pct === 0) return HEALTH_TIERS[4]; // defeated
  for (const tier of HEALTH_TIERS) {
    if (pct >= tier.minPercent && pct <= tier.maxPercent) return tier;
  }
  return HEALTH_TIERS[0]; // fallback to healthy
}

/* ── Batch Initiative ─────────────────────────────────────── */

/** A resolved combatant entry for batch initiative rolling. */
export interface BatchCombatant {
  /** Combatant document ID within the Combat encounter. */
  combatantId: string;
  /** Actor ID. */
  actorId: string;
  /** Token ID on the canvas. */
  tokenId: string;
  /** Display name for the combatant. */
  name: string;
  /** Whether this combatant is a PC (player character). */
  isPC: boolean;
}

/* ── Damage Workflow ──────────────────────────────────────── */

export type WorkflowType =
  | "saveForHalf"
  | "saveOrNothing"
  | "flatDamage"
  | "healing"
  | "saveForCondition"
  | "removeCondition";

export type SaveAbility = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const SAVE_ABILITIES: readonly SaveAbility[] = ["str", "dex", "con", "int", "wis", "cha"];

export const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  saveForHalf: "Save for Half",
  saveOrNothing: "Save or Nothing",
  flatDamage: "Flat Damage",
  healing: "Healing",
  saveForCondition: "Save vs Condition",
  removeCondition: "Remove Condition",
};

/* ── D&D 5e Conditions ───────────────────────────────────── */

export interface DndCondition {
  id: string;
  label: string;
}

export const DND_CONDITIONS: readonly DndCondition[] = [
  { id: "blinded", label: "Blinded" },
  { id: "charmed", label: "Charmed" },
  { id: "deafened", label: "Deafened" },
  { id: "exhaustion", label: "Exhaustion" },
  { id: "frightened", label: "Frightened" },
  { id: "grappled", label: "Grappled" },
  { id: "incapacitated", label: "Incapacitated" },
  { id: "invisible", label: "Invisible" },
  { id: "paralyzed", label: "Paralyzed" },
  { id: "petrified", label: "Petrified" },
  { id: "poisoned", label: "Poisoned" },
  { id: "prone", label: "Prone" },
  { id: "restrained", label: "Restrained" },
  { id: "stunned", label: "Stunned" },
  { id: "unconscious", label: "Unconscious" },
] as const;

/* ── Workflow I/O ────────────────────────────────────────── */

export interface WorkflowInput {
  type: WorkflowType;
  /** Damage/healing amount. 0 for condition-only workflows. */
  amount: number;
  dc?: number;
  ability?: SaveAbility;
  damageType?: string;
  /** Condition status ID for condition workflows. */
  conditionId?: string;
  /** Human-readable condition label. */
  conditionLabel?: string;
}

export interface ConcentrationCheck {
  name: string;
  roll: number;
  dc: number;
  success: boolean;
}

export interface WorkflowTarget {
  tokenId: string;
  actorId: string;
  name: string;
  saveRoll?: number;
  saveMod?: number;
  saveSuccess?: boolean;
  damageApplied: number;
  hpBefore: number;
  hpMax: number;
  hpAfter: number;
  /** Whether a condition was applied or removed. */
  conditionApplied?: boolean;
  /** Whether the target already had / didn't have the condition. */
  conditionSkipped?: boolean;
}

export interface WorkflowResult {
  input: WorkflowInput;
  targets: WorkflowTarget[];
  /** Concentration checks triggered by damage (auto-detected). */
  concentrationChecks?: ConcentrationCheck[];
}
