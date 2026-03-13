/**
 * Character Creator — Step 2: Race/Species
 *
 * Card grid of available races from configured compendium packs.
 * Player selects one race; selection stored as RaceSelection.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  RaceSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableRaces(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("race", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createRaceStep(): WizardStepDefinition {
  return {
    id: "race",
    label: "Race & Species",
    icon: "fa-solid fa-dna",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.race?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      // Ensure packs are loaded
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableRaces(state);
      const selected = state.selections.race;

      return {
        stepId: "race",
        stepLabel: "Choose Your Race",
        stepDescription: "Select the race or species for your character.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected ? entries.find((e) => e.uuid === selected.uuid) : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No races available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableRaces(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;
          const selection: RaceSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
          };
          callbacks.setData(selection);
        });
      });
    },
  };
}
