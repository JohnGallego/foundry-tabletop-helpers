import type { WizardShellContext, WizardStepDefinition } from "../character-creator-types";
import type { WizardStateMachine } from "./wizard-state-machine";

export async function buildWizardShellContext(
  machine: WizardStateMachine,
  stepDef: WizardStepDefinition | undefined,
  renderTemplateFn: (path: string, data: Record<string, unknown>) => Promise<string>,
  getStepAtmosphere: (stepId: string) => string,
): Promise<WizardShellContext> {
  let stepContentHtml = "";
  let vmData: Record<string, unknown> = {};

  if (stepDef) {
    vmData = await stepDef.buildViewModel(machine.state);
    stepContentHtml = await renderTemplateFn(stepDef.templatePath, vmData);
  }

  const headerTitle = vmData.stepTitle as string | undefined;
  const headerSubtitle = vmData.stepLabel as string | undefined;
  const headerDescription = vmData.stepDescription as string | undefined;
  const headerIcon = vmData.stepIcon as string | undefined;
  const selectedEntry = vmData.selectedEntry as { name: string; img: string; packLabel: string } | null | undefined;

  return {
    steps: machine.buildStepIndicatorData(),
    stepContentHtml,
    currentStepId: machine.currentStepId,
    currentStepLabel: stepDef?.label ?? "",
    currentStepIcon: stepDef?.icon ?? "",
    canGoBack: machine.canGoBack,
    canGoNext: machine.canGoNext,
    isReviewStep: machine.isReviewStep,
    statusHint: stepDef?.getStatusHint?.(machine.state) ?? "",
    atmosphereClass: getStepAtmosphere(machine.currentStepId),
    headerTitle,
    headerSubtitle,
    headerDescription,
    headerIcon,
    selectedEntry,
  };
}

export function patchWizardNavState(root: HTMLElement | null, machine: WizardStateMachine): void {
  const nextBtn = root?.querySelector("[data-action='goNext']") as HTMLButtonElement | null;
  if (nextBtn) nextBtn.disabled = !machine.canGoNext;

  const hintEl = root?.querySelector("[data-status-hint]");
  if (hintEl) {
    const curDef = machine.currentStepDef;
    hintEl.textContent = curDef?.getStatusHint?.(machine.state) ?? "";
  }
}

export function patchWizardStepIndicators(root: HTMLElement | null, machine: WizardStateMachine): void {
  const indicators = root?.querySelectorAll(".cc-step-indicator__step") as NodeListOf<HTMLElement> | undefined;
  if (!indicators) return;

  const stepData = machine.buildStepIndicatorData();
  for (let i = 0; i < indicators.length; i++) {
    const data = stepData[i];
    if (!data) continue;
    indicators[i].classList.toggle("cc-step-indicator__step--complete", data.status === "complete");
    indicators[i].classList.toggle("cc-step-indicator__step--pending", data.status === "pending");
    indicators[i].classList.toggle("cc-step-indicator__step--invalid", data.status === "invalid");
  }
}

export function applyWizardAtmosphere(root: ParentNode | null | undefined, atmosphereClass: string): void {
  const shell = root?.querySelector?.(".cc-wizard-shell") as HTMLElement | null;
  if (!shell) return;

  shell.classList.forEach((cls: string) => {
    if (cls.startsWith("cc-atmosphere--")) shell.classList.remove(cls);
  });
  shell.classList.add(atmosphereClass);
}

export function deactivateCurrentStep(
  stepDef: WizardStepDefinition | undefined,
  machine: WizardStateMachine,
  root: ParentNode | null | undefined,
): void {
  if (!stepDef?.onDeactivate) return;
  const stepEl = root?.querySelector?.(".cc-step-content");
  if (stepEl) stepDef.onDeactivate(machine.state, stepEl as HTMLElement);
}
