/**
 * Character Creator — Step 5: Subclass
 *
 * Card grid of available subclasses filtered by the selected class's identifier.
 * Only applicable at level 3+.
 */

import { MOD } from "../../logger";
import { patchCardSelection } from "./card-select-utils";
import type {
  WizardStepDefinition,
  WizardState,
  SubclassSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableSubclasses(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("subclass", state.config.packSources);
  const classId = state.selections.class?.identifier;
  return entries
    .filter((e) => !state.config.disabledUUIDs.has(e.uuid))
    .filter((e) => !classId || e.classIdentifier === classId);
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSubclassStep(): WizardStepDefinition {
  return {
    id: "subclass",
    label: "Subclass",
    icon: "fa-solid fa-book-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: ["class"],

    isApplicable(state: WizardState): boolean {
      return state.config.startingLevel >= 3;
    },

    isComplete(state: WizardState): boolean {
      return !!state.selections.subclass?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableSubclasses(state);
      const selected = state.selections.subclass;
      const className = state.selections.class?.name ?? "your class";

      return {
        stepId: "subclass",
        stepLabel: "Choose Your Subclass",
        stepDescription: `Select the subclass that specializes your ${className}.`,
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected
          ? { ...entries.find((e) => e.uuid === selected.uuid), description: await compendiumIndexer.getCachedDescription(selected.uuid) }
          : null,
        hasEntries: entries.length > 0,
        emptyMessage: `No subclasses available for ${className}. Check your GM configuration.`,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableSubclasses(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;
          const selection: SubclassSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            classIdentifier: entry.classIdentifier,
          };
          // Patch DOM directly instead of full re-render
          patchCardSelection(el, uuid, entry);
          callbacks.setDataSilent(selection);
        });
      });
    },
  };
}
