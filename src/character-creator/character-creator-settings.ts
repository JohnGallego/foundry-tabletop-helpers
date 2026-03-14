/**
 * Character Creator & Level-Up Manager — Settings
 *
 * Registers all module settings and provides typed accessors.
 * Called from Hooks.once("init") via src/index.ts.
 */

import { Log, MOD } from "../logger";
import { getSetting, setSetting } from "../types";
import type { AbilityScoreMethod, EquipmentMethod, HpMethod, PackSourceConfig } from "./character-creator-types";
import { DEFAULT_PACK_SOURCES } from "./data/dnd5e-constants";

/* ── Setting Keys ─────────────────────────────────────────── */

export const CC_SETTINGS = {
  /** Master enable toggle for character creator. */
  ENABLED: "ccEnabled",
  /** Auto-open wizard for characterless players. */
  AUTO_OPEN: "ccAutoOpen",
  /** Enable level-up feature. */
  LEVEL_UP_ENABLED: "ccLevelUpEnabled",
  /** JSON: Compendium pack source configuration. */
  PACK_SOURCES: "ccPackSources",
  /** JSON: Array of disabled item UUIDs. */
  DISABLED_CONTENT: "ccDisabledContent",
  /** JSON: Which ability score methods are available. */
  ALLOWED_ABILITY_METHODS: "ccAllowedAbilityMethods",
  /** Starting level for new characters. */
  STARTING_LEVEL: "ccStartingLevel",
  /** Allow multiclass during creation. */
  ALLOW_MULTICLASS: "ccAllowMulticlass",
  /** Equipment method: "equipment", "gold", or "both". */
  EQUIPMENT_METHOD: "ccEquipmentMethod",
  /** HP method at level 1: "max" or "roll". */
  LEVEL1_HP_METHOD: "ccLevel1HpMethod",
  /** JSON: Per-step and per-item artwork overrides. */
  ARTWORK_OVERRIDES: "ccArtworkOverrides",
  /** Allow players to swap the origin feat on backgrounds. */
  ALLOW_CUSTOM_BACKGROUNDS: "ccAllowCustomBackgrounds",
} as const;

/* ── Registration ─────────────────────────────────────────── */

export function registerCharacterCreatorSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  try {
    // Boolean settings (visible in config UI)
    settings.register(MOD, CC_SETTINGS.ENABLED, {
      name: "Character Creator",
      hint: "Enable the Character Creator & Level-Up Manager for this world.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.AUTO_OPEN, {
      name: "Auto-Open for New Players",
      hint: "Automatically open the character creator when a player logs in without an assigned character.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.LEVEL_UP_ENABLED, {
      name: "Level-Up Manager",
      hint: "Show a level-up button when characters have enough XP to advance.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    // Scalar settings (visible in config UI)
    settings.register(MOD, CC_SETTINGS.STARTING_LEVEL, {
      name: "Starting Level",
      hint: "Default starting level for new characters (1–20).",
      scope: "world",
      config: true,
      type: Number,
      default: 1,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ALLOW_MULTICLASS, {
      name: "Allow Multiclass at Creation",
      hint: "Allow players to multiclass during character creation (only relevant if starting above level 1).",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.EQUIPMENT_METHOD, {
      name: "Starting Equipment",
      hint: "How players choose starting equipment.",
      scope: "world",
      config: true,
      type: String,
      default: "both",
      choices: {
        equipment: "Equipment Packs Only",
        gold: "Starting Gold Only",
        both: "Player's Choice",
      },
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.LEVEL1_HP_METHOD, {
      name: "Level 1 Hit Points",
      hint: "How hit points are determined at level 1.",
      scope: "world",
      config: true,
      type: String,
      default: "max",
      choices: {
        max: "Maximum Hit Die",
        roll: "Roll Hit Die",
      },
      restricted: true,
    });

    // JSON blob settings (hidden from config UI, managed by GM Config App)
    settings.register(MOD, CC_SETTINGS.PACK_SOURCES, {
      scope: "world",
      config: false,
      type: String,
      default: "{}",
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.DISABLED_CONTENT, {
      scope: "world",
      config: false,
      type: String,
      default: "[]",
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS, {
      scope: "world",
      config: false,
      type: String,
      default: '["4d6","pointBuy","standardArray"]',
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS, {
      scope: "world",
      config: false,
      type: Boolean,
      default: false,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ARTWORK_OVERRIDES, {
      scope: "world",
      config: false,
      type: String,
      default: "{}",
      restricted: true,
    });

    Log.debug("Character Creator settings registered");
  } catch (err) {
    Log.warn("Character Creator: failed to register settings", err);
  }
}

/* ── Typed Accessors ──────────────────────────────────────── */

export function ccEnabled(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ENABLED) ?? true;
}

export function ccAutoOpen(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.AUTO_OPEN) ?? true;
}

export function ccLevelUpEnabled(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.LEVEL_UP_ENABLED) ?? true;
}

export function getPackSources(): PackSourceConfig {
  const raw = getSetting<string>(MOD, CC_SETTINGS.PACK_SOURCES) ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<PackSourceConfig>;
    // Fall back to SRD defaults if the parsed result has no configured packs
    if (!parsed || Object.keys(parsed).length === 0) return { ...DEFAULT_PACK_SOURCES };
    return {
      classes: parsed.classes ?? DEFAULT_PACK_SOURCES.classes,
      subclasses: parsed.subclasses ?? DEFAULT_PACK_SOURCES.subclasses,
      races: parsed.races ?? DEFAULT_PACK_SOURCES.races,
      backgrounds: parsed.backgrounds ?? DEFAULT_PACK_SOURCES.backgrounds,
      feats: parsed.feats ?? DEFAULT_PACK_SOURCES.feats,
      spells: parsed.spells ?? DEFAULT_PACK_SOURCES.spells,
      items: parsed.items ?? DEFAULT_PACK_SOURCES.items,
    };
  } catch {
    return { ...DEFAULT_PACK_SOURCES };
  }
}

export async function setPackSources(config: PackSourceConfig): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.PACK_SOURCES, JSON.stringify(config));
}

export function getDisabledContentUUIDs(): string[] {
  const raw = getSetting<string>(MOD, CC_SETTINGS.DISABLED_CONTENT) ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setDisabledContentUUIDs(uuids: string[]): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.DISABLED_CONTENT, JSON.stringify(uuids));
}

export function getAllowedAbilityMethods(): AbilityScoreMethod[] {
  const raw = getSetting<string>(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS) ?? '["4d6","pointBuy","standardArray"]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ["4d6", "pointBuy", "standardArray"];
  } catch {
    return ["4d6", "pointBuy", "standardArray"];
  }
}

export async function setAllowedAbilityMethods(methods: AbilityScoreMethod[]): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS, JSON.stringify(methods));
}

export function getStartingLevel(): number {
  const val = getSetting<number>(MOD, CC_SETTINGS.STARTING_LEVEL);
  return typeof val === "number" && val >= 1 && val <= 20 ? val : 1;
}

export function allowMulticlass(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_MULTICLASS) ?? false;
}

export function getEquipmentMethod(): EquipmentMethod {
  const val = getSetting<string>(MOD, CC_SETTINGS.EQUIPMENT_METHOD);
  if (val === "equipment" || val === "gold" || val === "both") return val;
  return "both";
}

export function getLevel1HpMethod(): HpMethod {
  const val = getSetting<string>(MOD, CC_SETTINGS.LEVEL1_HP_METHOD);
  if (val === "max" || val === "roll") return val;
  return "max";
}

export function allowCustomBackgrounds(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS) ?? false;
}
