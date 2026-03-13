/**
 * Level-Up — Step 4: Subclass Selection
 *
 * Choose a subclass when reaching the appropriate level.
 * Filters by the class being leveled.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpSubclassChoice } from "../level-up-types";

import { compendiumIndexer } from "../../data/compendium-indexer";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Step Definition ─────────────────────────────────────── */

export function createLuSubclassStep(): LevelUpStepDef {
  return {
    id: "subclass",
    label: "Subclass",
    icon: "fa-solid fa-book-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,

    isComplete(state: LevelUpState): boolean {
      return !!state.selections.subclass?.uuid;
    },

    async buildViewModel(state: LevelUpState, _actor: FoundryDocument): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks({
        classes: [],
        subclasses: ["dnd5e.subclasses"],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      });

      const classId = state.selections.classChoice?.classIdentifier ?? "";
      const allSubclasses = compendiumIndexer.getIndexedEntries("subclass", {
        classes: [],
        subclasses: ["dnd5e.subclasses"],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      });

      const entries = allSubclasses.filter((e) => e.classIdentifier === classId);
      const selected = state.selections.subclass;

      return {
        stepId: "subclass",
        stepLabel: "Choose Your Subclass",
        stepDescription: `Select the subclass for your ${state.selections.classChoice?.className ?? "class"}.`,
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected ? entries.find((e) => e.uuid === selected.uuid) : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No subclasses available for this class.",
      };
    },

    onActivate(_state: LevelUpState, el: HTMLElement, callbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const name = (card as HTMLElement).querySelector(".cc-select-card__name")?.textContent ?? "";
          const img = (card as HTMLElement).querySelector<HTMLImageElement>(".cc-select-card__img")?.src ?? "";
          callbacks.setData({
            uuid,
            name,
            img,
          } as LevelUpSubclassChoice);
        });
      });
    },
  };
}
