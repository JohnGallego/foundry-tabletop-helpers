/**
 * Asset Manager — Settings Registration
 *
 * Registers module settings for the asset manager feature.
 * Called from Hooks.once("init") via src/index.ts.
 */

import { Log, MOD } from "../logger";
import { getGame, getFormApplicationClass } from "../types";
import { DEFAULT_PRESETS, loadPresetsFromSettings, type OptPresetConfig } from "./asset-manager-upload";

/* ── Guards ───────────────────────────────────────────────── */

/** Check if the Asset Manager feature is enabled in settings. */
export function isAssetManagerEnabled(): boolean {
  try {
    const game = getGame();
    return !!game?.settings?.get?.(MOD, AM_SETTINGS.ENABLE);
  } catch { return false; }
}

/* ── Setting Keys ─────────────────────────────────────────── */

export const AM_SETTINGS = {
  /** Enable the asset manager as FilePicker replacement. */
  ENABLE: "enableAssetManager",
  /** Auto-optimize images on upload. */
  OPTIMIZE_ON_UPLOAD: "amOptimizeOnUpload",
  /** Default optimization preset. */
  DEFAULT_PRESET: "amDefaultPreset",
  /** Hidden: JSON blob for metadata backup (tags, folder memory, etc.). */
  METADATA_BACKUP: "amMetadataBackup",
  /** Server companion URL (e.g., http://localhost:7890). Empty = disabled. */
  OPTIMIZER_URL: "amOptimizerUrl",
  /** Server companion auth token. */
  OPTIMIZER_TOKEN: "amOptimizerToken",
  /** JSON: Custom optimization preset overrides. */
  PRESET_OVERRIDES: "amPresetOverrides",
} as const;

/* ── Registration ─────────────────────────────────────────── */

export function registerAssetManagerSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMenu(module: string, key: string, data: any): void;
}): void {
  try {
    settings.register(MOD, AM_SETTINGS.ENABLE, {
      name: "Asset Manager",
      hint: "Replace the default file picker with the enhanced Asset Manager. Provides thumbnails, virtual scrolling, and a dark arcane theme. Requires reload.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
      requiresReload: true,
    });

    settings.register(MOD, AM_SETTINGS.OPTIMIZE_ON_UPLOAD, {
      name: "Optimize on Upload",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.DEFAULT_PRESET, {
      name: "Default Optimization Preset",
      scope: "world",
      config: false,
      type: String,
      default: "auto",
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.OPTIMIZER_URL, {
      name: "Optimizer Server URL",
      scope: "world",
      config: false,
      type: String,
      default: "",
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.OPTIMIZER_TOKEN, {
      name: "Optimizer Server Token",
      scope: "world",
      config: false,
      type: String,
      default: "",
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.METADATA_BACKUP, {
      scope: "world",
      config: false,
      type: String,
      default: "",
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.PRESET_OVERRIDES, {
      scope: "world",
      config: false,
      type: String,
      default: "{}",
      restricted: true,
    });

    // Vault Settings submenu
    _registerVaultSettingsMenu(settings);

    Log.debug("Asset Manager settings registered");
  } catch (err) {
    Log.warn("Asset Manager: failed to register settings", err);
  }
}

/**
 * Load saved preset overrides into the active PRESETS object.
 * Call during the `ready` hook after settings are available.
 */
export function loadSavedPresets(): void {
  try {
    const game = getGame();
    const raw = game?.settings?.get?.(MOD, AM_SETTINGS.PRESET_OVERRIDES) as string | undefined;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed) {
        loadPresetsFromSettings(parsed);
        Log.debug("Asset Manager: loaded custom preset overrides");
      }
    }
  } catch {
    Log.debug("Asset Manager: no custom presets, using defaults");
  }
}

/* ── Vault Settings Menu ─────────────────────────────────── */

function _registerVaultSettingsMenu(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMenu(module: string, key: string, data: any): void;
}): void {
  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BaseWithDefaults = FormAppBase as any;

    class VaultSettingsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).foundry.utils.mergeObject(base, {
          id: `${MOD}-vault-settings`,
          title: "Asset Vault Settings",
          template: `modules/${MOD}/templates/asset-manager/am-vault-settings.hbs`,
          width: 520,
          height: "auto",
        }, { inplace: false });
      }

      async getData() {
        const game = getGame();
        const optimizeOnUpload = game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZE_ON_UPLOAD) ?? true;
        const optimizerUrl = game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_URL) ?? "";
        const optimizerToken = game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_TOKEN) ?? "";

        // Load current preset values (with overrides applied)
        let overrides: Record<string, OptPresetConfig> = {};
        try {
          const raw = game?.settings?.get?.(MOD, AM_SETTINGS.PRESET_OVERRIDES) as string;
          if (raw) overrides = JSON.parse(raw);
        } catch { /* use empty */ }

        const presetData = (["icon", "token", "portrait", "map"] as const).map((key) => {
          const defaults = DEFAULT_PRESETS[key];
          const current = overrides[key] ?? {};
          return {
            key,
            label: defaults.label,
            maxWidth: current.maxWidth ?? defaults.maxWidth,
            maxHeight: current.maxHeight ?? defaults.maxHeight,
            quality: Math.round((current.quality ?? defaults.quality) * 100),
          };
        });

        return { optimizeOnUpload, optimizerUrl, optimizerToken, presets: presetData };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async _updateObject(_event: Event, formData: Record<string, any>) {
        const game = getGame();
        if (!game?.settings) return;

        // Save general settings
        await game.settings.set(MOD, AM_SETTINGS.OPTIMIZE_ON_UPLOAD, !!formData.optimizeOnUpload);
        await game.settings.set(MOD, AM_SETTINGS.OPTIMIZER_URL, String(formData.optimizerUrl ?? "").trim());
        await game.settings.set(MOD, AM_SETTINGS.OPTIMIZER_TOKEN, String(formData.optimizerToken ?? "").trim());

        // Build preset overrides from form data
        const overrides: Record<string, Partial<OptPresetConfig>> = {};
        for (const key of ["icon", "token", "portrait", "map"]) {
          const maxW = parseInt(formData[`${key}_maxWidth`], 10);
          const maxH = parseInt(formData[`${key}_maxHeight`], 10);
          const quality = parseInt(formData[`${key}_quality`], 10);
          if (!isNaN(maxW) || !isNaN(maxH) || !isNaN(quality)) {
            overrides[key] = {};
            if (!isNaN(maxW) && maxW > 0) overrides[key].maxWidth = maxW;
            if (!isNaN(maxH) && maxH > 0) overrides[key].maxHeight = maxH;
            if (!isNaN(quality) && quality > 0 && quality <= 100) overrides[key].quality = quality / 100;
          }
        }

        await game.settings.set(MOD, AM_SETTINGS.PRESET_OVERRIDES, JSON.stringify(overrides));
        loadPresetsFromSettings(overrides as Record<string, OptPresetConfig>);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ui = (globalThis as any).ui;
        ui?.notifications?.info?.("Asset Vault settings saved.");
      }
    }

    settings.registerMenu(MOD, "amVaultSettingsMenu", {
      name: "Asset Vault",
      label: "Vault Settings",
      hint: "Configure optimization presets, server connection, and upload behavior.",
      icon: "fa-solid fa-vault",
      type: VaultSettingsForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Asset Manager: failed to register vault settings menu", e);
  }
}
