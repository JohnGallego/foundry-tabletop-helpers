import { Log, MOD } from "./logger";
import type { PaperSize, PortraitMode, SheetType } from "./print-sheet/types";
import { getSectionDefaults } from "./print-sheet/section-definitions";
import {
  getGame,
  getSetting,
  setSetting,
  getCurrentUserId,
} from "./types";
import { registerSettingsMenus } from "./settings-menus";
import {
  registerCoreSettings,
  registerMenuBackingSettings,
  registerPrintSettings,
} from "./settings-registrations";
import { parseCsvSetting, parsePrintDefaults, printDefaultsSettingKey } from "./settings-utils";

export type RotMode = 90 | 180;

/** Who may access print/preview features */
export type PrintAccess = "everyone" | "gm";

/** Default print options structure */
export interface DefaultPrintOptions {
  paperSize: PaperSize;
  portrait: PortraitMode;
  sections: Record<string, boolean>;
}

/** Human-readable labels for sheet types */
const SHEET_TYPE_LABELS: Record<SheetType, string> = {
  character: "Character Sheet",
  npc: "NPC Stat Block",
  encounter: "Encounter Group",
  party: "Party Summary",
};

/** Get default print options for a sheet type */
export function getDefaultPrintOptions(sheetType: SheetType): DefaultPrintOptions {
  return {
    paperSize: "letter",
    portrait: sheetType === "character" || sheetType === "npc" ? "portrait" : "none",
    sections: getSectionDefaults(sheetType),
  };
}

export function registerSettings(): void {
  const game = getGame();
  const settings = game?.settings;
  if (!settings) return;

  registerCoreSettings(settings);
  registerPrintSettings(settings, getDefaultPrintOptions);
  registerMenuBackingSettings(settings);

  registerSettingsMenus(settings, {
    targetUserIds,
    rotateButtonPlayerIds,
    kioskPlayerIds,
    getDefaultPrintOptions,
    getPrintDefaults,
    sheetTypeLabels: SHEET_TYPE_LABELS,
  });
}


export const rotationMode = (): RotMode => {
  const v = getSetting<string>(MOD, "rotationMode");
  return Number(v) === 180 ? 180 : 90;
};

export const rotationLabel = () => (rotationMode() === 180 ? "Flip 180°" : "Rotate 90°");

export const animationsEnabled = (): boolean => {
  return getSetting<boolean>(MOD, "enableAnimations") ?? true;
};

export const supportV1 = (): boolean => {
  return getSetting<boolean>(MOD, "supportV1") ?? true;
};

export const targetUserIds = (): string[] => {
  return parseCsvSetting(getSetting<string>(MOD, "targetUserIds"));
};

/* ── Rotate Button Settings Getters ────────────────────────── */

export const rotateButtonPlayerIds = (): string[] => {
  return parseCsvSetting(getSetting<string>(MOD, "rotateButtonPlayerIds"));
};

/** Returns true if the current user should see the rotate button.
 *  All users (including GMs) must be explicitly enabled in the list. */
export const shouldShowRotateButton = (): boolean => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  return rotateButtonPlayerIds().includes(userId);
};

/* ── Kiosk Settings Getters ────────────────────────────────── */

export const kioskPlayerIds = (): string[] => {
  return parseCsvSetting(getSetting<string>(MOD, "kioskPlayerIds"));
};

export const isKioskPlayer = (): boolean => {
  const userId = getCurrentUserId();
  if (!userId) return false;
  return kioskPlayerIds().includes(userId);
};

export type KioskCanvasMode = "disable" | "low" | "none";

export const getKioskCanvasMode = (): KioskCanvasMode => {
  const v = getSetting<string>(MOD, "kioskCanvasMode") ?? "disable";
  if (v === "low" || v === "none") return v;
  return "disable";
};

/* ── Print Settings Getters ────────────────────────────────── */

/** Returns true if the current user is allowed to use print/preview features. */
export const canUsePrintFeature = (): boolean => {
  const access = getSetting<string>(MOD, "printAccess") ?? "everyone";
  if (access === "gm") {
    return getGame()?.user?.isGM ?? false;
  }
  return true;
};

export const showPrintOptionsDialog = (): boolean => {
  return getSetting<boolean>(MOD, "showPrintOptionsDialog") ?? true;
};

/** Get saved print defaults for a sheet type, or return standard defaults */
export const getPrintDefaults = (sheetType: SheetType): DefaultPrintOptions => {
  return parsePrintDefaults(
    getSetting<string>(MOD, printDefaultsSettingKey(sheetType)),
    getDefaultPrintOptions(sheetType),
  );
};

/** Save print defaults for a sheet type */
export const setPrintDefaults = async (sheetType: SheetType, options: DefaultPrintOptions): Promise<void> => {
  try {
    await setSetting(MOD, printDefaultsSettingKey(sheetType), JSON.stringify(options));
  } catch (e) {
    Log.warn(`Failed to save print defaults for ${sheetType}`, e);
  }
};
