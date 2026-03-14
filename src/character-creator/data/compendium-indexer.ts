/**
 * Character Creator — Compendium Indexer
 *
 * Loads, caches, and normalizes compendium data from multiple configurable packs.
 * Strategy: index-first loading (fast), lazy document fetch (on demand).
 */

import { Log } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryCompendiumCollection, FoundryDocument, FoundryIndexEntry } from "../../types";
import type { CreatorContentType, CreatorIndexEntry, PackSourceConfig } from "../character-creator-types";

/** Fields requested from compendium indexes for normalization. */
const INDEX_FIELDS = [
  "name", "img", "type",
  "system.identifier",
  "system.classIdentifier",
  "system.level",
  "system.school",
  "system.armor.type",
  "system.weaponType",
];

/** Maps pack source config keys to content types. */
const SOURCE_KEY_TO_TYPE: Record<keyof PackSourceConfig, CreatorContentType> = {
  classes: "class",
  subclasses: "subclass",
  races: "race",
  backgrounds: "background",
  feats: "feat",
  spells: "spell",
  items: "item",
};

/**
 * Maps our content types to the dnd5e item types that qualify.
 * Used to filter out unrelated items from mixed-content packs.
 */
const ACCEPTED_ITEM_TYPES: Record<CreatorContentType, Set<string>> = {
  class: new Set(["class"]),
  subclass: new Set(["subclass"]),
  race: new Set(["race"]),
  background: new Set(["background"]),
  feat: new Set(["feat"]),
  spell: new Set(["spell"]),
  item: new Set(["weapon", "equipment", "consumable", "tool", "loot"]),
};

export class CompendiumIndexer {
  /** Cached index entries keyed by pack collection ID. */
  private indexCache = new Map<string, CreatorIndexEntry[]>();

  /** Cached full documents keyed by UUID. */
  private docCache = new Map<string, FoundryDocument>();

  /** In-flight index loads for deduplication. */
  private loading = new Map<string, Promise<CreatorIndexEntry[]>>();

  /**
   * Load all configured packs and return indexed entries grouped by pack.
   * Results are cached for the session — call invalidate() to clear.
   */
  async loadPacks(sources: PackSourceConfig): Promise<Map<string, CreatorIndexEntry[]>> {
    const promises: Promise<void>[] = [];

    for (const [sourceKey, packIds] of Object.entries(sources)) {
      const type = SOURCE_KEY_TO_TYPE[sourceKey as keyof PackSourceConfig];
      if (!type) continue;
      for (const packId of packIds) {
        if (this.indexCache.has(packId)) continue;
        promises.push(
          this.loadPack(packId, type).then((entries) => {
            this.indexCache.set(packId, entries);
          }),
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return this.indexCache;
  }

  /**
   * Load a single pack's index, normalize entries, and cache.
   * Deduplicates concurrent calls to the same pack.
   */
  async loadPack(packId: string, type: CreatorContentType): Promise<CreatorIndexEntry[]> {
    // Return cached result
    const cached = this.indexCache.get(packId);
    if (cached) return cached;

    // Deduplicate in-flight requests
    const inflight = this.loading.get(packId);
    if (inflight) return inflight;

    const promise = this._doLoadPack(packId, type);
    this.loading.set(packId, promise);

    try {
      const result = await promise;
      this.indexCache.set(packId, result);
      return result;
    } finally {
      this.loading.delete(packId);
    }
  }

  /**
   * Fetch a full document by UUID, with caching.
   */
  async fetchDocument(uuid: string): Promise<FoundryDocument | null> {
    const cached = this.docCache.get(uuid);
    if (cached) return cached;

    const doc = await fromUuid(uuid);
    if (doc) {
      this.docCache.set(uuid, doc);
    }
    return doc;
  }

  /**
   * Get a cached document's HTML description, if available.
   * Returns empty string if the document isn't cached or has no description.
   */
  getCachedDescription(uuid: string): string {
    const doc = this.docCache.get(uuid);
    if (!doc) return "";
    const system = doc.system as Record<string, unknown> | undefined;
    const desc = system?.description as Record<string, unknown> | undefined;
    return typeof desc?.value === "string" ? desc.value : "";
  }

  /**
   * Get all indexed entries of a given content type from the cache.
   * Must call loadPacks() first.
   */
  getIndexedEntries(type: CreatorContentType, sources: PackSourceConfig): CreatorIndexEntry[] {
    const sourceKey = Object.entries(SOURCE_KEY_TO_TYPE)
      .find(([, t]) => t === type)?.[0] as keyof PackSourceConfig | undefined;
    if (!sourceKey) return [];

    const packIds = sources[sourceKey] ?? [];
    const accepted = ACCEPTED_ITEM_TYPES[type];
    const entries: CreatorIndexEntry[] = [];

    for (const packId of packIds) {
      const cached = this.indexCache.get(packId);
      if (!cached) continue;
      for (const entry of cached) {
        if (accepted && entry.itemType && !accepted.has(entry.itemType)) continue;
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get all indexed entries across all types from the cache.
   */
  getAllIndexedEntries(): CreatorIndexEntry[] {
    const entries: CreatorIndexEntry[] = [];
    for (const cached of this.indexCache.values()) {
      entries.push(...cached);
    }
    return entries;
  }

  /** Clear all caches. Call when GM changes pack sources or content toggles. */
  invalidate(): void {
    this.indexCache.clear();
    this.docCache.clear();
    this.loading.clear();
    Log.debug("CompendiumIndexer: cache invalidated");
  }

  /* ── Private ─────────────────────────────────────────────── */

  private async _doLoadPack(
    packId: string,
    type: CreatorContentType,
  ): Promise<CreatorIndexEntry[]> {
    const game = getGame();
    if (!game?.packs) return [];

    const pack = game.packs.get(packId) as FoundryCompendiumCollection | undefined;
    if (!pack) {
      Log.warn(`CompendiumIndexer: pack "${packId}" not found`);
      return [];
    }

    try {
      const rawIndex = await pack.getIndex({ fields: INDEX_FIELDS });
      const entries: CreatorIndexEntry[] = [];
      const packLabel = pack.metadata?.label ?? pack.metadata?.name ?? packId;

      for (const raw of rawIndex) {
        const entry = this.normalizeEntry(raw, packId, packLabel, type);
        if (entry) entries.push(entry);
      }

      Log.debug(`CompendiumIndexer: loaded ${entries.length} entries from "${packId}"`);
      return entries;
    } catch (err) {
      Log.error(`CompendiumIndexer: failed to load pack "${packId}"`, err);
      return [];
    }
  }

  private normalizeEntry(
    raw: FoundryIndexEntry,
    packId: string,
    packLabel: string,
    type: CreatorContentType,
  ): CreatorIndexEntry | null {
    const name = raw.name;
    if (!name) return null;

    // Store the actual dnd5e item type — filtering happens at query time
    const itemType = (raw.type as string) ?? "";

    const uuid = raw.uuid ?? `Compendium.${packId}.Item.${raw._id}`;
    const img = (raw.img as string) ?? "icons/svg/mystery-man.svg";

    // Extract system fields safely
    const sysIdentifier = this.extractString(raw, "system.identifier");
    const sysClassIdentifier = this.extractString(raw, "system.classIdentifier");
    const sysSpellLevel = this.extractNumber(raw, "system.level");
    const sysSchool = this.extractString(raw, "system.school");
    const sysArmorType = this.extractString(raw, "system.armor.type");
    const sysWeaponType = this.extractString(raw, "system.weaponType");

    return {
      uuid,
      name,
      img,
      packId,
      packLabel,
      type,
      itemType: itemType || undefined,
      ...(sysIdentifier !== undefined && { identifier: sysIdentifier }),
      ...(sysClassIdentifier !== undefined && { classIdentifier: sysClassIdentifier }),
      ...(sysSpellLevel !== undefined && { spellLevel: sysSpellLevel }),
      ...(sysSchool !== undefined && { school: sysSchool }),
      ...(sysArmorType !== undefined && { armorType: sysArmorType }),
      ...(sysWeaponType !== undefined && { weaponType: sysWeaponType }),
    };
  }

  /**
   * Safely extract a value from an index entry using dot notation.
   * Tries flat key first (Foundry V13 index style), then nested access.
   */
  private extractValue(raw: Record<string, unknown>, path: string): unknown {
    // Flat key (Foundry index entries often use "system.level" as a literal key)
    const flat = raw[path];
    if (flat !== undefined) return flat;

    // Nested access fallback
    const parts = path.split(".");
    let current: unknown = raw;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /** Safely extract a string field from an index entry using dot notation. */
  private extractString(raw: Record<string, unknown>, path: string): string | undefined {
    const val = this.extractValue(raw, path);
    return typeof val === "string" ? val : undefined;
  }

  /** Safely extract a number field from an index entry using dot notation. */
  private extractNumber(raw: Record<string, unknown>, path: string): number | undefined {
    const val = this.extractValue(raw, path);
    return typeof val === "number" ? val : undefined;
  }
}

/** Singleton indexer instance. */
export const compendiumIndexer = new CompendiumIndexer();
