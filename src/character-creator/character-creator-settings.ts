/**
 * Character Creator & Level-Up Manager — Settings
 *
 * Registers all module settings and provides typed accessors.
 * All CC settings are managed via a single settings submenu popup.
 * Called from Hooks.once("init") via src/index.ts.
 */

import { Log, MOD } from "../logger";
import { getFormApplicationClass, getGame, getSetting, setSetting, getUI } from "../types";
import type { AbilityScoreMethod, EquipmentMethod, HpMethod, PackSourceConfig } from "./character-creator-types";
import { DEFAULT_PACK_SOURCES } from "./data/dnd5e-constants";
import { compendiumIndexer } from "./data/compendium-indexer";

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
  /** Max number of 4d6 rerolls allowed (0 = unlimited). */
  MAX_REROLLS: "ccMaxRerolls",
  /** Allow players to swap the origin feat on backgrounds. */
  ALLOW_CUSTOM_BACKGROUNDS: "ccAllowCustomBackgrounds",
  /** JSON: Per-step and per-item artwork overrides. */
  ARTWORK_OVERRIDES: "ccArtworkOverrides",
} as const;

/* ── Registration ─────────────────────────────────────────── */

export function registerCharacterCreatorSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMenu(module: string, key: string, data: any): void;
}): void {
  try {
    // All settings are config: false — managed via the submenu popup
    settings.register(MOD, CC_SETTINGS.ENABLED, {
      name: "Character Creator",
      hint: "Enable the Character Creator & Level-Up Manager for this world.",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.AUTO_OPEN, {
      name: "Auto-Open for New Players",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.LEVEL_UP_ENABLED, {
      name: "Level-Up Manager",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.STARTING_LEVEL, {
      name: "Starting Level",
      scope: "world",
      config: false,
      type: Number,
      default: 1,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ALLOW_MULTICLASS, {
      name: "Allow Multiclass at Creation",
      scope: "world",
      config: false,
      type: Boolean,
      default: false,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.EQUIPMENT_METHOD, {
      name: "Starting Equipment",
      scope: "world",
      config: false,
      type: String,
      default: "both",
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.LEVEL1_HP_METHOD, {
      name: "Level 1 Hit Points",
      scope: "world",
      config: false,
      type: String,
      default: "max",
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.MAX_REROLLS, {
      name: "Max 4d6 Rerolls",
      scope: "world",
      config: false,
      type: Number,
      default: 0,
      restricted: true,
    });

    settings.register(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS, {
      scope: "world",
      config: false,
      type: Boolean,
      default: false,
      restricted: true,
    });

    // JSON blob settings (managed by GM Config App)
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

    settings.register(MOD, CC_SETTINGS.ARTWORK_OVERRIDES, {
      scope: "world",
      config: false,
      type: String,
      default: "{}",
      restricted: true,
    });

    // Settings submenu popups — GM only
    _registerSettingsMenu(settings);
    _registerCompendiumSelectMenu(settings);

    Log.debug("Character Creator settings registered");
  } catch (err) {
    Log.warn("Character Creator: failed to register settings", err);
  }
}

/* ── Settings Menu (FormApplication popup) ────────────────── */

function _registerSettingsMenu(settings: {
  registerMenu(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BaseWithDefaults = FormAppBase as any;

    class CharacterCreatorSettingsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-cc-settings`,
          title: "Character Creator Settings",
          template: `modules/${MOD}/templates/character-creator/cc-settings.hbs`,
          width: 480,
          height: "auto",
        }, { inplace: false });
      }

      async getData() {
        const methods = getAllowedAbilityMethods();
        return {
          ccEnabled: ccEnabled(),
          ccAutoOpen: ccAutoOpen(),
          ccLevelUpEnabled: ccLevelUpEnabled(),
          method_4d6: methods.includes("4d6"),
          method_pointBuy: methods.includes("pointBuy"),
          method_standardArray: methods.includes("standardArray"),
          maxRerolls: getMaxRerolls(),
          startingLevel: getStartingLevel(),
          allowMulticlass: allowMulticlass(),
          equipmentMethod: getEquipmentMethod(),
          level1HpMethod: getLevel1HpMethod(),
        };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        // Build ability methods array — enforce at least one
        const methods: AbilityScoreMethod[] = [];
        if (formData.method_4d6) methods.push("4d6");
        if (formData.method_pointBuy) methods.push("pointBuy");
        if (formData.method_standardArray) methods.push("standardArray");

        if (methods.length === 0) {
          getUI()?.notifications?.warn?.("At least one ability score method must be enabled. Defaulting to Roll 4d6.");
          methods.push("4d6");
        }

        // Clamp starting level
        const rawLevel = Number(formData.startingLevel) || 1;
        const startingLevel = Math.max(1, Math.min(20, rawLevel));

        // Clamp max rerolls
        const rawRerolls = Number(formData.maxRerolls) || 0;
        const maxRerolls = Math.max(0, Math.floor(rawRerolls));

        await Promise.all([
          setSetting(MOD, CC_SETTINGS.ENABLED, !!formData.ccEnabled),
          setSetting(MOD, CC_SETTINGS.AUTO_OPEN, !!formData.ccAutoOpen),
          setSetting(MOD, CC_SETTINGS.LEVEL_UP_ENABLED, !!formData.ccLevelUpEnabled),
          setSetting(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS, JSON.stringify(methods)),
          setSetting(MOD, CC_SETTINGS.MAX_REROLLS, maxRerolls),
          setSetting(MOD, CC_SETTINGS.STARTING_LEVEL, startingLevel),
          setSetting(MOD, CC_SETTINGS.ALLOW_MULTICLASS, !!formData.allowMulticlass),
          setSetting(MOD, CC_SETTINGS.EQUIPMENT_METHOD, String(formData.equipmentMethod || "both")),
          setSetting(MOD, CC_SETTINGS.LEVEL1_HP_METHOD, String(formData.level1HpMethod || "max")),
        ]);

        getUI()?.notifications?.info?.("Character Creator settings saved.");
      }
    }

    settings.registerMenu(MOD, "ccSettingsMenu", {
      name: "Character Creator",
      label: "Configure",
      hint: "Configure character creation rules, ability score methods, and level-up options.",
      icon: "fa-solid fa-hat-wizard",
      type: CharacterCreatorSettingsForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Character Creator: failed to register settings menu", e);
  }
}

/* ── Compendium Pack Selection Menu ────────────────────────── */

/** The dnd5e item types we look for when scanning packs. */
const CONTENT_TYPE_ITEM_TYPES: Record<string, { types: Set<string>; label: string }> = {
  classes: { types: new Set(["class"]), label: "Classes" },
  subclasses: { types: new Set(["subclass"]), label: "Subclasses" },
  races: { types: new Set(["race"]), label: "Species / Races" },
  backgrounds: { types: new Set(["background"]), label: "Backgrounds" },
  feats: { types: new Set(["feat"]), label: "Feats" },
  spells: { types: new Set(["spell"]), label: "Spells" },
  items: { types: new Set(["weapon", "equipment", "consumable", "tool", "loot"]), label: "Equipment" },
};

interface DetectedPack {
  collection: string;
  label: string;
  packageName: string;
  count: number;
  enabled: boolean;
}

/**
 * Scan all installed compendium packs and detect which content types they contain.
 */
async function detectPacks(
  sourceKey: string,
  currentSources: string[],
): Promise<DetectedPack[]> {
  const game = getGame();
  if (!game?.packs) return [];

  const info = CONTENT_TYPE_ITEM_TYPES[sourceKey];
  if (!info) return [];

  const enabledSet = new Set(currentSources);
  const results: DetectedPack[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const pack of game.packs as any) {
    // Only scan Item compendiums
    if (pack.documentName !== "Item") continue;

    try {
      const index = await pack.getIndex({ fields: ["type"] });
      let count = 0;
      for (const entry of index) {
        if (info.types.has(entry.type as string)) count++;
      }
      if (count === 0) continue;

      const collection = pack.collection ?? pack.metadata?.id ?? "";
      results.push({
        collection,
        label: pack.metadata?.label ?? collection,
        packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? "unknown",
        count,
        enabled: enabledSet.has(collection),
      });
    } catch {
      // Skip packs that fail to index
    }
  }

  return results;
}

function _registerCompendiumSelectMenu(settings: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMenu(module: string, key: string, data: any): void;
}): void {
  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BaseWithDefaults = FormAppBase as any;

    class CompendiumSelectForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-cc-compendium-select`,
          title: "Character Creator — Compendium Sources",
          template: `modules/${MOD}/templates/character-creator/cc-compendium-select.hbs`,
          width: 560,
          height: "auto",
        }, { inplace: false });
      }

      async getData() {
        const currentSources = getPackSources();
        const groups: Array<{
          type: string;
          label: string;
          packs: DetectedPack[];
        }> = [];

        for (const [sourceKey, info] of Object.entries(CONTENT_TYPE_ITEM_TYPES)) {
          const currentIds = currentSources[sourceKey as keyof PackSourceConfig] ?? [];
          const packs = await detectPacks(sourceKey, currentIds);
          groups.push({ type: sourceKey, label: info.label, packs });
        }

        return { groups };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const newSources: Record<string, string[]> = {
          classes: [],
          subclasses: [],
          races: [],
          backgrounds: [],
          feats: [],
          spells: [],
          items: [],
        };

        for (const [key, value] of Object.entries(formData)) {
          if (!key.startsWith("pack__") || !value) continue;
          // key format: pack__<sourceKey>__<collection>
          const parts = key.split("__");
          if (parts.length < 3) continue;
          const sourceKey = parts[1];
          const collection = parts.slice(2).join("__"); // collection may contain __
          if (newSources[sourceKey]) {
            newSources[sourceKey].push(collection);
          }
        }

        await setPackSources(newSources as unknown as PackSourceConfig);

        // Invalidate the indexer cache so next wizard open re-indexes
        compendiumIndexer.invalidate();

        getUI()?.notifications?.info?.("Compendium sources updated. Changes take effect on next wizard open.");
      }
    }

    settings.registerMenu(MOD, "ccCompendiumSelectMenu", {
      name: "Compendium Sources",
      label: "Select Compendiums",
      hint: "Choose which compendium packs provide classes, species, backgrounds, feats, and spells for the character creator.",
      icon: "fa-solid fa-book-open",
      type: CompendiumSelectForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Character Creator: failed to register compendium select menu", e);
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

/** Max rerolls for 4d6 method. 0 = unlimited. */
export function getMaxRerolls(): number {
  const val = getSetting<number>(MOD, CC_SETTINGS.MAX_REROLLS);
  return typeof val === "number" && val >= 0 ? val : 0;
}

export function allowCustomBackgrounds(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS) ?? false;
}
