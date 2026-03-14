/**
 * Character Creator — Step: Class (2024 PHB)
 *
 * Card grid of available classes from configured compendium packs.
 * On selection, fetches the full document and parses advancement data
 * to extract skill proficiency pool and count for downstream steps.
 */

import { Log, MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  ClassSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseClassSkillAdvancement, parseClassSpellcasting } from "../data/advancement-parser";

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
        stepTitle: "Class",
        stepLabel: "",
        stepIcon: "fa-solid fa-shield-halved",
        stepDescription:
          "Select the class that defines your character's abilities and fighting style.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: selected
          ? { ...entries.find((e) => e.uuid === selected.uuid), description: compendiumIndexer.getCachedDescription(selected.uuid) }
          : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No classes available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableClasses(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;

          const selection: ClassSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            identifier: entry.identifier ?? "",
            skillPool: [],
            skillCount: 2,
            isSpellcaster: false,
            spellcastingAbility: "",
            spellcastingProgression: "",
          };

          // Fetch full document to parse advancement data
          try {
            const doc = await compendiumIndexer.fetchDocument(uuid);
            if (doc) {
              const { skillPool, skillCount } = parseClassSkillAdvancement(doc);
              selection.skillPool = skillPool;
              selection.skillCount = skillCount;

              const sc = parseClassSpellcasting(doc);
              selection.isSpellcaster = sc.isSpellcaster;
              selection.spellcastingAbility = sc.ability;
              selection.spellcastingProgression = sc.progression;
            }
          } catch (err) {
            Log.warn("Failed to parse class advancement data", err);
          }

          callbacks.setData(selection);
        });
      });
    },
  };
}
