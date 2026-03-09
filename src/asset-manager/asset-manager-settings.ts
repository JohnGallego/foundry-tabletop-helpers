/**
 * Asset Manager — Settings Registration
 *
 * Registers module settings for the asset manager feature.
 * Called from Hooks.once("init") via src/index.ts.
 */

import { Log, MOD } from "../logger";
import { getGame } from "../types";

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
} as const;

/* ── Registration ─────────────────────────────────────────── */

export function registerAssetManagerSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
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
      hint: "Automatically resize and convert images to WebP when uploading through the Asset Manager.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.DEFAULT_PRESET, {
      name: "Default Optimization Preset",
      hint: "Default preset for image optimization. Auto-detect guesses from filename and file size.",
      scope: "world",
      config: true,
      type: String,
      default: "auto",
      choices: {
        auto: "Auto-detect",
        token: "Token (400px)",
        portrait: "Portrait (800px)",
        map: "Map (original size)",
        icon: "Icon (128px)",
        none: "No optimization",
      },
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.OPTIMIZER_URL, {
      name: "Optimizer Server URL",
      hint: "URL of the FTH Optimizer server companion (e.g., http://your-server:7890). Leave empty to use client-side optimization only.",
      scope: "world",
      config: true,
      type: String,
      default: "",
      restricted: true,
    });

    settings.register(MOD, AM_SETTINGS.OPTIMIZER_TOKEN, {
      name: "Optimizer Server Token",
      hint: "Auth token for the FTH Optimizer server. Generated during server installation.",
      scope: "world",
      config: true,
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

    Log.debug("Asset Manager settings registered");
  } catch (err) {
    Log.warn("Asset Manager: failed to register settings", err);
  }
}
