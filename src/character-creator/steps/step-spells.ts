/**
 * Character Creator — Step 8: Spells
 *
 * Cantrip + spell selection filtered by the chosen class's spell list.
 * Uses the dnd5e spell list API when available, with fallback to
 * showing all compendium spells.
 */

import { Log, MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  SpellSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { resolveClassSpellUuids } from "../data/spell-list-resolver";

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

function getAllSpells(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("spell", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/**
 * Max spell slot level available at a given character level,
 * based on spellcasting progression.
 */
function getMaxSpellLevel(characterLevel: number, progression: string): number {
  if (progression === "pact") {
    // Pact magic: level = ceil(casterLevel / 2), max 5
    return Math.min(5, Math.ceil(characterLevel / 2));
  }

  // Caster level depends on progression
  let casterLevel = characterLevel;
  if (progression === "half" || progression === "artificer") casterLevel = Math.ceil(characterLevel / 2);
  else if (progression === "third") casterLevel = Math.ceil(characterLevel / 3);

  if (casterLevel >= 17) return 9;
  if (casterLevel >= 15) return 8;
  if (casterLevel >= 13) return 7;
  if (casterLevel >= 11) return 6;
  if (casterLevel >= 9) return 5;
  if (casterLevel >= 7) return 4;
  if (casterLevel >= 5) return 3;
  if (casterLevel >= 3) return 2;
  return 1;
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSpellsStep(): WizardStepDefinition {
  /** Cached spell list UUIDs for the current class (avoids re-resolving). */
  let cachedClassId = "";
  let cachedSpellUuids: Set<string> | null = null;

  return {
    id: "spells",
    label: "Spells",
    icon: "fa-solid fa-wand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-spells.hbs`,
    dependencies: ["class", "subclass"],

    isApplicable(state: WizardState): boolean {
      return state.selections.class?.isSpellcaster === true;
    },

    isComplete(state: WizardState): boolean {
      const cls = state.selections.class;
      if (!cls?.isSpellcaster) return true;
      const data = state.selections.spells;
      if (!data) return false;
      return data.cantrips.length > 0 || data.spells.length > 0;
    },

    getStatusHint(state: WizardState): string {
      const cls = state.selections.class;
      if (!cls?.isSpellcaster) return "";
      const data = state.selections.spells;
      if (!data || (data.cantrips.length === 0 && data.spells.length === 0)) {
        return "Select your cantrips and spells";
      }
      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const cls = state.selections.class;
      const className = cls?.name ?? "your class";
      const classIdentifier = cls?.identifier ?? "";
      const progression = cls?.spellcastingProgression ?? "full";
      const maxLevel = getMaxSpellLevel(state.config.startingLevel, progression);

      // Resolve class spell list (cached per class identifier)
      if (classIdentifier && classIdentifier !== cachedClassId) {
        cachedClassId = classIdentifier;
        cachedSpellUuids = await resolveClassSpellUuids(classIdentifier);
        if (cachedSpellUuids) {
          Log.debug(`Spells step: resolved ${cachedSpellUuids.size} spells for "${classIdentifier}"`);
        } else {
          Log.debug(`Spells step: no spell list API found for "${classIdentifier}", showing all spells`);
        }
      }

      // Get and filter spells
      let allSpells = getAllSpells(state);
      if (cachedSpellUuids) {
        allSpells = allSpells.filter((s) => cachedSpellUuids!.has(s.uuid));
      }

      Log.debug(`Spells step: ${allSpells.length} total spells available for "${className}"`, {
        withSpellLevel: allSpells.filter((s) => s.spellLevel !== undefined).length,
        withoutSpellLevel: allSpells.filter((s) => s.spellLevel === undefined).length,
      });

      const data = state.selections.spells ?? { cantrips: [], spells: [] };
      const selectedCantrips = new Set(data.cantrips);
      const selectedSpells = new Set(data.spells);

      // Separate cantrips and leveled spells
      const cantrips = allSpells
        .filter((s) => s.spellLevel === 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          ...s,
          selected: selectedCantrips.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      const leveledSpells = allSpells
        .filter((s) => (s.spellLevel ?? 0) > 0 && (s.spellLevel ?? 0) <= maxLevel)
        .sort((a, b) => a.name.localeCompare(b.name))
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

      const usingClassFilter = cachedSpellUuids !== null;

      return {
        cantrips,
        cantripCount: data.cantrips.length,
        spellsByLevel,
        spellCount: data.spells.length,
        hasCantrips: cantrips.length > 0,
        hasSpells: leveledSpells.length > 0,
        maxSpellLevel: maxLevel,
        className,
        usingClassFilter,
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

          const newData: SpellSelection = { cantrips: [...cantrips], spells: current.spells };
          patchSpellCard(card as HTMLElement, cantrips.has(uuid));
          patchSpellCounter(el, "cantrip", cantrips.size);
          callbacks.setDataSilent(newData);
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

          const newData: SpellSelection = { cantrips: current.cantrips, spells: [...spells] };
          patchSpellCard(card as HTMLElement, spells.has(uuid));
          patchSpellCounter(el, "spell", spells.size);
          callbacks.setDataSilent(newData);
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

/* ── DOM Patching ────────────────────────────────────────── */

/** Toggle a spell card's selected state without re-rendering. */
function patchSpellCard(card: HTMLElement, selected: boolean): void {
  card.classList.toggle("cc-spell-card--selected", selected);
  card.setAttribute("aria-selected", String(selected));
  // Toggle check icon
  let check = card.querySelector(".cc-spell-card__check");
  if (selected && !check) {
    check = document.createElement("div");
    check.className = "cc-spell-card__check";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-check";
    check.appendChild(icon);
    card.appendChild(check);
  } else if (!selected && check) {
    check.remove();
  }
}

/** Update a spell counter element. */
function patchSpellCounter(el: HTMLElement, type: "cantrip" | "spell", count: number): void {
  // Update section header count
  if (type === "cantrip") {
    const countEl = el.querySelector(".cc-spell-section__count");
    if (countEl) countEl.textContent = `${count} selected`;
  }
  // Update summary bar
  const summary = el.querySelector(".cc-spells-summary__value");
  if (summary) {
    const cantripCount = type === "cantrip" ? count : parseInt(summary.textContent?.match(/(\d+) cantrips/)?.[1] ?? "0", 10);
    const spellCount = type === "spell" ? count : parseInt(summary.textContent?.match(/(\d+) spells/)?.[1] ?? "0", 10);
    summary.textContent = `${cantripCount} cantrips, ${spellCount} spells`;
  }
}
