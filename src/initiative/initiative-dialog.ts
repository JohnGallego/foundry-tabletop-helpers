/**
 * Custom Initiative Roll Dialog
 *
 * Replaces the default dnd5e initiative roll configuration dialog with a
 * streamlined 3-button prompt: Normal / Advantage / Disadvantage.
 *
 * Architecture:
 * - Hooks into `dnd5e.preRollInitiativeDialog` to cancel the default dialog.
 * - Asynchronously shows a custom Dialog, then manually creates and caches
 *   the D20Roll on the actor before calling rollInitiative() to complete the flow.
 *
 * @see https://github.com/foundryvtt/dnd5e/blob/master/module/documents/actor/actor.mjs
 * @see https://github.com/foundryvtt/dnd5e/blob/master/module/dice/basic-roll.mjs
 * @see https://github.com/foundryvtt/dnd5e/blob/master/module/dice/d20-roll.mjs
 */

import { Log, MOD } from "../logger";
import { getConfig, getGame, getHooks, getSetting, isDnd5eWorld, isObject } from "../types";

/* ── Setting Key ──────────────────────────────────────────── */

const KEY_ENABLED = "enableQuickInitiative";

/* ── ADV_MODE (mirrors D20Roll.ADV_MODE from dnd5e) ──────── */

const ADV_MODE = { NORMAL: 0, ADVANTAGE: 1, DISADVANTAGE: -1 } as const;
type AdvMode = (typeof ADV_MODE)[keyof typeof ADV_MODE];

/* ── Settings Registration ────────────────────────────────── */

/**
 * Register initiative feature settings.
 * Called from Hooks.once("init") via src/index.ts.
 */
export function registerInitiativeSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  try {
    settings.register(MOD, KEY_ENABLED, {
      name: "Quick Initiative Dialog",
      hint: "Replace the default initiative roll dialog with a simplified 3-button choice (Normal / Advantage / Disadvantage).",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
    });
    Log.debug("Initiative settings registered");
  } catch (err) {
    Log.warn("Initiative: failed to register settings", err);
  }
}

/* ── Setting Accessor ─────────────────────────────────────── */

/** Whether the quick initiative dialog is enabled for this client. */
function quickInitiativeEnabled(): boolean {
  return getSetting<boolean>(MOD, KEY_ENABLED) ?? true;
}

/* ── Hook Registration ────────────────────────────────────── */

/**
 * Register the dnd5e.preRollInitiativeDialog hook.
 * Called from Hooks.once("init") via src/index.ts.
 *
 * The hook fires inside BasicRoll.buildConfigure() before the default
 * D20RollConfigurationDialog opens. Returning `false` cancels that dialog
 * and causes buildConfigure() to return an empty rolls array.
 * We fire our own async dialog independently and complete the roll manually.
 *
 * Escape hatch: Foundry's Hooks.on callback is typed `(...args) => void` but
 * the runtime hook system checks for `false` return values. We cast via `any`
 * to satisfy TypeScript while returning `false` to cancel the default dialog.
 */
export function registerInitiativeHooks(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hooks = getHooks() as any;
  if (!hooks) return;

  hooks.on(
    "dnd5e.preRollInitiativeDialog",
    (config: unknown, _dialog: unknown, message: unknown): false | void => {
      if (!quickInitiativeEnabled()) return;
      if (!isDnd5eWorld()) return;

      const cfg = isObject(config) ? config : undefined;
      if (!cfg) return;

      // config.subject = the Actor5e instance
      const actor = isObject(cfg.subject) ? cfg.subject : undefined;
      // config.rolls[0] = D20RollConfiguration from getInitiativeRollConfig()
      const rollConfig =
        Array.isArray(cfg.rolls) && isObject(cfg.rolls[0])
          ? (cfg.rolls[0] as Record<string, unknown>)
          : undefined;

      if (!actor || !rollConfig) return;

      // Fire-and-forget: async completion runs after hook returns false
      void handleInitiativeDialog(actor, rollConfig, message);

      // Cancel the default D20RollConfigurationDialog
      return false;
    }
  );

  Log.debug("Initiative hooks registered");
}

/* ── Dialog Handler ───────────────────────────────────────── */

/**
 * Show the 3-button dialog and complete the initiative roll.
 * Runs asynchronously after the hook has returned false to cancel the default.
 */
async function handleInitiativeDialog(
  actor: Record<string, unknown>,
  rollConfig: Record<string, unknown>,
  message: unknown
): Promise<void> {
  const choice = await showThreeButtonDialog();
  if (choice === null) {
    Log.debug("Initiative: dialog cancelled — no roll");
    return;
  }

  Log.debug("Initiative: rolling with advantageMode", choice);

  // Build options, forwarding all existing options from getInitiativeRollConfig()
  const options: Record<string, unknown> = isObject(rollConfig.options)
    ? { ...rollConfig.options }
    : {};
  options.advantageMode = choice;

  const rawDice = getConfig()?.Dice;
  const Dice = isObject(rawDice) ? rawDice : undefined;

  try {
    if (options.fixed !== undefined) {
      // Fixed initiative score (NPC score mode or "all" mode in dnd5e settings).
      // Matches Actor5e.rollInitiativeDialog() line 1818.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BasicRoll = (Dice?.BasicRoll as any) as
        | (new (formula: string, data: unknown, options: unknown) => unknown)
        | undefined;
      if (!BasicRoll) {
        Log.warn("Initiative: CONFIG.Dice.BasicRoll not available");
        return;
      }
      actor._cachedInitiativeRoll = new BasicRoll(
        String(options.fixed),
        rollConfig.data,
        options
      );
    } else {
      // Normal D20 roll — matches Actor5e.getInitiativeRoll() lines 1719-1720.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const D20Roll = (Dice?.D20Roll as any) as
        | (new (formula: string, data: unknown, options: unknown) => unknown)
        | undefined;
      if (!D20Roll) {
        Log.warn("Initiative: CONFIG.Dice.D20Roll not available");
        return;
      }
      const parts = Array.isArray(rollConfig.parts)
        ? (rollConfig.parts as string[])
        : [];
      const formula = ["1d20"].concat(parts).join(" + ");
      actor._cachedInitiativeRoll = new D20Roll(formula, rollConfig.data, options);
    }
  } catch (err) {
    Log.error("Initiative: failed to create roll", err);
    return;
  }

  // Build message options — mirrors Actor5e.rollInitiativeDialog() line 1821.
  const rollMode = getGame()?.settings?.get("core", "rollMode") as string | undefined;
  const messageOptions: Record<string, unknown> = isObject(message) ? { ...message } : {};
  if (rollMode && !messageOptions.rollMode) {
    messageOptions.rollMode = rollMode;
  }

  try {
    // Call rollInitiative on the actor to evaluate and post the cached roll.
    // Matches Actor5e.rollInitiativeDialog() line 1821.
    const rollFn = typeof actor.rollInitiative === "function" ? actor.rollInitiative : undefined;
    if (!rollFn) {
      Log.warn("Initiative: actor.rollInitiative is not a function");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (rollFn as any).call(actor, {
      createCombatants: true,
      initiativeOptions: { messageOptions },
    });
  } catch (err) {
    Log.error("Initiative: rollInitiative failed", err);
  }
}

/* ── Custom 3-Button Dialog ───────────────────────────────── */

/**
 * Show the initiative choice dialog using Foundry's built-in Dialog class.
 * Resolves with the chosen ADV_MODE value, or null if cancelled/closed.
 */
function showThreeButtonDialog(): Promise<AdvMode | null> {
  return new Promise<AdvMode | null>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DialogClass = (globalThis as any).Dialog as
      | (new (
          data: Record<string, unknown>,
          options?: Record<string, unknown>
        ) => { render(force: boolean): void })
      | undefined;

    if (!DialogClass) {
      Log.warn("Initiative: Dialog class not available");
      resolve(null);
      return;
    }

    // Guard against multiple resolutions (e.g. button click + close both firing)
    let resolved = false;
    const once = (value: AdvMode | null) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    new DialogClass(
      {
        title: "Roll Initiative",
        content: ``,
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
      { classes: ["initiative-roll-dialog"], width: 320 }
    ).render(true);
  });
}


