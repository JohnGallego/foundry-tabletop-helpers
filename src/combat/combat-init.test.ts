import { beforeEach, describe, expect, it } from "vitest";

import { MOD } from "../logger";
import { __combatInternals } from "./combat-init";
import { resetRuntimePatches } from "../runtime/runtime-patches";

class CombatDocumentStub {
  static rollAllCalls = 0;
  static rollNPCCalls = 0;

  async rollAll(...args: unknown[]): Promise<string> {
    CombatDocumentStub.rollAllCalls += 1;
    return `rollAll:${args.join(",")}`;
  }

  async rollNPC(...args: unknown[]): Promise<string> {
    CombatDocumentStub.rollNPCCalls += 1;
    return `rollNPC:${args.join(",")}`;
  }
}

describe("combat prototype wrapping", () => {
  beforeEach(() => {
    resetRuntimePatches();
    CombatDocumentStub.rollAllCalls = 0;
    CombatDocumentStub.rollNPCCalls = 0;

    (globalThis as Record<string, unknown>).CONFIG = {
      Combat: {
        documentClass: CombatDocumentStub,
      },
    };

    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: false },
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === "enableAdvantageInitiative") return true;
          return undefined;
        },
      },
    };
  });

  it("wraps combat prototype methods only once", async () => {
    __combatInternals.wrapCombatPrototype();
    const firstRollAll = CombatDocumentStub.prototype.rollAll;
    const firstRollNPC = CombatDocumentStub.prototype.rollNPC;
    const firstRollPC = (CombatDocumentStub.prototype as { rollPC?: unknown }).rollPC;

    __combatInternals.wrapCombatPrototype();

    expect(CombatDocumentStub.prototype.rollAll).toBe(firstRollAll);
    expect(CombatDocumentStub.prototype.rollNPC).toBe(firstRollNPC);
    expect((CombatDocumentStub.prototype as { rollPC?: unknown }).rollPC).toBe(firstRollPC);

    const combat = new CombatDocumentStub();
    await expect(combat.rollAll("alpha")).resolves.toBe("rollAll:alpha");
    await expect(combat.rollNPC("beta")).resolves.toBe("rollNPC:beta");
    expect(CombatDocumentStub.rollAllCalls).toBe(1);
    expect(CombatDocumentStub.rollNPCCalls).toBe(1);
  });
});
