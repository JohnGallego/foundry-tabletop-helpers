import { describe, expect, it, vi } from "vitest";

import type { GMConfig, WizardStepDefinition } from "../character-creator-types";
import { WizardStateMachine } from "./wizard-state-machine";
import {
  applyWizardAtmosphere,
  buildWizardShellContext,
  deactivateCurrentStep,
  patchWizardNavState,
  patchWizardStepIndicators,
} from "./character-creator-app-helpers";

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (value: string) => { classes.add(value); },
    remove: (value: string) => { classes.delete(value); },
    toggle: (value: string, force?: boolean) => {
      if (force === true) {
        classes.add(value);
        return true;
      }
      if (force === false) {
        classes.delete(value);
        return false;
      }
      if (classes.has(value)) {
        classes.delete(value);
        return false;
      }
      classes.add(value);
      return true;
    },
    contains: (value: string) => classes.has(value),
    forEach: (callback: (value: string) => void) => Array.from(classes).forEach(callback),
  };
}

function makeConfig(): GMConfig {
  return {
    packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
    disabledUUIDs: new Set(),
    allowedAbilityMethods: ["4d6"],
    maxRerolls: 0,
    startingLevel: 1,
    allowMulticlass: false,
    equipmentMethod: "equipment",
    level1HpMethod: "max",
    allowCustomBackgrounds: false,
  };
}

function makeStep(id: string, extra: Partial<WizardStepDefinition> = {}): WizardStepDefinition {
  return {
    id,
    label: id,
    icon: "fa-solid fa-circle",
    templatePath: "step.hbs",
    dependencies: [],
    isApplicable: () => true,
    isComplete: () => true,
    buildViewModel: async () => ({}),
    ...extra,
  };
}

describe("character creator app helpers", () => {
  it("builds shell context from current step view model", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", {
        label: "Species",
        icon: "fa-solid fa-leaf",
        buildViewModel: async () => ({
          stepTitle: "Choose Species",
          stepLabel: "Origin",
          stepDescription: "Pick your ancestry",
          stepIcon: "fa-solid fa-leaf",
          selectedEntry: { name: "Elf", img: "elf.png", packLabel: "PHB" },
        }),
      }),
    ]);

    const context = await buildWizardShellContext(
      machine,
      machine.currentStepDef,
      async (_path, data) => `<div>${String(data.stepTitle)}</div>`,
      () => "cc-atmosphere--nature",
    );

    expect(context).toMatchObject({
      currentStepId: "species",
      currentStepLabel: "Species",
      currentStepIcon: "fa-solid fa-leaf",
      atmosphereClass: "cc-atmosphere--nature",
      headerTitle: "Choose Species",
      headerSubtitle: "Origin",
      headerDescription: "Pick your ancestry",
      headerIcon: "fa-solid fa-leaf",
      selectedEntry: { name: "Elf", img: "elf.png", packLabel: "PHB" },
      stepContentHtml: "<div>Choose Species</div>",
    });
  });

  it("patches nav and step indicator state", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", {
        isComplete: () => false,
        getStatusHint: () => "Select a species",
      }),
      makeStep("review"),
    ]);

    const nextBtn = { disabled: false };
    const hint = { textContent: "" };
    const stepA = { classList: makeClassList(["cc-step-indicator__step"]) };
    const stepB = { classList: makeClassList(["cc-step-indicator__step"]) };
    const root = {
      querySelector(selector: string) {
        if (selector === "[data-action='goNext']") return nextBtn;
        if (selector === "[data-status-hint]") return hint;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".cc-step-indicator__step") return [stepA, stepB];
        return [];
      },
    } as unknown as HTMLElement;

    machine.markComplete("species");

    patchWizardNavState(root, machine);
    patchWizardStepIndicators(root, machine);

    expect(nextBtn.disabled).toBe(true);
    expect(hint.textContent).toBe("Select a species");
    expect(stepA.classList.contains("cc-step-indicator__step--complete")).toBe(true);
    expect(stepB.classList.contains("cc-step-indicator__step--pending")).toBe(true);
  });

  it("applies atmosphere and deactivates the current step", () => {
    const onDeactivate = vi.fn();
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", { onDeactivate }),
    ]);

    const shell = { classList: makeClassList(["cc-wizard-shell", "cc-atmosphere--shadow"]) };
    const stepContent = {};
    const root = {
      querySelector(selector: string) {
        if (selector === ".cc-wizard-shell") return shell;
        if (selector === ".cc-step-content") return stepContent;
        return null;
      },
    } as unknown as HTMLElement;

    applyWizardAtmosphere(root, "cc-atmosphere--nature");
    deactivateCurrentStep(machine.currentStepDef, machine, root);

    expect(shell.classList.contains("cc-atmosphere--shadow")).toBe(false);
    expect(shell.classList.contains("cc-atmosphere--nature")).toBe(true);
    expect(onDeactivate).toHaveBeenCalledWith(machine.state, stepContent);
  });
});
