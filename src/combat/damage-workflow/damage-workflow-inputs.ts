import type {
  SaveAbility,
  WorkflowInput,
  WorkflowType,
} from "../combat-types";
import {
  isDamageWorkflowDamageMode,
  isDamageWorkflowSaveMode,
} from "./damage-workflow-dialog-helpers";

interface ValidationError {
  field: "#dwf-amount" | "#dwf-dc";
}

type WorkflowInputParseResult =
  | { ok: true; input: WorkflowInput }
  | { ok: false; error: ValidationError };

function parsePositiveInt(value: string | undefined): number {
  return parseInt(value ?? "0", 10);
}

function getSelectedCondition(panelEl: HTMLElement, fallbackId: string): { conditionId: string; conditionLabel: string } {
  const condSelect = panelEl.querySelector<HTMLSelectElement>("#dwf-condition");
  const conditionId = condSelect?.value ?? fallbackId;
  const conditionLabel = condSelect?.options?.[condSelect.selectedIndex]?.text ?? conditionId;
  return { conditionId, conditionLabel };
}

export function buildDamageWorkflowInput(
  panelEl: HTMLElement,
  currentMode: WorkflowType,
  action: "damage" | "heal" | "applyCondition" | "removeCondition",
): WorkflowInputParseResult {
  if (action === "applyCondition") {
    const dc = parsePositiveInt(panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.value);
    const ability = (panelEl.querySelector<HTMLSelectElement>("#dwf-ability")?.value ?? "wis") as SaveAbility;
    if (!dc || dc <= 0) return { ok: false, error: { field: "#dwf-dc" } };
    const { conditionId, conditionLabel } = getSelectedCondition(panelEl, "frightened");
    return {
      ok: true,
      input: { type: "saveForCondition", amount: 0, dc, ability, conditionId, conditionLabel },
    };
  }

  if (action === "removeCondition") {
    const { conditionId, conditionLabel } = getSelectedCondition(panelEl, "prone");
    return {
      ok: true,
      input: { type: "removeCondition", amount: 0, conditionId, conditionLabel },
    };
  }

  const amount = parsePositiveInt(panelEl.querySelector<HTMLInputElement>("#dwf-amount")?.value);
  if (!amount || amount <= 0) return { ok: false, error: { field: "#dwf-amount" } };

  if (action === "heal") {
    const input: WorkflowInput = { type: "healing", amount };
    const damageType = panelEl.querySelector<HTMLInputElement>("#dwf-damage-type")?.value?.trim();
    if (damageType) input.damageType = damageType;
    return { ok: true, input };
  }

  const mode = currentMode as WorkflowType;
  const input: WorkflowInput = { type: isDamageWorkflowDamageMode(mode) ? mode : "flatDamage", amount };
  const damageType = panelEl.querySelector<HTMLInputElement>("#dwf-damage-type")?.value?.trim();
  if (damageType) input.damageType = damageType;

  if (isDamageWorkflowSaveMode(mode) && mode !== "saveForCondition") {
    const dc = parsePositiveInt(panelEl.querySelector<HTMLInputElement>("#dwf-dc")?.value);
    const ability = (panelEl.querySelector<HTMLSelectElement>("#dwf-ability")?.value ?? "dex") as SaveAbility;
    if (!dc || dc <= 0) return { ok: false, error: { field: "#dwf-dc" } };
    input.dc = dc;
    input.ability = ability;
  }

  return { ok: true, input };
}

export function flashDamageWorkflowInputError(
  panelEl: HTMLElement,
  field: "#dwf-amount" | "#dwf-dc",
): void {
  const input = panelEl.querySelector<HTMLElement>(field);
  input?.classList.add("dwf-input-error");
  setTimeout(() => input?.classList.remove("dwf-input-error"), 400);
}
