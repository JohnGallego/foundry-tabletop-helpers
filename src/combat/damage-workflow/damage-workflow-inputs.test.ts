import { describe, expect, it, vi } from "vitest";

import {
  buildDamageWorkflowInput,
  flashDamageWorkflowInputError,
} from "./damage-workflow-inputs";

function makePanel(values: Partial<Record<string, unknown>> = {}): HTMLElement {
  const amountInput = {
    value: values.amount ?? "",
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  const dcInput = {
    value: values.dc ?? "",
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  const ability = { value: values.ability ?? "dex" };
  const damageType = { value: values.damageType ?? "" };
  const condition = {
    value: values.conditionId ?? "frightened",
    selectedIndex: 0,
    options: [{ text: values.conditionLabel ?? "Frightened" }],
  };

  return {
    querySelector(selector: string) {
      if (selector === "#dwf-amount") return amountInput;
      if (selector === "#dwf-dc") return dcInput;
      if (selector === "#dwf-ability") return ability;
      if (selector === "#dwf-damage-type") return damageType;
      if (selector === "#dwf-condition") return condition;
      return null;
    },
  } as unknown as HTMLElement;
}

describe("damage workflow inputs", () => {
  it("builds valid workflow inputs for each action type", () => {
    expect(buildDamageWorkflowInput(makePanel({ amount: "12", damageType: "fire" }), "flatDamage", "damage")).toEqual({
      ok: true,
      input: { type: "flatDamage", amount: 12, damageType: "fire" },
    });

    expect(buildDamageWorkflowInput(makePanel({ amount: "8" }), "healing", "heal")).toEqual({
      ok: true,
      input: { type: "healing", amount: 8 },
    });

    expect(buildDamageWorkflowInput(makePanel({ dc: "15", ability: "wis", conditionId: "prone", conditionLabel: "Prone" }), "saveForCondition", "applyCondition")).toEqual({
      ok: true,
      input: { type: "saveForCondition", amount: 0, dc: 15, ability: "wis", conditionId: "prone", conditionLabel: "Prone" },
    });

    expect(buildDamageWorkflowInput(makePanel({ conditionId: "poisoned", conditionLabel: "Poisoned" }), "removeCondition", "removeCondition")).toEqual({
      ok: true,
      input: { type: "removeCondition", amount: 0, conditionId: "poisoned", conditionLabel: "Poisoned" },
    });
  });

  it("validates amount and dc fields", () => {
    expect(buildDamageWorkflowInput(makePanel({ amount: "0" }), "flatDamage", "damage")).toEqual({
      ok: false,
      error: { field: "#dwf-amount" },
    });

    expect(buildDamageWorkflowInput(makePanel({ amount: "9", dc: "0" }), "saveForHalf", "damage")).toEqual({
      ok: false,
      error: { field: "#dwf-dc" },
    });
  });

  it("flashes input errors on the requested field", () => {
    vi.useFakeTimers();
    const panel = makePanel({ amount: "" });
    const amountInput = panel.querySelector("#dwf-amount") as unknown as { classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } };

    flashDamageWorkflowInputError(panel, "#dwf-amount");
    expect(amountInput.classList.add).toHaveBeenCalledWith("dwf-input-error");

    vi.runAllTimers();
    expect(amountInput.classList.remove).toHaveBeenCalledWith("dwf-input-error");
    vi.useRealTimers();
  });
});
