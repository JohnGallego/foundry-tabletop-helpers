/**
 * Character Creator — Step 11: Review & Create
 *
 * Full character summary with edit-back buttons, character name input,
 * and the "Create Character" action.
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
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";

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

      // Build ability summary
      const abilities = ABILITY_KEYS.map((key: AbilityKey) => {
        const score = sel.abilities?.scores?.[key] ?? 10;
        const mod = abilityModifier(score);
        return {
          key,
          label: ABILITY_LABELS[key],
          score,
          modifier: formatModifier(mod),
          isPositive: mod >= 0,
        };
      });

      // Build skills summary
      const skills = sel.skills?.chosen ?? [];

      // Build feat/ASI summary
      let featSummary = "";
      if (sel.feats) {
        if (sel.feats.choice === "asi") {
          const asiAbilities = sel.feats.asiAbilities?.map((a) => ABILITY_LABELS[a]).join(", ");
          featSummary = `Ability Score Improvement: ${asiAbilities ?? "None"}`;
        } else {
          featSummary = sel.feats.featName ?? "Selected feat";
        }
      }

      // Build spells summary
      const cantripCount = sel.spells?.cantrips?.length ?? 0;
      const spellCount = sel.spells?.spells?.length ?? 0;

      // Build equipment summary
      let equipmentSummary = "";
      if (sel.equipment) {
        if (sel.equipment.method === "gold") {
          equipmentSummary = `Starting gold: ${sel.equipment.goldAmount ?? 0} gp`;
        } else {
          equipmentSummary = "Standard equipment packs";
        }
      }

      // Check completeness of each section
      const sections = [
        {
          id: "abilities",
          label: "Ability Scores",
          icon: "fa-solid fa-dice-d20",
          complete: !!sel.abilities && Object.values(sel.abilities.scores).every((v) => v > 0),
          summary: abilities,
          isAbilities: true,
        },
        {
          id: "race",
          label: "Race",
          icon: "fa-solid fa-users",
          complete: !!sel.race?.uuid,
          summary: sel.race?.name ?? "Not selected",
          img: sel.race?.img,
          isSimple: true,
        },
        {
          id: "background",
          label: "Background",
          icon: "fa-solid fa-scroll",
          complete: !!sel.background?.uuid,
          summary: sel.background?.name ?? "Not selected",
          img: sel.background?.img,
          isSimple: true,
        },
        {
          id: "class",
          label: "Class",
          icon: "fa-solid fa-shield-halved",
          complete: !!sel.class?.uuid,
          summary: sel.class?.name ?? "Not selected",
          img: sel.class?.img,
          isSimple: true,
        },
      ];

      // Conditional sections
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

      sections.push({
        id: "skills",
        label: "Skills",
        icon: "fa-solid fa-hand-fist",
        complete: skills.length > 0,
        summary: skills.length > 0 ? `${skills.length} proficiencies` : "None selected",
        isSimple: true,
      } as typeof sections[number]);

      if (state.applicableSteps.includes("feats")) {
        sections.push({
          id: "feats",
          label: "Feats & ASI",
          icon: "fa-solid fa-star",
          complete: !!sel.feats,
          summary: featSummary || "Not selected",
          isSimple: true,
        } as typeof sections[number]);
      }

      if (state.applicableSteps.includes("spells")) {
        sections.push({
          id: "spells",
          label: "Spells",
          icon: "fa-solid fa-wand-sparkles",
          complete: cantripCount > 0 || spellCount > 0,
          summary: `${cantripCount} cantrips, ${spellCount} spells`,
          isSimple: true,
        } as typeof sections[number]);
      }

      sections.push({
        id: "equipment",
        label: "Equipment",
        icon: "fa-solid fa-sack",
        complete: !!sel.equipment,
        summary: equipmentSummary || "Not selected",
        isSimple: true,
      } as typeof sections[number]);

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
      // Character name input
      const nameInput = el.querySelector("[data-character-name]") as HTMLInputElement | null;
      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setData({ ...current, characterName: nameInput.value });
        });
      }

      // Edit buttons — jump back to that step (handled by jumpToStep action in shell)
      // These use data-action="jumpToStep" data-step-id="..." which is already wired
    },
  };
}
