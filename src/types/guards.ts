/**
 * Type guards and accessor helpers for Foundry VTT globals.
 * 
 * These functions provide safe, typed access to Foundry globals
 * without requiring `any` casts throughout the codebase.
 * 
 * Usage:
 *   const game = getGame();
 *   if (game?.system?.id === "dnd5e") { ... }
 */

import type {
  FoundryGame,
  FoundryHooks,
  FoundryUI,
  FoundryUser,
} from "./foundry";

/* ── Global Accessors ─────────────────────────────────────── */

/**
 * Safely get the global game object.
 * Returns undefined if game is not yet initialized.
 */
export function getGame(): FoundryGame | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.game as FoundryGame | undefined;
}

/**
 * Safely get the global Hooks object.
 */
export function getHooks(): FoundryHooks | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.Hooks as FoundryHooks | undefined;
}

/**
 * Safely get the global ui object.
 */
export function getUI(): FoundryUI | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.ui as FoundryUI | undefined;
}

/**
 * Safely get the global Handlebars object.
 */
export function getHandlebars(): typeof Handlebars | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.Handlebars as typeof Handlebars | undefined;
}

/**
 * Safely get the global CONFIG object.
 */
export function getConfig(): Record<string, unknown> | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.CONFIG as Record<string, unknown> | undefined;
}

/**
 * Get the FormApplication base class (for settings menus).
 */
export function getFormApplicationClass(): (new (...args: unknown[]) => unknown) | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.FormApplication as (new (...args: unknown[]) => unknown) | undefined;
}

/**
 * Get the Dialog class (for confirmation dialogs, etc.).
 */
export function getDialogClass(): (new (...args: unknown[]) => unknown) | undefined {
  const g = globalThis as Record<string, unknown>;
  return g.Dialog as (new (...args: unknown[]) => unknown) | undefined;
}

/**
 * Get the CompendiumCollection class.
 * Uses the v13 namespaced path: foundry.documents.collections.CompendiumCollection
 */
export function getCompendiumCollectionClass(): {
  createCompendium?: (data: Record<string, unknown>) => Promise<unknown>;
} | undefined {
  const g = globalThis as Record<string, unknown>;
  // v13+ namespaced path
  const foundryNs = g.foundry as Record<string, unknown> | undefined;
  const docsNs = foundryNs?.documents as Record<string, unknown> | undefined;
  const collectionsNs = docsNs?.collections as Record<string, unknown> | undefined;
  const CC = collectionsNs?.CompendiumCollection as {
    createCompendium?: (data: Record<string, unknown>) => Promise<unknown>;
  } | undefined;
  return CC;
}

/* ── System Checks ────────────────────────────────────────── */

/**
 * Check if the current world is running the dnd5e system.
 */
export function isDnd5eWorld(): boolean {
  return getGame()?.system?.id === "dnd5e";
}

/**
 * Get the current system ID, or "unknown" if unavailable.
 */
export function getSystemId(): string {
  return getGame()?.system?.id ?? "unknown";
}

/**
 * Parse a semver string (e.g., "4.3.2") into a numeric tuple.
 * Non-numeric segments are treated as 0.
 */
function parseSemver(version: string): [number, number, number] {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Check if the active system's version is at least `major.minor.patch`.
 * Returns false if the version string cannot be determined.
 */
export function systemVersionAtLeast(major: number, minor = 0, patch = 0): boolean {
  const version = getGame()?.system?.version ?? "0.0.0";
  const [v1, v2, v3] = parseSemver(version);
  if (v1 !== major) return v1 > major;
  if (v2 !== minor) return v2 > minor;
  return v3 >= patch;
}

/**
 * Check if the dnd5e system supports the Activities model (dnd5e >= 4.0.0).
 *
 * The Activities model was introduced in dnd5e 4.0 and replaced the legacy
 * "activation" + "damage.parts" pattern with a structured `item.system.activities`
 * collection.  Code that reads activities should guard with this function so it
 * degrades gracefully on older installs.
 */
export function isDnd5eActivitiesSupported(): boolean {
  return isDnd5eWorld() && systemVersionAtLeast(4);
}

/* ── User Checks ──────────────────────────────────────────── */

/**
 * Check if the current user is a GM.
 */
export function isGM(): boolean {
  return getGame()?.user?.isGM ?? false;
}

/**
 * Get the current user ID.
 */
export function getCurrentUserId(): string | undefined {
  return getGame()?.user?.id;
}

/**
 * Get all non-GM users.
 */
export function getPlayerUsers(): FoundryUser[] {
  const game = getGame();
  if (!game?.users) return [];
  return [...game.users].filter((u) => !u.isGM);
}

/* ── Settings Helpers ─────────────────────────────────────── */

/**
 * Safely get a setting value.
 */
export function getSetting<T = unknown>(module: string, key: string): T | undefined {
  try {
    return getGame()?.settings?.get(module, key) as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Safely set a setting value.
 */
export async function setSetting(module: string, key: string, value: unknown): Promise<void> {
  try {
    await getGame()?.settings?.set(module, key, value);
  } catch {
    // Setting failed - likely called before ready
  }
}

/* ── Object Type Guards ───────────────────────────────────── */

/**
 * Check if an object has a specific property.
 */
export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * Check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

