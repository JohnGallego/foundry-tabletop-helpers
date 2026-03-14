/**
 * Character Creator — Step 2: Background (2024 PHB)
 *
 * Card grid of available backgrounds with an inline grants configuration
 * panel for ASI distribution, language selection, and proficiency display.
 * Uses its own template (not the shared card-select) because the grants
 * panel appears inline below the card grid when a background is selected.
 */

import { Log, MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  BackgroundSelection,
  StepCallbacks,
  CreatorIndexEntry,
  AbilityKey,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseBackgroundGrants } from "../data/advancement-parser";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  SKILLS,
  STANDARD_LANGUAGES,
  LANGUAGE_LABELS,
} from "../data/dnd5e-constants";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableBackgrounds(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/** Convert a skill key like "ins" to a display name like "Insight". */
function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

/** Convert a tool proficiency key like "art:calligrapher" to display text. */
function toolLabel(key: string): string {
  // Tool keys look like "art:calligrapher" — capitalize and format
  const parts = key.split(":");
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(": ");
}

/** Convert a language ID to a display name. */
function langLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/* ── ViewModel Builders ──────────────────────────────────── */

interface AsiAbilityVM {
  key: AbilityKey;
  label: string;
  value: number;
  suggested: boolean;
  options: Array<{ value: number; label: string; selected: boolean }>;
}

interface LanguageOptionVM {
  id: string;
  label: string;
  selected: boolean;
  disabled: boolean;
}

function buildAsiAbilities(
  bg: BackgroundSelection,
): AsiAbilityVM[] {
  const assignments = bg.asi.assignments;
  const suggested = new Set(bg.grants.asiSuggested);
  const totalUsed = Object.values(assignments).reduce((sum, v) => sum + (v ?? 0), 0);
  const remaining = bg.grants.asiPoints - totalUsed;

  return ABILITY_KEYS.map((key) => {
    const value = assignments[key] ?? 0;
    const options: Array<{ value: number; label: string; selected: boolean }> = [
      { value: 0, label: "+0", selected: value === 0 },
      { value: 1, label: "+1", selected: value === 1 },
    ];
    // Only show +2 option if cap allows it and there are enough points
    // (or this ability already has 2 assigned)
    if (bg.grants.asiCap >= 2) {
      const canGetTwo = value === 2 || remaining >= (2 - value);
      if (canGetTwo) {
        options.push({ value: 2, label: "+2", selected: value === 2 });
      }
    }
    return {
      key,
      label: ABILITY_LABELS[key],
      value,
      suggested: suggested.has(key),
      options,
    };
  });
}

function buildLanguageOptions(
  bg: BackgroundSelection,
  slotIndex: number,
): LanguageOptionVM[] {
  const chosen = bg.languages.chosen;
  const fixed = new Set(bg.languages.fixed);
  const currentSlotValue = chosen[slotIndex] ?? "";

  return STANDARD_LANGUAGES
    .filter((lang) => !fixed.has(lang.id))
    .map((lang) => ({
      id: lang.id,
      label: lang.label,
      selected: lang.id === currentSlotValue,
      // Disable if chosen in another slot
      disabled: lang.id !== currentSlotValue && chosen.includes(lang.id),
    }));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createBackgroundStep(): WizardStepDefinition {
  return {
    id: "background",
    label: "Character Origins",
    icon: "fa-solid fa-scroll",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-background.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      const bg = state.selections.background;
      if (!bg?.uuid) return false;
      const grants = bg.grants;
      if (!grants) return false;
      // ASI must be fully assigned (if available)
      if (grants.asiPoints > 0) {
        const total = Object.values(bg.asi.assignments).reduce(
          (sum, v) => sum + (v ?? 0),
          0,
        );
        if (total !== grants.asiPoints) return false;
      }
      // Languages must be fully chosen (if available)
      if (grants.languageChoiceCount > 0) {
        if (bg.languages.chosen.length < grants.languageChoiceCount) return false;
      }
      return true;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableBackgrounds(state);
      const bg = state.selections.background;
      const showGrants = !!bg?.uuid && !!bg.grants;

      // Base card grid data
      const vm: Record<string, unknown> = {
        stepId: "background",
        stepTitle: "Character Origins:",
        stepLabel: "Background",
        stepIcon: "fa-solid fa-scroll",
        stepDescription: "Select the background that shaped your character.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === bg?.uuid,
        })),
        hasEntries: entries.length > 0,
        emptyMessage: "No backgrounds available. Check your GM configuration.",
        showGrants,
      };

      // Grants panel data (only when a background is selected)
      if (bg?.grants && showGrants) {
        const grants = bg.grants;

        // Proficiency chips
        vm.grantedSkills = grants.skillProficiencies.map(skillLabel);
        vm.toolProficiency = grants.toolProficiency
          ? toolLabel(grants.toolProficiency)
          : null;

        // Origin feat
        vm.originFeatName = grants.originFeatName;

        // ASI picker
        vm.hasASI = grants.asiPoints > 0;
        if (grants.asiPoints > 0) {
          vm.asiAbilities = buildAsiAbilities(bg);
          const totalUsed = Object.values(bg.asi.assignments).reduce(
            (sum, v) => sum + (v ?? 0),
            0,
          );
          vm.asiPointsUsed = totalUsed;
          vm.asiPoints = grants.asiPoints;
        }

        // Language picker
        vm.hasLanguages = grants.languageChoiceCount > 0 || grants.languageGrants.length > 0;
        vm.fixedLanguages = grants.languageGrants.map(langLabel);
        if (grants.languageChoiceCount > 0) {
          // Build slot array for the language dropdowns
          const slots: number[] = [];
          for (let i = 0; i < grants.languageChoiceCount; i++) {
            slots.push(i);
          }
          vm.languageSlots = slots.map((i) => ({
            index: i,
            options: buildLanguageOptions(bg, i),
          }));
        }
      }

      return vm;
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // --- Card click handlers ---
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableBackgrounds(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;

          // Fetch full document to parse grants from advancement data
          try {
            const doc = await compendiumIndexer.fetchDocument(uuid);
            if (!doc) return;
            const grants = await parseBackgroundGrants(doc);

            const selection: BackgroundSelection = {
              uuid: entry.uuid,
              name: entry.name,
              img: entry.img,
              grants,
              asi: { assignments: {} },
              languages: {
                fixed: grants.languageGrants,
                chosen: [],
              },
            };

            callbacks.setData(selection);
          } catch (err) {
            Log.warn("Failed to parse background grants", err);
          }
        });
      });

      // --- ASI dropdown handlers (silent update + DOM patch) ---
      el.querySelectorAll<HTMLSelectElement>("[data-asi-ability]").forEach((select) => {
        select.addEventListener("change", () => {
          const bg = state.selections.background;
          if (!bg?.grants) return;

          const ability = select.dataset.asiAbility as AbilityKey;
          const newValue = parseInt(select.value, 10) || 0;

          // Validate: new value must not exceed cap
          if (newValue > bg.grants.asiCap) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          // Calculate what total would be with this change
          const otherTotal = Object.entries(bg.asi.assignments)
            .filter(([k]) => k !== ability)
            .reduce((sum, [, v]) => sum + (v ?? 0), 0);
          const proposedTotal = otherTotal + newValue;

          if (proposedTotal > bg.grants.asiPoints) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          // Apply the change
          if (newValue === 0) {
            delete bg.asi.assignments[ability];
          } else {
            bg.asi.assignments[ability] = newValue;
          }

          // Update the counter in DOM
          const counter = el.querySelector("[data-asi-counter]");
          if (counter) {
            counter.textContent = `${proposedTotal} / ${bg.grants.asiPoints}`;
          }

          // Re-render to update option availability across all dropdowns
          callbacks.rerender();
        });
      });

      // --- Language dropdown handlers (silent update + DOM patch) ---
      el.querySelectorAll<HTMLSelectElement>("[data-lang-slot]").forEach((select) => {
        select.addEventListener("change", () => {
          const bg = state.selections.background;
          if (!bg?.grants) return;

          const slotIndex = parseInt(select.dataset.langSlot ?? "0", 10);
          const newValue = select.value;

          // Update the chosen array
          const chosen = [...bg.languages.chosen];
          // Ensure array is long enough
          while (chosen.length <= slotIndex) chosen.push("");
          chosen[slotIndex] = newValue;
          // Remove trailing empty strings
          while (chosen.length > 0 && chosen[chosen.length - 1] === "") {
            chosen.pop();
          }
          bg.languages.chosen = chosen.filter((v) => v !== "");

          // Re-render to update disabled state across all language dropdowns
          callbacks.rerender();
        });
      });
    },
  };
}
