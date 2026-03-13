/**
 * Level-Up Manager — Detection Logic
 *
 * Determines whether a character is eligible to level up based on XP thresholds.
 * Provides utilities for extracting level and class data from actors.
 */

import type { FoundryDocument } from "../../types";
import { XP_THRESHOLDS } from "../data/dnd5e-constants";
import type { ClassItemInfo, AdvancementEntry } from "./level-up-types";

/* ── Public API ──────────────────────────────────────────── */

/**
 * Check whether an actor has enough XP to level up.
 * Returns false for non-character actors or actors at max level.
 */
export function shouldShowLevelUp(actor: FoundryDocument): boolean {
  if (actor.type !== "character") return false;

  const system = actor.system as Record<string, unknown> | undefined;
  if (!system) return false;

  const details = system.details as Record<string, unknown> | undefined;
  const xp = details?.xp as { value?: number } | undefined;
  if (!xp || typeof xp.value !== "number") return false;

  const currentLevel = getTotalLevel(actor);
  if (currentLevel >= 20) return false; // Max level

  const nextThreshold = XP_THRESHOLDS[currentLevel + 1];
  if (nextThreshold === undefined) return false;

  return xp.value >= nextThreshold;
}

/**
 * Get the total character level from an actor.
 */
export function getTotalLevel(actor: FoundryDocument): number {
  const system = actor.system as Record<string, unknown> | undefined;
  const details = system?.details as Record<string, unknown> | undefined;
  const level = details?.level;
  return typeof level === "number" ? level : 0;
}

/**
 * Extract class item information from an actor's embedded items.
 * Returns info about each class the character has levels in.
 */
export function getClassItems(actor: FoundryDocument): ClassItemInfo[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (actor as any).items;
  if (!items) return [];

  const classItems: ClassItemInfo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of items) {
    if (item.type !== "class") continue;

    const sys = item.system as Record<string, unknown> | undefined;
    if (!sys) continue;

    const levels = typeof sys.levels === "number" ? sys.levels : 0;
    const identifier = typeof sys.identifier === "string" ? sys.identifier : item.name?.toLowerCase() ?? "";
    const hitDie = typeof sys.hitDice === "string" ? sys.hitDice : "d8";

    // Extract advancement data
    const advancement = extractAdvancement(sys);

    // Check for subclass
    const subclassName = findSubclassName(actor, identifier);

    classItems.push({
      itemId: item.id ?? item._id ?? "",
      name: item.name ?? "Unknown Class",
      identifier,
      levels,
      hitDie,
      subclassName,
      advancement,
    });
  }

  return classItems;
}

/**
 * Get the hit die denomination for a class at a given level.
 * Falls back to "d8" if unknown.
 */
export function getHitDie(classInfo: ClassItemInfo): string {
  return classInfo.hitDie || "d8";
}

/**
 * Calculate the average HP gain for a hit die denomination.
 * Standard 5e rule: average = (max/2) + 1.
 */
export function averageHpForHitDie(hitDie: string): number {
  const dieSize = parseInt(hitDie.replace("d", ""), 10);
  if (isNaN(dieSize)) return 5; // Default d8 average
  return Math.floor(dieSize / 2) + 1;
}

/**
 * Check which levels grant ASI for a class.
 * Standard 5e ASI levels: 4, 8, 12, 16, 19.
 * Some classes (Fighter, Rogue) get extra ASIs.
 */
export function isAsiLevel(classIdentifier: string, classLevel: number): boolean {
  const standardAsiLevels = [4, 8, 12, 16, 19];
  const fighterExtraAsi = [6, 14];
  const rogueExtraAsi = [10];

  if (standardAsiLevels.includes(classLevel)) return true;
  if (classIdentifier === "fighter" && fighterExtraAsi.includes(classLevel)) return true;
  if (classIdentifier === "rogue" && rogueExtraAsi.includes(classLevel)) return true;

  return false;
}

/**
 * Check which levels grant subclass selection.
 * Standard is level 3, but some classes differ.
 */
export function isSubclassLevel(classIdentifier: string, classLevel: number): boolean {
  // Cleric and Sorcerer get subclass at level 1, Warlock at level 1
  const level1Subclass = ["cleric", "sorcerer", "warlock"];
  // Druid and Wizard get subclass at level 2
  const level2Subclass = ["druid", "wizard"];

  if (level1Subclass.includes(classIdentifier) && classLevel === 1) return true;
  if (level2Subclass.includes(classIdentifier) && classLevel === 2) return true;
  // Standard: level 3
  if (classLevel === 3) return true;

  return false;
}

/* ── Internal Helpers ────────────────────────────────────── */

/**
 * Extract advancement entries from a class item's system data.
 */
function extractAdvancement(sys: Record<string, unknown>): AdvancementEntry[] {
  const advRaw = sys.advancement;
  if (!advRaw || !Array.isArray(advRaw)) {
    // Try accessing as a collection (dnd5e stores advancement as a collection)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = (advRaw as any)?.contents ?? (advRaw as any)?._source;
    if (Array.isArray(contents)) {
      return normalizeAdvancement(contents);
    }
    return [];
  }
  return normalizeAdvancement(advRaw);
}

function normalizeAdvancement(raw: unknown[]): AdvancementEntry[] {
  return raw
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      type: typeof a.type === "string" ? a.type : "",
      level: typeof a.level === "number" ? a.level : undefined,
      configuration: typeof a.configuration === "object" ? a.configuration as Record<string, unknown> : undefined,
      title: typeof a.title === "string" ? a.title : undefined,
    }));
}

/**
 * Find the subclass name for a given class on an actor.
 */
function findSubclassName(actor: FoundryDocument, classIdentifier: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (actor as any).items;
  if (!items) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of items) {
    if (item.type !== "subclass") continue;
    const sys = item.system as Record<string, unknown> | undefined;
    if (sys?.classIdentifier === classIdentifier) {
      return item.name as string | undefined;
    }
  }

  return undefined;
}
