import { describe, expect, it } from "vitest";

import {
  getDamageWorkflowPanelHTML,
  isDamageWorkflowConditionMode,
  isDamageWorkflowDamageMode,
  isDamageWorkflowSaveMode,
  updateDamageWorkflowPanelVisibility,
} from "./damage-workflow-dialog-helpers";

describe("damage workflow dialog helpers", () => {
  it("builds panel html with remembered condition and ability options", () => {
    const html = getDamageWorkflowPanelHTML(3, "prone");

    expect(html).toContain("Quick Apply");
    expect(html).toContain("3 targets");
    expect(html).toContain('value="dex" selected');
    expect(html).toContain('value="prone" selected');
    expect(html).toContain("Save+Cond");
  });

  it("classifies workflow modes", () => {
    expect(isDamageWorkflowDamageMode("flatDamage")).toBe(true);
    expect(isDamageWorkflowDamageMode("removeCondition")).toBe(false);
    expect(isDamageWorkflowSaveMode("saveForHalf")).toBe(true);
    expect(isDamageWorkflowSaveMode("healing")).toBe(false);
    expect(isDamageWorkflowConditionMode("saveForCondition")).toBe(true);
    expect(isDamageWorkflowConditionMode("saveOrNothing")).toBe(false);
  });

  it("updates field visibility for each mode", () => {
    const damageSection = { style: { display: "unset" } };
    const saveFields = { style: { display: "unset" } };
    const conditionFields = { style: { display: "unset" } };
    const conditionAction = { style: { display: "unset" } };
    const removeAction = { style: { display: "unset" } };
    const el = {
      querySelector(selector: string) {
        if (selector === ".dwf-damage-section") return damageSection;
        if (selector === ".dwf-save-fields") return saveFields;
        if (selector === ".dwf-condition-fields") return conditionFields;
        if (selector === ".dwf-condition-action") return conditionAction;
        if (selector === ".dwf-remove-action") return removeAction;
        return null;
      },
    } as unknown as HTMLElement;

    updateDamageWorkflowPanelVisibility(el, "saveForCondition");
    expect(damageSection.style.display).toBe("none");
    expect(saveFields.style.display).toBe("");
    expect(conditionFields.style.display).toBe("");
    expect(conditionAction.style.display).toBe("");
    expect(removeAction.style.display).toBe("none");

    updateDamageWorkflowPanelVisibility(el, "removeCondition");
    expect(saveFields.style.display).toBe("none");
    expect(conditionFields.style.display).toBe("");
    expect(conditionAction.style.display).toBe("none");
    expect(removeAction.style.display).toBe("");
  });
});
