/**
 * Quick Rules Reference — Panel
 *
 * Floating, draggable reference panel for rapid D&D 5e (2024) rule lookups.
 * Two-zone layout:
 *   Zone 1: Sticky at-a-glance card strip (Tier 1 rules)
 *   Zone 2: Searchable category accordion (Tier 2 rules)
 *
 * Triggered via Combat Tracker button, "/" keybind, or macro API.
 * Draggable with localStorage position memory.
 */

import { Log, MOD } from "../logger";
import { getHooks, isGM, isDnd5eWorld, getSetting } from "../types";
import { COMBAT_SETTINGS } from "../combat/combat-settings";
import { TIER_1_RULES, RULE_CATEGORIES } from "./rules-reference-data";
import { buildSearchIndex, searchRules } from "./rules-reference-search";
import type { RuleEntry, RuleCategory, SearchIndexEntry, KeyStat } from "./rules-reference-types";

/* ── State ────────────────────────────────────────────────── */

let panelEl: HTMLElement | null = null;
let visible = false;
let searchIndex: SearchIndexEntry[] = [];
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let expandedRuleId: string | null = null;
let expandedCategoryId: string | null = null;
let searchActive = false;
const POSITION_KEY = `${MOD}:rules-reference-pos`;
const SEARCH_DEBOUNCE_MS = 150;

/* ── Public API ───────────────────────────────────────────── */

/**
 * Register hooks for the rules reference panel.
 * Called from registerCombatHooks() during init.
 */
export function registerRulesReferenceHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  // "/" keybind listener
  document.addEventListener("keydown", onKeyDown);

  Log.debug("Rules reference hooks registered");
}

/**
 * Toggle the rules reference panel visibility.
 * Called from Combat Tracker button, keybind, or macro API.
 */
export function toggleRulesReference(): void {
  if (!isRulesReferenceEnabled()) return;

  if (visible && panelEl) {
    hidePanel();
  } else {
    showPanel();
  }
}

/* ── Feature Enabled Check ────────────────────────────────── */

export function isRulesReferenceEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_RULES_REFERENCE) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/* ── Keybind ──────────────────────────────────────────────── */

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== "/") return;
  if (!isRulesReferenceEnabled()) return;

  // Don't intercept when typing in an input
  const active = document.activeElement;
  if (active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || (active instanceof HTMLElement && active.isContentEditable)) {
    return;
  }

  e.preventDefault();
  toggleRulesReference();
}

/* ── Panel Lifecycle ──────────────────────────────────────── */

function showPanel(): void {
  // Build search index on first show
  if (searchIndex.length === 0) {
    searchIndex = buildSearchIndex(RULE_CATEGORIES, TIER_1_RULES);
  }

  if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.id = "fth-rules-reference";
    panelEl.className = "fth-rules-reference";
    document.body.appendChild(panelEl);
    restorePosition();
  }

  // Reset state
  expandedRuleId = null;
  expandedCategoryId = null;
  searchActive = false;

  panelEl.innerHTML = buildPanelHTML();
  attachPanelListeners(panelEl);
  makeDraggable(panelEl);
  panelEl.style.display = "";
  visible = true;

  // Focus search input
  const searchInput = panelEl.querySelector<HTMLInputElement>("#rr-search");
  if (searchInput) setTimeout(() => searchInput.focus(), 50);
}

function hidePanel(): void {
  if (panelEl) panelEl.style.display = "none";
  visible = false;
}

/* ── HTML Builders ────────────────────────────────────────── */

function buildPanelHTML(): string {
  const zone1HTML = buildZone1HTML();
  const zone2HTML = buildZone2HTML();

  return `
    <div class="rr-header" data-rr-drag>
      <span class="rr-title"><i class="fa-solid fa-book-sparkles"></i> Rules Reference</span>
      <span class="rr-subtitle">D&D 2024</span>
      <button class="rr-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="rr-search-bar">
      <i class="fa-solid fa-magnifying-glass rr-search-icon"></i>
      <input type="search" id="rr-search" class="rr-search-input" placeholder="Search rules...  ( / )" autocomplete="off" />
    </div>
    <div class="rr-content">
      <div class="rr-zone1">${zone1HTML}</div>
      <div class="rr-zone2">${zone2HTML}</div>
    </div>
  `;
}

function buildZone1HTML(): string {
  const cards = TIER_1_RULES.map((entry) => buildGlanceCard(entry)).join("");
  return `<div class="rr-glance-grid">${cards}</div>`;
}

function buildGlanceCard(entry: RuleEntry): string {
  const statsHTML = (entry.keyStats ?? [])
    .map((s) => `<span class="rr-stat-badge"><span class="rr-stat-label">${esc(s.label)}</span> ${esc(s.value)}</span>`)
    .join("");

  const expandedClass = expandedRuleId === entry.id ? "rr-expanded" : "";
  const bodyHTML = expandedRuleId === entry.id
    ? `<div class="rr-glance-body">${entry.body}</div>`
    : "";

  return `
    <div class="rr-glance-card ${expandedClass}" data-rule-id="${entry.id}">
      <div class="rr-glance-header">
        <span class="rr-glance-title">${esc(entry.title)}</span>
        <i class="fa-solid fa-chevron-down rr-expand-icon"></i>
      </div>
      ${statsHTML ? `<div class="rr-glance-stats">${statsHTML}</div>` : ""}
      <div class="rr-glance-summary">${esc(entry.summary)}</div>
      ${bodyHTML}
    </div>
  `;
}

function buildZone2HTML(): string {
  if (searchActive) return ""; // Replaced by search results
  return RULE_CATEGORIES.map((cat) => buildCategorySection(cat)).join("");
}

function buildCategorySection(cat: RuleCategory): string {
  const isExpanded = expandedCategoryId === cat.id;
  const expandedClass = isExpanded ? "rr-cat-expanded" : "";
  const entriesHTML = isExpanded
    ? `<div class="rr-cat-entries">${cat.entries.map((e) => buildRuleRow(e)).join("")}</div>`
    : "";

  return `
    <div class="rr-category ${expandedClass}" data-category-id="${cat.id}">
      <div class="rr-cat-header">
        <i class="${cat.icon} rr-cat-icon"></i>
        <span class="rr-cat-label">${esc(cat.label)}</span>
        <span class="rr-cat-count">${cat.entries.length}</span>
        <i class="fa-solid fa-chevron-right rr-cat-chevron"></i>
      </div>
      ${entriesHTML}
    </div>
  `;
}

function buildRuleRow(entry: RuleEntry): string {
  const isExpanded = expandedRuleId === entry.id;
  const expandedClass = isExpanded ? "rr-rule-expanded" : "";
  const statsHTML = (entry.keyStats ?? [])
    .map((s: KeyStat) => `<span class="rr-stat-badge rr-stat-badge-sm"><span class="rr-stat-label">${esc(s.label)}</span> ${esc(s.value)}</span>`)
    .join("");
  const bodyHTML = isExpanded
    ? `<div class="rr-rule-body">${entry.body}</div>`
    : "";

  return `
    <div class="rr-rule-row ${expandedClass}" data-rule-id="${entry.id}">
      <div class="rr-rule-title-bar">
        <span class="rr-rule-title">${esc(entry.title)}</span>
        <div class="rr-rule-stats">${statsHTML}</div>
        <i class="fa-solid fa-chevron-right rr-rule-chevron"></i>
      </div>
      <div class="rr-rule-summary">${esc(entry.summary)}</div>
      ${bodyHTML}
    </div>
  `;
}

function buildSearchResults(query: string): string {
  const results = searchRules(searchIndex, query);
  if (results.length === 0) {
    return `<div class="rr-no-results">No rules found for "${esc(query)}"</div>`;
  }

  return results.map((r) => {
    const statsHTML = (r.entry.keyStats ?? [])
      .map((s: KeyStat) => `<span class="rr-stat-badge rr-stat-badge-sm"><span class="rr-stat-label">${esc(s.label)}</span> ${esc(s.value)}</span>`)
      .join("");

    const isExpanded = expandedRuleId === r.entry.id;
    const expandedClass = isExpanded ? "rr-rule-expanded" : "";
    const bodyHTML = isExpanded
      ? `<div class="rr-rule-body">${r.entry.body}</div>`
      : "";

    return `
      <div class="rr-rule-row rr-search-result ${expandedClass}" data-rule-id="${r.entry.id}">
        <div class="rr-rule-title-bar">
          <span class="rr-rule-title">${esc(r.entry.title)}</span>
          <div class="rr-rule-stats">${statsHTML}</div>
          <i class="fa-solid fa-chevron-right rr-rule-chevron"></i>
        </div>
        <div class="rr-rule-summary">${esc(r.entry.summary)}</div>
        ${bodyHTML}
      </div>
    `;
  }).join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Event Listeners ──────────────────────────────────────── */

function attachPanelListeners(el: HTMLElement): void {
  // Close button
  el.querySelector(".rr-close")?.addEventListener("click", () => hidePanel());

  // Search input
  const searchInput = el.querySelector<HTMLInputElement>("#rr-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => onSearchInput(searchInput.value), SEARCH_DEBOUNCE_MS);
    });

    // Escape in search clears, second Escape closes panel
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (searchInput.value) {
          searchInput.value = "";
          onSearchInput("");
          e.stopPropagation();
        } else {
          hidePanel();
        }
      }
    });
  }

  // Delegate clicks
  el.addEventListener("click", onPanelClick);
}

function onPanelClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!panelEl) return;

  // At-a-glance card click (expand/collapse)
  const glanceCard = target.closest<HTMLElement>(".rr-glance-card");
  if (glanceCard) {
    const ruleId = glanceCard.dataset.ruleId;
    if (ruleId) {
      expandedRuleId = expandedRuleId === ruleId ? null : ruleId;
      rerenderZone1();
    }
    return;
  }

  // Category header click (expand/collapse)
  const catHeader = target.closest<HTMLElement>(".rr-cat-header");
  if (catHeader) {
    const category = catHeader.closest<HTMLElement>(".rr-category");
    const catId = category?.dataset.categoryId;
    if (catId) {
      expandedCategoryId = expandedCategoryId === catId ? null : catId;
      expandedRuleId = null; // Reset rule expansion when switching categories
      rerenderZone2();
    }
    return;
  }

  // Rule row click (expand/collapse)
  const ruleRow = target.closest<HTMLElement>(".rr-rule-row");
  if (ruleRow) {
    const ruleId = ruleRow.dataset.ruleId;
    if (ruleId) {
      expandedRuleId = expandedRuleId === ruleId ? null : ruleId;
      if (searchActive) {
        rerenderSearchResults();
      } else {
        rerenderZone2();
      }
    }
    return;
  }
}

/* ── Search ───────────────────────────────────────────────── */

function onSearchInput(query: string): void {
  if (!panelEl) return;

  const trimmed = query.trim();
  if (!trimmed) {
    // Restore default view
    searchActive = false;
    expandedRuleId = null;
    rerenderZone1();
    rerenderZone2();
    return;
  }

  searchActive = true;
  expandedRuleId = null;

  // Hide Zone 1, show search results in Zone 2
  const zone1 = panelEl.querySelector<HTMLElement>(".rr-zone1");
  if (zone1) zone1.style.display = "none";

  const zone2 = panelEl.querySelector<HTMLElement>(".rr-zone2");
  if (zone2) {
    zone2.innerHTML = buildSearchResults(trimmed);
    zone2.scrollTop = 0;
  }
}

/* ── Re-render helpers ────────────────────────────────────── */

function rerenderZone1(): void {
  if (!panelEl) return;
  const zone1 = panelEl.querySelector<HTMLElement>(".rr-zone1");
  if (zone1) {
    zone1.innerHTML = buildZone1HTML();
    zone1.style.display = searchActive ? "none" : "";
  }
}

function rerenderZone2(): void {
  if (!panelEl) return;
  const zone2 = panelEl.querySelector<HTMLElement>(".rr-zone2");
  if (zone2) zone2.innerHTML = buildZone2HTML();
}

function rerenderSearchResults(): void {
  if (!panelEl) return;
  const searchInput = panelEl.querySelector<HTMLInputElement>("#rr-search");
  const query = searchInput?.value?.trim() ?? "";
  const zone2 = panelEl.querySelector<HTMLElement>(".rr-zone2");
  if (zone2) zone2.innerHTML = buildSearchResults(query);
}

/* ── Dragging ─────────────────────────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  const handle = el.querySelector<HTMLElement>("[data-rr-drag]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".rr-close")) return;
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    handle.style.cursor = "grabbing";
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e: PointerEvent) => {
    if (!dragging) return;
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    savePosition();
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

function savePosition(): void {
  if (!panelEl) return;
  const pos = { left: panelEl.style.left, top: panelEl.style.top };
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function restorePosition(): void {
  if (!panelEl) return;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const pos = JSON.parse(raw) as { left?: string; top?: string };
      if (pos.left && pos.top) {
        panelEl.style.left = pos.left;
        panelEl.style.top = pos.top;
        panelEl.style.right = "auto";
        panelEl.style.bottom = "auto";
        return;
      }
    }
  } catch { /* ignore */ }
  // Default: right-center
  panelEl.style.right = "340px";
  panelEl.style.top = "50%";
  panelEl.style.transform = "translateY(-50%)";
}
