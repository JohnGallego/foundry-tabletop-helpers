import { describe, expect, it, vi } from "vitest";

import {
  embedActionToFeatureData,
  extractGearFromSystem,
  extractSkillsFromContext,
} from "./dnd5e-npc-extractor";

describe("dnd5e npc extractor helpers", () => {
  it("uses embed context skills when present", () => {
    const result = extractSkillsFromContext({
      summary: { skills: "Deception +5, Stealth +6" },
    } as never, {
      system: {},
    }, {
      skillKeyToName: (key) => key,
    });

    expect(result).toEqual([
      { name: "Deception", mod: 5 },
      { name: "Stealth", mod: 6 },
    ]);
  });

  it("converts embed actions into feature data with stripped descriptions", () => {
    const actor = {
      name: "Dragon",
      getRollData: () => ({}),
      items: {
        get: vi.fn(() => ({ type: "feat", uuid: "Item.uuid" })),
      },
    };

    const feature = embedActionToFeatureData({
      name: "Breath Weapon",
      description: "deals damage",
      openingTag: "<p>",
      dataset: { id: "item-1" },
    } as never, new Set(["item-1"]), actor, {
      stripEnrichedText: (html) => html.toUpperCase(),
    });

    expect(feature).toMatchObject({
      name: "Breath Weapon",
      description: "<P>DEALS DAMAGE",
      isFavorite: true,
      itemType: "feat",
    });
  });

  it("uses system getGear when available before fallback extraction", () => {
    const extractGear = vi.fn(() => ["Fallback Gear"]);
    const actor = {
      system: {
        getGear: () => [
          { name: "Longsword", system: { quantity: 2 } },
          { name: "Shield", system: { quantity: 1 } },
        ],
      },
    };

    expect(extractGearFromSystem(actor, { extractGear })).toEqual(["Longsword (2)", "Shield"]);
    expect(extractGear).not.toHaveBeenCalled();
  });
});
