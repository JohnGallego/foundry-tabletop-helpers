/**
 * Helper for querying SRD / PHB / DMG compendiums.
 * Used to pull combat action descriptions, weapon mastery text,
 * conditions reference, etc.
 *
 * Fully implemented in Phase 5 – this is the scaffold.
 */

import { Log } from "../../logger";

/**
 * Query a Foundry compendium pack by collection id and entry name.
 * Returns the document if found, or null.
 */
export async function getCompendiumEntry(
  packId: string,
  entryName: string,
): Promise<any | null> {
  try {
    const pack: any = (globalThis as any).game?.packs?.get?.(packId);
    if (!pack) {
      Log.debug(`compendium pack not found: ${packId}`);
      return null;
    }
    await pack.getIndex();
    const entry = pack.index.find(
      (e: any) => e.name?.toLowerCase() === entryName.toLowerCase(),
    );
    if (!entry) {
      Log.debug(`compendium entry not found: ${entryName} in ${packId}`);
      return null;
    }
    return pack.getDocument(entry._id);
  } catch (err) {
    Log.warn("compendium query failed", { packId, entryName, err });
    return null;
  }
}

/**
 * Bulk-fetch multiple entries from a pack.
 */
export async function getCompendiumEntries(
  packId: string,
  entryNames: string[],
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  try {
    const pack: any = (globalThis as any).game?.packs?.get?.(packId);
    if (!pack) return results;
    await pack.getIndex();
    for (const name of entryNames) {
      const entry = pack.index.find(
        (e: any) => e.name?.toLowerCase() === name.toLowerCase(),
      );
      if (entry) {
        const doc = await pack.getDocument(entry._id);
        if (doc) results.set(name, doc);
      }
    }
  } catch (err) {
    Log.warn("bulk compendium query failed", { packId, err });
  }
  return results;
}

