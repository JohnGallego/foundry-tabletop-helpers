import type { WorkflowType } from "../combat-types";

interface DamageWorkflowDialogInteractionOptions {
  onClose: () => void;
  onAction: (action: "damage" | "heal" | "applyCondition" | "removeCondition") => void;
  onModeChange: (mode: WorkflowType) => void;
  onConditionChange: (conditionId: string) => void;
}

export function attachDamageWorkflowPanelListeners(
  el: HTMLElement,
  options: DamageWorkflowDialogInteractionOptions,
): void {
  el.querySelector(".dwf-close")?.addEventListener("click", options.onClose);

  el.querySelector("[data-action='damage']")?.addEventListener("click", () => options.onAction("damage"));
  el.querySelector("[data-action='heal']")?.addEventListener("click", () => options.onAction("heal"));
  el.querySelector("[data-action='applyCondition']")?.addEventListener("click", () => options.onAction("applyCondition"));
  el.querySelector("[data-action='removeCondition']")?.addEventListener("click", () => options.onAction("removeCondition"));

  el.querySelector("#dwf-amount")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      options.onAction("damage");
    }
  });

  el.querySelector("#dwf-dc")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      const currentMode = el.querySelector<HTMLButtonElement>(".dwf-mode-tab.active")?.dataset.mode as WorkflowType | undefined;
      options.onAction(currentMode === "saveForCondition" ? "applyCondition" : "damage");
    }
  });

  const allModeTabs = el.querySelectorAll<HTMLButtonElement>(".dwf-mode-tab");
  allModeTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      allModeTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      options.onModeChange(tab.dataset.mode as WorkflowType);
    });
  });

  el.querySelector("#dwf-condition")?.addEventListener("change", (e) => {
    options.onConditionChange((e.target as HTMLSelectElement).value);
  });
}
