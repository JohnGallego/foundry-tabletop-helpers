/**
 * Combat Command Center — Hook Orchestrator
 *
 * Integrates batch initiative (with advantage/disadvantage dialog) directly
 * into the Combat Tracker sidebar panel by:
 *
 * 1. Wrapping Combat.prototype.rollAll and Combat.prototype.rollNPC to show
 *    the advantage dialog before rolling.
 * 2. Adding a new Combat.prototype.rollPC method for player-only rolls.
 * 3. Injecting a "Roll PCs" button into the Combat Tracker via the
 *    renderCombatTracker hook.
 *
 * This replaces the previous scene-control-button approach with tight
 * integration into Foundry's built-in combat UI.
 */

import { Log, MOD } from "../logger";
import { getHooks, getSetting, isGM, isDnd5eWorld, isObject } from "../types";
import { COMBAT_SETTINGS } from "./combat-settings";
import {
  showAdvantageDialog,
  cacheRollsOnCombatants,
  cleanupCachedRolls,
} from "./batch-initiative/batch-initiative-dialog";
import { registerTokenHealthHooks } from "./token-health/token-health-indicators";
import { registerDamageWorkflowHooks, triggerDamageWorkflow as triggerDamagePanel } from "./damage-workflow/damage-workflow-dialog";
import { registerMonsterPreviewHooks } from "./monster-preview/monster-preview-panel";
import { registerPartySummaryHooks, togglePartySummary } from "./party-summary/party-summary-panel";
import { registerRulesReferenceHooks, toggleRulesReference, isRulesReferenceEnabled } from "../rules-reference/rules-reference-panel";
/* ── Stored originals for prototype wrapping ──────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _origRollAll: ((...args: any[]) => Promise<any>) | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _origRollNPC: ((...args: any[]) => Promise<any>) | undefined;

/* ── Feature enabled check ────────────────────────────────── */

function isAdvantageInitiativeEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_ADVANTAGE_INITIATIVE) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/* ── Hook Registration (called during `init`) ─────────────── */

/**
 * Register all combat feature hooks.
 * Called from Hooks.once("init") in src/index.ts.
 */
export function registerCombatHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  // Wrap Combat prototype methods at init (classes are available now)
  wrapCombatPrototype();

  // Inject "Roll PCs" button into the Combat Tracker after each render
  hooks.on("renderCombatTracker", onRenderCombatTracker);

  // Token Health Indicators — AC badge + health tier icon on NPC tokens
  registerTokenHealthHooks();

  // Damage Workflows — auto-popup panel on token selection
  registerDamageWorkflowHooks();

  // Damage Workflows — Combat Tracker button (only when auto-popup is disabled)
  hooks.on("renderCombatTracker", onRenderCombatTrackerWorkflow);

  // Monster Preview — NPC stat block panel on combat turn
  registerMonsterPreviewHooks();

  // Party Summary — GM quick-reference PC card grid
  registerPartySummaryHooks();

  // Party Summary — Combat Tracker toggle button
  hooks.on("renderCombatTracker", onRenderCombatTrackerPartySummary);

  // Rules Reference — quick D&D 5e rules lookup panel
  registerRulesReferenceHooks();

  // Rules Reference — Combat Tracker toggle button
  hooks.on("renderCombatTracker", onRenderCombatTrackerRulesReference);

  // Rules Reference — Scene Control button (token controls layer)
  hooks.on("getSceneControlButtons", onGetSceneControlButtonsRulesReference);

  Log.debug("Combat hooks registered");
}

/* ── Ready Initialization (called during `ready`) ─────────── */

/**
 * Initialize combat features that require the game to be fully loaded.
 * Called from Hooks.once("ready") in src/index.ts.
 */
export function initCombatReady(): void {
  Log.debug("Combat features ready");
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Build the combat API object for window.fth.
 * Exposes batch initiative (and future combat features) to macros.
 */
export function buildCombatApi(): Record<string, unknown> {
  return {
    // Quick Damage/Save workflow — opens panel for selected tokens
    quickDamage: async () => void triggerDamagePanel(),
    // Party Summary — toggle PC quick-reference panel
    partySummary: () => void togglePartySummary(),
    // Rules Reference — toggle rules lookup panel
    rulesReference: () => void toggleRulesReference(),
    // Batch initiative — opens advantage dialog + roll all
    batchInitiative: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const combat = (globalThis as any).game?.combat;
      if (!combat) return;
      await rollWithAdvantage(combat, "all");
    },
  };
}

/* ── Combat Prototype Wrapping ────────────────────────────── */

/**
 * Wrap Combat.prototype.rollAll and Combat.prototype.rollNPC to show the
 * advantage dialog before rolling. Also add Combat.prototype.rollPC.
 *
 * We wrap at `init` time because Foundry's document classes are available
 * as globals by then (they're defined during Foundry boot, before init).
 */
function wrapCombatPrototype(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CombatClass = (globalThis as any).CONFIG?.Combat?.documentClass;
  if (!CombatClass?.prototype) {
    Log.warn("Combat: Combat document class not found — skipping prototype wrapping");
    return;
  }

  const proto = CombatClass.prototype;

  // Store originals
  _origRollAll = proto.rollAll;
  _origRollNPC = proto.rollNPC;

  // Wrap rollAll
  proto.rollAll = async function (this: Record<string, unknown>, ...args: unknown[]) {
    if (isAdvantageInitiativeEnabled()) {
      return rollWithAdvantage(this, "all");
    }
    return _origRollAll!.apply(this, args);
  };

  // Wrap rollNPC
  proto.rollNPC = async function (this: Record<string, unknown>, ...args: unknown[]) {
    if (isAdvantageInitiativeEnabled()) {
      return rollWithAdvantage(this, "npc");
    }
    return _origRollNPC!.apply(this, args);
  };

  // Add rollPC (new method — no original to store)
  proto.rollPC = async function (this: Record<string, unknown>) {
    if (isAdvantageInitiativeEnabled()) {
      return rollWithAdvantage(this, "pc");
    }
    // Fallback: roll PCs with normal mode
    return rollPCNormal(this);
  };

  Log.debug("Combat prototype methods wrapped");
}

/* ── Roll With Advantage Logic ────────────────────────────── */

type RollScope = "all" | "npc" | "pc";

const SCOPE_LABELS: Record<RollScope, string> = {
  all: "Rolling for all combatants",
  npc: "Rolling for NPCs",
  pc: "Rolling for PCs",
};

/**
 * Show the advantage dialog, cache D20Rolls, and delegate to the
 * appropriate original method.
 */
async function rollWithAdvantage(
  combat: Record<string, unknown>,
  scope: RollScope
): Promise<unknown> {
  const advMode = await showAdvantageDialog(SCOPE_LABELS[scope]);
  if (advMode === null) {
    Log.debug("Batch Initiative: dialog cancelled");
    return combat;
  }

  Log.info(`Batch Initiative: ${scope} with mode ${advMode}`);

  // Build combatant filter based on scope
  const filter = buildScopeFilter(scope);

  // Cache D20Rolls on target actors
  cacheRollsOnCombatants(combat, advMode, filter);

  try {
    if (scope === "all" && _origRollAll) {
      return await _origRollAll.call(combat);
    } else if (scope === "npc" && _origRollNPC) {
      return await _origRollNPC.call(combat);
    } else if (scope === "pc") {
      return await rollPCNormal(combat);
    }
    return combat;
  } finally {
    // Always cleanup cached rolls to prevent stale state
    cleanupCachedRolls(combat);
  }
}

/**
 * Build a combatant filter predicate for the given scope.
 * Returns undefined for "all" (no filter — cache everyone).
 */
function buildScopeFilter(
  scope: RollScope
): ((c: Record<string, unknown>) => boolean) | undefined {
  if (scope === "all") return undefined;

  return (c: Record<string, unknown>) => {
    const actor = c.actor as Record<string, unknown> | undefined;
    if (!actor) return false;

    if (scope === "pc") {
      return actor.hasPlayerOwner === true;
    } else {
      // npc: non-player-owned actors
      return actor.hasPlayerOwner !== true;
    }
  };
}

/**
 * Roll initiative for PC combatants that don't have initiative yet.
 * Mirrors the pattern of Combat.rollNPC() but for player-owned actors.
 */
async function rollPCNormal(combat: Record<string, unknown>): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combatants = (combat as any).combatants;
  if (!combatants) return combat;

  // Collect IDs of PC combatants without initiative
  const ids: string[] = [];
  const iterate = typeof combatants.forEach === "function"
    ? (cb: (c: Record<string, unknown>) => void) => combatants.forEach(cb)
    : (cb: (c: Record<string, unknown>) => void) => {
        for (const c of combatants) cb(c as Record<string, unknown>);
      };

  iterate((c: Record<string, unknown>) => {
    if (c.initiative !== null && c.initiative !== undefined) return;
    const actor = c.actor as Record<string, unknown> | undefined;
    if (!actor || actor.hasPlayerOwner !== true) return;
    if (typeof c.id === "string") ids.push(c.id);
  });

  if (ids.length === 0) return combat;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rollFn = (combat as any).rollInitiative;
  if (typeof rollFn === "function") {
    return rollFn.call(combat, ids);
  }
  return combat;
}

/* ── Damage Workflow — Scene Control Button ───────────────── */

function isDamageWorkflowsEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_DAMAGE_WORKFLOWS) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/**
 * Inject a "Quick Damage" button into the Combat Tracker header controls.
 * Uses the same renderCombatTracker hook as the Roll PCs button.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRenderCombatTrackerWorkflow(_app: any, html: any, ..._rest: unknown[]): void {
  if (!isDamageWorkflowsEnabled()) return;
  // Hide the button when auto-popup panel is active
  if (getSetting<boolean>(MOD, COMBAT_SETTINGS.AUTO_DAMAGE_PANEL) ?? true) return;

  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? (html as { get(i: number): HTMLElement }).get(0)
        : html?.[0] ?? null;

  if (!el) return;

  // Already injected?
  if (el.querySelector("[data-action='fth-damage-workflow']")) return;

  // Find any existing header control button to clone styling from
  const rollAllBtn = el.querySelector("[data-action='rollAll']");
  const rollNPCBtn = el.querySelector("[data-action='rollNPC']");
  const rollPCBtn = el.querySelector("[data-action='rollPC']");
  const refBtn = rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  if (!refBtn) return; // No combat active

  // Create the Quick Damage button
  const btn = document.createElement(refBtn.tagName.toLowerCase());
  btn.setAttribute("data-action", "fth-damage-workflow");
  btn.setAttribute("data-tooltip", "Quick Damage / Save");
  btn.setAttribute("aria-label", "Quick Damage / Save");
  btn.setAttribute("role", "button");

  // Copy non-FA classes from reference button
  for (const cls of refBtn.classList) {
    if (cls.startsWith("fa-") || cls === "fas" || cls === "far" || cls === "fab" || cls === "fa-solid" || cls === "fa-regular") continue;
    btn.classList.add(cls);
  }
  btn.classList.add("fth-damage-workflow-btn");
  btn.innerHTML = '<i class="fa-solid fa-bolt"></i>';

  // Insert after the last roll button
  const lastRollBtn = rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  lastRollBtn!.parentNode?.insertBefore(btn, lastRollBtn!.nextSibling);

  // Click handler — not using data-action delegation since this isn't a Combat method
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void triggerDamageWorkflow();
  });

  Log.debug("Combat Tracker: Quick Damage button injected");
}

/**
 * Trigger the damage workflow panel from the Combat Tracker button fallback.
 */
async function triggerDamageWorkflow(): Promise<void> {
  await triggerDamagePanel();
}

/* ── Combat Tracker Render Hook ───────────────────────────── */

/**
 * Inject a "Roll PCs" button into the Combat Tracker after each render.
 * Finds the existing "Roll All" / "Roll NPCs" buttons and adds ours alongside.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRenderCombatTracker(_app: any, html: any, ..._rest: unknown[]): void {
  if (!isGM()) return;
  if (!(getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_ADVANTAGE_INITIATIVE) ?? true)) return;

  // In V13 ApplicationV2, html is a native HTMLElement.
  // In V12-style or jQuery-wrapped, html might be a jQuery object.
  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? html.get(0)
        : html?.[0] ?? null;

  if (!el) return;

  // Already injected? (guard against double-render)
  if (el.querySelector("[data-action='rollPC']")) return;

  // Find the existing roll buttons. In V13, these might be:
  // - <button data-action="rollAll"> or <a data-action="rollAll">
  // - <button data-action="rollNPC"> or <a data-action="rollNPC">
  // They may also be header controls or footer controls.
  // We search broadly and inject next to whatever we find.
  const rollAllBtn = el.querySelector("[data-action='rollAll']");
  const rollNPCBtn = el.querySelector("[data-action='rollNPC']");

  // Determine the container and reference button
  const refBtn = rollNPCBtn ?? rollAllBtn;
  if (!refBtn) {
    // Buttons not found — combat tracker may not have an active combat yet.
    // This is normal when no combat is active. Try the encounter controls area.
    Log.debug("Combat Tracker: roll buttons not found (no active combat?)");
    return;
  }

  // Create our Roll PCs button, matching the tag and classes of the reference button
  const rollPCBtn = document.createElement(refBtn.tagName.toLowerCase());
  rollPCBtn.setAttribute("data-action", "rollPC");
  rollPCBtn.setAttribute("data-tooltip", "Roll PCs");
  rollPCBtn.setAttribute("aria-label", "Roll PCs");
  rollPCBtn.setAttribute("role", "button");

  // Copy the class list from the reference button, but skip Font Awesome
  // icon classes — we provide our own icon via the <i> child element.
  for (const cls of refBtn.classList) {
    if (cls.startsWith("fa-") || cls === "fas" || cls === "far" || cls === "fab" || cls === "fa-solid" || cls === "fa-regular") continue;
    rollPCBtn.classList.add(cls);
  }
  // Add our own identifier class
  rollPCBtn.classList.add("fth-roll-pc");

  // Icon + label — match the structure of sibling buttons
  rollPCBtn.innerHTML = '<i class="fas fa-users"></i>';

  // Insert after the Roll NPCs button (or after Roll All if no Roll NPCs)
  refBtn.parentNode?.insertBefore(rollPCBtn, refBtn.nextSibling);

  Log.debug("Combat Tracker: Roll PCs button injected");
}

/* ── Party Summary — Combat Tracker Button ────────────────── */

function isPartySummaryEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_PARTY_SUMMARY) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/**
 * Inject a "Party Summary" button into the Combat Tracker header controls.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRenderCombatTrackerPartySummary(_app: any, html: any, ..._rest: unknown[]): void {
  if (!isPartySummaryEnabled()) return;

  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? (html as { get(i: number): HTMLElement }).get(0)
        : html?.[0] ?? null;

  if (!el) return;
  if (el.querySelector("[data-action='fth-party-summary']")) return;

  // Find a reference button to clone styling from
  const rollAllBtn = el.querySelector("[data-action='rollAll']");
  const rollNPCBtn = el.querySelector("[data-action='rollNPC']");
  const rollPCBtn = el.querySelector("[data-action='rollPC']");
  const refBtn = rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  if (!refBtn) return;

  const btn = document.createElement(refBtn.tagName.toLowerCase());
  btn.setAttribute("data-action", "fth-party-summary");
  btn.setAttribute("data-tooltip", "Party Summary");
  btn.setAttribute("aria-label", "Party Summary");
  btn.setAttribute("role", "button");

  for (const cls of refBtn.classList) {
    if (cls.startsWith("fa-") || cls === "fas" || cls === "far" || cls === "fab" || cls === "fa-solid" || cls === "fa-regular") continue;
    btn.classList.add(cls);
  }
  btn.classList.add("fth-party-summary-btn");
  btn.innerHTML = '<i class="fa-solid fa-users-viewfinder"></i>';

  // Insert after the last injected button
  const lastBtn = el.querySelector("[data-action='fth-damage-workflow']")
    ?? rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  lastBtn!.parentNode?.insertBefore(btn, lastBtn!.nextSibling);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePartySummary();
  });

  Log.debug("Combat Tracker: Party Summary button injected");
}

/* ── Rules Reference — Combat Tracker Button ──────────────── */

/**
 * Inject a "Rules Reference" button into the Combat Tracker header controls.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRenderCombatTrackerRulesReference(_app: any, html: any, ..._rest: unknown[]): void {
  if (!isRulesReferenceEnabled()) return;

  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? (html as { get(i: number): HTMLElement }).get(0)
        : html?.[0] ?? null;

  if (!el) return;
  if (el.querySelector("[data-action='fth-rules-reference']")) return;

  const rollAllBtn = el.querySelector("[data-action='rollAll']");
  const rollNPCBtn = el.querySelector("[data-action='rollNPC']");
  const rollPCBtn = el.querySelector("[data-action='rollPC']");
  const refBtn = rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  if (!refBtn) return;

  const btn = document.createElement(refBtn.tagName.toLowerCase());
  btn.setAttribute("data-action", "fth-rules-reference");
  btn.setAttribute("data-tooltip", "Rules Reference");
  btn.setAttribute("aria-label", "Rules Reference");
  btn.setAttribute("role", "button");

  for (const cls of refBtn.classList) {
    if (cls.startsWith("fa-") || cls === "fas" || cls === "far" || cls === "fab" || cls === "fa-solid" || cls === "fa-regular") continue;
    btn.classList.add(cls);
  }
  btn.classList.add("fth-rules-reference-btn");
  btn.innerHTML = '<i class="fa-solid fa-book-sparkles"></i>';

  // Insert after the last injected button
  const lastBtn = el.querySelector("[data-action='fth-party-summary']")
    ?? el.querySelector("[data-action='fth-damage-workflow']")
    ?? rollPCBtn ?? rollNPCBtn ?? rollAllBtn;
  lastBtn!.parentNode?.insertBefore(btn, lastBtn!.nextSibling);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRulesReference();
  });

  Log.debug("Combat Tracker: Rules Reference button injected");
}

/* ── Rules Reference — Scene Control Button ───────────────── */

/**
 * Add a "Rules Reference" button to the Token scene controls.
 * V13: controls is an object keyed by name, tools is also an object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onGetSceneControlButtonsRulesReference(controls: Record<string, any>): void {
  if (!isRulesReferenceEnabled()) return;
  if (!controls.tokens?.tools) return;

  controls.tokens.tools["fth-rules-reference"] = {
    name: "fth-rules-reference",
    title: "Rules Reference",
    icon: "fa-solid fa-book-sparkles",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => toggleRulesReference(),
  };
}
