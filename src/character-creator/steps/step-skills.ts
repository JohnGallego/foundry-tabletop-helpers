/**
 * Character Creator — Step: Skills & Proficiencies
 *
 * Checkbox selection of skill proficiencies, filtered by class pool
 * and excluding background-granted skills shown as locked chips.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  SkillSelection,
  StepCallbacks,
  AbilityKey,
} from "../character-creator-types";
import { SKILLS, ABILITY_ABBREVS } from "../data/dnd5e-constants";

/* ── Constants ───────────────────────────────────────────── */

/** Default number of skill picks for most classes. */
const DEFAULT_SKILL_PICKS = 2;

/* ── Helpers ─────────────────────────────────────────────── */

function getBackgroundSkills(state: WizardState): string[] {
  return state.selections.background?.grants.skillProficiencies ?? [];
}

function getClassPool(state: WizardState): string[] {
  const pool = state.selections.class?.skillPool;
  return pool && pool.length > 0 ? pool : Object.keys(SKILLS);
}

function getSkillCount(state: WizardState): number {
  return state.selections.class?.skillCount ?? DEFAULT_SKILL_PICKS;
}

/** Patch skill row DOM without full re-render. */
function patchSkillsDOM(
  el: HTMLElement,
  chosen: Set<string>,
  maxPicks: number,
): void {
  const atMax = chosen.size >= maxPicks;
  // Update each checkbox row
  el.querySelectorAll<HTMLInputElement>("[data-skill]").forEach((cb) => {
    const key = cb.dataset.skill!;
    const isChosen = chosen.has(key);
    cb.checked = isChosen;
    cb.disabled = !isChosen && atMax;
    const row = cb.closest(".cc-skill-row");
    if (row) {
      row.classList.toggle("cc-skill-row--checked", isChosen);
    }
  });
  // Update counter
  const countEl = el.querySelector<HTMLElement>("[data-skill-count]");
  if (countEl) countEl.textContent = String(chosen.size);
  const counterEl = el.querySelector<HTMLElement>(".cc-skills__counter");
  if (counterEl) {
    counterEl.classList.toggle("cc-skills__counter--full", atMax);
  }
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSkillsStep(): WizardStepDefinition {
  return {
    id: "skills",
    label: "Skills & Proficiencies",
    icon: "fa-solid fa-hand-fist",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-skills.hbs`,
    dependencies: ["race", "background", "class"],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      const data = state.selections.skills;
      if (!data) return false;
      const skillCount = getSkillCount(state);
      return data.chosen.length === skillCount;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const data = state.selections.skills ?? { chosen: [] };
      const chosenSet = new Set(data.chosen);

      const backgroundSkills = getBackgroundSkills(state);
      const backgroundSet = new Set(backgroundSkills);
      const classPool = getClassPool(state);
      const maxPicks = getSkillCount(state);

      // Filter class pool: remove background-granted skills
      const availableKeys = classPool.filter((k) => !backgroundSet.has(k));

      // Build available skill entries
      const availableSkills = availableKeys
        .filter((key) => key in SKILLS)
        .map((key) => {
          const skill = SKILLS[key];
          const checked = chosenSet.has(key);
          return {
            key,
            label: skill.label,
            abilityAbbrev: ABILITY_ABBREVS[skill.ability as AbilityKey],
            checked,
            disabled: !checked && chosenSet.size >= maxPicks,
          };
        });

      // Build background skill chips (display names)
      const backgroundSkillChips = backgroundSkills
        .filter((key) => key in SKILLS)
        .map((key) => SKILLS[key].label);

      const chosenCount = data.chosen.length;
      const atMax = chosenCount >= maxPicks;

      return {
        availableSkills,
        backgroundSkillChips,
        chosenCount,
        maxPicks,
        atMax,
        className: state.selections.class?.name ?? "",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      const backgroundSet = new Set(getBackgroundSkills(state));
      const maxPicks = getSkillCount(state);

      el.querySelectorAll<HTMLInputElement>("[data-skill]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const key = checkbox.dataset.skill;
          if (!key) return;

          const current = state.selections.skills ?? { chosen: [] };
          const chosen = new Set(current.chosen);

          if (checkbox.checked) {
            // Enforce max picks — revert if at cap
            if (chosen.size >= maxPicks) {
              checkbox.checked = false;
              return;
            }
            // Prevent double-picking background skills
            if (backgroundSet.has(key)) {
              checkbox.checked = false;
              return;
            }
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          const newData: SkillSelection = { chosen: [...chosen] };
          callbacks.setData(newData);

          // Patch DOM directly for flicker-free update
          patchSkillsDOM(el, chosen, maxPicks);
        });
      });
    },
  };
}
