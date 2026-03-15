/**
 * Level-Up Manager — State Machine
 *
 * Manages navigation and state for the level-up wizard.
 * Similar to WizardStateMachine but tailored for the level-up flow.
 */

import { Log } from "../../logger";
import type { FoundryDocument } from "../../types";
import type { LevelUpState } from "./level-up-types";
import {
  getTotalLevel,
  getClassItems,
} from "./level-up-detection";
import {
  buildLevelUpIndicatorData,
  recalculateLevelUpApplicableSteps,
} from "./level-up-state-machine-helpers";

/* ── Step IDs ───────────────────────────────────────────── */

/* ── State Machine ──────────────────────────────────────── */

export class LevelUpStateMachine {
  state: LevelUpState;

  constructor(actor: FoundryDocument, allowMulticlass: boolean) {
    const currentLevel = getTotalLevel(actor);
    const classItems = getClassItems(actor);

    this.state = {
      actorId: actor.id,
      currentLevel,
      targetLevel: currentLevel + 1,
      applicableSteps: [],
      currentStep: 0,
      selections: {},
      stepStatus: new Map(),
      classItems,
    };

    recalculateLevelUpApplicableSteps(this.state, allowMulticlass);
    Log.debug("LevelUpStateMachine: initialized", {
      currentLevel,
      targetLevel: this.state.targetLevel,
      classItems: classItems.map((c) => `${c.name} (L${c.levels})`),
      steps: this.state.applicableSteps,
    });
  }

  /* ── Getters ──────────────────────────────────────────── */

  get currentStepId(): string {
    return this.state.applicableSteps[this.state.currentStep] ?? "";
  }

  get canGoBack(): boolean {
    return this.state.currentStep > 0;
  }

  get canGoNext(): boolean {
    if (this.state.currentStep >= this.state.applicableSteps.length - 1) return false;
    const status = this.state.stepStatus.get(this.currentStepId);
    return status === "complete";
  }

  get isReviewStep(): boolean {
    return this.currentStepId === "review";
  }

  /* ── Navigation ───────────────────────────────────────── */

  goNext(): boolean {
    if (!this.canGoNext) return false;
    this.state.stepStatus.set(this.currentStepId, "complete");
    this.state.currentStep++;
    Log.debug(`LevelUp: → step ${this.currentStepId}`);
    return true;
  }

  goBack(): boolean {
    if (!this.canGoBack) return false;
    this.state.currentStep--;
    Log.debug(`LevelUp: ← step ${this.currentStepId}`);
    return true;
  }

  jumpTo(stepId: string): boolean {
    const idx = this.state.applicableSteps.indexOf(stepId);
    if (idx < 0) return false;
    this.state.currentStep = idx;
    Log.debug(`LevelUp: ⇢ step ${stepId}`);
    return true;
  }

  setStepData(stepId: string, value: unknown): void {
    this.state.selections[stepId] = value;
  }

  markComplete(stepId: string): void {
    this.state.stepStatus.set(stepId, "complete");
  }

  getStepStatus(stepId: string): "pending" | "complete" {
    return this.state.stepStatus.get(stepId) ?? "pending";
  }

  /** Build step indicator data for the shell template. */
  buildStepIndicatorData(): Array<{
    id: string;
    label: string;
    icon: string;
    status: "pending" | "complete";
    active: boolean;
    index: number;
  }> {
    return buildLevelUpIndicatorData(this.state);
  }
}
