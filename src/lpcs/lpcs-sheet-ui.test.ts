import { describe, expect, it } from "vitest";

import {
  buildSkillGroups,
  setLPCSVitalsView,
  switchLPCSTab,
  updateHPDrawerModeUI,
  updateHPDrawerPreview,
} from "./lpcs-sheet-ui";
import type { LPCSSkill } from "./lpcs-types";

describe("lpcs sheet ui helpers", () => {
  it("groups skills by proficiency", () => {
    const skills: LPCSSkill[] = [
      { key: "acr", label: "Acrobatics", ability: "DEX", profLevel: 2, mod: "+5", modValue: 5, passive: 15, proficient: true, isPassiveRelevant: false, profIcon: "", profCss: "", description: "", examples: [] },
      { key: "arc", label: "Arcana", ability: "INT", profLevel: 0, mod: "+1", modValue: 1, passive: 11, proficient: false, isPassiveRelevant: false, profIcon: "", profCss: "", description: "", examples: [] },
      { key: "ath", label: "Athletics", ability: "STR", profLevel: 1, mod: "+3", modValue: 3, passive: 13, proficient: true, isPassiveRelevant: false, profIcon: "", profCss: "", description: "", examples: [] },
    ];

    const groups = buildSkillGroups(skills, "proficiency");

    expect(groups.map((group) => group.label)).toEqual(["Proficient", "Other Skills"]);
    expect(groups[0]?.skills.map((skill) => skill.label)).toEqual(["Acrobatics", "Athletics"]);
    expect(groups[1]?.skills.map((skill) => skill.label)).toEqual(["Arcana"]);
  });

  it("updates drawer mode UI and preview text", () => {
    const modeButtons = [
      { dataset: { mode: "damage" }, classList: { toggle() {} }, setAttribute() {} },
      { dataset: { mode: "heal" }, classList: { toggle() {} }, setAttribute() {} },
    ];
    const applyButton = { textContent: "" };
    const amountInput = { value: "7" };
    const preview = { textContent: "" };
    const drawer = {
      dataset: {} as Record<string, string>,
      querySelectorAll(selector: string) {
        if (selector === "[data-mode]") return modeButtons;
        return [];
      },
      querySelector(selector: string) {
        if (selector === "[data-apply]") return applyButton;
        if (selector === "[data-amount]") return amountInput;
        if (selector === "[data-preview]") return preview;
        return null;
      },
    } as unknown as HTMLElement;

    updateHPDrawerModeUI(drawer, "damage");
    updateHPDrawerPreview(drawer, { value: 12, max: 20, temp: 3 }, "damage");

    expect(drawer.dataset.mode).toBe("damage");
    expect(applyButton.textContent).toBe("Apply Damage");
    expect(preview.textContent).toBe("HP 12->8  ·  Temp 3->0");
  });

  it("switches tabs and vitals state on existing elements", () => {
    const tabGroups = { primary: "combat" };
    const tabButton = {
      dataset: { tab: "skills" },
      classList: { toggle() {} },
      setAttribute() {},
    };
    const tabPanel = {
      dataset: { tab: "skills" },
      classList: { toggle() {} },
      removeAttribute() {},
      setAttribute() {},
    };
    const el = {
      querySelectorAll(selector: string) {
        if (selector === ".lpcs-tab-btn[data-tab]") return [tabButton];
        if (selector === ".lpcs-tab[data-tab]") return [tabPanel];
        return [];
      },
    } as unknown as HTMLElement;

    const hpView = { classList: { toggle() {} } } as unknown as HTMLElement;
    const dsView = { classList: { toggle() {} } } as unknown as HTMLElement;

    switchLPCSTab(el, "skills", tabGroups);
    setLPCSVitalsView(hpView, dsView, "ds");

    expect(tabGroups.primary).toBe("skills");
  });
});
