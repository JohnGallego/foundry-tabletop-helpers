import { describe, expect, it, vi } from "vitest";

import { LevelUpStateMachine } from "./level-up-state-machine";
import {
  activateLevelUpStep,
  applyLevelUpAtmosphere,
  buildLevelUpShellContext,
  createLevelUpStepCallbacks,
  resetApplyLevelUpButton,
  setApplyLevelUpButtonPending,
  updateLevelUpWindowTitle,
} from "./level-up-app-helpers";
import type { LevelUpStepDef } from "./steps/lu-step-class-choice";

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (value: string) => { classes.add(value); },
    remove: (value: string) => { classes.delete(value); },
    contains: (value: string) => classes.has(value),
    forEach: (callback: (value: string) => void) => Array.from(classes).forEach(callback),
  };
}

function makeActor(overrides: Record<string, unknown> = {}) {
  return {
    id: "actor-1",
    name: "Tarin",
    type: "character",
    system: {
      details: { level: 1 },
    },
    items: [
      {
        id: "fighter-1",
        type: "class",
        name: "Fighter",
        system: {
          identifier: "fighter",
          levels: 1,
          hitDice: "d10",
          advancement: [],
        },
      },
    ],
    ...overrides,
  };
}

function makeStep(extra: Partial<LevelUpStepDef> = {}): LevelUpStepDef {
  return {
    id: "classChoice",
    label: "Class",
    icon: "fa-solid fa-shield-halved",
    templatePath: "step.hbs",
    isComplete: () => true,
    buildViewModel: async () => ({ heading: "Choose Class" }),
    ...extra,
  };
}

describe("level-up app helpers", () => {
  it("builds shell context from the current step", async () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);
    const stepDef = makeStep({
      label: "Class",
      icon: "fa-solid fa-shield-halved",
      buildViewModel: async () => ({ heading: "Choose Class" }),
    });

    const context = await buildLevelUpShellContext(
      machine,
      machine.currentStepId,
      stepDef,
      makeActor() as never,
      async (_path, data) => `<div>${String(data.heading)}</div>`,
      () => "cc-atmosphere--steel",
    );

    expect(context).toMatchObject({
      currentStepId: "classChoice",
      currentStepLabel: "Class",
      currentStepIcon: "fa-solid fa-shield-halved",
      atmosphereClass: "cc-atmosphere--steel",
      isLevelUp: true,
      stepContentHtml: "<div>Choose Class</div>",
    });
  });

  it("creates callbacks that store data, mark completion, and rerender", () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);
    const render = vi.fn();
    const callbacks = createLevelUpStepCallbacks(machine, render);

    callbacks.setData({ mode: "existing", classIdentifier: "fighter" });
    callbacks.rerender();

    expect(machine.state.selections.classChoice).toEqual({ mode: "existing", classIdentifier: "fighter" });
    expect(machine.getStepStatus("classChoice")).toBe("complete");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("activates the step, applies atmosphere, updates title, and toggles button state", () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);
    const onActivate = vi.fn();
    const stepDef = makeStep({ onActivate });
    const stepContent = {};
    const shell = { classList: makeClassList(["cc-wizard-shell", "cc-atmosphere--ember"]) };
    const root = {
      querySelector(selector: string) {
        if (selector === ".cc-step-content") return stepContent;
        if (selector === ".cc-wizard-shell") return shell;
        return null;
      },
    } as unknown as HTMLElement;
    const callbacks = createLevelUpStepCallbacks(machine, vi.fn());
    const titleTarget: { title?: string } = {};
    const button = { disabled: false, innerHTML: "" } as HTMLButtonElement;

    activateLevelUpStep(stepDef, machine, root, callbacks);
    applyLevelUpAtmosphere(root, "cc-atmosphere--steel");
    updateLevelUpWindowTitle(titleTarget, makeActor() as never);
    setApplyLevelUpButtonPending(button);

    expect(onActivate).toHaveBeenCalledWith(machine.state, stepContent, callbacks);
    expect(shell.classList.contains("cc-atmosphere--ember")).toBe(false);
    expect(shell.classList.contains("cc-atmosphere--steel")).toBe(true);
    expect(titleTarget.title).toBe("Level Up — Tarin");
    expect(button.disabled).toBe(true);
    expect(button.innerHTML).toContain("Applying...");

    resetApplyLevelUpButton(button);
    expect(button.disabled).toBe(false);
    expect(button.innerHTML).toContain("Apply Level Up");
  });
});
