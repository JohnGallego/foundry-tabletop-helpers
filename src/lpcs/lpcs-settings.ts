/**
 * LPCS-specific settings registration and accessors.
 * All settings access goes through this file — no scattered game.settings.get calls.
 *
 * @see src/settings.ts for the main module settings pattern
 */

import { Log, MOD } from "../logger";
import { getSetting } from "../types";

/* ── Setting Keys ─────────────────────────────────────────── */

const KEY_ENABLED = "lpcsEnabled";
const KEY_AUTO_OPEN = "lpcsAutoOpen";
const KEY_DEFAULT_TAB = "lpcsDefaultTab";
const KEY_DS_ROLL_MODE = "lpcsDeathSavesRollMode";

/* ── Roll Mode Types ──────────────────────────────────────── */

/** Whether a given action uses physical dice (manual entry) or digital (Foundry-rolled). */
export type RollMode = "physical" | "digital";
/** Maps action keys to their roll mode. Extensible for future action types. */
export type RollModes = Record<string, RollMode>;

/* ── Registration ─────────────────────────────────────────── */

/**
 * Register all LPCS settings.
 * Called from Hooks.once("init") via src/index.ts.
 *
 * @param settings - Foundry settings manager (game.settings)
 */
export function registerLPCSSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  try {
    settings.register(MOD, KEY_ENABLED, {
      name: "Live Play Sheet: Enable",
      hint: "Register the Live Play Character Sheet as an available sheet option for dnd5e characters.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, KEY_AUTO_OPEN, {
      name: "Live Play Sheet: Auto-Open",
      hint: "Automatically open the Live Play Sheet when a player logs in (if their character uses it).",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
    });

    settings.register(MOD, KEY_DEFAULT_TAB, {
      name: "Live Play Sheet: Default Tab",
      hint: "Which tab is shown first when the sheet opens.",
      scope: "client",
      config: true,
      type: String,
      choices: {
        skills: "Skills",
        combat: "Combat",
        spells: "Spells",
        inventory: "Inventory",
        features: "Features",
      },
      default: "combat",
    });

    settings.register(MOD, KEY_DS_ROLL_MODE, {
      name: "Live Play Sheet: Death Save Mode",
      hint: "Physical — tap the success/failure group to manually record dice results. Digital — use the Roll button and let Foundry handle the dice.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        digital: "Digital (Foundry rolls the dice)",
        physical: "Physical (tap to record manual results)",
      },
      default: "digital",
      restricted: true,
    });

    Log.debug("LPCS settings registered");
  } catch (err) {
    Log.warn("LPCS: failed to register settings", err);
  }
}

/* ── Accessors ────────────────────────────────────────────── */

/** Whether the LPCS feature is enabled for this world. */
export function lpcsEnabled(): boolean {
  return getSetting<boolean>(MOD, KEY_ENABLED) ?? true;
}

/** Whether to auto-open the sheet on player login. */
export function lpcsAutoOpen(): boolean {
  return getSetting<boolean>(MOD, KEY_AUTO_OPEN) ?? true;
}

/** The default tab to show on sheet open. */
export function lpcsDefaultTab(): string {
  return getSetting<string>(MOD, KEY_DEFAULT_TAB) ?? "combat";
}

/** Get the roll mode for a specific action key ("digital" if not explicitly set). */
export function getRollMode(actionKey: string): RollMode {
  if (actionKey === "deathSaves") {
    return (getSetting<string>(MOD, KEY_DS_ROLL_MODE) as RollMode | undefined) ?? "digital";
  }
  return "digital";
}

/** Returns true when the given action is configured for physical (manual) dice entry. */
export function isPhysicalMode(actionKey: string): boolean {
  return getRollMode(actionKey) === "physical";
}

