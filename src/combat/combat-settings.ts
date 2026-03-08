/**
 * Combat Command Center — Settings Registration
 *
 * Registers all module settings for combat features:
 * - Advantage Initiative Dialog (Phase 1)
 * - Token Health Indicators (Phase 2) — placeholder
 * - Damage Workflows (Phase 3) — placeholder
 * - Monster Preview (Phase 4) — placeholder
 * - Party Summary (Phase 5) — placeholder
 */

import { Log, MOD } from "../logger";

/* ── Setting Keys ─────────────────────────────────────────── */

export const COMBAT_SETTINGS = {
  /** Show advantage/disadvantage dialog when batch-rolling initiative from the Combat Tracker. */
  ENABLE_ADVANTAGE_INITIATIVE: "enableAdvantageInitiative",
  /** Token health indicator visibility: "everyone", "gm", or "off". */
  TOKEN_HEALTH_VISIBILITY: "tokenHealthVisibility",
  /** Enable the Quick Damage/Save Workflows feature. */
  ENABLE_DAMAGE_WORKFLOWS: "enableDamageWorkflows",
  /** Auto-show damage panel when tokens are selected. */
  AUTO_DAMAGE_PANEL: "autoDamagePanel",
  /** Auto-show NPC stat block panel on their combat turn. */
  ENABLE_MONSTER_PREVIEW: "enableMonsterPreview",
  /** Enable the Party Summary quick-reference panel. */
  ENABLE_PARTY_SUMMARY: "enablePartySummary",
  /** Party source: "primaryParty" (dnd5e group) or "playerOwned" (all player-owned characters). */
  PARTY_SOURCE: "partySource",
  /** Enable the Quick Rules Reference panel. */
  ENABLE_RULES_REFERENCE: "enableRulesReference",
} as const;

/* ── Registration ─────────────────────────────────────────── */

/**
 * Register all combat feature settings.
 * Called from Hooks.once("init") via src/index.ts.
 */
export function registerCombatSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  try {
    settings.register(MOD, COMBAT_SETTINGS.ENABLE_ADVANTAGE_INITIATIVE, {
      name: "Advantage Initiative Dialog",
      hint: "Show a Normal / Advantage / Disadvantage dialog when using Roll All, Roll NPCs, or Roll PCs in the Combat Tracker. Also adds a Roll PCs button.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.TOKEN_HEALTH_VISIBILITY, {
      name: "Token Health Indicators",
      hint: "Show AC badge and health tier icon on NPC tokens. 'Everyone' shows to all players, 'GM Only' shows only to the GM, 'Off' disables indicators.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        everyone: "Everyone",
        gm: "GM Only",
        off: "Off",
      },
      default: "everyone",
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_DAMAGE_WORKFLOWS, {
      name: "Quick Damage/Save Workflows",
      hint: "Adds a token control button for quick damage, healing, and save workflows against selected tokens.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.AUTO_DAMAGE_PANEL, {
      name: "Auto-Show Damage Panel",
      hint: "Automatically show the Quick Damage panel when tokens are selected. When off, use the Combat Tracker button instead.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_MONSTER_PREVIEW, {
      name: "Combat Monster Preview",
      hint: "Auto-show NPC stat block panel during their combat turn. Includes an Up Next preview for the next combatant. GM only.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_PARTY_SUMMARY, {
      name: "Party Summary Panel",
      hint: "GM-only quick-reference panel showing PC stats, saves, and conditions. Toggle via Combat Tracker button or window.fth.partySummary().",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_RULES_REFERENCE, {
      name: "Quick Rules Reference",
      hint: "Floating D&D 5e (2024) rules reference panel. Toggle via Combat Tracker button, / keybind, or window.fth.rulesReference().",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.PARTY_SOURCE, {
      name: "Party Source",
      hint: "Where the Party Summary gets its members. 'Primary Party' uses the dnd5e assigned primary party group (falls back to player-owned if none is set). 'Player Owned' shows all player-owned characters.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        primaryParty: "Primary Party (dnd5e group)",
        playerOwned: "Player Owned Characters",
      },
      default: "primaryParty",
      restricted: true,
    });

    Log.debug("Combat settings registered");
  } catch (err) {
    Log.warn("Combat: failed to register settings", err);
  }
}
