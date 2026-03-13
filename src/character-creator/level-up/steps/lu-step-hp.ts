/**
 * Level-Up — Step 2: Hit Points
 *
 * Roll hit die or take average for HP gain.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpHpChoice } from "../level-up-types";
import { averageHpForHitDie } from "../level-up-detection";
import { abilityModifier } from "../../data/dnd5e-constants";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Step Definition ─────────────────────────────────────── */

export function createHpStep(): LevelUpStepDef {
  return {
    id: "hp",
    label: "Hit Points",
    icon: "fa-solid fa-heart",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-hp.hbs`,

    isComplete(state: LevelUpState): boolean {
      return !!state.selections.hp && state.selections.hp.hpGained > 0;
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      const sel = state.selections;
      const classChoice = sel.classChoice;
      const classInfo = classChoice?.mode === "existing"
        ? state.classItems.find((c) => c.itemId === classChoice.classItemId)
        : null;

      const hitDie = classInfo?.hitDie ?? "d8";
      const dieSize = parseInt(hitDie.replace("d", ""), 10) || 8;
      const average = averageHpForHitDie(hitDie);

      // Con modifier
      const system = actor.system as Record<string, unknown> | undefined;
      const abilities = system?.abilities as Record<string, { value?: number }> | undefined;
      const conScore = abilities?.con?.value ?? 10;
      const conMod = abilityModifier(conScore);

      const hpData = sel.hp;

      return {
        hitDie,
        dieSize,
        average,
        conMod,
        conModFormatted: conMod >= 0 ? `+${conMod}` : `${conMod}`,
        method: hpData?.method ?? null,
        rollResult: hpData?.rollResult ?? null,
        hpGained: hpData?.hpGained ?? 0,
        totalWithCon: (hpData?.hpGained ?? 0),
        className: classChoice?.className ?? "your class",
        hasChosen: !!hpData,
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      const classChoice = state.selections.classChoice;
      const classInfo = classChoice?.mode === "existing"
        ? state.classItems.find((c) => c.itemId === classChoice?.classItemId)
        : null;
      const hitDie = classInfo?.hitDie ?? "d8";
      const dieSize = parseInt(hitDie.replace("d", ""), 10) || 8;
      const average = averageHpForHitDie(hitDie);

      // Get CON modifier
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actor = getActorById(state.actorId);
      const system = actor?.system as Record<string, unknown> | undefined;
      const abilities = system?.abilities as Record<string, { value?: number }> | undefined;
      const conMod = abilityModifier(abilities?.con?.value ?? 10);

      // Roll button
      el.querySelector("[data-hp-roll]")?.addEventListener("click", () => {
        const roll = Math.floor(Math.random() * dieSize) + 1;
        // Minimum 1 HP from roll (standard rule: can't go below 1)
        const hpGained = Math.max(1, roll + conMod);
        callbacks.setData({
          method: "roll",
          hpGained,
          hitDie,
          rollResult: roll,
        } as LevelUpHpChoice);
      });

      // Average button
      el.querySelector("[data-hp-average]")?.addEventListener("click", () => {
        const hpGained = Math.max(1, average + conMod);
        callbacks.setData({
          method: "average",
          hpGained,
          hitDie,
        } as LevelUpHpChoice);
      });
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function getActorById(id: string): FoundryDocument | null {
  const g = globalThis as Record<string, unknown>;
  const game = g.game as { actors?: { get(id: string): FoundryDocument | undefined } } | undefined;
  return game?.actors?.get(id) ?? null;
}
