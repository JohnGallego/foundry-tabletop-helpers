import { describe, expect, it } from "vitest";

import type { GMConfig, WizardStepDefinition } from "../character-creator-types";
import { WizardStateMachine } from "./wizard-state-machine";

function makeConfig(): GMConfig {
  return {
    packSources: {
      classes: [],
      subclasses: [],
      races: [],
      backgrounds: [],
      feats: [],
      spells: [],
      items: [],
    },
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

function makeStep(
  id: string,
  options: Partial<WizardStepDefinition> = {},
): WizardStepDefinition {
  return {
    id,
    label: id,
    icon: "fa-solid fa-circle",
    templatePath: "test.hbs",
    dependencies: [],
    isApplicable: () => true,
    isComplete: () => false,
    buildViewModel: async () => ({}),
    ...options,
  };
}

describe("wizard state machine", () => {
  it("filters applicable steps and keeps the current step when possible", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", { isComplete: () => true }),
      makeStep("subclass", {
        isApplicable: (state) => !!state.selections.class,
        isComplete: (state) => !!state.selections.subclass,
      }),
      makeStep("review", { isComplete: () => true }),
    ]);

    expect(machine.state.applicableSteps).toEqual(["species", "review"]);

    machine.goNext();
    expect(machine.currentStepId).toBe("review");

    machine.setStepData("class", { className: "Wizard" });
    expect(machine.state.applicableSteps).toEqual(["species", "subclass", "review"]);
    expect(machine.currentStepId).toBe("review");
  });

  it("cascades invalidation to completed dependent steps", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("background", { isComplete: (state) => !!state.selections.background }),
      makeStep("backgroundGrants", { isComplete: (state) => !!state.selections.backgroundGrants }),
      makeStep("originFeat", { isComplete: (state) => !!state.selections.originFeat }),
      makeStep("skills", { isComplete: (state) => !!state.selections.skills }),
      makeStep("abilities", { isComplete: (state) => !!state.selections.abilities }),
    ]);

    machine.updateSelection("backgroundGrants", { tool: "smith" });
    machine.updateSelection("originFeat", { uuid: "feat-1" });
    machine.updateSelection("skills", { chosen: ["arc"] });
    machine.updateSelection("abilities", { str: 15 });

    const invalidated = machine.updateSelection("background", { uuid: "bg-1" });

    expect([...invalidated].sort()).toEqual(["abilities", "backgroundGrants", "originFeat", "skills"]);
    expect(machine.state.stepStatus.get("background")).toBe("complete");
    expect(machine.state.stepStatus.get("originFeat")).toBe("pending");
    expect(machine.state.selections.originFeat).toBeUndefined();
    expect(machine.state.selections.abilities).toBeUndefined();
  });

  it("only allows next navigation when the current step is complete", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", { isComplete: (state) => !!state.selections.species }),
      makeStep("review", { isComplete: () => true }),
    ]);

    expect(machine.canGoNext).toBe(false);
    expect(machine.goNext()).toBe(false);

    machine.updateSelection("species", { uuid: "species-1" });

    expect(machine.canGoNext).toBe(true);
    expect(machine.goNext()).toBe(true);
    expect(machine.currentStepId).toBe("review");
  });

  it("builds step indicator data from current status and position", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", { label: "Species", icon: "fa-solid fa-leaf", isComplete: () => true }),
      makeStep("review", { label: "Review", icon: "fa-solid fa-scroll", isComplete: () => true }),
    ]);

    machine.markComplete("species");
    machine.goNext();

    expect(machine.buildStepIndicatorData()).toEqual([
      {
        id: "species",
        label: "Species",
        icon: "fa-solid fa-leaf",
        status: "complete",
        active: false,
        index: 0,
        number: 1,
      },
      {
        id: "review",
        label: "Review",
        icon: "fa-solid fa-scroll",
        status: "pending",
        active: true,
        index: 1,
        number: 2,
      },
    ]);
  });
});
