/**
 * Level-Up — Step 7: Review
 *
 * Summary of all level-up changes with confirmation.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState } from "../level-up-types";
import { ABILITY_LABELS } from "../../data/dnd5e-constants";
import type { AbilityKey } from "../../character-creator-types";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Step Definition ─────────────────────────────────────── */

export function createLuReviewStep(): LevelUpStepDef {
  return {
    id: "review",
    label: "Review",
    icon: "fa-solid fa-clipboard-check",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-review.hbs`,

    isComplete(): boolean {
      return true; // Review is always "complete"
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      const sel = state.selections;
      const changes: Array<{ label: string; detail: string; icon: string }> = [];

      // Class
      if (sel.classChoice) {
        const mode = sel.classChoice.mode === "multiclass" ? "Multiclass into" : "Level up";
        changes.push({
          label: "Class",
          detail: `${mode} ${sel.classChoice.className}`,
          icon: "fa-solid fa-shield-halved",
        });
      }

      // HP
      if (sel.hp) {
        const method = sel.hp.method === "roll" ? `Rolled ${sel.hp.rollResult}` : "Took average";
        changes.push({
          label: "Hit Points",
          detail: `${method} → +${sel.hp.hpGained} HP`,
          icon: "fa-solid fa-heart",
        });
      }

      // Features
      if (sel.features && sel.features.featureNames.length > 0) {
        changes.push({
          label: "Features",
          detail: sel.features.featureNames.join(", "),
          icon: "fa-solid fa-scroll",
        });
      }

      // Subclass
      if (sel.subclass) {
        changes.push({
          label: "Subclass",
          detail: sel.subclass.name,
          icon: "fa-solid fa-book-sparkles",
        });
      }

      // ASI / Feat
      if (sel.feats) {
        if (sel.feats.choice === "asi" && sel.feats.asiAbilities) {
          const abilityNames = sel.feats.asiAbilities
            .map((a) => ABILITY_LABELS[a as AbilityKey] ?? a)
            .join(", ");
          const bonus = sel.feats.asiAbilities.length === 1 ? "+2" : "+1 each";
          changes.push({
            label: "Ability Score Improvement",
            detail: `${abilityNames} (${bonus})`,
            icon: "fa-solid fa-star",
          });
        } else if (sel.feats.choice === "feat") {
          changes.push({
            label: "Feat",
            detail: sel.feats.featName ?? "Selected feat",
            icon: "fa-solid fa-star",
          });
        }
      }

      // Spells
      if (sel.spells) {
        const parts: string[] = [];
        if (sel.spells.newCantripUuids.length > 0) {
          parts.push(`${sel.spells.newCantripUuids.length} new cantrip(s)`);
        }
        if (sel.spells.newSpellUuids.length > 0) {
          parts.push(`${sel.spells.newSpellUuids.length} new spell(s)`);
        }
        if (sel.spells.swappedOutUuids.length > 0) {
          parts.push(`${sel.spells.swappedOutUuids.length} spell swap(s)`);
        }
        if (parts.length > 0) {
          changes.push({
            label: "Spells",
            detail: parts.join(", "),
            icon: "fa-solid fa-wand-sparkles",
          });
        }
      }

      return {
        actorName: actor.name ?? "Character",
        currentLevel: state.currentLevel,
        targetLevel: state.targetLevel,
        className: sel.classChoice?.className ?? "",
        changes,
        hasChanges: changes.length > 0,
        isReview: true,
      };
    },
  };
}
