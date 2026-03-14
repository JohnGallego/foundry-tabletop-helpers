/**
 * Character Creator — Spell List Resolver
 *
 * Resolves which spells are available to a class by querying
 * the dnd5e system's spell list API at runtime.
 *
 * Tries multiple API patterns (dnd5e has evolved across versions)
 * and falls back gracefully when no spell list can be determined.
 */

import { Log } from "../../logger";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Attempt to resolve the set of spell UUIDs available to a class.
 *
 * Tries the following approaches in order:
 * 1. `dnd5e.registry.spellLists` — dnd5e 5.x registry API
 * 2. Walk the class document's `SpellList` advancement for a list reference
 *
 * Returns null if no spell list can be determined (caller should fall back
 * to showing all spells).
 */
export async function resolveClassSpellUuids(
  classIdentifier: string,
): Promise<Set<string> | null> {
  // Method 1: dnd5e.registry.spellLists API
  const fromRegistry = await tryRegistryLookup(classIdentifier);
  if (fromRegistry) return fromRegistry;

  return null;
}

/* ── Method 1: dnd5e Registry ────────────────────────────── */

async function tryRegistryLookup(classIdentifier: string): Promise<Set<string> | null> {
  try {
    const g = globalThis as Record<string, any>;
    const dnd5e = g.dnd5e;
    if (!dnd5e?.registry) return null;

    const registry = dnd5e.registry;

    // dnd5e 5.x: registry.spellLists is a Map-like structure
    if (registry.spellLists) {
      const spellLists = registry.spellLists;

      // Try known API method names
      for (const method of ["forClass", "getListForClass", "get"]) {
        if (typeof spellLists[method] === "function") {
          const result = await spellLists[method](classIdentifier);
          const uuids = extractUuidsFromResult(result);
          if (uuids) {
            Log.debug(`Spell list resolved via registry.spellLists.${method}()`, {
              classIdentifier,
              count: uuids.size,
            });
            return uuids;
          }
        }
      }

      // Try direct map access
      if (typeof spellLists.get === "function") {
        const result = spellLists.get(classIdentifier);
        const uuids = extractUuidsFromResult(result);
        if (uuids) {
          Log.debug("Spell list resolved via registry.spellLists.get()", {
            classIdentifier,
            count: uuids.size,
          });
          return uuids;
        }
      }
    }
  } catch (err) {
    Log.debug("Spell list registry lookup failed:", err);
  }

  return null;
}

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Extract a Set of UUID strings from various possible spell list result shapes.
 */
function extractUuidsFromResult(result: any): Set<string> | null {
  if (!result) return null;

  // Shape: { spells: string[] } or { spells: [{ uuid: string }] }
  if (Array.isArray(result.spells) && result.spells.length > 0) {
    return new Set(
      result.spells.map((s: any) => (typeof s === "string" ? s : s?.uuid)).filter(Boolean),
    );
  }

  // Shape: { entries: string[] } or { entries: [{ uuid: string }] }
  if (Array.isArray(result.entries) && result.entries.length > 0) {
    return new Set(
      result.entries.map((s: any) => (typeof s === "string" ? s : s?.uuid)).filter(Boolean),
    );
  }

  // Shape: Set<string> or Array<string> directly
  if (result instanceof Set) return result as Set<string>;
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === "string") {
    return new Set(result);
  }

  return null;
}
