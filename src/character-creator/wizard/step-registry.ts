/**
 * Character Creator — Step Registry
 *
 * Central registry for wizard step definitions.
 * Steps register themselves during module init; the wizard
 * consumes them in canonical order.
 */

import { MOD } from "../../logger";
import type { WizardStepDefinition, WizardState } from "../character-creator-types";
import { createAbilitiesStep } from "../steps/step-abilities";
import { createSpeciesStep } from "../steps/step-species";
// TODO: createOriginFeatStep will be added in Task 6
// import { createOriginFeatStep } from "../steps/step-origin-feat";
import { createBackgroundStep } from "../steps/step-background";
import { createClassStep } from "../steps/step-class";
import { createSkillsStep } from "../steps/step-skills";
import { createSubclassStep } from "../steps/step-subclass";
import { createFeatsStep } from "../steps/step-feats";
import { createSpellsStep } from "../steps/step-spells";
import { createEquipmentStep } from "../steps/step-equipment";
import { createPortraitStep } from "../steps/step-portrait";
import { createReviewStep } from "../steps/step-review";

/* ── Step Definitions ────────────────────────────────────── */

/** Canonical step order. Steps not in this list sort to the end. */
const STEP_ORDER = [
  "species",
  "background",
  "originFeat",
  "class",
  "subclass",
  "abilities",
  "skills",
  "feats",
  "spells",
  "equipment",
  "portrait",
  "review",
];

/** All registered step definitions. */
const _steps: WizardStepDefinition[] = [];

/* ── Public API ──────────────────────────────────────────── */

/**
 * Register a wizard step definition.
 * Call during module init for each step.
 */
export function registerStep(step: WizardStepDefinition): void {
  // Prevent duplicate registration
  const existing = _steps.findIndex((s) => s.id === step.id);
  if (existing >= 0) {
    _steps[existing] = step;
  } else {
    _steps.push(step);
  }
}

/**
 * Get all registered steps in canonical order.
 */
export function getOrderedSteps(): WizardStepDefinition[] {
  return [..._steps].sort((a, b) => {
    const ai = STEP_ORDER.indexOf(a.id);
    const bi = STEP_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/**
 * Get a step definition by ID.
 */
export function getStep(id: string): WizardStepDefinition | undefined {
  return _steps.find((s) => s.id === id);
}

/* ── Atmospheric Gradients ───────────────────────────────── */

/** Atmospheric gradient class per step (maps to CSS). */
const STEP_ATMOSPHERES: Record<string, string> = {
  species: "cc-atmosphere--nature",
  background: "cc-atmosphere--shadow",
  originFeat: "cc-atmosphere--crimson",
  class: "cc-atmosphere--forge",
  subclass: "cc-atmosphere--forge",
  abilities: "cc-atmosphere--arcane",
  skills: "cc-atmosphere--arcane",
  feats: "cc-atmosphere--crimson",
  spells: "cc-atmosphere--arcane",
  equipment: "cc-atmosphere--forge",
  portrait: "cc-atmosphere--shadow",
  review: "cc-atmosphere--gold",
};

/** Get the atmospheric CSS class for a step. */
export function getStepAtmosphere(stepId: string): string {
  return STEP_ATMOSPHERES[stepId] ?? "cc-atmosphere--arcane";
}

/* ── Placeholder Step Factory ────────────────────────────── */

/**
 * Create a placeholder step definition.
 * Used for steps not yet implemented.
 */
export function createPlaceholderStep(
  id: string,
  label: string,
  icon: string,
  dependencies: string[] = [],
  isApplicable: (state: WizardState) => boolean = () => true,
): WizardStepDefinition {
  return {
    id,
    label,
    icon,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies,
    isApplicable,
    isComplete: () => true, // Placeholders are always "complete" for navigation
    buildViewModel: async (state) => ({
      stepId: id,
      stepLabel: label,
      stepIcon: icon,
      isPlaceholder: true,
      atmosphere: getStepAtmosphere(id),
      stepNumber: state.applicableSteps.indexOf(id) + 1,
      totalSteps: state.applicableSteps.length,
    }),
  };
}

/**
 * Register all wizard steps.
 * Phases 3 & 4 steps are fully implemented; portrait remains as placeholder.
 */
export function registerAllSteps(): void {
  registerStep(createSpeciesStep());

  // Core steps
  registerStep(createBackgroundStep());

  // TODO: Origin Feat step (Task 6)
  // registerStep(createOriginFeatStep());

  registerStep(createClassStep());
  registerStep(createSubclassStep());
  registerStep(createAbilitiesStep());
  registerStep(createSkillsStep());
  registerStep(createFeatsStep());
  registerStep(createSpellsStep());
  registerStep(createEquipmentStep());

  // Portrait (AI generation or manual upload)
  registerStep(createPortraitStep());

  // Review
  registerStep(createReviewStep());
}
