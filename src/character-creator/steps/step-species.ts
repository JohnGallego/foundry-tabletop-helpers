/**
 * Character Creator — Step 1: Species (2024 PHB)
 *
 * Card grid of available species from configured compendium packs.
 * Replaces the old "Race" step with 2024 PHB terminology.
 * Player selects one species; selection stored as SpeciesSelection
 * with parsed trait names from advancement data.
 */

import { Log, MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  SpeciesSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseSpeciesTraits, parseSpeciesLanguages } from "../data/advancement-parser";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableSpecies(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("race", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSpeciesStep(): WizardStepDefinition {
  return {
    id: "species",
    label: "Character Origins",
    icon: "fa-solid fa-dna",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.species?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableSpecies(state);
      const selected = state.selections.species;

      return {
        stepId: "species",
        stepTitle: "Character Origins:",
        stepLabel: "Species",
        stepIcon: "fa-solid fa-dna",
        stepDescription: "Choose your character's species.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected ? entries.find((e) => e.uuid === selected.uuid) : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No species available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableSpecies(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;

          const selection: SpeciesSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
          };

          // Fetch full document to parse species traits and languages
          try {
            const doc = await compendiumIndexer.fetchDocument(uuid);
            if (doc) {
              selection.traits = parseSpeciesTraits(doc);
              const langs = parseSpeciesLanguages(doc);
              selection.languageGrants = langs.fixed;
              selection.languageChoiceCount = langs.choiceCount;
            }
          } catch (err) {
            Log.warn("Failed to parse species data", err);
          }

          callbacks.setData(selection);
        });
      });
    },
  };
}
