/**
 * Level-Up — Step 5: ASI / Feat
 *
 * Same logic as character creation feats step,
 * but reads current scores from the actor.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpFeatChoice } from "../level-up-types";
import type { AbilityKey } from "../../character-creator-types";
import { compendiumIndexer } from "../../data/compendium-indexer";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifier, formatModifier } from "../../data/dnd5e-constants";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Step Definition ─────────────────────────────────────── */

export function createLuFeatsStep(): LevelUpStepDef {
  return {
    id: "feats",
    label: "ASI / Feat",
    icon: "fa-solid fa-star",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-feats.hbs`,

    isComplete(state: LevelUpState): boolean {
      const data = state.selections.feats;
      if (!data) return false;
      if (data.choice === "asi") {
        return (data.asiAbilities?.length ?? 0) > 0;
      }
      return !!data.featUuid;
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks({
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: ["dnd5e.feats"],
        spells: [],
        items: [],
      });

      const data = state.selections.feats;
      const feats = compendiumIndexer.getIndexedEntries("feat", {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: ["dnd5e.feats"],
        spells: [],
        items: [],
      });

      // Read actor's current ability scores
      const system = actor.system as Record<string, unknown> | undefined;
      const actorAbilities = system?.abilities as Record<string, { value?: number }> | undefined;
      const asiSet = new Set(data?.asiAbilities ?? []);

      const abilities = ABILITY_KEYS.map((key) => {
        const score = actorAbilities?.[key]?.value ?? 10;
        const mod = abilityModifier(score);
        return {
          key,
          label: ABILITY_LABELS[key],
          score,
          modifier: formatModifier(mod),
          selected: asiSet.has(key),
          atMax: score >= 20,
        };
      });

      return {
        choice: data?.choice ?? "asi",
        isAsi: !data?.choice || data.choice === "asi",
        isFeat: data?.choice === "feat",
        abilities,
        asiCount: data?.asiAbilities?.length ?? 0,
        maxAsiPicks: 2,
        feats: feats.map((e) => ({
          ...e,
          selected: e.uuid === data?.featUuid,
        })),
        selectedFeat: data?.featUuid ? feats.find((e) => e.uuid === data.featUuid) : null,
        hasFeats: feats.length > 0,
        emptyMessage: "No feats available.",
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      // Choice tabs
      el.querySelectorAll("[data-feat-choice]").forEach((tab) => {
        tab.addEventListener("click", () => {
          const choice = (tab as HTMLElement).dataset.featChoice as "asi" | "feat";
          if (!choice) return;
          const current = state.selections.feats ?? { choice: "asi" };
          callbacks.setData({ ...current, choice } as LevelUpFeatChoice);
        });
      });

      // ASI ability toggles
      el.querySelectorAll("[data-asi-ability]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const ability = (btn as HTMLElement).dataset.asiAbility as AbilityKey;
          if (!ability) return;
          const current = state.selections.feats ?? { choice: "asi" };
          const abilities = new Set(current.asiAbilities ?? []);
          if (abilities.has(ability)) {
            abilities.delete(ability);
          } else if (abilities.size < 2) {
            abilities.add(ability);
          }
          callbacks.setData({
            ...current,
            choice: "asi",
            asiAbilities: [...abilities],
          } as LevelUpFeatChoice);
        });
      });

      // Feat card selection
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const name = (card as HTMLElement).querySelector(".cc-select-card__name")?.textContent ?? "";
          callbacks.setData({
            choice: "feat",
            featUuid: uuid,
            featName: name,
          } as LevelUpFeatChoice);
        });
      });
    },
  };
}
