/**
 * Character Creator — Step 2b: Background Grants (2024 PHB)
 *
 * Configures the grants from the selected background:
 * - ASI distribution (+2/+1 or +1/+1/+1)
 * - Language selection (Common + 2 picks)
 * - Read-only display of granted skills, tool proficiency, and origin feat
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  StepCallbacks,
  AbilityKey,
} from "../character-creator-types";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  SKILLS,
  STANDARD_LANGUAGES,
  LANGUAGE_LABELS,
} from "../data/dnd5e-constants";

/* ── Helpers ─────────────────────────────────────────────── */

/** Total language choices = background choices + species choices. */
function getTotalLanguageChoiceCount(state: WizardState): number {
  const bgCount = state.selections.background?.grants?.languageChoiceCount ?? 0;
  const speciesCount = state.selections.species?.languageChoiceCount ?? 0;
  return bgCount + speciesCount;
}

/** All fixed languages from both background and species (deduplicated). */
function getAllFixedLanguages(state: WizardState): string[] {
  const bgFixed = state.selections.background?.grants?.languageGrants ?? [];
  const speciesFixed = state.selections.species?.languageGrants ?? [];
  return [...new Set([...bgFixed, ...speciesFixed])];
}

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function toolLabel(key: string): string {
  const parts = key.split(":");
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(": ");
}

function langLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/* ── Step Definition ─────────────────────────────────────── */

export function createBackgroundGrantsStep(): WizardStepDefinition {
  return {
    id: "backgroundGrants",
    label: "Background Grants",
    icon: "fa-solid fa-gift",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-background-grants.hbs`,
    dependencies: ["background"],
    isApplicable(state: WizardState): boolean {
      return !!state.selections.background?.uuid;
    },

    isComplete(state: WizardState): boolean {
      const bg = state.selections.background;
      if (!bg?.grants) return false;
      const grants = bg.grants;

      // ASI must be fully assigned (if available)
      if (grants.asiPoints > 0) {
        const total = Object.values(bg.asi.assignments).reduce(
          (sum, v) => sum + (v ?? 0), 0,
        );
        if (total !== grants.asiPoints) return false;
      }

      // Languages must be fully chosen (species + background combined)
      const totalLangChoices = getTotalLanguageChoiceCount(state);
      if (totalLangChoices > 0) {
        if (bg.languages.chosen.length < totalLangChoices) return false;
      }

      return true;
    },

    getStatusHint(state: WizardState): string {
      const bg = state.selections.background;
      if (!bg?.grants) return "Select a background first";
      const grants = bg.grants;

      // Check ASI
      if (grants.asiPoints > 0) {
        const total = Object.values(bg.asi.assignments).reduce(
          (sum, v) => sum + (v ?? 0), 0,
        );
        if (total < grants.asiPoints) {
          const remaining = grants.asiPoints - total;
          return `Assign ${remaining} more ability score point${remaining > 1 ? "s" : ""}`;
        }
      }

      // Check languages (species + background combined)
      const totalLangChoices = getTotalLanguageChoiceCount(state);
      if (totalLangChoices > 0) {
        const remaining = totalLangChoices - bg.languages.chosen.length;
        if (remaining > 0) {
          return `Choose ${remaining} more language${remaining > 1 ? "s" : ""}`;
        }
      }

      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const bg = state.selections.background;
      if (!bg?.grants) {
        return { hasGrants: false, backgroundName: "None selected" };
      }

      const grants = bg.grants;
      const totalUsed = Object.values(bg.asi.assignments).reduce(
        (sum, v) => sum + (v ?? 0), 0,
      );

      // ASI abilities
      const asiAbilities = ABILITY_KEYS.map((key) => {
        const value = bg.asi.assignments[key] ?? 0;
        const suggested = grants.asiSuggested.includes(key);
        const remaining = grants.asiPoints - totalUsed;

        const options = [
          { value: 0, label: "+0", selected: value === 0 },
          { value: 1, label: "+1", selected: value === 1 },
        ];
        if (grants.asiCap >= 2) {
          const canGetTwo = value === 2 || remaining >= (2 - value);
          if (canGetTwo) {
            options.push({ value: 2, label: "+2", selected: value === 2 });
          }
        }

        return { key, label: ABILITY_LABELS[key], value, suggested, options };
      });

      // Language slots — combine species + background grants
      const allFixed = getAllFixedLanguages(state);
      const fixedLangs = allFixed.map(langLabel);
      const fixedSet = new Set(allFixed);
      const totalLangChoices = getTotalLanguageChoiceCount(state);

      const langSlots = [];
      for (let i = 0; i < totalLangChoices; i++) {
        const currentValue = bg.languages.chosen[i] ?? "";
        const options = STANDARD_LANGUAGES
          .filter((lang) => !fixedSet.has(lang.id))
          .map((lang) => ({
            id: lang.id,
            label: lang.label,
            selected: lang.id === currentValue,
            disabled: lang.id !== currentValue && bg.languages.chosen.includes(lang.id),
          }));
        langSlots.push({ index: i, options });
      }

      return {
        hasGrants: true,
        backgroundName: bg.name,
        backgroundImg: bg.img,

        // Proficiency chips
        grantedSkills: grants.skillProficiencies.map(skillLabel),
        toolProficiency: grants.toolProficiency ? toolLabel(grants.toolProficiency) : null,
        originFeatName: grants.originFeatName,

        // ASI picker
        hasASI: grants.asiPoints > 0,
        asiAbilities,
        asiPointsUsed: totalUsed,
        asiPoints: grants.asiPoints,
        asiComplete: totalUsed === grants.asiPoints,

        // Language picker
        hasLanguages: totalLangChoices > 0 || allFixed.length > 0,
        fixedLanguages: fixedLangs,
        languageSlots: langSlots.length > 0 ? langSlots : null,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      const bg = state.selections.background;
      if (!bg?.grants) return;

      // ASI dropdown handlers — patch counters and dropdown availability in-place
      el.querySelectorAll<HTMLSelectElement>("[data-asi-ability]").forEach((select) => {
        select.addEventListener("change", () => {
          if (!bg.grants) return;
          const ability = select.dataset.asiAbility as AbilityKey;
          const newValue = parseInt(select.value, 10) || 0;

          if (newValue > bg.grants.asiCap) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          const otherTotal = Object.entries(bg.asi.assignments)
            .filter(([k]) => k !== ability)
            .reduce((sum, [, v]) => sum + (v ?? 0), 0);
          const proposedTotal = otherTotal + newValue;

          if (proposedTotal > bg.grants.asiPoints) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          if (newValue === 0) {
            delete bg.asi.assignments[ability];
          } else {
            bg.asi.assignments[ability] = newValue;
          }

          // Patch DOM: counter
          const counter = el.querySelector("[data-asi-counter]");
          if (counter) counter.textContent = `${proposedTotal} / ${bg.grants.asiPoints}`;

          // Patch DOM: update +2 option availability on other dropdowns
          const remaining = bg.grants.asiPoints - proposedTotal;
          el.querySelectorAll<HTMLSelectElement>("[data-asi-ability]").forEach((otherSelect) => {
            const otherAbility = otherSelect.dataset.asiAbility as AbilityKey;
            const otherValue = bg.asi.assignments[otherAbility] ?? 0;
            // Disable +2 option if there aren't enough remaining points
            const opt2 = otherSelect.querySelector<HTMLOptionElement>('option[value="2"]');
            if (opt2) {
              const canGetTwo = otherValue === 2 || remaining >= (2 - otherValue);
              opt2.disabled = !canGetTwo;
            }
          });

          // Patch DOM: complete state visual
          const completeEl = el.querySelector("[data-asi-complete]");
          if (completeEl) {
            completeEl.classList.toggle("cc-grants-complete", proposedTotal === bg.grants.asiPoints);
          }

          callbacks.setDataSilent(bg);
        });
      });

      // Language dropdown handlers — patch disabled states in-place
      el.querySelectorAll<HTMLSelectElement>("[data-lang-slot]").forEach((select) => {
        select.addEventListener("change", () => {
          if (!bg.grants) return;
          const slotIndex = parseInt(select.dataset.langSlot ?? "0", 10);
          const newValue = select.value;

          const chosen = [...bg.languages.chosen];
          while (chosen.length <= slotIndex) chosen.push("");
          chosen[slotIndex] = newValue;
          bg.languages.chosen = chosen.filter((v) => v !== "");

          // Patch DOM: disable already-chosen languages in other dropdowns
          const chosenSet = new Set(bg.languages.chosen);
          el.querySelectorAll<HTMLSelectElement>("[data-lang-slot]").forEach((otherSelect) => {
            const otherSlot = parseInt(otherSelect.dataset.langSlot ?? "0", 10);
            const otherValue = otherSelect.value;
            otherSelect.querySelectorAll<HTMLOptionElement>("option").forEach((opt) => {
              if (!opt.value) return; // skip placeholder
              opt.disabled = opt.value !== otherValue && chosenSet.has(opt.value);
            });
            // Preserve selection for this slot
            if (otherSlot === slotIndex) otherSelect.value = newValue;
          });

          callbacks.setDataSilent(bg);
        });
      });
    },
  };
}
