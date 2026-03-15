import { describe, expect, it } from "vitest";

import {
  averageHpForHitDie,
  getClassItems,
  getHitDie,
  getTotalLevel,
  isAsiLevel,
  isSubclassLevel,
  shouldShowLevelUp,
} from "./level-up-detection";

describe("level up detection", () => {
  it("detects when a character can level up from xp", () => {
    expect(shouldShowLevelUp({
      type: "character",
      system: { details: { xp: { value: 300 }, level: 1 } },
    } as never)).toBe(true);

    expect(shouldShowLevelUp({
      type: "character",
      system: { details: { xp: { value: 100 }, level: 1 } },
    } as never)).toBe(false);

    expect(shouldShowLevelUp({
      type: "npc",
      system: { details: { xp: { value: 999999 }, level: 20 } },
    } as never)).toBe(false);
  });

  it("extracts total level and class item details", () => {
    const actor = {
      system: { details: { level: 5 } },
      items: [
        {
          id: "class-1",
          type: "class",
          name: "Wizard",
          system: {
            levels: 5,
            identifier: "wizard",
            hitDice: "d6",
            advancement: [{ type: "ItemGrant", level: 1, title: "Spellbook" }],
          },
        },
        {
          id: "subclass-1",
          type: "subclass",
          name: "Evoker",
          system: { classIdentifier: "wizard" },
        },
      ],
    };

    expect(getTotalLevel(actor as never)).toBe(5);
    expect(getClassItems(actor as never)).toEqual([
      {
        itemId: "class-1",
        name: "Wizard",
        identifier: "wizard",
        levels: 5,
        hitDie: "d6",
        subclassName: "Evoker",
        advancement: [{ type: "ItemGrant", level: 1, title: "Spellbook", configuration: undefined }],
      },
    ]);
  });

  it("handles hit die, asi, and subclass helpers", () => {
    expect(getHitDie({ hitDie: "d10" } as never)).toBe("d10");
    expect(averageHpForHitDie("d12")).toBe(7);
    expect(averageHpForHitDie("weird")).toBe(5);
    expect(isAsiLevel("fighter", 6)).toBe(true);
    expect(isAsiLevel("rogue", 10)).toBe(true);
    expect(isAsiLevel("wizard", 5)).toBe(false);
    expect(isSubclassLevel("cleric", 1)).toBe(true);
    expect(isSubclassLevel("wizard", 2)).toBe(true);
    expect(isSubclassLevel("fighter", 3)).toBe(true);
    expect(isSubclassLevel("fighter", 2)).toBe(false);
  });
});
