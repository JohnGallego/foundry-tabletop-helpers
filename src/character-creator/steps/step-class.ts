/**
 * Character Creator — Step 4: Class
 *
 * Card grid of available classes from configured compendium packs.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  ClassSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableClasses(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("class", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createClassStep(): WizardStepDefinition {
  return {
    id: "class",
    label: "Class",
    icon: "fa-solid fa-shield-halved",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableClasses(state);
      const selected = state.selections.class;

      return {
        stepId: "class",
        stepLabel: "Choose Your Class",
        stepDescription: "Select the class that defines your character's abilities and fighting style.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected ? entries.find((e) => e.uuid === selected.uuid) : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No classes available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableClasses(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;
          const selection: ClassSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            identifier: entry.identifier,
          };
          callbacks.setData(selection);
        });
      });
    },
  };
}
