/**
 * Character Creator — Step 6: Skills & Proficiencies
 *
 * Checkbox selection of skill proficiencies. Shows all 18 skills
 * with their associated ability scores.
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
      return data.chosen.length > 0;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const data = state.selections.skills ?? { chosen: [] };
      const chosenSet = new Set(data.chosen);

      // Build skill entries
      const skills = Object.entries(SKILLS).map(([key, skill]) => ({
        key,
        label: skill.label,
        ability: skill.ability,
        abilityAbbrev: ABILITY_ABBREVS[skill.ability as AbilityKey],
        checked: chosenSet.has(key),
      }));

      // Group by ability
      const abilityGroups = new Map<string, typeof skills>();
      for (const skill of skills) {
        const group = abilityGroups.get(skill.ability) ?? [];
        group.push(skill);
        abilityGroups.set(skill.ability, group);
      }

      const groups = Array.from(abilityGroups.entries()).map(([ability, groupSkills]) => ({
        ability,
        abilityLabel: ABILITY_ABBREVS[ability as AbilityKey],
        skills: groupSkills,
      }));

      return {
        skills,
        groups,
        chosenCount: data.chosen.length,
        maxPicks: DEFAULT_SKILL_PICKS,
        hasClass: !!state.selections.class,
        className: state.selections.class?.name ?? "your class",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      el.querySelectorAll("[data-skill]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const key = (checkbox as HTMLInputElement).dataset.skill;
          if (!key) return;
          const current = state.selections.skills ?? { chosen: [] };
          const chosen = new Set(current.chosen);

          if ((checkbox as HTMLInputElement).checked) {
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          callbacks.setData({ chosen: [...chosen] } as SkillSelection);
        });
      });
    },
  };
}
