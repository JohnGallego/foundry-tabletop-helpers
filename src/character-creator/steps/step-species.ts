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
import { patchCardSelection } from "./card-select-utils";

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
        selectedEntry: selected
          ? { ...entries.find((e) => e.uuid === selected.uuid), description: await compendiumIndexer.getCachedDescription(selected.uuid) }
          : null,
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

          // Patch DOM directly instead of full re-render
          patchCardSelection(el, uuid, entry);
          patchDetailPanelDOM(el, entry, uuid);
          callbacks.setDataSilent(selection);
        });
      });
    },
  };
}

/** Patch the detail panel in-place without triggering a full re-render. */
function patchDetailPanelDOM(el: HTMLElement, entry: CreatorIndexEntry, uuid: string): void {
  const pane = el.querySelector(".cc-card-detail-pane");
  if (!pane) return;

  // Build new detail panel via safe DOM methods
  const detail = document.createElement("div");
  detail.className = "cc-card-detail cc-card-detail--active";

  const header = document.createElement("div");
  header.className = "cc-card-detail__header";
  const img = document.createElement("img");
  img.className = "cc-card-detail__img";
  img.src = entry.img;
  img.alt = entry.name;
  header.appendChild(img);
  const titleWrap = document.createElement("div");
  titleWrap.className = "cc-card-detail__title";
  const h3 = document.createElement("h3");
  h3.textContent = entry.name;
  titleWrap.appendChild(h3);
  const source = document.createElement("span");
  source.className = "cc-card-detail__source";
  source.textContent = entry.packLabel;
  titleWrap.appendChild(source);
  header.appendChild(titleWrap);
  detail.appendChild(header);

  // Placeholder while description loads
  const descPlaceholder = document.createElement("p");
  descPlaceholder.className = "cc-card-detail__hint";
  descPlaceholder.textContent = "Loading...";
  detail.appendChild(descPlaceholder);

  // Swap immediately (header visible), then async-load description
  pane.replaceChildren(detail);

  compendiumIndexer.getCachedDescription(uuid).then((enrichedHtml) => {
    if (enrichedHtml) {
      const descEl = document.createElement("div");
      descEl.className = "cc-card-detail__description";
      // Enriched by Foundry's TextEditor.enrichHTML — safe rendered HTML
      // eslint-disable-next-line no-unsanitized/property
      descEl.innerHTML = enrichedHtml;
      descPlaceholder.replaceWith(descEl);
    } else {
      descPlaceholder.textContent = "No description available.";
    }
  }).catch(() => {
    descPlaceholder.textContent = "No description available.";
  });
}
