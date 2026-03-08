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
  type SaveAbility,
  SAVE_ABILITIES,
  DND_CONDITIONS,
} from "../combat-types";
import { executeWorkflow } from "./damage-workflow-engine";
import { postWorkflowChat } from "./damage-workflow-chat";

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
  if (isDamageMode(currentMode)) {
    const amountInput = panelEl.querySelector<HTMLInputElement>("#dwf-amount");
    if (amountInput) {
      setTimeout(() => { amountInput.focus(); amountInput.select(); }, 50);
    }
  }
}

/* ── Mode Helpers ─────────────────────────────────────────── */

function isDamageMode(mode: WorkflowType): boolean {
  return mode === "flatDamage" || mode === "saveForHalf" || mode === "saveOrNothing" || mode === "healing";
}

function isSaveMode(mode: WorkflowType): boolean {
  return mode === "saveForHalf" || mode === "saveOrNothing" || mode === "saveForCondition";
}

function isConditionMode(mode: WorkflowType): boolean {
  return mode === "saveForCondition" || mode === "removeCondition";
}

/* ── Panel Construction ───────────────────────────────────── */

function buildPanel(): HTMLElement {
  const el = document.createElement("div");
  el.id = "fth-damage-panel";
  el.className = "fth-damage-panel";
  el.innerHTML = buildPanelHTML();
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

function buildPanelHTML(): string {
  const abilityOptions = SAVE_ABILITIES
    .map((a, i) => `<option value="${a}"${i === 1 ? " selected" : ""}>${a.toUpperCase()}</option>`)
    .join("");

  const lastCond = getLastCondition();
  const conditionOptions = DND_CONDITIONS
    .map((c) => `<option value="${c.id}"${c.id === lastCond ? " selected" : ""}>${c.label}</option>`)
    .join("");

  return `
    <div class="dwf-header" data-dwf-drag>
      <span class="dwf-title"><i class="fa-solid fa-bolt"></i> Quick Apply</span>
      <span class="dwf-target-count">${currentTokenCount} targets</span>
      <button class="dwf-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="dwf-body">
      <div class="dwf-damage-section">
        <div class="dwf-fast-row">
          <input type="number" id="dwf-amount" name="amount" min="1" value="" placeholder="0"
                 class="dwf-amount-input" autocomplete="off" />
          <button type="button" class="dwf-action-btn dwf-action-damage" data-action="damage">
            <i class="fa-solid fa-burst"></i> Dmg
          </button>
          <button type="button" class="dwf-action-btn dwf-action-heal" data-action="heal">
            <i class="fa-solid fa-heart-pulse"></i> Heal
          </button>
        </div>

        <div class="dwf-options-row">
          <input type="text" id="dwf-damage-type" name="damageType" placeholder="type (optional)"
                 class="dwf-damage-type-input" autocomplete="off" />
        </div>
      </div>

      <div class="dwf-mode-section">
        <div class="dwf-mode-group">
          <span class="dwf-mode-label">Damage</span>
          <div class="dwf-mode-tabs">
            <button type="button" class="dwf-mode-tab active" data-mode="flatDamage">Flat</button>
            <button type="button" class="dwf-mode-tab" data-mode="saveForHalf">Save ½</button>
            <button type="button" class="dwf-mode-tab" data-mode="saveOrNothing">Save / 0</button>
          </div>
        </div>
        <div class="dwf-mode-group">
          <span class="dwf-mode-label">Conditions</span>
          <div class="dwf-mode-tabs">
            <button type="button" class="dwf-mode-tab" data-mode="saveForCondition">Save+Cond</button>
            <button type="button" class="dwf-mode-tab" data-mode="removeCondition">Remove</button>
          </div>
        </div>
      </div>

      <div class="dwf-save-fields" style="display: none;">
        <div class="dwf-save-field">
          <label class="dwf-save-label" for="dwf-dc">DC</label>
          <input type="number" id="dwf-dc" name="dc" min="1" value="15" class="dwf-save-input" />
        </div>
        <div class="dwf-save-field">
          <label class="dwf-save-label" for="dwf-ability">Save</label>
          <select id="dwf-ability" name="ability" class="dwf-save-input">
            ${abilityOptions}
          </select>
        </div>
      </div>

      <div class="dwf-condition-fields" style="display: none;">
        <div class="dwf-save-field" style="width: 100%;">
          <label class="dwf-save-label" for="dwf-condition">Condition</label>
          <select id="dwf-condition" name="condition" class="dwf-save-input dwf-condition-select">
            ${conditionOptions}
          </select>
        </div>
      </div>

      <div class="dwf-condition-action" style="display: none;">
        <button type="button" class="dwf-action-btn dwf-action-apply" data-action="applyCondition">
          <i class="fa-solid fa-circle-plus"></i> Apply
        </button>
      </div>

      <div class="dwf-remove-action" style="display: none;">
        <button type="button" class="dwf-action-btn dwf-action-remove" data-action="removeCondition">
          <i class="fa-solid fa-circle-minus"></i> Remove
        </button>
      </div>
    </div>
  `;
}

/* ── Panel Interaction ────────────────────────────────────── */

function attachPanelListeners(el: HTMLElement): void {
  // Close button
  el.querySelector(".dwf-close")?.addEventListener("click", () => hidePanel());

  // Damage / Heal action buttons
  el.querySelector("[data-action='damage']")?.addEventListener("click", () => void applyAction("damage"));
  el.querySelector("[data-action='heal']")?.addEventListener("click", () => void applyAction("heal"));

  // Condition action buttons
  el.querySelector("[data-action='applyCondition']")?.addEventListener("click", () => void applyAction("applyCondition"));
  el.querySelector("[data-action='removeCondition']")?.addEventListener("click", () => void applyAction("removeCondition"));

  // Enter key on amount input triggers damage
  el.querySelector("#dwf-amount")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void applyAction("damage");
    }
  });

  // Enter key on DC input triggers current action
  el.querySelector("#dwf-dc")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      if (currentMode === "saveForCondition") {
        void applyAction("applyCondition");
      } else {
        void applyAction("damage");
      }
    }
  });

  // Mode tabs — collect ALL tabs from both groups
  const allModeTabs = el.querySelectorAll<HTMLButtonElement>(".dwf-mode-tab");

  allModeTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      // Deactivate all tabs across both groups
      allModeTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      currentMode = tab.dataset.mode as WorkflowType;
      updatePanelVisibility(el);
    });
  });

  // Track last-used condition
  el.querySelector("#dwf-condition")?.addEventListener("change", (e) => {
    saveLastCondition((e.target as HTMLSelectElement).value);
  });
}

function updatePanelVisibility(el: HTMLElement): void {
  const damageSection = el.querySelector<HTMLElement>(".dwf-damage-section");
  const saveFields = el.querySelector<HTMLElement>(".dwf-save-fields");
  const conditionFields = el.querySelector<HTMLElement>(".dwf-condition-fields");
  const conditionAction = el.querySelector<HTMLElement>(".dwf-condition-action");
  const removeAction = el.querySelector<HTMLElement>(".dwf-remove-action");

  // Damage section (amount + type): visible for damage modes only
  if (damageSection) damageSection.style.display = isDamageMode(currentMode) ? "" : "none";

  // Save fields (DC + ability): visible for any save mode
  if (saveFields) saveFields.style.display = isSaveMode(currentMode) ? "" : "none";

  // Condition selector: visible for condition modes
  if (conditionFields) conditionFields.style.display = isConditionMode(currentMode) ? "" : "none";

  // Condition action button: only for saveForCondition
  if (conditionAction) conditionAction.style.display = currentMode === "saveForCondition" ? "" : "none";

  // Remove action button: only for removeCondition
  if (removeAction) removeAction.style.display = currentMode === "removeCondition" ? "" : "none";
}

async function applyAction(action: "damage" | "heal" | "applyCondition" | "removeCondition"): Promise<void> {
  if (!panelEl || currentTokens.length === 0) return;

  let input: WorkflowInput;

  if (action === "applyCondition") {
    // Save for Condition workflow
    const dc = parseInt(panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.value ?? "0", 10);
    const ability = (panelEl.querySelector<HTMLSelectElement>("#dwf-ability")?.value ?? "wis") as SaveAbility;
    if (!dc || dc <= 0) {
      panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.classList.add("dwf-input-error");
      setTimeout(() => panelEl?.querySelector<HTMLInputElement>("#dwf-dc")?.classList.remove("dwf-input-error"), 400);
      return;
    }
    const condSelect = panelEl.querySelector<HTMLSelectElement>("#dwf-condition");
    const conditionId = condSelect?.value ?? "frightened";
    const conditionLabel = condSelect?.options?.[condSelect.selectedIndex]?.text ?? conditionId;

    input = { type: "saveForCondition", amount: 0, dc, ability, conditionId, conditionLabel };

  } else if (action === "removeCondition") {
    // Remove Condition workflow
    const condSelect = panelEl.querySelector<HTMLSelectElement>("#dwf-condition");
    const conditionId = condSelect?.value ?? "prone";
    const conditionLabel = condSelect?.options?.[condSelect.selectedIndex]?.text ?? conditionId;

    input = { type: "removeCondition", amount: 0, conditionId, conditionLabel };

  } else if (action === "heal") {
    const amountInput = panelEl.querySelector<HTMLInputElement>("#dwf-amount");
    const amount = parseInt(amountInput?.value ?? "0", 10);
    if (!amount || amount <= 0) {
      amountInput?.classList.add("dwf-input-error");
      setTimeout(() => amountInput?.classList.remove("dwf-input-error"), 400);
      return;
    }
    input = { type: "healing", amount };
    const damageType = panelEl.querySelector<HTMLInputElement>("#dwf-damage-type")?.value?.trim();
    if (damageType) input.damageType = damageType;

  } else {
    // Damage: check the active mode
    const amountInput = panelEl.querySelector<HTMLInputElement>("#dwf-amount");
    const amount = parseInt(amountInput?.value ?? "0", 10);
    if (!amount || amount <= 0) {
      amountInput?.classList.add("dwf-input-error");
      setTimeout(() => amountInput?.classList.remove("dwf-input-error"), 400);
      return;
    }

    const mode = currentMode as WorkflowType;
    input = { type: isDamageMode(mode) ? mode : "flatDamage", amount };

    const damageType = panelEl.querySelector<HTMLInputElement>("#dwf-damage-type")?.value?.trim();
    if (damageType) input.damageType = damageType;

    if (mode === "saveForHalf" || mode === "saveOrNothing") {
      const dc = parseInt(panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.value ?? "0", 10);
      const ability = (panelEl.querySelector<HTMLSelectElement>("#dwf-ability")?.value ?? "dex") as SaveAbility;
      if (!dc || dc <= 0) {
        panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.classList.add("dwf-input-error");
        setTimeout(() => panelEl?.querySelector<HTMLInputElement>("#dwf-dc")?.classList.remove("dwf-input-error"), 400);
        return;
      }
      input.dc = dc;
      input.ability = ability;
    }
  }

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
