/**
 * Character Creator — Step 8: Spells
 *
 * Cantrip + spell selection with level filter tabs and search.
 * Shows spells available from configured packs, filtered by spell level.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  SpellSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";

/* ── Constants ───────────────────────────────────────────── */

/** Spell school labels. */
const SCHOOL_LABELS: Record<string, string> = {
  abj: "Abjuration",
  con: "Conjuration",
  div: "Divination",
  enc: "Enchantment",
  evo: "Evocation",
  ill: "Illusion",
  nec: "Necromancy",
  trs: "Transmutation",
};

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableSpells(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("spell", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

function getMaxSpellLevel(characterLevel: number): number {
  if (characterLevel >= 17) return 9;
  if (characterLevel >= 15) return 8;
  if (characterLevel >= 13) return 7;
  if (characterLevel >= 11) return 6;
  if (characterLevel >= 9) return 5;
  if (characterLevel >= 7) return 4;
  if (characterLevel >= 5) return 3;
  if (characterLevel >= 3) return 2;
  return 1;
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSpellsStep(): WizardStepDefinition {
  return {
    id: "spells",
    label: "Spells",
    icon: "fa-solid fa-wand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-spells.hbs`,
    dependencies: ["class", "subclass"],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      const data = state.selections.spells;
      if (!data) return true; // Non-casters can skip
      return data.cantrips.length > 0 || data.spells.length > 0;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const allSpells = getAvailableSpells(state);
      const data = state.selections.spells ?? { cantrips: [], spells: [] };
      const selectedCantrips = new Set(data.cantrips);
      const selectedSpells = new Set(data.spells);
      const maxLevel = getMaxSpellLevel(state.config.startingLevel);

      // Separate cantrips and leveled spells
      const cantrips = allSpells
        .filter((s) => s.spellLevel === 0)
        .map((s) => ({
          ...s,
          selected: selectedCantrips.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      const leveledSpells = allSpells
        .filter((s) => (s.spellLevel ?? 0) > 0 && (s.spellLevel ?? 0) <= maxLevel)
        .map((s) => ({
          ...s,
          selected: selectedSpells.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      // Group leveled spells by level
      const spellsByLevel: Array<{ level: number; label: string; spells: typeof leveledSpells }> = [];
      for (let lvl = 1; lvl <= maxLevel; lvl++) {
        const spells = leveledSpells.filter((s) => s.spellLevel === lvl);
        if (spells.length > 0) {
          spellsByLevel.push({
            level: lvl,
            label: `Level ${lvl}`,
            spells,
          });
        }
      }

      return {
        cantrips,
        cantripCount: data.cantrips.length,
        spellsByLevel,
        spellCount: data.spells.length,
        hasCantrips: cantrips.length > 0,
        hasSpells: leveledSpells.length > 0,
        maxSpellLevel: maxLevel,
        className: state.selections.class?.name ?? "your class",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Cantrip selection
      el.querySelectorAll("[data-cantrip-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cantripUuid;
          if (!uuid) return;
          const current = state.selections.spells ?? { cantrips: [], spells: [] };
          const cantrips = new Set(current.cantrips);

          if (cantrips.has(uuid)) {
            cantrips.delete(uuid);
          } else {
            cantrips.add(uuid);
          }

          callbacks.setData({
            cantrips: [...cantrips],
            spells: current.spells,
          } as SpellSelection);
        });
      });

      // Spell selection
      el.querySelectorAll("[data-spell-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.spellUuid;
          if (!uuid) return;
          const current = state.selections.spells ?? { cantrips: [], spells: [] };
          const spells = new Set(current.spells);

          if (spells.has(uuid)) {
            spells.delete(uuid);
          } else {
            spells.add(uuid);
          }

          callbacks.setData({
            cantrips: current.cantrips,
            spells: [...spells],
          } as SpellSelection);
        });
      });

      // Search filter
      const searchInput = el.querySelector("[data-spell-search]") as HTMLInputElement | null;
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const query = searchInput.value.toLowerCase().trim();
          el.querySelectorAll("[data-spell-name]").forEach((row) => {
            const name = ((row as HTMLElement).dataset.spellName ?? "").toLowerCase();
            (row as HTMLElement).style.display = !query || name.includes(query) ? "" : "none";
          });
        });
      }
    },
  };
}
