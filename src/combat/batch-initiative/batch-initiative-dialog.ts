/**
 * Batch Initiative — Advantage Dialog + Roll Caching
 *
 * Provides a compact 3-button advantage/disadvantage/normal dialog and
 * D20Roll caching helpers used by the Combat prototype wrappers in
 * combat-init.ts.
 *
 * Architecture:
 * - Combat.prototype.rollAll / rollNPC / rollPC are wrapped in combat-init.ts
 * - Wrapper calls showAdvantageDialog() to get the chosen mode
 * - Then calls cacheRollsOnCombatants() to pre-cache D20Rolls with that mode
 * - Then delegates to the original Combat method
 * - The cached rolls are picked up by actor.getInitiativeRoll()
 *
 * This module also exports rollPC() — a new method added to Combat.prototype
 * that rolls initiative for player-owned combatants only.
 */

import { Log } from "../../logger";
import { getConfig, isObject } from "../../types";
import { ADV_MODE, type AdvMode } from "../combat-types";

/* ── Advantage Dialog ─────────────────────────────────────── */

/**
 * Show a compact 3-button advantage dialog.
 * Returns the chosen AdvMode, or null if cancelled.
 *
 * @param scopeLabel  Description shown in the dialog (e.g. "Rolling for all combatants")
 */
export function showAdvantageDialog(scopeLabel: string): Promise<AdvMode | null> {
  return new Promise<AdvMode | null>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DialogClass = (globalThis as any).Dialog as
      | (new (
          data: Record<string, unknown>,
          options?: Record<string, unknown>
        ) => { render(force: boolean): void })
      | undefined;

    if (!DialogClass) {
      Log.warn("Advantage Dialog: Dialog class not available");
      resolve(null);
      return;
    }

    let resolved = false;
    const once = (value: AdvMode | null) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    const content = `<p class="batch-init-scope">${escapeHtml(scopeLabel)}</p>`;

    new DialogClass(
      {
        title: "Roll Initiative",
        content,
        buttons: {
          disadvantage: {
            icon: '<i class="fa-solid fa-angles-down"></i>',
            label: "Disadvantage",
            callback: () => once(ADV_MODE.DISADVANTAGE),
          },
          normal: {
            icon: '<i class="fa-solid fa-dice-d20"></i>',
            label: "Normal",
            callback: () => once(ADV_MODE.NORMAL),
          },
          advantage: {
            icon: '<i class="fa-solid fa-angles-up"></i>',
            label: "Advantage",
            callback: () => once(ADV_MODE.ADVANTAGE),
          },
        },
        default: "normal",
        close: () => once(null),
      },
      { classes: ["batch-initiative-dialog"], width: 320 }
    ).render(true);
  });
}

/* ── D20Roll Caching ──────────────────────────────────────── */

/**
 * Cache a D20Roll with the chosen advantage mode on each target combatant's
 * actor, so that when combat.rollInitiative() internally calls
 * actor.getInitiativeRoll(), the cached roll is used.
 *
 * This follows the same pattern as src/initiative/initiative-dialog.ts.
 *
 * @param combat    The active Combat document
 * @param filter    Predicate to select which combatants to cache for.
 *                  If omitted, caches for ALL combatants without initiative.
 * @param advMode   The advantage mode to apply
 */
export function cacheRollsOnCombatants(
  combat: Record<string, unknown>,
  advMode: AdvMode,
  filter?: (combatant: Record<string, unknown>) => boolean
): void {
  const rawDice = getConfig()?.Dice;
  const Dice = isObject(rawDice) ? rawDice : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const D20Roll = (Dice?.D20Roll as any) as
    | (new (formula: string, data: unknown, options: unknown) => unknown)
    | undefined;

  if (!D20Roll) {
    Log.warn("Batch Initiative: CONFIG.Dice.D20Roll not available");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combatants = (combat as any).combatants;
  if (!combatants) return;

  // Iterate via forEach (Foundry collections support it)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iterate = typeof combatants.forEach === "function"
    ? (cb: (c: Record<string, unknown>) => void) => combatants.forEach(cb)
    : (cb: (c: Record<string, unknown>) => void) => {
        for (const c of combatants) cb(c as Record<string, unknown>);
      };

  iterate((c: Record<string, unknown>) => {
    // Skip combatants that already have initiative (unless we want to re-roll)
    if (c.initiative !== null && c.initiative !== undefined) return;

    // Apply filter if provided
    if (filter && !filter(c)) return;

    const actor = c.actor as Record<string, unknown> | undefined;
    if (!actor) return;

    // Get the initiative roll config from the actor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getConfigFn = (actor as any).getInitiativeRollConfig;
    let rollConfig: Record<string, unknown> | undefined;

    if (typeof getConfigFn === "function") {
      try {
        rollConfig = getConfigFn.call(actor) as Record<string, unknown>;
      } catch {
        // Fallback: build manually
      }
    }

    // Build the D20Roll with advantage mode
    const parts =
      rollConfig && Array.isArray(rollConfig.parts)
        ? (rollConfig.parts as string[])
        : [];
    const data = rollConfig?.data ?? {};
    const options: Record<string, unknown> = isObject(rollConfig?.options)
      ? { ...(rollConfig!.options as Record<string, unknown>) }
      : {};
    options.advantageMode = advMode;

    // Check for fixed initiative (NPC score mode in dnd5e settings)
    if (options.fixed !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BasicRoll = (Dice?.BasicRoll as any) as
        | (new (formula: string, data: unknown, options: unknown) => unknown)
        | undefined;
      if (BasicRoll) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (actor as any)._cachedInitiativeRoll = new BasicRoll(
          String(options.fixed),
          data,
          options
        );
      }
    } else {
      const formula = ["1d20"].concat(parts).join(" + ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (actor as any)._cachedInitiativeRoll = new D20Roll(formula, data, options);
    }
  });
}

/**
 * Clean up cached initiative rolls on all combatant actors.
 * Called in a `finally` block after rolling to prevent stale caches.
 */
export function cleanupCachedRolls(combat: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combatants = (combat as any).combatants;
  if (!combatants) return;

  const cleanup = (c: Record<string, unknown>) => {
    const actor = c.actor as Record<string, unknown> | undefined;
    if (actor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (actor as any)._cachedInitiativeRoll;
    }
  };

  if (typeof combatants.forEach === "function") {
    combatants.forEach(cleanup);
  } else {
    for (const c of combatants) cleanup(c as Record<string, unknown>);
  }
}

/* ── Helpers ──────────────────────────────────────────────── */

/** Minimal HTML escaping for display strings. */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
