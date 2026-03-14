/**
 * Character Creator — Wizard State Machine
 *
 * Manages wizard navigation, step applicability, validation,
 * and dependency cascade invalidation.
 */

import { Log } from "../../logger";
import type {
  WizardState,
  WizardStepDefinition,
  StepStatus,
  GMConfig,
} from "../character-creator-types";

/* ── Dependency Cascade Map ──────────────────────────────── */

/**
 * When a step's selection changes, all downstream steps listed here
 * are invalidated (selections cleared, status → "pending").
 */
const DEPENDENCY_CASCADE: Record<string, string[]> = {
  species: [],
  background: ["backgroundGrants", "originFeat", "skills", "abilities"],
  backgroundGrants: [],
  class: ["subclass", "skills", "feats", "spells", "equipment"],
  subclass: ["spells"],
  abilities: ["feats"],
};

/* ── State Machine ───────────────────────────────────────── */

export class WizardStateMachine {
  /** Current wizard state — mutable, discarded on close. */
  state: WizardState;

  /** Registered step definitions in canonical order. */
  private _allSteps: WizardStepDefinition[];

  constructor(config: GMConfig, steps: WizardStepDefinition[]) {
    this._allSteps = steps;

    this.state = {
      currentStep: 0,
      applicableSteps: [],
      selections: {},
      stepStatus: new Map(),
      config,
    };

    this._recalculateApplicableSteps();
  }

  /* ── Getters ──────────────────────────────────────────── */

  /** The currently active step definition. */
  get currentStepDef(): WizardStepDefinition | undefined {
    const id = this.state.applicableSteps[this.state.currentStep];
    return this._allSteps.find((s) => s.id === id);
  }

  /** The current step's ID. */
  get currentStepId(): string {
    return this.state.applicableSteps[this.state.currentStep] ?? "";
  }

  /** Total number of applicable steps. */
  get stepCount(): number {
    return this.state.applicableSteps.length;
  }

  /** Whether we can navigate backward. */
  get canGoBack(): boolean {
    return this.state.currentStep > 0;
  }

  /** Whether we can navigate forward (current step must be complete or skippable). */
  get canGoNext(): boolean {
    const step = this.currentStepDef;
    if (!step) return false;
    if (this.state.currentStep >= this.stepCount - 1) return false;
    return step.isComplete(this.state);
  }

  /** Whether the current step is the review step. */
  get isReviewStep(): boolean {
    return this.currentStepId === "review";
  }

  /** Get status for a step by ID. */
  getStepStatus(stepId: string): StepStatus {
    return this.state.stepStatus.get(stepId) ?? "pending";
  }

  /** Get step definition by ID. */
  getStepDef(stepId: string): WizardStepDefinition | undefined {
    return this._allSteps.find((s) => s.id === stepId);
  }

  /* ── Navigation ───────────────────────────────────────── */

  /** Move to the next applicable step. Marks current step complete. Returns true if navigation occurred. */
  goNext(): boolean {
    if (!this.canGoNext) return false;
    this.state.stepStatus.set(this.currentStepId, "complete");
    this.state.currentStep++;
    Log.debug(`Wizard: → step ${this.currentStepId}`);
    return true;
  }

  /** Move to the previous applicable step. Returns true if navigation occurred. */
  goBack(): boolean {
    if (!this.canGoBack) return false;
    this.state.currentStep--;
    Log.debug(`Wizard: ← step ${this.currentStepId}`);
    return true;
  }

  /** Jump to a specific step by ID (used from review screen). Returns true if navigation occurred. */
  jumpTo(stepId: string): boolean {
    const idx = this.state.applicableSteps.indexOf(stepId);
    if (idx < 0) return false;
    this.state.currentStep = idx;
    Log.debug(`Wizard: ⇢ step ${stepId}`);
    return true;
  }

  /* ── Step Completion ──────────────────────────────────── */

  /** Mark a step as complete. */
  markComplete(stepId: string): void {
    this.state.stepStatus.set(stepId, "complete");
  }

  /** Mark a step as pending. */
  markPending(stepId: string): void {
    this.state.stepStatus.set(stepId, "pending");
  }

  /**
   * Store step data without marking complete.
   * If the step was previously completed, cascades downstream invalidation.
   */
  setStepData(stepId: string, value: unknown): Set<string> {
    const wasComplete = this.state.stepStatus.get(stepId) === "complete";
    this.state.selections[stepId] = value;

    if (wasComplete) {
      const invalidated = this._cascadeInvalidation(stepId);
      this._recalculateApplicableSteps();
      return invalidated;
    }
    return new Set();
  }

  /**
   * Update a step's selection and mark it complete, triggering dependency cascading.
   * Returns the set of invalidated step IDs.
   */
  updateSelection(stepId: string, value: unknown): Set<string> {
    this.state.selections[stepId] = value;
    this.state.stepStatus.set(stepId, "complete");

    // Cascade invalidation
    const invalidated = this._cascadeInvalidation(stepId);

    // Recalculate applicable steps (some steps may appear/disappear)
    this._recalculateApplicableSteps();

    return invalidated;
  }

  /* ── Internal ─────────────────────────────────────────── */

  /** Recalculate which steps are applicable based on current state. */
  private _recalculateApplicableSteps(): void {
    const previousId = this.currentStepId;
    this.state.applicableSteps = this._allSteps
      .filter((s) => s.isApplicable(this.state))
      .map((s) => s.id);

    // Try to maintain current position
    if (previousId) {
      const newIdx = this.state.applicableSteps.indexOf(previousId);
      if (newIdx >= 0) {
        this.state.currentStep = newIdx;
      } else {
        // Step disappeared — clamp to last valid
        this.state.currentStep = Math.min(
          this.state.currentStep,
          Math.max(0, this.state.applicableSteps.length - 1),
        );
      }
    }
  }

  /**
   * Invalidate all downstream steps that depend on the changed step.
   * Clears their selections and sets status to "pending".
   */
  private _cascadeInvalidation(changedStepId: string): Set<string> {
    const toInvalidate = new Set<string>();
    const queue = DEPENDENCY_CASCADE[changedStepId] ?? [];

    // BFS to collect all transitively dependent steps
    const visited = new Set<string>();
    const bfsQueue = [...queue];

    while (bfsQueue.length > 0) {
      const stepId = bfsQueue.shift()!;
      if (visited.has(stepId)) continue;
      visited.add(stepId);

      // Only invalidate if the step was previously completed
      if (this.state.stepStatus.get(stepId) === "complete") {
        toInvalidate.add(stepId);
      }

      // Continue cascade
      const downstream = DEPENDENCY_CASCADE[stepId] ?? [];
      bfsQueue.push(...downstream);
    }

    // Apply invalidation
    for (const stepId of toInvalidate) {
      this.state.selections[stepId] = undefined;
      this.state.stepStatus.set(stepId, "pending");
      Log.debug(`Wizard: invalidated step "${stepId}" (cascade from "${changedStepId}")`);
    }

    return toInvalidate;
  }

  /** Build the step indicator data for the shell template. */
  buildStepIndicatorData(): Array<{
    id: string;
    label: string;
    icon: string;
    status: StepStatus;
    active: boolean;
    index: number;
    number: number;
  }> {
    return this.state.applicableSteps.map((id, index) => {
      const def = this.getStepDef(id);
      return {
        id,
        label: def?.label ?? id,
        icon: def?.icon ?? "fa-solid fa-circle",
        status: this.getStepStatus(id),
        active: index === this.state.currentStep,
        index,
        number: index + 1,
      };
    });
  }
}
