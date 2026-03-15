import { describe, expect, it } from "vitest";

import { LevelUpStateMachine } from "./level-up-state-machine";
import { recalculateLevelUpApplicableSteps } from "./level-up-state-machine-helpers";

function makeActor(overrides: Record<string, unknown> = {}) {
  const classItems = [
    {
      id: "fighter-1",
      type: "class",
      name: "Fighter",
      system: {
        identifier: "fighter",
        levels: 1,
        hd: { denomination: "d10", value: 2, max: 2 },
        advancement: [],
      },
    },
  ];

  return {
    id: "actor-1",
    type: "character",
    system: {
      details: { level: 1 },
    },
    items: classItems,
    ...overrides,
  };
}

describe("level-up state machine", () => {
  it("builds the default step flow for a non-ASI, non-subclass level", () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);

    expect(machine.state.applicableSteps).toEqual([
      "classChoice",
      "hp",
      "features",
      "spells",
      "review",
    ]);
  });

  it("adds a subclass step when the chosen class level requires it", () => {
    const actor = makeActor({
      items: [
        {
          id: "wizard-1",
          type: "class",
          name: "Wizard",
          system: {
            identifier: "wizard",
            levels: 1,
            hd: { denomination: "d6", value: 1, max: 1 },
            advancement: [],
          },
        },
        {
          id: "rogue-1",
          type: "class",
          name: "Rogue",
          system: {
            identifier: "rogue",
            levels: 2,
            hd: { denomination: "d8", value: 3, max: 3 },
            advancement: [],
          },
        },
      ],
      system: {
        details: { level: 3 },
      },
    });

    const machine = new LevelUpStateMachine(actor as never, true);
    machine.setStepData("classChoice", {
      mode: "existing",
      classItemId: "rogue-1",
      className: "Rogue",
      classIdentifier: "rogue",
    });

    recalculateLevelUpApplicableSteps(machine.state, true);

    expect(machine.state.applicableSteps).toEqual([
      "classChoice",
      "hp",
      "features",
      "subclass",
      "spells",
      "review",
    ]);
  });

  it("adds a feat step when the chosen class level requires it", () => {
    const actor = makeActor({
      items: [
        {
          id: "fighter-1",
          type: "class",
          name: "Fighter",
          system: {
            identifier: "fighter",
            levels: 5,
            hd: { denomination: "d10", value: 5, max: 5 },
            advancement: [],
          },
        },
      ],
      system: {
        details: { level: 5 },
      },
    });

    const machine = new LevelUpStateMachine(actor as never, false);
    machine.setStepData("classChoice", {
      mode: "existing",
      classItemId: "fighter-1",
      className: "Fighter",
      classIdentifier: "fighter",
    });

    recalculateLevelUpApplicableSteps(machine.state, false);

    expect(machine.state.applicableSteps).toEqual([
      "classChoice",
      "hp",
      "features",
      "feats",
      "spells",
      "review",
    ]);
  });

  it("supports navigation only after the current step is complete", () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);

    expect(machine.canGoNext).toBe(false);
    expect(machine.goNext()).toBe(false);

    machine.markComplete("classChoice");
    expect(machine.canGoNext).toBe(true);
    expect(machine.goNext()).toBe(true);
    expect(machine.currentStepId).toBe("hp");
  });

  it("builds step indicator data with active and completion state", () => {
    const machine = new LevelUpStateMachine(makeActor() as never, false);
    machine.markComplete("classChoice");
    machine.goNext();

    expect(machine.buildStepIndicatorData()).toEqual([
      {
        id: "classChoice",
        label: "Class",
        icon: "fa-solid fa-shield-halved",
        status: "complete",
        active: false,
        index: 0,
      },
      {
        id: "hp",
        label: "Hit Points",
        icon: "fa-solid fa-heart",
        status: "pending",
        active: true,
        index: 1,
      },
      {
        id: "features",
        label: "Features",
        icon: "fa-solid fa-scroll",
        status: "pending",
        active: false,
        index: 2,
      },
      {
        id: "spells",
        label: "Spells",
        icon: "fa-solid fa-wand-sparkles",
        status: "pending",
        active: false,
        index: 3,
      },
      {
        id: "review",
        label: "Review",
        icon: "fa-solid fa-clipboard-check",
        status: "pending",
        active: false,
        index: 4,
      },
    ]);
  });
});
