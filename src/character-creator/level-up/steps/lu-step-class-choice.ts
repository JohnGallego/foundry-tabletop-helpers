/**
 * Level-Up — Step 1: Class Choice
 *
 * Choose which class to level up (existing) or multiclass into a new class.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpClassChoice, MulticlassPrereqResult } from "../level-up-types";
import { MULTICLASS_PREREQUISITES } from "../level-up-types";
import { compendiumIndexer } from "../../data/compendium-indexer";
import { ABILITY_LABELS } from "../../data/dnd5e-constants";
import type { AbilityKey } from "../../character-creator-types";

/* ── Step Definition ─────────────────────────────────────── */

export interface LevelUpStepDef {
  id: string;
  label: string;
  icon: string;
  templatePath: string;
  isComplete(state: LevelUpState): boolean;
  buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>>;
  onActivate?(state: LevelUpState, el: HTMLElement, callbacks: { setData: (v: unknown) => void; rerender: () => void }): void;
}

export function createClassChoiceStep(): LevelUpStepDef {
  return {
    id: "classChoice",
    label: "Class",
    icon: "fa-solid fa-shield-halved",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-class-choice.hbs`,

    isComplete(state: LevelUpState): boolean {
      return !!state.selections.classChoice?.classIdentifier;
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      const classItems = state.classItems;
      const selected = state.selections.classChoice;

      // Get actor's ability scores for multiclass prereq checks
      const system = actor.system as Record<string, unknown> | undefined;
      const abilities = system?.abilities as Record<string, { value?: number }> | undefined;

      // Build existing class options
      const existingClasses = classItems.map((ci) => ({
        itemId: ci.itemId,
        name: ci.name,
        identifier: ci.identifier,
        levels: ci.levels,
        hitDie: ci.hitDie,
        subclassName: ci.subclassName,
        selected: selected?.mode === "existing" && selected.classItemId === ci.itemId,
      }));

      // Multiclass options (from compendium, excluding already-taken classes)
      const takenIdentifiers = new Set(classItems.map((c) => c.identifier));
      const allClasses = compendiumIndexer.getIndexedEntries("class", {
        classes: ["dnd5e.classes"],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      });

      const multiclassOptions = allClasses
        .filter((c) => !takenIdentifiers.has(c.identifier ?? ""))
        .map((c) => {
          const prereq = checkMulticlassPrereqs(c.identifier ?? "", abilities);
          return {
            uuid: c.uuid,
            name: c.name,
            img: c.img,
            identifier: c.identifier,
            prereqMet: prereq.met,
            prereqReasons: prereq.unmetReasons,
            selected: selected?.mode === "multiclass" && selected.newClassUuid === c.uuid,
          };
        });

      return {
        existingClasses,
        multiclassOptions,
        hasMulticlassOptions: multiclassOptions.length > 0,
        selectedMode: selected?.mode ?? "existing",
        isSingleClass: classItems.length === 1,
        targetLevel: state.targetLevel,
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      // Existing class buttons
      el.querySelectorAll("[data-existing-class]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemId = (btn as HTMLElement).dataset.existingClass;
          if (!itemId) return;
          const classInfo = state.classItems.find((c) => c.itemId === itemId);
          if (!classInfo) return;
          callbacks.setData({
            mode: "existing",
            classItemId: itemId,
            className: classInfo.name,
            classIdentifier: classInfo.identifier,
          } as LevelUpClassChoice);
        });
      });

      // Multiclass buttons
      el.querySelectorAll("[data-multiclass-uuid]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const uuid = (btn as HTMLElement).dataset.multiclassUuid;
          const name = (btn as HTMLElement).dataset.multiclassName ?? "";
          const identifier = (btn as HTMLElement).dataset.multiclassId ?? "";
          const prereqMet = (btn as HTMLElement).dataset.prereqMet === "true";
          if (!uuid || !prereqMet) return;
          callbacks.setData({
            mode: "multiclass",
            className: name,
            classIdentifier: identifier,
            newClassUuid: uuid,
          } as LevelUpClassChoice);
        });
      });
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function checkMulticlassPrereqs(
  classIdentifier: string,
  abilities?: Record<string, { value?: number }>,
): MulticlassPrereqResult {
  const prereqs = MULTICLASS_PREREQUISITES[classIdentifier];
  if (!prereqs) return { met: true, unmetReasons: [] };
  if (!abilities) return { met: false, unmetReasons: ["Unable to read ability scores"] };

  const unmetReasons: string[] = [];
  for (const [key, minScore] of Object.entries(prereqs)) {
    const current = abilities[key]?.value ?? 10;
    if (current < minScore) {
      const label = ABILITY_LABELS[key as AbilityKey] ?? key;
      unmetReasons.push(`${label} ${current} (need ${minScore})`);
    }
  }

  return { met: unmetReasons.length === 0, unmetReasons };
}
