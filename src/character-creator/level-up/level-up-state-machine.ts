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
  isAsiLevel,
  isSubclassLevel,
} from "./level-up-detection";

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

    this._recalculateApplicableSteps(allowMulticlass);
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

  /* ── Step Applicability ───────────────────────────────── */

  private _recalculateApplicableSteps(_allowMulticlass: boolean): void {
    const steps: string[] = [];
    const sel = this.state.selections;
    const classItems = this.state.classItems;

    // Class Choice — always present (even single-class, to confirm which class to level)
    steps.push("classChoice");

    // HP — always
    steps.push("hp");

    // Features — always (may be empty if no features at this level)
    steps.push("features");

    // Determine which class is being leveled for conditional steps
    const chosenClass = sel.classChoice;
    const classId = chosenClass?.classIdentifier ?? classItems[0]?.identifier ?? "";
    const currentClassLevels = classItems.find((c) => c.identifier === classId)?.levels ?? 0;
    const newClassLevel = chosenClass?.mode === "multiclass" ? 1 : currentClassLevels + 1;

    // Subclass — if this level grants subclass selection and character doesn't have one yet
    const hasSubclass = classItems.find((c) => c.identifier === classId)?.subclassName;
    if (isSubclassLevel(classId, newClassLevel) && !hasSubclass) {
      steps.push("subclass");
    }

    // ASI/Feat — if this class level grants ASI
    if (isAsiLevel(classId, newClassLevel)) {
      steps.push("feats");
    }

    // Spells — always present (may show "no changes" if not a caster)
    steps.push("spells");

    // Review — always last
    steps.push("review");

    this.state.applicableSteps = steps;
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
    const labels: Record<string, string> = {
      classChoice: "Class",
      hp: "Hit Points",
      features: "Features",
      subclass: "Subclass",
      feats: "ASI / Feat",
      spells: "Spells",
      review: "Review",
    };

    const icons: Record<string, string> = {
      classChoice: "fa-solid fa-shield-halved",
      hp: "fa-solid fa-heart",
      features: "fa-solid fa-scroll",
      subclass: "fa-solid fa-book-sparkles",
      feats: "fa-solid fa-star",
      spells: "fa-solid fa-wand-sparkles",
      review: "fa-solid fa-clipboard-check",
    };

    return this.state.applicableSteps.map((id, index) => ({
      id,
      label: labels[id] ?? id,
      icon: icons[id] ?? "fa-solid fa-circle",
      status: this.getStepStatus(id),
      active: index === this.state.currentStep,
      index,
    }));
  }
}
