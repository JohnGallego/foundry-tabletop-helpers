import type {
  StepStatus,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";

/** When a step changes, downstream dependent steps are invalidated. */
export const DEPENDENCY_CASCADE: Record<string, string[]> = {
  species: ["backgroundGrants"],
  background: ["backgroundGrants", "originFeat", "skills", "abilities"],
  backgroundGrants: [],
  class: ["subclass", "skills", "feats", "spells", "equipment"],
  subclass: ["spells"],
  abilities: ["feats"],
};

export function recalculateApplicableSteps(
  state: WizardState,
  allSteps: WizardStepDefinition[],
): void {
  const previousId = state.applicableSteps[state.currentStep] ?? "";
  state.applicableSteps = allSteps
    .filter((step) => step.isApplicable(state))
    .map((step) => step.id);

  if (!previousId) return;

  const newIndex = state.applicableSteps.indexOf(previousId);
  if (newIndex >= 0) {
    state.currentStep = newIndex;
    return;
  }

  state.currentStep = Math.min(
    state.currentStep,
    Math.max(0, state.applicableSteps.length - 1),
  );
}

export function cascadeInvalidation(
  state: WizardState,
  changedStepId: string,
): Set<string> {
  const toInvalidate = new Set<string>();
  const visited = new Set<string>();
  const queue = [...(DEPENDENCY_CASCADE[changedStepId] ?? [])];

  while (queue.length > 0) {
    const stepId = queue.shift()!;
    if (visited.has(stepId)) continue;
    visited.add(stepId);

    if (state.stepStatus.get(stepId) === "complete") {
      toInvalidate.add(stepId);
    }

    queue.push(...(DEPENDENCY_CASCADE[stepId] ?? []));
  }

  for (const stepId of toInvalidate) {
    state.selections[stepId] = undefined;
    state.stepStatus.set(stepId, "pending");
  }

  return toInvalidate;
}

export function buildStepIndicatorData(
  state: WizardState,
  getStepDef: (stepId: string) => WizardStepDefinition | undefined,
): Array<{
  id: string;
  label: string;
  icon: string;
  status: StepStatus;
  active: boolean;
  index: number;
  number: number;
}> {
  return state.applicableSteps.map((id, index) => {
    const step = getStepDef(id);
    return {
      id,
      label: step?.label ?? id,
      icon: step?.icon ?? "fa-solid fa-circle",
      status: state.stepStatus.get(id) ?? "pending",
      active: index === state.currentStep,
      index,
      number: index + 1,
    };
  });
}
