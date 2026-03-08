/**
 * Damage Workflow — Engine
 *
 * Core logic: rolls saves, computes damage/healing, applies HP changes,
 * handles condition application/removal, and auto-detects concentration checks.
 * Takes a WorkflowInput and array of token references, returns WorkflowResult.
 */

import { Log } from "../../logger";
import { getConfig, isObject } from "../../types";
import type {
  WorkflowInput,
  WorkflowTarget,
  WorkflowResult,
  ConcentrationCheck,
  SaveAbility,
} from "../combat-types";

/* ── Public API ───────────────────────────────────────────── */

/**
 * Execute a damage/save/healing/condition workflow against the given tokens.
 * Rolls saves (if applicable), computes damage, applies HP changes,
 * toggles conditions, and checks concentration.
 */
export async function executeWorkflow(
  input: WorkflowInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens: any[]
): Promise<WorkflowResult> {
  // Dispatch to the appropriate handler
  if (input.type === "removeCondition") {
    return executeRemoveCondition(input, tokens);
  }
  if (input.type === "saveForCondition") {
    return executeSaveForCondition(input, tokens);
  }
  return executeDamageWorkflow(input, tokens);
}

/* ── Damage/Heal/Save Workflows ──────────────────────────── */

async function executeDamageWorkflow(
  input: WorkflowInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens: any[]
): Promise<WorkflowResult> {
  const targets: WorkflowTarget[] = [];

  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;

    const system = actor.system as Record<string, unknown> | undefined;
    if (!system) continue;

    const attributes = system.attributes as Record<string, unknown> | undefined;
    const hpObj = attributes?.hp as Record<string, unknown> | undefined;
    const hpValue = typeof hpObj?.value === "number" ? hpObj.value : 0;
    const hpMax = typeof hpObj?.max === "number" ? hpObj.max : 1;

    const target: WorkflowTarget = {
      tokenId: typeof token.id === "string" ? token.id : "",
      actorId: typeof actor.id === "string" ? actor.id : "",
      name: typeof token.name === "string" ? token.name : (typeof actor.name === "string" ? actor.name : "Unknown"),
      damageApplied: 0,
      hpBefore: hpValue,
      hpMax,
      hpAfter: hpValue,
    };

    if (input.type === "healing") {
      const healed = Math.min(input.amount, hpMax - hpValue);
      target.damageApplied = -healed;
      target.hpAfter = Math.min(hpValue + input.amount, hpMax);
    } else if (input.type === "flatDamage") {
      target.damageApplied = Math.min(input.amount, hpValue);
      target.hpAfter = Math.max(0, hpValue - input.amount);
    } else {
      // Save-based damage workflows (saveForHalf, saveOrNothing)
      const ability = input.ability ?? "dex";
      const dc = input.dc ?? 10;

      const saveResult = await rollSave(actor, ability);
      target.saveRoll = saveResult.total;
      target.saveMod = saveResult.modifier;
      target.saveSuccess = saveResult.total >= dc;

      if (target.saveSuccess) {
        if (input.type === "saveForHalf") {
          const halfDmg = Math.floor(input.amount / 2);
          target.damageApplied = Math.min(halfDmg, hpValue);
          target.hpAfter = Math.max(0, hpValue - halfDmg);
        } else {
          target.damageApplied = 0;
          target.hpAfter = hpValue;
        }
      } else {
        target.damageApplied = Math.min(input.amount, hpValue);
        target.hpAfter = Math.max(0, hpValue - input.amount);
      }
    }

    targets.push(target);
  }

  // Apply all HP changes
  for (const target of targets) {
    if (target.hpBefore === target.hpAfter) continue;

    const token = tokens.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => (typeof t.id === "string" ? t.id : "") === target.tokenId
    );
    const actor = token?.actor;
    if (!actor || typeof actor.update !== "function") continue;

    try {
      await actor.update({ "system.attributes.hp.value": target.hpAfter });
    } catch (err) {
      Log.error(`Damage Workflow: failed to update HP for ${target.name}`, err);
    }
  }

  // Auto-detect concentration checks for damage workflows
  const concentrationChecks = input.type !== "healing"
    ? await checkConcentration(tokens, targets, input.amount)
    : undefined;

  return { input, targets, concentrationChecks };
}

/* ── Save for Condition ──────────────────────────────────── */

async function executeSaveForCondition(
  input: WorkflowInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens: any[]
): Promise<WorkflowResult> {
  const targets: WorkflowTarget[] = [];
  const ability = input.ability ?? "wis";
  const dc = input.dc ?? 10;
  const conditionId = input.conditionId ?? "frightened";

  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;

    const target: WorkflowTarget = {
      tokenId: typeof token.id === "string" ? token.id : "",
      actorId: typeof actor.id === "string" ? actor.id : "",
      name: typeof token.name === "string" ? token.name : (typeof actor.name === "string" ? actor.name : "Unknown"),
      damageApplied: 0,
      hpBefore: 0,
      hpMax: 0,
      hpAfter: 0,
    };

    const saveResult = await rollSave(actor, ability);
    target.saveRoll = saveResult.total;
    target.saveMod = saveResult.modifier;
    target.saveSuccess = saveResult.total >= dc;

    if (!target.saveSuccess) {
      // Failed save — apply condition
      try {
        if (typeof actor.toggleStatusEffect === "function") {
          await actor.toggleStatusEffect(conditionId, { active: true });
          target.conditionApplied = true;
        } else {
          Log.warn(`Damage Workflow: toggleStatusEffect not available for ${target.name}`);
          target.conditionSkipped = true;
        }
      } catch (err) {
        Log.error(`Damage Workflow: failed to apply condition to ${target.name}`, err);
        target.conditionSkipped = true;
      }
    }

    targets.push(target);
  }

  return { input, targets };
}

/* ── Remove Condition ────────────────────────────────────── */

async function executeRemoveCondition(
  input: WorkflowInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens: any[]
): Promise<WorkflowResult> {
  const targets: WorkflowTarget[] = [];
  const conditionId = input.conditionId ?? "prone";

  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;

    const target: WorkflowTarget = {
      tokenId: typeof token.id === "string" ? token.id : "",
      actorId: typeof actor.id === "string" ? actor.id : "",
      name: typeof token.name === "string" ? token.name : (typeof actor.name === "string" ? actor.name : "Unknown"),
      damageApplied: 0,
      hpBefore: 0,
      hpMax: 0,
      hpAfter: 0,
    };

    // Check if the actor actually has this condition
    const hasCondition = actorHasCondition(actor, conditionId);

    if (hasCondition) {
      try {
        if (typeof actor.toggleStatusEffect === "function") {
          await actor.toggleStatusEffect(conditionId, { active: false });
          target.conditionApplied = true; // true = action was taken (removed)
        } else {
          target.conditionSkipped = true;
        }
      } catch (err) {
        Log.error(`Damage Workflow: failed to remove condition from ${target.name}`, err);
        target.conditionSkipped = true;
      }
    } else {
      target.conditionSkipped = true; // didn't have it
    }

    targets.push(target);
  }

  return { input, targets };
}

/* ── Concentration Checks ────────────────────────────────── */

/**
 * After dealing damage, check if any damaged targets were concentrating.
 * Roll a CON save for each (DC = max(10, floor(damage/2))).
 * On failure, drop concentration.
 */
async function checkConcentration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens: any[],
  targets: WorkflowTarget[],
  _baseDamage: number
): Promise<ConcentrationCheck[] | undefined> {
  const checks: ConcentrationCheck[] = [];

  for (const target of targets) {
    // Only check targets that actually took damage
    if (target.damageApplied <= 0) continue;

    const token = tokens.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => (typeof t.id === "string" ? t.id : "") === target.tokenId
    );
    const actor = token?.actor;
    if (!actor) continue;

    // Check if concentrating
    if (!actorIsConcentrating(actor)) continue;

    // DC = max(10, floor(damage_taken / 2))
    const dc = Math.max(10, Math.floor(target.damageApplied / 2));

    // Roll CON save
    const saveResult = await rollSave(actor, "con");
    const success = saveResult.total >= dc;

    checks.push({
      name: target.name,
      roll: saveResult.total,
      dc,
      success,
    });

    // If failed, drop concentration
    if (!success) {
      try {
        if (typeof actor.toggleStatusEffect === "function") {
          await actor.toggleStatusEffect("concentrating", { active: false });
        }
      } catch (err) {
        Log.error(`Damage Workflow: failed to drop concentration for ${target.name}`, err);
      }
    }
  }

  return checks.length > 0 ? checks : undefined;
}

/* ── Actor Helpers ───────────────────────────────────────── */

/**
 * Check if an actor is currently concentrating.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actorIsConcentrating(actor: any): boolean {
  if (!actor.effects) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const effect of actor.effects) {
    if (effect.statuses?.has?.("concentrating")) return true;
  }
  return false;
}

/**
 * Check if an actor has a specific condition active.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actorHasCondition(actor: any, conditionId: string): boolean {
  if (!actor.effects) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const effect of actor.effects) {
    if (effect.statuses?.has?.(conditionId)) return true;
  }
  return false;
}

/* ── Save Rolling ─────────────────────────────────────────── */

interface SaveResult {
  total: number;
  modifier: number;
}

async function rollSave(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any,
  ability: SaveAbility
): Promise<SaveResult> {
  const abilities = actor.system?.abilities as Record<string, unknown> | undefined;
  const abilityData = abilities?.[ability] as Record<string, unknown> | undefined;

  let modifier = 0;
  if (typeof abilityData?.save === "number") {
    modifier = abilityData.save;
  } else if (isObject(abilityData?.save) && typeof (abilityData!.save as Record<string, unknown>).value === "number") {
    modifier = (abilityData!.save as Record<string, unknown>).value as number;
  } else if (typeof abilityData?.mod === "number") {
    modifier = abilityData.mod as number;
  }

  const rawDice = getConfig()?.Dice;
  const Dice = isObject(rawDice) ? rawDice : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const D20Roll = (Dice?.D20Roll as any) as
    | (new (formula: string, data: unknown, options: unknown) => {
        evaluate: () => Promise<unknown>;
        total: number;
      })
    | undefined;

  if (D20Roll) {
    const formula = `1d20 + ${modifier}`;
    const roll = new D20Roll(formula, {}, {});
    await roll.evaluate();
    return { total: roll.total ?? modifier, modifier };
  }

  Log.warn("Damage Workflow: D20Roll not available, using Math.random fallback");
  const d20 = Math.floor(Math.random() * 20) + 1;
  return { total: d20 + modifier, modifier };
}
