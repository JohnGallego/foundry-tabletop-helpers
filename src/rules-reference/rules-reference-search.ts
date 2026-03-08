/**
 * Quick Rules Reference — Search Engine
 *
 * Client-side substring search across rule titles, tags, and body text.
 * Builds a pre-computed index for fast matching.
 */

import type { RuleEntry, RuleCategory, SearchIndexEntry, SearchResult } from "./rules-reference-types";

/* ── Index Building ──────────────────────────────────────── */

/**
 * Build a search index from categories and standalone tier-1 rules.
 * Call once when the panel opens; the index is reusable across searches.
 */
export function buildSearchIndex(
  categories: readonly RuleCategory[],
  tier1Rules: readonly RuleEntry[],
): SearchIndexEntry[] {
  const index: SearchIndexEntry[] = [];
  const seen = new Set<string>();

  // Index tier 1 rules (category "tier1")
  for (const entry of tier1Rules) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    index.push({
      entry,
      categoryId: "tier1",
      searchText: buildSearchText(entry),
    });
  }

  // Index category entries
  for (const cat of categories) {
    for (const entry of cat.entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      index.push({
        entry,
        categoryId: cat.id,
        searchText: buildSearchText(entry),
      });
    }
  }

  return index;
}

/**
 * Search the index for entries matching all query terms (AND logic).
 * Terms are space-separated substrings matched case-insensitively.
 */
export function searchRules(index: SearchIndexEntry[], query: string): SearchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const terms = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const item of index) {
    const matches = terms.every((term) => item.searchText.includes(term));
    if (matches) {
      results.push({ entry: item.entry, categoryId: item.categoryId });
    }
  }

  // Sort: title matches first, then by title alphabetically
  results.sort((a, b) => {
    const aTitle = a.entry.title.toLowerCase();
    const bTitle = b.entry.title.toLowerCase();
    const aTitleMatch = terms.some((t) => aTitle.includes(t));
    const bTitleMatch = terms.some((t) => bTitle.includes(t));
    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;
    return aTitle.localeCompare(bTitle);
  });

  return results;
}

/* ── Helpers ──────────────────────────────────────────────── */

function buildSearchText(entry: RuleEntry): string {
  const parts = [
    entry.title,
    entry.tags.join(" "),
    entry.summary,
    stripHtml(entry.body),
  ];
  return parts.join(" ").toLowerCase();
}

/** Strip HTML tags for clean search indexing. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
