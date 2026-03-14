/**
 * Character Creator — Step: Origin Feat (2024 PHB)
 *
 * Displays the origin feat granted by the selected background.
 * In default mode this is read-only — the background determines the feat.
 * If the GM allows custom backgrounds, shows a note that custom feat
 * selection will be available in a future update.
 */

import { Log, MOD } from "../../logger";
import { fromUuid } from "../../types";
import type {
  WizardStepDefinition,
  WizardState,
  OriginFeatSelection,
  StepCallbacks,
} from "../character-creator-types";

/* ── Step Definition ─────────────────────────────────────── */

export function createOriginFeatStep(): WizardStepDefinition {
  return {
    id: "originFeat",
    label: "Origin Feat",
    icon: "fa-solid fa-bolt",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-origin-feat.hbs`,
    dependencies: ["background"],

    isApplicable(state: WizardState): boolean {
      return !!state.selections.background?.grants.originFeatUuid;
    },

    isComplete(): boolean {
      return true;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      // Determine which feat UUID to display
      const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
      const currentSelection = state.selections.originFeat;
      const featUuid = currentSelection?.uuid ?? backgroundFeatUuid;

      let featName = currentSelection?.name ?? state.selections.background?.grants.originFeatName ?? "Origin Feat";
      let featImg = currentSelection?.img ?? state.selections.background?.grants.originFeatImg ?? "";
      let featDescription = "";

      // Fetch full document for description
      if (featUuid) {
        try {
          const doc = await fromUuid(featUuid);
          if (doc) {
            featName = (doc as Record<string, unknown>).name as string ?? featName;
            featImg = (doc as Record<string, unknown>).img as string ?? featImg;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            featDescription = (doc as any).system?.description?.value ?? "";
          }
        } catch (err) {
          Log.warn("Origin Feat: failed to fetch feat document", err);
        }
      }

      return {
        featName,
        featImg,
        featDescription,
        isCustomMode: !!state.config.allowCustomBackgrounds,
        isCustomSelection: !!currentSelection?.isCustom,
      };
    },

    onActivate(state: WizardState, _el: HTMLElement, callbacks: StepCallbacks): void {
      // Store the default feat as the selection so the review step can reference it
      const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
      if (backgroundFeatUuid && !state.selections.originFeat) {
        const selection: OriginFeatSelection = {
          uuid: backgroundFeatUuid,
          name: state.selections.background?.grants.originFeatName ?? "Origin Feat",
          img: state.selections.background?.grants.originFeatImg ?? "",
          isCustom: false,
        };
        callbacks.setData(selection);
      }
    },
  };
}
