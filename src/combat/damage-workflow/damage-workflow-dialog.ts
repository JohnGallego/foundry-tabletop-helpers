/**
 * Damage Workflow — Persistent Panel UI
 *
 * A compact, draggable panel that auto-appears when tokens are selected.
 * Optimized for the most common DM workflow: type a number, hit Damage.
 *
 * Layout (top to bottom):
 *   1. Target count badge
 *   2. Amount input (large, focused) + Damage / Heal buttons side by side
 *   3. Damage type (inline, optional — collapsed by default)
 *   4. Mode tabs — two rows:
 *      DAMAGE:     Flat (default) | Save½ | Save/0
 *      CONDITIONS: Cond | Remove
 *   5. Save fields (DC + ability) — only visible for save modes
 *   6. Condition selector — only visible for condition modes
 *
 * The panel remembers its last position via localStorage.
 * Auto-popup is controlled by a module setting (default: on).
 */

import { Log, MOD } from "../../logger";
import { getHooks, isGM, isDnd5eWorld, getSetting } from "../../types";
import { COMBAT_SETTINGS } from "../combat-settings";
import {
  type WorkflowInput,
  type WorkflowType,
} from "../combat-types";
import { executeWorkflow } from "./damage-workflow-engine";
import { postWorkflowChat } from "./damage-workflow-chat";
import {
  getDamageWorkflowPanelHTML,
  isDamageWorkflowDamageMode,
  updateDamageWorkflowPanelVisibility,
} from "./damage-workflow-dialog-helpers";
import { attachDamageWorkflowPanelListeners } from "./damage-workflow-dialog-interactions";
import {
  buildDamageWorkflowInput,
  flashDamageWorkflowInputError,
} from "./damage-workflow-inputs";

/* ── State ────────────────────────────────────────────────── */

let panelEl: HTMLElement | null = null;
let currentTokenCount = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentTokens: any[] = [];
let currentMode: WorkflowType = "flatDamage";
const POSITION_KEY = `${MOD}:damage-workflow-pos`;
const CONDITION_KEY = `${MOD}:damage-workflow-cond`;

/* ── Public API ───────────────────────────────────────────── */

/**
 * Register hooks for the auto-popup panel.
 * Called from registerCombatHooks() during init.
 */
export function registerDamageWorkflowHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  hooks.on("controlToken", onControlToken);
  Log.debug("Damage workflow panel hooks registered");
}

/**
 * Manually trigger the damage workflow (for macro API / button fallback).
 */
export async function triggerDamageWorkflow(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvas = (globalThis as any).canvas;
  const tokens = canvas?.tokens?.controlled;
  if (!Array.isArray(tokens) || tokens.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = (globalThis as any).ui;
    ui?.notifications?.warn?.("Select one or more tokens first.");
    return;
  }
  currentTokens = tokens;
  currentTokenCount = tokens.length;
  showPanel();
}

/* ── Auto-popup on Token Selection ────────────────────────── */

function isAutoPopupEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.AUTO_DAMAGE_PANEL) ?? true)
    && isGM()
    && isDnd5eWorld()
    && (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_DAMAGE_WORKFLOWS) ?? true);
}

function onControlToken(): void {
  if (!isAutoPopupEnabled()) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvas = (globalThis as any).canvas;
  const tokens = canvas?.tokens?.controlled;
  if (!Array.isArray(tokens)) return;

  currentTokens = tokens;
  currentTokenCount = tokens.length;

  if (tokens.length > 0) {
    showPanel();
  } else {
    hidePanel();
  }
}

/* ── Panel Lifecycle ──────────────────────────────────────── */

function showPanel(): void {
  if (!panelEl) {
    panelEl = buildPanel();
    document.body.appendChild(panelEl);
    restorePosition();
    makeDraggable(panelEl);
  }
  updateTargetCount();
  panelEl.style.display = "";
  focusInputForMode();
}

function hidePanel(): void {
  if (panelEl) {
    panelEl.style.display = "none";
  }
}

function updateTargetCount(): void {
  if (!panelEl) return;
  const badge = panelEl.querySelector(".dwf-target-count");
  if (badge) {
    badge.textContent = `${currentTokenCount} target${currentTokenCount !== 1 ? "s" : ""}`;
  }
}

function focusInputForMode(): void {
  if (!panelEl) return;
  if (isDamageWorkflowDamageMode(currentMode)) {
    const amountInput = panelEl.querySelector<HTMLInputElement>("#dwf-amount");
    if (amountInput) {
      setTimeout(() => { amountInput.focus(); amountInput.select(); }, 50);
    }
  }
}

/* ── Panel Construction ───────────────────────────────────── */

function buildPanel(): HTMLElement {
  const el = document.createElement("div");
  el.id = "fth-damage-panel";
  el.className = "fth-damage-panel";
  el.innerHTML = getDamageWorkflowPanelHTML(currentTokenCount, getLastCondition());
  attachPanelListeners(el);
  return el;
}

function getLastCondition(): string {
  try {
    return localStorage.getItem(CONDITION_KEY) ?? "frightened";
  } catch { return "frightened"; }
}

function saveLastCondition(id: string): void {
  try { localStorage.setItem(CONDITION_KEY, id); } catch { /* ignore */ }
}

/* ── Panel Interaction ────────────────────────────────────── */

function attachPanelListeners(el: HTMLElement): void {
  attachDamageWorkflowPanelListeners(el, {
    onClose: () => hidePanel(),
    onAction: (action) => { void applyAction(action); },
    onModeChange: (mode) => {
      currentMode = mode;
      updatePanelVisibility(el);
    },
    onConditionChange: (conditionId) => {
      saveLastCondition(conditionId);
    },
  });
}

function updatePanelVisibility(el: HTMLElement): void {
  updateDamageWorkflowPanelVisibility(el, currentMode);
}

async function applyAction(action: "damage" | "heal" | "applyCondition" | "removeCondition"): Promise<void> {
  if (!panelEl || currentTokens.length === 0) return;
  const parsed = buildDamageWorkflowInput(panelEl, currentMode, action);
  if (!parsed.ok) {
    flashDamageWorkflowInputError(panelEl, parsed.error.field);
    return;
  }
  const input = parsed.input;

  // Flash the action button green on execution
  const actionBtn = action === "applyCondition"
    ? panelEl.querySelector<HTMLElement>("[data-action='applyCondition']")
    : action === "removeCondition"
      ? panelEl.querySelector<HTMLElement>("[data-action='removeCondition']")
      : action === "heal"
        ? panelEl.querySelector<HTMLElement>("[data-action='heal']")
        : panelEl.querySelector<HTMLElement>("[data-action='damage']");

  const result = await executeWorkflow(input, currentTokens);
  await postWorkflowChat(result);

  // Success flash
  if (actionBtn) {
    actionBtn.classList.add("dwf-action-success");
    setTimeout(() => actionBtn.classList.remove("dwf-action-success"), 400);
  }

  // Clear the amount after applying (only for damage/heal modes) and re-focus
  if (action === "damage" || action === "heal") {
    const amountInput = panelEl.querySelector<HTMLInputElement>("#dwf-amount");
    if (amountInput) {
      amountInput.value = "";
      amountInput.focus();
    }
  }

  Log.debug("Damage Workflow: applied", input.type);
}

/* ── Dragging ─────────────────────────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  const handle = el.querySelector<HTMLElement>("[data-dwf-drag]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".dwf-close")) return;
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
  // Default position: bottom-left
  panelEl.style.bottom = "80px";
  panelEl.style.left = "90px";
}

/* ── Legacy Dialog API (for backward compat / fallback button) ── */

/**
 * Show a one-shot dialog version (used by the Combat Tracker button fallback).
 * Returns WorkflowInput or null.
 */
export function showDamageWorkflowDialog(_tokenCount: number): Promise<WorkflowInput | null> {
  // Just trigger the panel — the panel handles everything now
  triggerDamageWorkflow();
  // Return null since the panel handles execution internally
  return Promise.resolve(null);
}
