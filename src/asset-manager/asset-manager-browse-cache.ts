/**
 * Asset Manager — Browse Cache
 *
 * In-memory cache for FilePicker.browse() results with TTL.
 * Avoids redundant server round-trips when navigating back to
 * recently visited directories or re-rendering the same folder.
 *
 * Cache entries expire after 60 seconds. A background refresh
 * updates stale entries without blocking the UI — the user sees
 * the cached result immediately while fresh data loads behind.
 */

import { Log } from "../logger";

/* ── Constants ────────────────────────────────────────────── */

/** Cache time-to-live in milliseconds. */
const CACHE_TTL = 60_000;

/** Maximum number of cached directories. */
const MAX_ENTRIES = 50;

/* ── Types ────────────────────────────────────────────────── */

interface BrowseCacheEntry {
  /** Browse result data (files, dirs, etc.). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  /** Timestamp when cached. */
  timestamp: number;
  /** Whether a background refresh is in progress. */
  refreshing: boolean;
}

/** Callback to perform the actual browse request. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrowseFn = (source: string, target: string) => Promise<any>;

/* ── BrowseCache Class ────────────────────────────────────── */

class BrowseCache {
  #entries = new Map<string, BrowseCacheEntry>();
  #browseFn: BrowseFn | null = null;

  /** Set the browse function used for background refreshes. */
  setBrowseFn(fn: BrowseFn): void {
    this.#browseFn = fn;
  }

  /**
   * Get a cached browse result.
   * Returns the cached result if available (even if stale — triggers background refresh).
   * Returns `null` if no cache entry exists.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(source: string, target: string): any | null {
    const key = `${source}::${target}`;
    const entry = this.#entries.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;

    // If stale, trigger background refresh but still return cached data
    if (age > CACHE_TTL && !entry.refreshing && this.#browseFn) {
      entry.refreshing = true;
      this.#backgroundRefresh(source, target, key);
    }

    return entry.result;
  }

  /**
   * Store a browse result in the cache.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(source: string, target: string, result: any): void {
    const key = `${source}::${target}`;

    // Evict oldest if at capacity
    if (this.#entries.size >= MAX_ENTRIES && !this.#entries.has(key)) {
      this.#evictOldest();
    }

    this.#entries.set(key, {
      result,
      timestamp: Date.now(),
      refreshing: false,
    });
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(source: string, target: string): void {
    const key = `${source}::${target}`;
    this.#entries.delete(key);
  }

  /**
   * Invalidate all entries for a source.
   */
  invalidateSource(source: string): void {
    for (const key of this.#entries.keys()) {
      if (key.startsWith(`${source}::`)) {
        this.#entries.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.#entries.clear();
  }

  /**
   * Check if a fresh (non-stale) entry exists.
   */
  isFresh(source: string, target: string): boolean {
    const key = `${source}::${target}`;
    const entry = this.#entries.get(key);
    if (!entry) return false;
    return (Date.now() - entry.timestamp) <= CACHE_TTL;
  }

  /* ── Internal ─────────────────────────────────────────── */

  async #backgroundRefresh(source: string, target: string, key: string): Promise<void> {
    try {
      const result = await this.#browseFn!(source, target);
      this.#entries.set(key, {
        result,
        timestamp: Date.now(),
        refreshing: false,
      });
      Log.debug(`BrowseCache: background refresh for ${target}`);
    } catch (err) {
      // Mark as no longer refreshing so it can retry
      const entry = this.#entries.get(key);
      if (entry) entry.refreshing = false;
      Log.debug("BrowseCache: background refresh failed", err);
    }
  }

  #evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.#entries) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) this.#entries.delete(oldestKey);
  }
}

/* ── Singleton ────────────────────────────────────────────── */

let instance: BrowseCache | null = null;

/** Get or create the singleton BrowseCache. */
export function getBrowseCache(): BrowseCache {
  if (!instance) {
    instance = new BrowseCache();
  }
  return instance;
}
