import type { LevelUpState } from "./level-up-types";

import {
  isAsiLevel,
  isSubclassLevel,
} from "./level-up-detection";

export function recalculateLevelUpApplicableSteps(
  state: LevelUpState,
  allowMulticlass: boolean,
): void {
  const steps: string[] = [];
  const selections = state.selections;
  const classItems = state.classItems;

  steps.push("classChoice");
  steps.push("hp");
  steps.push("features");

  const chosenClass = selections.classChoice;
  const defaultClass = classItems[0];
  const classId = chosenClass?.classIdentifier ?? defaultClass?.identifier ?? "";
  const currentClassLevels = classItems.find((item) => item.identifier === classId)?.levels ?? 0;
  const newClassLevel = chosenClass?.mode === "multiclass" ? 1 : currentClassLevels + 1;

  const hasSubclass = classItems.find((item) => item.identifier === classId)?.subclassName;
  if (isSubclassLevel(classId, newClassLevel) && !hasSubclass) {
    steps.push("subclass");
  }

  if (isAsiLevel(classId, newClassLevel)) {
    steps.push("feats");
  }

  steps.push("spells");
  steps.push("review");

  state.applicableSteps = steps;
  state.currentStep = Math.min(state.currentStep, Math.max(0, steps.length - 1));

  void allowMulticlass;
}

export function buildLevelUpIndicatorData(
  state: LevelUpState,
): Array<{
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

  return state.applicableSteps.map((id, index) => ({
    id,
    label: labels[id] ?? id,
    icon: icons[id] ?? "fa-solid fa-circle",
    status: state.stepStatus.get(id) ?? "pending",
    active: index === state.currentStep,
    index,
  }));
}
