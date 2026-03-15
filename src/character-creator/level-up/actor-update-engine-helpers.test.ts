import { describe, expect, it } from "vitest";

import {
  buildAsiUpdatePayload,
  buildClassLevelUpdatePayload,
  buildHpUpdatePayload,
  collectLevelUpItemOperations,
  describeClassLevelTarget,
  prepareMulticlassItemData,
  resolveSpellsToDelete,
} from "./actor-update-engine-helpers";
import type { LevelUpState } from "./level-up-types";

function makeState(overrides: Partial<LevelUpState> = {}): LevelUpState {
  return {
    actorId: "actor-1",
    currentLevel: 4,
    targetLevel: 5,
    applicableSteps: ["classChoice", "hp", "review"],
    currentStep: 0,
    selections: {},
    stepStatus: new Map(),
    classItems: [],
    ...overrides,
  };
}

describe("actor update engine helpers", () => {
  it("collects item operations from level-up selections", () => {
    const ops = collectLevelUpItemOperations(makeState({
      selections: {
        features: { acceptedFeatureUuids: ["Compendium.feature.a"], featureNames: ["Second Wind"] },
        subclass: { uuid: "Compendium.subclass.a", name: "Champion", img: "champion.png" },
        feats: { choice: "feat", featUuid: "Compendium.feat.a", featName: "Alert" },
        spells: {
          newSpellUuids: ["Compendium.spell.a"],
          newCantripUuids: ["Compendium.cantrip.a"],
          swappedOutUuids: ["Compendium.spell.old"],
          swappedInUuids: ["Compendium.spell.new"],
        },
      },
    }));

    expect(ops).toEqual({
      featureUuids: ["Compendium.feature.a"],
      subclassUuids: ["Compendium.subclass.a"],
      featUuids: ["Compendium.feat.a"],
      spellGrantUuids: ["Compendium.spell.a", "Compendium.cantrip.a", "Compendium.spell.new"],
      swappedOutSpellUuids: ["Compendium.spell.old"],
    });
  });

  it("builds class, hp, and ASI update payloads", () => {
    expect(buildClassLevelUpdatePayload(4)).toEqual({
      "system.levels": 5,
    });

    expect(buildHpUpdatePayload({ value: 21, max: 30 }, 6)).toEqual({
      "system.attributes.hp.max": 36,
      "system.attributes.hp.value": 27,
    });

    expect(buildAsiUpdatePayload({
      str: { value: 18 },
      con: { value: 19 },
    }, ["str", "con"])).toEqual({
      "system.abilities.str.value": 19,
      "system.abilities.con.value": 20,
    });
  });

  it("prepares multiclass item data, describes targets, and resolves swapped spells", () => {
    expect(prepareMulticlassItemData({
      _id: "abc123",
      name: "Wizard",
      system: { levels: 7, identifier: "wizard" },
    })).toEqual({
      name: "Wizard",
      system: { levels: 1, identifier: "wizard" },
    });

    expect(describeClassLevelTarget({
      mode: "existing",
      classItemId: "fighter-1",
      className: "Fighter",
      classIdentifier: "fighter",
    }, 4)).toBe("Fighter → Level 5");

    expect(describeClassLevelTarget({
      mode: "multiclass",
      className: "Wizard",
      classIdentifier: "wizard",
      newClassUuid: "Compendium.class.wizard",
    }, 0)).toBe("Multiclassed into Wizard");

    expect(resolveSpellsToDelete([
      { id: "spell-1", type: "spell", name: "Shield" },
      { id: "spell-2", type: "spell", name: "Magic Missile" },
      { id: "item-1", type: "weapon", name: "Longsword" },
    ], new Set(["Magic Missile"]))).toEqual(["spell-2"]);
  });
});
