/**
 * Character Creator — Step 1: Ability Scores
 *
 * Three generation methods: 4d6 Drop Lowest, Point Buy, Standard Array.
 * All methods produce 6 ability scores assigned to STR/DEX/CON/INT/WIS/CHA.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  AbilityScoreState,
  AbilityScoreMethod,
  AbilityKey,
  StepCallbacks,
} from "../character-creator-types";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ABILITY_ABBREVS,
  POINT_BUY_COSTS,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  STANDARD_ARRAY,
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";

/* ── Defaults ────────────────────────────────────────────── */

function defaultScores(): Record<AbilityKey, number> {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
}

function defaultAssignments(): Record<AbilityKey, number> {
  return { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 };
}

function getAbilityState(state: WizardState): AbilityScoreState {
  const sel = state.selections.abilities;
  if (sel) return sel;

  const methods = state.config.allowedAbilityMethods;
  const defaultMethod = methods[0] ?? "4d6";

  return {
    method: defaultMethod,
    scores: defaultScores(),
    assignments: defaultAssignments(),
  };
}

/* ── Dice Rolling ────────────────────────────────────────── */

function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3]; // drop lowest
}

function rollAllAbilities(): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest());
}

/* ── Point Buy Helpers ───────────────────────────────────── */

function pointBuySpent(scores: Record<AbilityKey, number>): number {
  let total = 0;
  for (const key of ABILITY_KEYS) {
    total += POINT_BUY_COSTS[scores[key]] ?? 0;
  }
  return total;
}

/* ── ViewModel Builder ───────────────────────────────────── */

function buildAbilitiesVM(state: WizardState): Record<string, unknown> {
  const data = getAbilityState(state);
  const methods = state.config.allowedAbilityMethods;

  const methodTabs = [
    { id: "4d6", label: "Roll 4d6", icon: "fa-solid fa-dice", active: data.method === "4d6" },
    { id: "pointBuy", label: "Point Buy", icon: "fa-solid fa-coins", active: data.method === "pointBuy" },
    { id: "standardArray", label: "Standard Array", icon: "fa-solid fa-list-ol", active: data.method === "standardArray" },
  ].filter((m) => methods.includes(m.id as AbilityScoreMethod));

  // Read background ASI assignments (if any)
  const bgAsi = state.selections.background?.asi?.assignments ?? {};

  // Build ability cards
  const abilities = ABILITY_KEYS.map((key) => {
    const value = data.scores[key];
    const backgroundBonus = bgAsi[key] ?? 0;
    const total = value + backgroundBonus;
    const mod = abilityModifier(total);
    return {
      key,
      label: ABILITY_LABELS[key],
      abbrev: ABILITY_ABBREVS[key],
      value,
      backgroundBonus,
      total,
      modifier: mod,
      modifierStr: formatModifier(mod),
      canIncrement: data.method === "pointBuy" && value < POINT_BUY_MAX,
      canDecrement: data.method === "pointBuy" && value > POINT_BUY_MIN,
    };
  });

  const hasBackgroundBonus = abilities.some((a) => a.backgroundBonus > 0);

  // Point buy state
  const spent = data.method === "pointBuy" ? pointBuySpent(data.scores) : 0;
  const remaining = POINT_BUY_BUDGET - spent;

  // For point buy, check if incrementing would exceed budget
  if (data.method === "pointBuy") {
    for (const ab of abilities) {
      if (ab.canIncrement) {
        const nextCost = POINT_BUY_COSTS[ab.value + 1] ?? 99;
        const currentCost = POINT_BUY_COSTS[ab.value] ?? 0;
        const costDelta = nextCost - currentCost;
        if (costDelta > remaining) ab.canIncrement = false;
      }
    }
  }

  // 4d6 / Standard Array: unassigned values
  let availableValues: number[] = [];
  if (data.method === "4d6" && data.rolledValues) {
    const usedIndices = new Set(Object.values(data.assignments).filter((i) => i >= 0));
    availableValues = data.rolledValues
      .map((v, i) => ({ value: v, index: i }))
      .filter((item) => !usedIndices.has(item.index))
      .map((item) => item.value);
  } else if (data.method === "standardArray") {
    const usedIndices = new Set(Object.values(data.assignments).filter((i) => i >= 0));
    availableValues = STANDARD_ARRAY
      .map((v, i) => ({ value: v, index: i }))
      .filter((item) => !usedIndices.has(item.index))
      .map((item) => item.value);
  }

  // Build assignment options for dropdowns (4d6 and standard array)
  const valuePool = data.method === "4d6" ? data.rolledValues ?? [] : [...STANDARD_ARRAY];
  const assignmentOptions = (data.method === "4d6" || data.method === "standardArray")
    ? ABILITY_KEYS.map((key) => {
        const currentIdx = data.assignments[key];
        const usedIndices = new Set(
          Object.entries(data.assignments)
            .filter(([k, i]) => k !== key && i >= 0)
            .map(([, i]) => i),
        );
        const options = valuePool.map((v, i) => ({
          index: i,
          value: v,
          selected: i === currentIdx,
          disabled: usedIndices.has(i),
        }));
        return { key, label: ABILITY_ABBREVS[key], currentIdx, options };
      })
    : [];

  return {
    method: data.method,
    methodTabs,
    abilities,
    hasBackgroundBonus,
    isPointBuy: data.method === "pointBuy",
    isRoll: data.method === "4d6",
    isStandardArray: data.method === "standardArray",
    isAssignment: data.method === "4d6" || data.method === "standardArray",
    pointsSpent: spent,
    pointsRemaining: remaining,
    pointsBudget: POINT_BUY_BUDGET,
    budgetClass: remaining < 0 ? "over" : remaining <= 3 ? "low" : "ok",
    hasRolled: data.method === "4d6" && !!data.rolledValues,
    rolledValues: data.rolledValues ?? [],
    availableValues,
    assignmentOptions,
    pointBuyCosts: Object.entries(POINT_BUY_COSTS).map(([score, cost]) => ({
      score: Number(score),
      cost,
    })),
  };
}

/* ── Step Definition ─────────────────────────────────────── */

export function createAbilitiesStep(): WizardStepDefinition {
  return {
    id: "abilities",
    label: "Ability Scores",
    icon: "fa-solid fa-dice-d20",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-abilities.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      const data = state.selections.abilities;
      if (!data) return false;
      // All 6 scores must be non-zero (assigned)
      return ABILITY_KEYS.every((key) => data.scores[key] > 0);
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      return buildAbilitiesVM(state);
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Method tab clicks
      el.querySelectorAll("[data-method]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const method = (btn as HTMLElement).dataset.method as AbilityScoreMethod;
          if (!method) return;
          const current = getAbilityState(state);
          const newState: AbilityScoreState = {
            method,
            scores: method === "pointBuy" ? (current.method === "pointBuy" ? current.scores : defaultScores()) : defaultScores(),
            assignments: defaultAssignments(),
            rolledValues: method === "4d6" ? current.rolledValues : undefined,
          };
          callbacks.setData(newState);
        });
      });

      // Roll button (4d6)
      el.querySelector("[data-roll]")?.addEventListener("click", () => {
        const current = getAbilityState(state);
        const rolled = rollAllAbilities();
        callbacks.setData({
          ...current,
          rolledValues: rolled,
          assignments: defaultAssignments(),
          scores: defaultScores(),
        } as AbilityScoreState);
      });

      // Point buy +/- buttons — patch score/modifier/budget display in-place
      el.querySelectorAll("[data-adjust]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = (btn as HTMLElement).dataset.ability as AbilityKey;
          const delta = Number((btn as HTMLElement).dataset.adjust);
          if (!key || !delta) return;
          const current = getAbilityState(state);
          const newVal = current.scores[key] + delta;
          if (newVal < POINT_BUY_MIN || newVal > POINT_BUY_MAX) return;
          const newScores = { ...current.scores, [key]: newVal };
          // Check budget
          const newSpent = pointBuySpent(newScores);
          if (newSpent > POINT_BUY_BUDGET) return;
          const newState = { ...current, scores: newScores } as AbilityScoreState;

          // Patch DOM: update all ability cards (scores, modifiers, button states)
          patchAbilitiesDOM(el, newState, state);

          callbacks.setDataSilent(newState);
        });
      });

      // Assignment dropdowns (4d6 and standard array) — patch scores in-place
      el.querySelectorAll("[data-assign-ability]").forEach((select) => {
        select.addEventListener("change", () => {
          const key = (select as HTMLSelectElement).dataset.assignAbility as AbilityKey;
          const idx = Number((select as HTMLSelectElement).value);
          if (!key) return;
          const current = getAbilityState(state);
          const pool = current.method === "4d6" ? (current.rolledValues ?? []) : [...STANDARD_ARRAY];
          const newAssignments = { ...current.assignments, [key]: isNaN(idx) ? -1 : idx };
          // Recompute scores from assignments
          const newScores = { ...defaultScores() };
          for (const k of ABILITY_KEYS) {
            const assignedIdx = newAssignments[k];
            if (assignedIdx >= 0 && assignedIdx < pool.length) {
              newScores[k] = pool[assignedIdx];
            }
          }
          const newState = {
            ...current,
            assignments: newAssignments,
            scores: newScores,
          } as AbilityScoreState;

          // Patch DOM: update score displays and dropdown availability
          patchAbilitiesDOM(el, newState, state);
          patchAssignmentDropdowns(el, newAssignments, pool);

          callbacks.setDataSilent(newState);
        });
      });
    },
  };
}

/* ── DOM Patching ────────────────────────────────────────── */

/** Update ability score displays, modifiers, budget, and button states without re-render. */
function patchAbilitiesDOM(
  el: HTMLElement,
  newState: AbilityScoreState,
  wizardState: WizardState,
): void {
  const bgAsi = wizardState.selections.background?.asi?.assignments ?? {};

  for (const key of ABILITY_KEYS) {
    const value = newState.scores[key];
    const backgroundBonus = bgAsi[key] ?? 0;
    const total = value + backgroundBonus;
    const mod = abilityModifier(total);

    // Update score value
    const scoreEl = el.querySelector<HTMLElement>(`[data-score="${key}"]`);
    if (scoreEl) scoreEl.textContent = String(value);

    // Update total (if background bonus shown separately)
    const totalEl = el.querySelector<HTMLElement>(`[data-total="${key}"]`);
    if (totalEl) totalEl.textContent = String(total);

    // Update modifier
    const modEl = el.querySelector<HTMLElement>(`[data-modifier="${key}"]`);
    if (modEl) modEl.textContent = formatModifier(mod);

    // Update +/- button states (point buy)
    if (newState.method === "pointBuy") {
      const spent = pointBuySpent(newState.scores);
      const remaining = POINT_BUY_BUDGET - spent;

      const incBtn = el.querySelector<HTMLButtonElement>(`[data-ability="${key}"][data-adjust="1"]`);
      const decBtn = el.querySelector<HTMLButtonElement>(`[data-ability="${key}"][data-adjust="-1"]`);
      if (incBtn) {
        const nextCost = (POINT_BUY_COSTS[value + 1] ?? 99) - (POINT_BUY_COSTS[value] ?? 0);
        incBtn.disabled = value >= POINT_BUY_MAX || nextCost > remaining;
      }
      if (decBtn) {
        decBtn.disabled = value <= POINT_BUY_MIN;
      }
    }
  }

  // Update budget display (point buy)
  if (newState.method === "pointBuy") {
    const spent = pointBuySpent(newState.scores);
    const remaining = POINT_BUY_BUDGET - spent;
    const spentEl = el.querySelector<HTMLElement>("[data-points-spent]");
    if (spentEl) spentEl.textContent = String(spent);
    const remainEl = el.querySelector<HTMLElement>("[data-points-remaining]");
    if (remainEl) remainEl.textContent = String(remaining);
    const budgetEl = el.querySelector<HTMLElement>("[data-budget-indicator]");
    if (budgetEl) {
      budgetEl.classList.toggle("over", remaining < 0);
      budgetEl.classList.toggle("low", remaining >= 0 && remaining <= 3);
      budgetEl.classList.toggle("ok", remaining > 3);
    }
  }
}

/** Update assignment dropdown disabled states after an assignment change. */
function patchAssignmentDropdowns(
  el: HTMLElement,
  assignments: Record<AbilityKey, number>,
  pool: number[],
): void {
  const usedByAbility = new Map<string, number>();
  for (const [key, idx] of Object.entries(assignments)) {
    if (idx >= 0) usedByAbility.set(key, idx);
  }

  el.querySelectorAll<HTMLSelectElement>("[data-assign-ability]").forEach((select) => {
    const key = select.dataset.assignAbility as AbilityKey;
    const currentIdx = assignments[key];

    select.querySelectorAll<HTMLOptionElement>("option").forEach((opt) => {
      const optIdx = Number(opt.value);
      if (isNaN(optIdx)) {
        opt.disabled = false;
        return;
      }
      // Disable if this pool index is used by another ability
      const usedByOther = [...usedByAbility.entries()].some(
        ([k, i]) => k !== key && i === optIdx,
      );
      opt.disabled = usedByOther;
    });

    // Update the displayed score for this ability
    const scoreEl = el.querySelector<HTMLElement>(`[data-score="${key}"]`);
    if (scoreEl) {
      const value = currentIdx >= 0 && currentIdx < pool.length ? pool[currentIdx] : 0;
      scoreEl.textContent = value > 0 ? String(value) : "\u2014";
    }
  });
}
