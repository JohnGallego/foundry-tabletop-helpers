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
import {
  buildStepIndicatorData,
  cascadeInvalidation,
  recalculateApplicableSteps,
} from "./wizard-state-machine-helpers";

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

    recalculateApplicableSteps(this.state, this._allSteps);
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

    let invalidated = new Set<string>();
    if (wasComplete) {
      invalidated = this._cascadeInvalidation(stepId);
    }

    // Always recalculate — new data may make previously-inapplicable steps applicable
    recalculateApplicableSteps(this.state, this._allSteps);
    return invalidated;
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
    recalculateApplicableSteps(this.state, this._allSteps);

    return invalidated;
  }

  /**
   * Invalidate all downstream steps that depend on the changed step.
   * Clears their selections and sets status to "pending".
   */
  private _cascadeInvalidation(changedStepId: string): Set<string> {
    const invalidated = cascadeInvalidation(this.state, changedStepId);
    for (const stepId of invalidated) {
      Log.debug(`Wizard: invalidated step "${stepId}" (cascade from "${changedStepId}")`);
    }
    return invalidated;
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
    return buildStepIndicatorData(this.state, (stepId) => this.getStepDef(stepId));
  }
}
