/**
 * Quick Rules Reference — Types
 *
 * Defines the data structures for rule entries, categories,
 * and search results used by the reference panel.
 */

/* ── Rule Entry ──────────────────────────────────────────── */

/** A highlighted key value displayed as a bronze badge. */
export interface KeyStat {
  label: string;   // e.g. "DC", "Duration"
  value: string;   // e.g. "10", "1 minute"
}

/** A single rule entry with summary and detailed body text. */
export interface RuleEntry {
  id: string;             // unique slug, e.g. "death-saves"
  title: string;          // display name
  tags: string[];         // search keywords
  tier: 1 | 2;           // 1 = at-a-glance card, 2 = category accordion only
  summary: string;        // 1-2 line summary (plain text)
  body: string;           // full detail text (may contain basic HTML: <strong>, <em>)
  keyStats?: KeyStat[];   // bronze-highlighted key values for at-a-glance cards
}

/* ── Category ────────────────────────────────────────────── */

/** A group of rules for the accordion section. */
export interface RuleCategory {
  id: string;
  label: string;
  icon: string;           // Font Awesome class, e.g. "fa-solid fa-swords"
  entries: RuleEntry[];
}

/* ── Search ──────────────────────────────────────────────── */

/** Pre-computed search index entry for fast substring matching. */
export interface SearchIndexEntry {
  entry: RuleEntry;
  categoryId: string;
  searchText: string;     // pre-joined lowercase of title + tags + summary + body (HTML stripped)
}

/** A search result linking an entry to its category. */
export interface SearchResult {
  entry: RuleEntry;
  categoryId: string;
}
