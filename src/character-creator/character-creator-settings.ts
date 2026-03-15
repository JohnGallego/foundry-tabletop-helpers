/**
 * Character Creator & Level-Up Manager — Settings
 *
 * Registers all module settings and provides typed accessors.
 * All CC settings are managed via a single settings submenu popup.
 * Called from Hooks.once("init") via src/index.ts.
 */

import { Log, MOD } from "../logger";
import { CC_SETTINGS } from "./character-creator-settings-shared";
import { registerCharacterCreatorSettingsMenus } from "./character-creator-settings-menus";
export { CC_SETTINGS } from "./character-creator-settings-shared";
export {
  allowCustomBackgrounds,
  allowMulticlass,
  ccAutoOpen,
  ccEnabled,
  ccLevelUpEnabled,
  getAllowedAbilityMethods,
  getDisabledContentUUIDs,
  getEquipmentMethod,
  getLevel1HpMethod,
  getMaxRerolls,
  getPackSources,
  getStartingLevel,
  setAllowedAbilityMethods,
  setDisabledContentUUIDs,
  setPackSources,
} from "./character-creator-settings-accessors";

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
    registerCharacterCreatorSettingsMenus(settings);

    Log.debug("Character Creator settings registered");
  } catch (err) {
    Log.warn("Character Creator: failed to register settings", err);
  }
}
