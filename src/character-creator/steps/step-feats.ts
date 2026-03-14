/**
 * Character Creator — Step 7: Feats & ASI
 *
 * At ASI levels (4, 8, 12, 16, 19), the player chooses between:
 * - Ability Score Improvement (+2 to one / +1 to two abilities)
 * - A feat from the compendium
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  FeatSelection,
  StepCallbacks,
  AbilityKey,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifier, formatModifier } from "../data/dnd5e-constants";

/* ── Constants ───────────────────────────────────────────── */

/** Levels that grant an ASI/feat. */
const ASI_LEVELS = [4, 8, 12, 16, 19];

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableFeats(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("feat", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createFeatsStep(): WizardStepDefinition {
  return {
    id: "feats",
    label: "Feats & ASI",
    icon: "fa-solid fa-star",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-feats.hbs`,
    dependencies: ["class", "abilities"],

    isApplicable(state: WizardState): boolean {
      return ASI_LEVELS.includes(state.config.startingLevel);
    },

    isComplete(state: WizardState): boolean {
      const data = state.selections.feats;
      if (!data) return false;
      if (data.choice === "asi") {
        return (data.asiAbilities?.length ?? 0) > 0;
      }
      return !!data.featUuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const data = state.selections.feats;
      const feats = getAvailableFeats(state);
      const scores = state.selections.abilities?.scores;
      const asiSet = new Set(data?.asiAbilities ?? []);

      // Build ability entries for ASI panel
      const abilities = ABILITY_KEYS.map((key) => {
        const score = scores?.[key] ?? 10;
        const mod = abilityModifier(score);
        return {
          key,
          label: ABILITY_LABELS[key],
          score,
          modifier: formatModifier(mod),
          selected: asiSet.has(key),
          atMax: score >= 20,
        };
      });

      return {
        choice: data?.choice ?? "asi",
        isAsi: !data?.choice || data.choice === "asi",
        isFeat: data?.choice === "feat",
        abilities,
        asiCount: data?.asiAbilities?.length ?? 0,
        maxAsiPicks: 2,
        feats: feats.map((e) => ({
          ...e,
          selected: e.uuid === data?.featUuid,
        })),
        selectedFeat: data?.featUuid ? feats.find((e) => e.uuid === data.featUuid) : null,
        hasFeats: feats.length > 0,
        emptyMessage: "No feats available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Choice tabs (ASI vs Feat)
      el.querySelectorAll("[data-feat-choice]").forEach((tab) => {
        tab.addEventListener("click", () => {
          const choice = (tab as HTMLElement).dataset.featChoice as "asi" | "feat";
          if (!choice) return;
          const current = state.selections.feats ?? { choice: "asi" };
          callbacks.setData({ ...current, choice } as FeatSelection);
        });
      });

      // ASI ability toggles — patch selected state in-place
      el.querySelectorAll("[data-asi-ability]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const ability = (btn as HTMLElement).dataset.asiAbility as AbilityKey;
          if (!ability) return;
          const current = state.selections.feats ?? { choice: "asi" };
          const abilities = new Set(current.asiAbilities ?? []);

          if (abilities.has(ability)) {
            abilities.delete(ability);
          } else if (abilities.size < 2) {
            abilities.add(ability);
          }

          const newData = {
            ...current,
            choice: "asi" as const,
            asiAbilities: [...abilities],
          } as FeatSelection;

          // Patch DOM: toggle selected class on ability buttons
          el.querySelectorAll<HTMLElement>("[data-asi-ability]").forEach((b) => {
            const key = b.dataset.asiAbility as AbilityKey;
            b.classList.toggle("cc-asi-btn--selected", abilities.has(key));
          });
          // Update counter
          const countEl = el.querySelector("[data-asi-count]");
          if (countEl) countEl.textContent = String(abilities.size);

          callbacks.setDataSilent(newData);
        });
      });

      // Feat card selection — patch selected state in-place
      el.querySelectorAll("[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = (card as HTMLElement).dataset.cardUuid;
          if (!uuid) return;
          const feats = getAvailableFeats(state);
          const entry = feats.find((e) => e.uuid === uuid);
          if (!entry) return;

          const newData = {
            choice: "feat" as const,
            featUuid: entry.uuid,
            featName: entry.name,
            featImg: entry.img,
          } as FeatSelection;

          // Patch DOM: toggle selected class on cards
          el.querySelectorAll<HTMLElement>("[data-card-uuid]").forEach((c) => {
            const isSelected = c.dataset.cardUuid === uuid;
            c.classList.toggle("cc-spell-card--selected", isSelected);
            c.setAttribute("aria-selected", String(isSelected));
          });

          callbacks.setDataSilent(newData);
        });
      });
    },
  };
}
