/**
 * Level-Up Manager — Detection Logic
 *
 * Determines whether a character is eligible to level up based on XP thresholds.
 * Provides utilities for extracting level and class data from actors.
 */

import type { FoundryDocument } from "../../types";
import { XP_THRESHOLDS } from "../data/dnd5e-constants";
import type { ClassItemInfo } from "./level-up-types";
import {
  buildLevelUpClassItems,
  extractActorTotalLevel,
  isLevelUpAsiLevel,
  isLevelUpSubclassLevel,
} from "./level-up-detection-helpers";

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
  return extractActorTotalLevel(actor as { system?: Record<string, unknown> });
}

/**
 * Extract class item information from an actor's embedded items.
 * Returns info about each class the character has levels in.
 */
export function getClassItems(actor: FoundryDocument): ClassItemInfo[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (actor as any).items;
  if (!items) return [];
  return buildLevelUpClassItems(items as Iterable<{
    id?: string;
    _id?: string;
    type?: string;
    name?: string;
    system?: Record<string, unknown>;
  }>);
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
  return isLevelUpAsiLevel(classIdentifier, classLevel);
}

/**
 * Check which levels grant subclass selection.
 * Standard is level 3, but some classes differ.
 */
export function isSubclassLevel(classIdentifier: string, classLevel: number): boolean {
  return isLevelUpSubclassLevel(classIdentifier, classLevel);
}
