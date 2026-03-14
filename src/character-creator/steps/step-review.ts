/**
 * Character Creator — Step 11: Review & Create
 *
 * Full character summary with edit-back buttons, character name input,
 * and the "Create Character" action.
 *
 * Updated for 2024 PHB rules: species (replaces race), background grants,
 * origin feat, ASI from background, and language selections.
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
  LANGUAGE_LABELS,
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";

/* ── Helpers ─────────────────────────────────────────────── */

/** Look up a skill key to its display name. */
function skillName(key: string): string {
  return SKILLS[key]?.label ?? key;
}

/** Look up a language key to its display name. */
function languageName(key: string): string {
  return LANGUAGE_LABELS[key] ?? key;
}

/** Format ASI assignments as "WIS +2, CHA +1". */
function formatASI(assignments: Partial<Record<AbilityKey, number>>): string {
  const parts: string[] = [];
  for (const key of ABILITY_KEYS) {
    const val = assignments[key];
    if (val && val > 0) {
      parts.push(`${ABILITY_LABELS[key]} +${val}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "None assigned";
}

/* ── Step Definition ─────────────────────────────────────── */

export function createReviewStep(): WizardStepDefinition {
  return {
    id: "review",
    label: "Review & Create",
    icon: "fa-solid fa-clipboard-check",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-review.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      // Review is complete when the character name is entered
      const name = (state.selections.review as { characterName?: string } | undefined)?.characterName;
      return !!name && name.trim().length > 0;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const sel = state.selections;
      const reviewData = sel.review as { characterName?: string } | undefined;

      /* ── 1. Species ──────────────────────────────────────── */
      const speciesSection = {
        id: "species",
        label: "Species",
        icon: "fa-solid fa-users",
        complete: !!sel.species?.uuid,
        summary: sel.species?.name ?? "Not selected",
        img: sel.species?.img,
        isSimple: true,
        traits: sel.species?.traits ?? [],
        hasTraits: (sel.species?.traits?.length ?? 0) > 0,
      };

      /* ── 2. Background ──────────────────────────────────── */
      const bg = sel.background;
      const bgSkills = bg?.grants.skillProficiencies.map(skillName) ?? [];
      const bgTool = bg?.grants.toolProficiency ?? null;
      const bgOriginFeat = bg?.grants.originFeatName ?? null;
      const bgLanguagesFixed = bg?.languages.fixed.map(languageName) ?? [];
      const bgLanguagesChosen = bg?.languages.chosen.map(languageName) ?? [];
      const bgASI = bg?.asi.assignments ? formatASI(bg.asi.assignments) : "None assigned";

      // Complete check: uuid AND ASI fully assigned AND languages fully chosen
      const asiTotal = bg?.asi.assignments
        ? Object.values(bg.asi.assignments).reduce((sum, v) => sum + (v ?? 0), 0)
        : 0;
      const asiNeeded = bg?.grants.asiPoints ?? 0;
      const langChosenCount = bg?.languages.chosen.length ?? 0;
      const langNeeded = bg?.grants.languageChoiceCount ?? 0;
      const bgComplete = !!bg?.uuid && asiTotal >= asiNeeded && langChosenCount >= langNeeded;

      const backgroundSection = {
        id: "background",
        label: "Background",
        icon: "fa-solid fa-scroll",
        complete: bgComplete,
        summary: bg?.name ?? "Not selected",
        img: bg?.img,
        isBackground: true,
        bgSkills,
        bgTool,
        bgOriginFeat,
        bgLanguagesFixed,
        bgLanguagesChosen,
        bgASI,
        hasBgDetails: !!bg?.uuid,
      };

      /* ── 3. Origin Feat ─────────────────────────────────── */
      const originFeatSection = {
        id: "originFeat",
        label: "Origin Feat",
        icon: "fa-solid fa-star-half-stroke",
        complete: !!sel.originFeat?.uuid,
        summary: sel.originFeat?.name ?? "Not selected",
        img: sel.originFeat?.img,
        isSimple: true,
      };

      /* ── 4. Class ───────────────────────────────────────── */
      const classSection = {
        id: "class",
        label: "Class",
        icon: "fa-solid fa-shield-halved",
        complete: !!sel.class?.uuid,
        summary: sel.class?.name ?? "Not selected",
        img: sel.class?.img,
        isSimple: true,
      };

      /* ── 5. Subclass (conditional) ──────────────────────── */
      const sections: Record<string, unknown>[] = [
        speciesSection,
        backgroundSection,
        originFeatSection,
        classSection,
      ];

      if (state.config.startingLevel >= 3 && state.applicableSteps.includes("subclass")) {
        sections.push({
          id: "subclass",
          label: "Subclass",
          icon: "fa-solid fa-book-sparkles",
          complete: !!sel.subclass?.uuid,
          summary: sel.subclass?.name ?? "Not selected",
          img: sel.subclass?.img,
          isSimple: true,
        });
      }

      /* ── 6. Abilities ───────────────────────────────────── */
      const bgBonuses = bg?.asi.assignments ?? {};
      const abilities = ABILITY_KEYS.map((key: AbilityKey) => {
        const baseScore = sel.abilities?.scores?.[key] ?? 10;
        const bonus = bgBonuses[key] ?? 0;
        const totalScore = baseScore + bonus;
        const mod = abilityModifier(totalScore);
        return {
          key,
          label: ABILITY_LABELS[key],
          score: totalScore,
          baseScore,
          bonus,
          hasBonus: bonus > 0,
          modifier: formatModifier(mod),
          isPositive: mod >= 0,
        };
      });

      sections.push({
        id: "abilities",
        label: "Ability Scores",
        icon: "fa-solid fa-dice-d20",
        complete: !!sel.abilities && Object.values(sel.abilities.scores).every((v) => v > 0),
        summary: abilities,
        isAbilities: true,
      });

      /* ── 7. Skills ──────────────────────────────────────── */
      const classSkills = sel.skills?.chosen.map(skillName) ?? [];
      const backgroundSkills = bg?.grants.skillProficiencies.map(skillName) ?? [];

      sections.push({
        id: "skills",
        label: "Skills",
        icon: "fa-solid fa-hand-fist",
        complete: classSkills.length > 0 || backgroundSkills.length > 0,
        classSkills,
        backgroundSkills,
        hasClassSkills: classSkills.length > 0,
        hasBackgroundSkills: backgroundSkills.length > 0,
        isSkills: true,
      });

      /* ── 8. Feats (conditional) ─────────────────────────── */
      if (state.applicableSteps.includes("feats")) {
        let featSummary = "";
        if (sel.feats) {
          if (sel.feats.choice === "asi") {
            const asiAbilities = sel.feats.asiAbilities?.map((a) => ABILITY_LABELS[a]).join(", ");
            featSummary = `Ability Score Improvement: ${asiAbilities ?? "None"}`;
          } else {
            featSummary = sel.feats.featName ?? "Selected feat";
          }
        }
        sections.push({
          id: "feats",
          label: "Feats & ASI",
          icon: "fa-solid fa-star",
          complete: !!sel.feats,
          summary: featSummary || "Not selected",
          img: sel.feats?.featImg,
          isSimple: true,
        });
      }

      /* ── 9. Spells (conditional) ────────────────────────── */
      if (state.applicableSteps.includes("spells")) {
        const cantripCount = sel.spells?.cantrips?.length ?? 0;
        const spellCount = sel.spells?.spells?.length ?? 0;
        sections.push({
          id: "spells",
          label: "Spells",
          icon: "fa-solid fa-wand-sparkles",
          complete: cantripCount > 0 || spellCount > 0,
          summary: `${cantripCount} cantrips, ${spellCount} spells`,
          isSimple: true,
        });
      }

      /* ── 10. Equipment ──────────────────────────────────── */
      let equipmentSummary = "";
      if (sel.equipment) {
        if (sel.equipment.method === "gold") {
          equipmentSummary = `Starting gold: ${sel.equipment.goldAmount ?? 0} gp`;
        } else {
          equipmentSummary = "Standard equipment packs";
        }
      }
      sections.push({
        id: "equipment",
        label: "Equipment",
        icon: "fa-solid fa-sack",
        complete: !!sel.equipment,
        summary: equipmentSummary || "Not selected",
        isSimple: true,
      });

      const allComplete = sections.every((s) => s.complete);

      return {
        characterName: reviewData?.characterName ?? "",
        sections,
        allComplete,
        isReview: true,
        startingLevel: state.config.startingLevel,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Character name input — save silently on keystroke (no re-render needed)
      const nameInput = el.querySelector("[data-character-name]") as HTMLInputElement | null;
      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setDataSilent({ ...current, characterName: nameInput.value });
        });
      }

      // Edit buttons — jump back to that step (handled by jumpToStep action in shell)
      // These use data-action="jumpToStep" data-step-id="..." which is already wired
    },
  };
}
