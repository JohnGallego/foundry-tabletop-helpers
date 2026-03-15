import {
  type SaveAbility,
  SAVE_ABILITIES,
  DND_CONDITIONS,
  type WorkflowType,
} from "../combat-types";

export function isDamageWorkflowDamageMode(mode: WorkflowType): boolean {
  return mode === "flatDamage" || mode === "saveForHalf" || mode === "saveOrNothing" || mode === "healing";
}

export function isDamageWorkflowSaveMode(mode: WorkflowType): boolean {
  return mode === "saveForHalf" || mode === "saveOrNothing" || mode === "saveForCondition";
}

export function isDamageWorkflowConditionMode(mode: WorkflowType): boolean {
  return mode === "saveForCondition" || mode === "removeCondition";
}

export function getDamageWorkflowPanelHTML(
  currentTokenCount: number,
  lastCondition: string,
  abilities: readonly SaveAbility[] = SAVE_ABILITIES,
): string {
  const abilityOptions = abilities
    .map((ability, index) => `<option value="${ability}"${index === 1 ? " selected" : ""}>${ability.toUpperCase()}</option>`)
    .join("");

  const conditionOptions = DND_CONDITIONS
    .map((condition) => `<option value="${condition.id}"${condition.id === lastCondition ? " selected" : ""}>${condition.label}</option>`)
    .join("");

  return `
    <div class="dwf-header" data-dwf-drag>
      <span class="dwf-title"><i class="fa-solid fa-bolt"></i> Quick Apply</span>
      <span class="dwf-target-count">${currentTokenCount} targets</span>
      <button class="dwf-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="dwf-body">
      <div class="dwf-damage-section">
        <div class="dwf-fast-row">
          <input type="number" id="dwf-amount" name="amount" min="1" value="" placeholder="0"
                 class="dwf-amount-input" autocomplete="off" />
          <button type="button" class="dwf-action-btn dwf-action-damage" data-action="damage">
            <i class="fa-solid fa-burst"></i> Dmg
          </button>
          <button type="button" class="dwf-action-btn dwf-action-heal" data-action="heal">
            <i class="fa-solid fa-heart-pulse"></i> Heal
          </button>
        </div>

        <div class="dwf-options-row">
          <input type="text" id="dwf-damage-type" name="damageType" placeholder="type (optional)"
                 class="dwf-damage-type-input" autocomplete="off" />
        </div>
      </div>

      <div class="dwf-mode-section">
        <div class="dwf-mode-group">
          <span class="dwf-mode-label">Damage</span>
          <div class="dwf-mode-tabs">
            <button type="button" class="dwf-mode-tab active" data-mode="flatDamage">Flat</button>
            <button type="button" class="dwf-mode-tab" data-mode="saveForHalf">Save ½</button>
            <button type="button" class="dwf-mode-tab" data-mode="saveOrNothing">Save / 0</button>
          </div>
        </div>
        <div class="dwf-mode-group">
          <span class="dwf-mode-label">Conditions</span>
          <div class="dwf-mode-tabs">
            <button type="button" class="dwf-mode-tab" data-mode="saveForCondition">Save+Cond</button>
            <button type="button" class="dwf-mode-tab" data-mode="removeCondition">Remove</button>
          </div>
        </div>
      </div>

      <div class="dwf-save-fields" style="display: none;">
        <div class="dwf-save-field">
          <label class="dwf-save-label" for="dwf-dc">DC</label>
          <input type="number" id="dwf-dc" name="dc" min="1" value="15" class="dwf-save-input" />
        </div>
        <div class="dwf-save-field">
          <label class="dwf-save-label" for="dwf-ability">Save</label>
          <select id="dwf-ability" name="ability" class="dwf-save-input">
            ${abilityOptions}
          </select>
        </div>
      </div>

      <div class="dwf-condition-fields" style="display: none;">
        <div class="dwf-save-field" style="width: 100%;">
          <label class="dwf-save-label" for="dwf-condition">Condition</label>
          <select id="dwf-condition" name="condition" class="dwf-save-input dwf-condition-select">
            ${conditionOptions}
          </select>
        </div>
      </div>

      <div class="dwf-condition-action" style="display: none;">
        <button type="button" class="dwf-action-btn dwf-action-apply" data-action="applyCondition">
          <i class="fa-solid fa-circle-plus"></i> Apply
        </button>
      </div>

      <div class="dwf-remove-action" style="display: none;">
        <button type="button" class="dwf-action-btn dwf-action-remove" data-action="removeCondition">
          <i class="fa-solid fa-circle-minus"></i> Remove
        </button>
      </div>
    </div>
  `;
}

export function updateDamageWorkflowPanelVisibility(el: HTMLElement, currentMode: WorkflowType): void {
  const damageSection = el.querySelector<HTMLElement>(".dwf-damage-section");
  const saveFields = el.querySelector<HTMLElement>(".dwf-save-fields");
  const conditionFields = el.querySelector<HTMLElement>(".dwf-condition-fields");
  const conditionAction = el.querySelector<HTMLElement>(".dwf-condition-action");
  const removeAction = el.querySelector<HTMLElement>(".dwf-remove-action");

  if (damageSection) damageSection.style.display = isDamageWorkflowDamageMode(currentMode) ? "" : "none";
  if (saveFields) saveFields.style.display = isDamageWorkflowSaveMode(currentMode) ? "" : "none";
  if (conditionFields) conditionFields.style.display = isDamageWorkflowConditionMode(currentMode) ? "" : "none";
  if (conditionAction) conditionAction.style.display = currentMode === "saveForCondition" ? "" : "none";
  if (removeAction) removeAction.style.display = currentMode === "removeCondition" ? "" : "none";
}
