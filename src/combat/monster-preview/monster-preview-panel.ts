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
import {
  buildMonsterPreviewContentHTML,
  buildMonsterPreviewPanelHTML,
  buildMonsterPreviewUpNextHTML,
  type UpNextInfo,
} from "./monster-preview-rendering";
import {
  makeMonsterPreviewDraggable,
  restoreMonsterPreviewPosition,
  saveMonsterPreviewPosition,
} from "./monster-preview-floating";
import {
  attachMonsterPreviewFloatingListeners,
  attachMonsterPreviewInlineListeners,
} from "./monster-preview-interactions";
import {
  findMonsterPreviewTrackerElement,
  injectMonsterPreviewIntoTracker,
} from "./monster-preview-tracker";

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
  cachedContentHTML = buildMonsterPreviewContentHTML(vm, upNext);

  // Display in the appropriate mode
  if (isFloating) {
    showFloating();
  } else {
    showInline();
  }
}

/* ── Up Next ──────────────────────────────────────────────── */

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
  const upNextHTML = buildMonsterPreviewUpNextHTML(upNext);

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

  floatingEl.innerHTML = buildMonsterPreviewPanelHTML(cachedContentHTML);
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
  return findMonsterPreviewTrackerElement();
}

/** Inject the stat block into the combat tracker sidebar */
function injectIntoTracker(trackerEl: HTMLElement): void {
  injectMonsterPreviewIntoTracker(trackerEl, {
    cachedContentHTML,
    dismissed,
    attachInlineListeners,
  });
}

/* ── Inline Mode Listeners ────────────────────────────────── */

function attachInlineListeners(el: HTMLElement): void {
  attachMonsterPreviewInlineListeners(el, {
    onDismiss: () => {
      dismissed = true;
      el.remove();
    },
    onPopout: () => {
      isFloating = true;
      saveMode();
      el.remove();
      showFloating();
    },
  });
}

/* ── Floating Mode Listeners ──────────────────────────────── */

function attachFloatingListeners(el: HTMLElement): void {
  attachMonsterPreviewFloatingListeners(el, {
    onDismiss: () => {
      dismissed = true;
      el.style.display = "none";
    },
    onDock: () => {
      isFloating = false;
      saveMode();
      el.remove();
      floatingEl = null;
      try { localStorage.removeItem(POSITION_KEY); } catch { /* ignore */ }
      showInline();
    },
  });
}

/* ── Dragging (floating mode only) ────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  makeMonsterPreviewDraggable(el, savePosition);
}

function savePosition(): void {
  saveMonsterPreviewPosition(floatingEl, POSITION_KEY);
}

function restorePosition(): void {
  restoreMonsterPreviewPosition(floatingEl, POSITION_KEY);
}

function saveMode(): void {
  try { localStorage.setItem(MODE_KEY, isFloating ? "floating" : "inline"); } catch { /* ignore */ }
}
