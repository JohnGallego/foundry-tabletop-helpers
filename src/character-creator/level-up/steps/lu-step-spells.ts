/**
 * Level-Up — Step 6: Spells
 *
 * Add new spells and optionally swap existing ones.
 * Shows "no spell changes" for non-casters.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpSpellsChoice } from "../level-up-types";
import { compendiumIndexer } from "../../data/compendium-indexer";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Constants ───────────────────────────────────────────── */

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

/* ── Step Definition ─────────────────────────────────────── */

export function createLuSpellsStep(): LevelUpStepDef {
  return {
    id: "spells",
    label: "Spells",
    icon: "fa-solid fa-wand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-spells.hbs`,

    isComplete(): boolean {
      // Always complete — spells are optional
      return true;
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks({
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });

      const sel = state.selections.spells ?? {
        newSpellUuids: [],
        swappedOutUuids: [],
        swappedInUuids: [],
        newCantripUuids: [],
      };

      const allSpells = compendiumIndexer.getIndexedEntries("spell", {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });

      // Get max spell level based on target level
      const maxLevel = getMaxSpellLevel(state.targetLevel);

      const selectedNewSpells = new Set(sel.newSpellUuids);
      const selectedCantrips = new Set(sel.newCantripUuids);

      const cantrips = allSpells
        .filter((s) => s.spellLevel === 0)
        .map((s) => ({
          ...s,
          selected: selectedCantrips.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      const spells = allSpells
        .filter((s) => (s.spellLevel ?? 0) > 0 && (s.spellLevel ?? 0) <= maxLevel)
        .map((s) => ({
          ...s,
          selected: selectedNewSpells.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      // Get current spells on the actor for swap display
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actorItems = (actor as any).items ?? [];
      const currentSpells: Array<{ id: string; name: string; level: number }> = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of actorItems) {
        if (item.type === "spell") {
          currentSpells.push({
            id: item.id,
            name: item.name ?? "Unknown",
            level: item.system?.level ?? 0,
          });
        }
      }

      return {
        cantrips,
        spells: spells.slice(0, 100), // Limit for performance
        currentSpells,
        newSpellCount: sel.newSpellUuids.length,
        newCantripCount: sel.newCantripUuids.length,
        hasCantrips: cantrips.length > 0,
        hasSpells: spells.length > 0,
        hasCurrentSpells: currentSpells.length > 0,
        maxSpellLevel: maxLevel,
        className: state.selections.classChoice?.className ?? "your class",
        targetLevel: state.targetLevel,
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      const getCurrentData = () => state.selections.spells ?? {
        newSpellUuids: [],
        swappedOutUuids: [],
        swappedInUuids: [],
        newCantripUuids: [],
      };

      // New cantrip selection
      el.querySelectorAll("[data-cantrip-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cantripUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const cantrips = new Set(current.newCantripUuids);
          if (cantrips.has(uuid)) cantrips.delete(uuid);
          else cantrips.add(uuid);
          callbacks.setData({ ...current, newCantripUuids: [...cantrips] } as LevelUpSpellsChoice);
        });
      });

      // New spell selection
      el.querySelectorAll("[data-spell-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.spellUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const spells = new Set(current.newSpellUuids);
          if (spells.has(uuid)) spells.delete(uuid);
          else spells.add(uuid);
          callbacks.setData({ ...current, newSpellUuids: [...spells] } as LevelUpSpellsChoice);
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

/* ── Helpers ─────────────────────────────────────────────── */

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
