/**
 * Combat Monster Preview — Auto-showing NPC Stat Block Panel
 *
 * Displays the full NPC stat block during their combat turn. Two modes:
 *
 * 1. **Inline** (default): Injected into the Combat Tracker sidebar below the
 *    combatant list. Scrolls naturally with the sidebar content.
 *
 * 2. **Floating** (after drag): Popped out as a draggable fixed-position panel.
 *    Position is remembered via localStorage. Reset to inline via close button.
 *
 * Reuses the print-sheet extractor and ViewModel pipeline.
 * Includes an "Up Next" compact preview for the next combatant.
 *
 * - Auto-shows on NPC turns, auto-hides on PC turns
 * - Dismissible (resets on next turn change)
 * - GM-only, controlled by enableMonsterPreview setting
 */

import { Log, MOD } from "../../logger";
import { getHooks, isGM, isDnd5eWorld, getSetting, isObject } from "../../types";
import { COMBAT_SETTINGS } from "../combat-settings";
import { getExtractor } from "../../print-sheet/extractors/base-extractor";
import { transformNPCToViewModel } from "../../print-sheet/renderers/viewmodels/npc-transformer";
import type { NPCData } from "../../print-sheet/extractors/dnd5e-types";
import type { PrintOptions } from "../../print-sheet/types";
import type {
  NPCViewModel,
  FeatureSectionViewModel,
  FeatureEntryViewModel,
} from "../../print-sheet/renderers/viewmodels/npc-viewmodel";

/* ── State ────────────────────────────────────────────────── */

/** The floating panel element (only exists when in floating mode) */
let floatingEl: HTMLElement | null = null;
/** Cached inner HTML for the stat block — re-injected on Combat Tracker re-renders */
let cachedContentHTML: string = "";
/** The actor currently displayed */
let currentActorId: string | null = null;
/** Whether the user dismissed the panel this turn */
let dismissed = false;
/** Whether the panel is in floating mode (user dragged it out) */
let isFloating = false;

const POSITION_KEY = `${MOD}:monster-preview-pos`;
const MODE_KEY = `${MOD}:monster-preview-mode`;

/** Options for the extraction pipeline — show everything, use token image */
const PREVIEW_OPTIONS: PrintOptions = {
  paperSize: "letter",
  portrait: "token",
  sections: { stats: true, abilities: true, traits: true, features: true, actions: true },
};

/* ── Public API ───────────────────────────────────────────── */

/**
 * Register hooks for the monster preview panel.
 * Called from registerCombatHooks() during init.
 */
export function registerMonsterPreviewHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  hooks.on("updateCombat", onUpdateCombat);
  hooks.on("deleteCombat", onDeleteCombat);
  hooks.on("combatStart", onCombatStart);
  hooks.on("renderCombatTracker", onRenderCombatTracker);

  // Restore mode preference
  try {
    isFloating = localStorage.getItem(MODE_KEY) === "floating";
  } catch { /* ignore */ }

  Log.debug("Monster preview hooks registered");
}

/* ── Feature Enabled Check ────────────────────────────────── */

function isMonsterPreviewEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_MONSTER_PREVIEW) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/* ── Hook Handlers ────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onUpdateCombat(combat: any, change: any): void {
  if (!isMonsterPreviewEnabled()) return;
  if (change.turn === undefined && change.round === undefined) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameCombat = (globalThis as any).game?.combat;
  if (combat.id !== gameCombat?.id) return;

  dismissed = false;
  void handleTurnChange(combat);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onDeleteCombat(combat: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameCombat = (globalThis as any).game?.combat;
  if (combat.id === gameCombat?.id || !gameCombat) {
    clearPreview();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCombatStart(combat: any): void {
  if (!isMonsterPreviewEnabled()) return;
  dismissed = false;
  void handleTurnChange(combat);
}

/**
 * Re-inject the cached stat block into the Combat Tracker on each re-render.
 * This is needed because Foundry rebuilds the sidebar HTML on every render.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRenderCombatTracker(_app: any, html: any): void {
  if (!isMonsterPreviewEnabled()) return;
  if (isFloating || dismissed || !cachedContentHTML) return;

  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? (html as { get(i: number): HTMLElement }).get(0)
        : html?.[0] ?? null;

  if (!el) return;
  injectIntoTracker(el);
}

/* ── Turn Change Logic ────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTurnChange(combat: any): Promise<void> {
  try {
    const combatant = combat.combatant;
    const actor = combatant?.actor;

    if (!actor || actor.type !== "npc") {
      hidePreview();
      currentActorId = null;
      return;
    }

    if (dismissed) return;

    // Skip re-extraction if same actor (just update up-next)
    if (actor.id === currentActorId && cachedContentHTML) {
      updateUpNext(combat);
      showPreview();
      return;
    }

    currentActorId = actor.id;
    await extractAndRender(actor, combat);
  } catch (err) {
    Log.error("Monster Preview: failed to handle turn change", err);
  }
}

/* ── NPC Extraction + Rendering ───────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractAndRender(actor: any, combat: any): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemId = ((globalThis as any).game?.system?.id as string) ?? "dnd5e";
  const extractor = getExtractor(systemId);
  if (!extractor) {
    Log.warn("Monster Preview: no extractor for system", systemId);
    return;
  }

  const npcData = await extractor.extractNPC(actor, PREVIEW_OPTIONS) as NPCData;
  const vm = transformNPCToViewModel(npcData, PREVIEW_OPTIONS, false);
  const upNext = getUpNextData(combat);

  // Cache the rendered HTML
  cachedContentHTML = buildContentHTML(vm, upNext);

  // Display in the appropriate mode
  if (isFloating) {
    showFloating();
  } else {
    showInline();
  }
}

/* ── Up Next ──────────────────────────────────────────────── */

interface UpNextInfo {
  name: string;
  isNPC: boolean;
  ac?: number;
  hpMax?: number;
  cr?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUpNextData(combat: any): UpNextInfo | null {
  const turns = combat.turns;
  if (!Array.isArray(turns) || turns.length <= 1) return null;

  const currentIdx = combat.turn as number;
  const nextIdx = (currentIdx + 1) % turns.length;
  const nextCombatant = turns[nextIdx];
  const nextActor = nextCombatant?.actor;
  if (!nextActor) return null;

  const isNPC = nextActor.type === "npc";
  const info: UpNextInfo = { name: nextActor.name ?? "Unknown", isNPC };

  if (isNPC) {
    info.ac = nextActor.system?.attributes?.ac?.value;
    info.hpMax = nextActor.system?.attributes?.hp?.max;
    info.cr = nextActor.system?.details?.cr?.toString();
  }

  return info;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateUpNext(combat: any): void {
  const upNext = getUpNextData(combat);
  const upNextHTML = buildUpNextHTML(upNext);

  // Update in whichever container is active
  const containers = [
    floatingEl?.querySelector(".mp-up-next"),
    document.querySelector("#fth-mp-inline .mp-up-next"),
  ];
  for (const c of containers) {
    if (c) c.innerHTML = upNextHTML;
  }

  // Also update the cached HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = cachedContentHTML;
  const cached = tempDiv.querySelector(".mp-up-next");
  if (cached) {
    cached.innerHTML = upNextHTML;
    cachedContentHTML = tempDiv.innerHTML;
  }
}

/* ── Display Modes ────────────────────────────────────────── */

/** Show the stat block inline in the combat tracker sidebar */
function showInline(): void {
  // Remove floating if it exists
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }

  // Try to find and inject into the combat tracker
  const tracker = findCombatTrackerElement();
  if (tracker) {
    injectIntoTracker(tracker);
  }
}

/** Show the stat block as a floating draggable panel */
function showFloating(): void {
  // Remove any inline instance
  document.querySelector("#fth-mp-inline")?.remove();

  if (!floatingEl) {
    floatingEl = document.createElement("div");
    floatingEl.id = "fth-monster-preview";
    floatingEl.className = "fth-monster-preview fth-mp-floating";
    document.body.appendChild(floatingEl);
    restorePosition();
  }

  floatingEl.innerHTML = buildPanelHTML(cachedContentHTML);
  attachFloatingListeners(floatingEl);
  makeDraggable(floatingEl);
  floatingEl.style.display = "";
}

/** Hide the preview from both modes */
function hidePreview(): void {
  if (floatingEl) floatingEl.style.display = "none";
  document.querySelector("#fth-mp-inline")?.remove();
  cachedContentHTML = "";
}

/** Show the preview in whichever mode is active */
function showPreview(): void {
  if (isFloating) {
    if (floatingEl) floatingEl.style.display = "";
  } else {
    showInline();
  }
}

/** Full cleanup on combat end */
function clearPreview(): void {
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }
  document.querySelector("#fth-mp-inline")?.remove();
  cachedContentHTML = "";
  currentActorId = null;
  dismissed = false;
}

/* ── Combat Tracker Injection ─────────────────────────────── */

/** Find the combat tracker sidebar element */
function findCombatTrackerElement(): HTMLElement | null {
  // V13 ApplicationV2: the sidebar tab is rendered as a section
  return document.querySelector<HTMLElement>("#combat")
    ?? document.querySelector<HTMLElement>("[data-tab='combat']");
}

/** Inject the stat block into the combat tracker sidebar */
function injectIntoTracker(trackerEl: HTMLElement): void {
  // Remove any existing inline preview
  trackerEl.querySelector("#fth-mp-inline")?.remove();

  if (!cachedContentHTML || dismissed) return;

  // Find the combatant list — try common V13 selectors
  const combatantList = trackerEl.querySelector<HTMLElement>(".combat-tracker")
    ?? trackerEl.querySelector<HTMLElement>("[class*='combatant']")?.parentElement
    ?? trackerEl.querySelector<HTMLElement>("ol, ul");

  // Build the inline container
  const inlineEl = document.createElement("div");
  inlineEl.id = "fth-mp-inline";
  inlineEl.className = "fth-monster-preview fth-mp-inline";
  inlineEl.innerHTML = buildInlineHTML(cachedContentHTML);

  // Insert after the combatant list, or at the end of the tracker
  if (combatantList) {
    combatantList.parentNode?.insertBefore(inlineEl, combatantList.nextSibling);
  } else {
    trackerEl.appendChild(inlineEl);
  }

  attachInlineListeners(inlineEl);
}

/* ── HTML Builders ────────────────────────────────────────── */

/** Build the stat block + up-next content (shared between modes) */
function buildContentHTML(vm: NPCViewModel, upNext: UpNextInfo | null): string {
  return `
    ${buildStatBlockHTML(vm)}
    <div class="mp-up-next">${buildUpNextHTML(upNext)}</div>
  `;
}

/** Wrap content for inline mode (with pop-out + dismiss buttons) */
function buildInlineHTML(content: string): string {
  return `
    <div class="mp-header">
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      <button class="mp-popout" type="button" aria-label="Pop out" data-tooltip="Pop Out">
        <i class="fa-solid fa-up-right-from-square"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

/** Wrap content for floating mode (with dock + dismiss buttons, drag handle) */
function buildPanelHTML(content: string): string {
  return `
    <div class="mp-header" data-mp-drag>
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      <button class="mp-dock" type="button" aria-label="Dock to sidebar" data-tooltip="Dock to Sidebar">
        <i class="fa-solid fa-right-to-bracket"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

function buildStatBlockHTML(vm: NPCViewModel): string {
  const parts: string[] = [];

  // Name + portrait
  parts.push(`<div class="mp-identity">`);
  if (vm.hasPortrait) {
    parts.push(`<img class="mp-portrait" src="${vm.portraitUrl}" alt="" />`);
  }
  parts.push(`<div class="mp-name-block">`);
  parts.push(`<div class="mp-name">${vm.name}</div>`);
  parts.push(`<div class="mp-meta">${vm.meta}</div>`);
  parts.push(`</div></div>`);

  // Core stats
  if (vm.showStats) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-core-stats">`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">AC</span> <span class="mp-stat-value">${vm.ac}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">HP</span> <span class="mp-stat-value">${vm.hp}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Speed</span> <span class="mp-stat-value">${vm.speed}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Init</span> <span class="mp-stat-value">${vm.initiative}</span></div>`);
    parts.push(`</div>`);
  }

  // Ability scores
  if (vm.showAbilities && vm.abilityRows.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-abilities">`);
    for (const row of vm.abilityRows) {
      if (row.left) parts.push(buildAbilityCell(row.left));
      if (row.right) parts.push(buildAbilityCell(row.right));
    }
    parts.push(`</div>`);
  }

  // Trait lines
  if (vm.showTraits && vm.traitLines.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-traits">`);
    for (const trait of vm.traitLines) {
      parts.push(`<div class="mp-trait"><strong class="mp-trait-label">${trait.label}</strong> ${trait.value}</div>`);
    }
    parts.push(`</div>`);
  }

  // Feature sections
  if (vm.featureSections.length > 0) {
    for (const section of vm.featureSections) {
      if (!section.hasEntries) continue;
      parts.push(buildFeatureSection(section));
    }
  }

  return parts.join("");
}

function buildAbilityCell(cell: { key: string; value: number; mod: string; save: string }): string {
  return `
    <div class="mp-ability">
      <span class="mp-ability-key">${cell.key}</span>
      <span class="mp-ability-score">${cell.value} <span class="mp-ability-mod">(${cell.mod})</span></span>
      <span class="mp-ability-save">Save ${cell.save}</span>
    </div>
  `;
}

function buildFeatureSection(section: FeatureSectionViewModel): string {
  const parts: string[] = [];
  parts.push(`<div class="mp-divider"></div>`);
  parts.push(`<div class="mp-feature-section">`);
  parts.push(`<div class="mp-section-title">${section.title}</div>`);
  if (section.intro) {
    parts.push(`<div class="mp-section-intro">${section.intro}</div>`);
  }
  for (const entry of section.entries) {
    parts.push(buildFeatureEntry(entry));
  }
  parts.push(`</div>`);
  return parts.join("");
}

function buildFeatureEntry(entry: FeatureEntryViewModel): string {
  return `
    <div class="mp-feature">
      <span class="mp-feature-name">${entry.nameWithUses}.</span>
      <span class="mp-feature-desc">${entry.description}</span>
    </div>
  `;
}

function buildUpNextHTML(upNext: UpNextInfo | null): string {
  if (!upNext) return "";

  let statsHtml = "";
  if (upNext.isNPC) {
    const statParts: string[] = [];
    if (upNext.cr !== undefined) statParts.push(`CR ${upNext.cr}`);
    if (upNext.ac !== undefined) statParts.push(`AC ${upNext.ac}`);
    if (upNext.hpMax !== undefined) statParts.push(`HP ${upNext.hpMax}`);
    statsHtml = statParts.length > 0
      ? `<span class="mp-upnext-stats">${statParts.join(" · ")}</span>`
      : "";
  }

  const icon = upNext.isNPC
    ? `<i class="fa-solid fa-skull"></i>`
    : `<i class="fa-solid fa-user"></i>`;

  return `
    <div class="mp-upnext-divider"></div>
    <div class="mp-upnext-row">
      <span class="mp-upnext-label">Up Next</span>
      <span class="mp-upnext-name">${icon} ${upNext.name}</span>
      ${statsHtml}
    </div>
  `;
}

/* ── Inline Mode Listeners ────────────────────────────────── */

function attachInlineListeners(el: HTMLElement): void {
  el.querySelector(".mp-close")?.addEventListener("click", () => {
    dismissed = true;
    el.remove();
  });

  el.querySelector(".mp-popout")?.addEventListener("click", () => {
    isFloating = true;
    saveMode();
    el.remove();
    showFloating();
  });
}

/* ── Floating Mode Listeners ──────────────────────────────── */

function attachFloatingListeners(el: HTMLElement): void {
  el.querySelector(".mp-close")?.addEventListener("click", () => {
    dismissed = true;
    el.style.display = "none";
  });

  el.querySelector(".mp-dock")?.addEventListener("click", () => {
    isFloating = false;
    saveMode();
    el.remove();
    floatingEl = null;
    // Clear saved position so next pop-out starts fresh
    try { localStorage.removeItem(POSITION_KEY); } catch { /* ignore */ }
    showInline();
  });
}

/* ── Dragging (floating mode only) ────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  const handle = el.querySelector<HTMLElement>("[data-mp-drag]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".mp-close, .mp-dock")) return;
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
  if (!floatingEl) return;
  const pos = { left: floatingEl.style.left, top: floatingEl.style.top };
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function restorePosition(): void {
  if (!floatingEl) return;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const pos = JSON.parse(raw) as { left?: string; top?: string };
      if (pos.left && pos.top) {
        floatingEl.style.left = pos.left;
        floatingEl.style.top = pos.top;
        floatingEl.style.right = "auto";
        floatingEl.style.bottom = "auto";
        return;
      }
    }
  } catch { /* ignore */ }
  // Default floating position: left of the sidebar
  floatingEl.style.right = "320px";
  floatingEl.style.top = "80px";
}

function saveMode(): void {
  try { localStorage.setItem(MODE_KEY, isFloating ? "floating" : "inline"); } catch { /* ignore */ }
}
