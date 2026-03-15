import type { FoundryDocument } from "../../types";
import type { WizardShellContext } from "../character-creator-types";
import type { LevelUpStateMachine } from "./level-up-state-machine";
import type { LevelUpStepDef } from "./steps/lu-step-class-choice";

export interface LevelUpShellContext extends WizardShellContext {
  isLevelUp: boolean;
}

export function createLevelUpStepCallbacks(
  machine: LevelUpStateMachine,
  render: () => void,
): {
  setData: (value: unknown) => void;
  rerender: () => void;
} {
  return {
    setData: (value: unknown) => {
      machine.setStepData(machine.currentStepId, value);
      machine.markComplete(machine.currentStepId);
      render();
    },
    rerender: () => {
      render();
    },
  };
}

export async function buildLevelUpShellContext(
  machine: LevelUpStateMachine,
  stepId: string,
  stepDef: LevelUpStepDef | undefined,
  actor: FoundryDocument | null,
  renderTemplateFn: (path: string, data: Record<string, unknown>) => Promise<string>,
  getStepAtmosphere: (stepId: string) => string,
): Promise<LevelUpShellContext> {
  let stepContentHtml = "";

  if (stepDef && actor) {
    const vmData = await stepDef.buildViewModel(machine.state, actor);
    stepContentHtml = await renderTemplateFn(stepDef.templatePath, vmData);
  }

  return {
    steps: machine.buildStepIndicatorData(),
    stepContentHtml,
    currentStepId: stepId,
    currentStepLabel: stepDef?.label ?? "",
    currentStepIcon: stepDef?.icon ?? "",
    canGoBack: machine.canGoBack,
    canGoNext: machine.canGoNext,
    isReviewStep: machine.isReviewStep,
    statusHint: "",
    atmosphereClass: getStepAtmosphere(stepId),
    isLevelUp: true,
  };
}

export function activateLevelUpStep(
  stepDef: LevelUpStepDef | undefined,
  machine: LevelUpStateMachine,
  root: ParentNode | null | undefined,
  callbacks: {
    setData: (value: unknown) => void;
    rerender: () => void;
  },
): void {
  if (!stepDef?.onActivate) return;
  const stepEl = root?.querySelector?.(".cc-step-content");
  if (stepEl) {
    stepDef.onActivate(machine.state, stepEl as HTMLElement, callbacks);
  }
}

export function applyLevelUpAtmosphere(root: ParentNode | null | undefined, atmosphereClass: string): void {
  const shell = root?.querySelector?.(".cc-wizard-shell") as HTMLElement | null;
  if (!shell) return;

  shell.classList.forEach((cls: string) => {
    if (cls.startsWith("cc-atmosphere--")) shell.classList.remove(cls);
  });
  shell.classList.add(atmosphereClass);
}

export function updateLevelUpWindowTitle(
  target: { title?: string },
  actor: FoundryDocument | null,
): void {
  if (actor?.name) {
    target.title = `Level Up — ${actor.name}`;
  }
}

export function setApplyLevelUpButtonPending(button: HTMLButtonElement | null): void {
  if (!button) return;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Applying...</span>';
}

export function resetApplyLevelUpButton(button: HTMLButtonElement | null): void {
  if (!button) return;
  button.disabled = false;
  button.innerHTML = '<i class="fa-solid fa-arrow-up"></i> <span>Apply Level Up</span>';
}
