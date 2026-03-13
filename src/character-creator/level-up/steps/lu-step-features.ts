/**
 * Level-Up — Step 3: Class Features
 *
 * Shows features granted at the new level via class advancement data.
 * Players can accept or decline optional features.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { LevelUpState, LevelUpFeaturesChoice } from "../level-up-types";
import type { LevelUpStepDef } from "./lu-step-class-choice";

/* ── Step Definition ─────────────────────────────────────── */

export function createFeaturesStep(): LevelUpStepDef {
  return {
    id: "features",
    label: "Features",
    icon: "fa-solid fa-scroll",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-features.hbs`,

    isComplete(_state: LevelUpState): boolean {
      // Features step is always complete (features auto-granted, or no features at this level)
      return true;
    },

    async buildViewModel(state: LevelUpState, _actor: FoundryDocument): Promise<Record<string, unknown>> {
      const classChoice = state.selections.classChoice;
      const classInfo = classChoice?.mode === "existing"
        ? state.classItems.find((c) => c.itemId === classChoice?.classItemId)
        : null;

      const newClassLevel = classChoice?.mode === "multiclass"
        ? 1
        : (classInfo?.levels ?? 0) + 1;

      // Find advancement entries for this level
      const advancement = classInfo?.advancement ?? [];
      const levelFeatures = advancement.filter((a) => {
        // ItemGrant advancement at this level
        if (a.type === "ItemGrant" && a.level === newClassLevel) return true;
        return false;
      });

      // Extract feature info from advancement configuration
      const features = levelFeatures.map((a) => {
        const items = (a.configuration?.items as Array<{ uuid?: string; name?: string }>) ?? [];
        return items.map((item) => ({
          uuid: item.uuid ?? "",
          name: item.name ?? "Feature",
          fromAdvancement: true,
        }));
      }).flat();

      // ScaleValue changes at this level
      const scaleValues = advancement.filter((a) =>
        a.type === "ScaleValue" && a.level === newClassLevel,
      ).map((a) => ({
        title: a.title ?? "Scale Value",
        type: "ScaleValue",
      }));

      const sel = state.selections.features;
      const acceptedUuids = new Set(sel?.acceptedFeatureUuids ?? features.map((f) => f.uuid));

      return {
        className: classChoice?.className ?? "your class",
        newClassLevel,
        features: features.map((f) => ({
          ...f,
          accepted: acceptedUuids.has(f.uuid),
        })),
        scaleValues,
        hasFeatures: features.length > 0,
        hasScaleValues: scaleValues.length > 0,
        hasAnyContent: features.length > 0 || scaleValues.length > 0,
        targetLevel: state.targetLevel,
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      // Feature toggle checkboxes (for optional features)
      el.querySelectorAll("[data-feature-uuid]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const uuid = (checkbox as HTMLInputElement).dataset.featureUuid;
          if (!uuid) return;
          const current = state.selections.features ?? {
            acceptedFeatureUuids: [],
            featureNames: [],
          };
          const accepted = new Set(current.acceptedFeatureUuids);
          const names = new Set(current.featureNames);
          const name = (checkbox as HTMLInputElement).dataset.featureName ?? "";

          if ((checkbox as HTMLInputElement).checked) {
            accepted.add(uuid);
            if (name) names.add(name);
          } else {
            accepted.delete(uuid);
            names.delete(name);
          }

          callbacks.setData({
            acceptedFeatureUuids: [...accepted],
            featureNames: [...names],
          } as LevelUpFeaturesChoice);
        });
      });
    },
  };
}
