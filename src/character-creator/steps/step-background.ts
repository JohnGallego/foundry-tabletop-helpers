/**
 * Character Creator — Step 3: Background
 *
 * Card grid of available backgrounds from configured compendium packs.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  BackgroundSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableBackgrounds(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createBackgroundStep(): WizardStepDefinition {
  return {
    id: "background",
    label: "Background",
    icon: "fa-solid fa-scroll",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.background?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableBackgrounds(state);
      const selected = state.selections.background;

      return {
        stepId: "background",
        stepLabel: "Choose Your Background",
        stepDescription: "Select the background that shaped your character before they became an adventurer.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected ? entries.find((e) => e.uuid === selected.uuid) : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No backgrounds available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableBackgrounds(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;
          const selection: BackgroundSelection = {
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
