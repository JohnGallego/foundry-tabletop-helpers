import { Log, MOD } from "./logger";
import type { PaperSize, PortraitMode, SheetType } from "./print-sheet/types";
import { getSectionDefaults, getSectionLabels, SECTION_DEFINITIONS } from "./print-sheet/section-definitions";
import type { Level } from "./logger";
import {
  getGame,
  getFormApplicationClass,
  getHandlebars,
  getUI,
  getPlayerUsers,
  getSetting,
  setSetting,
  getCurrentUserId,
} from "./types";

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

  // Log level
  settings.register(MOD, "logLevel", {
    name: "Log Level",
    hint: "Controls verbosity of console logs for Foundry Tabletop Helpers.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      silent: "silent",
      error: "error",
      warn: "warn",
      info: "info",
      debug: "debug",
    },
    default: "info",
    onChange: (v: unknown) => Log.setLevel(v as Level),
  });

  // Rotation mode (90/180)
  settings.register(MOD, "rotationMode", {
    name: "Rotation",
    hint: "How much each press rotates: 90° steps or 180° flip.",
    scope: "client",
    config: true,
    type: String,
    choices: { "90": "Rotate 90°", "180": "Flip 180°" },
    default: "90",
  });

  // Animations toggle
  settings.register(MOD, "enableAnimations", {
    name: "Animations",
    hint: "Enable snappy rotation animations with a polished easing curve.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // V1 application support (many core windows in v13 still use V1)
  settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows",
    hint: "Adds the rotation button to V1 application windows (JournalSheet, Compendium, etc). Recommended to keep enabled since many windows in Foundry v13 still use the V1 Application framework.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  /* ── Print Sheet Settings ─────────────────────────────────── */

  // Print access (GM-configurable, world-scoped)
  settings.register(MOD, "printAccess", {
    name: "Print Access",
    hint: "Control who can use the Print and Preview features. 'Everyone' lets players print their own characters. 'GM Only' hides the buttons for players.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      everyone: "Everyone",
      gm: "GM Only",
    },
    default: "everyone",
    restricted: true,
  });

  // Show print options dialog
  settings.register(MOD, "showPrintOptionsDialog", {
    name: "Show Print Options Dialog",
    hint: "When enabled, shows the print options dialog each time. When disabled, uses saved default options.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Default print options (stored as JSON, not shown in config UI)
  // Each sheet type has its own default options
  for (const sheetType of ["character", "npc", "encounter", "party"] as const) {
    settings.register(MOD, `printDefaults_${sheetType}`, {
      name: `Print Defaults (${sheetType})`,
      hint: `Default print options for ${sheetType} sheets.`,
      scope: "client",
      config: false,
      type: String,
      default: JSON.stringify(getDefaultPrintOptions(sheetType)),
    });
  }

  // Target players list (GM-only; stored as CSV; hidden - configured via submenu)
  settings.register(MOD, "targetUserIds", {
    name: "Target Players (storage)",
    hint: "Internal storage for selected player IDs.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  // GM-only submenu to configure target players with checkboxes
  try {
    // FormApplication inheritance requires careful typing - use base class pattern
    const FormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BaseWithDefaults = FormAppBase as any;
    class TargetPlayersForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        // foundry.utils.mergeObject is the canonical Foundry v13 pattern for defaultOptions.
        // inplace:false ensures the base class options object is not mutated.
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-target-players`,
          title: "Target Players",
          template: `modules/${MOD}/templates/target-users.hbs`,
          width: 420,
        }, {inplace: false});
      }
      async getData() {
        const selected = new Set(targetUserIds());
        const users = getPlayerUsers();
        return {
          users: users.map((u) => ({ id: u.id, name: u.name, selected: selected.has(u.id), isActive: u.active })),
        };
      }
      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const raw = formData["userIds"];
        const ids: string[] = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
        await setSetting(MOD, "targetUserIds", ids.join(","));
      }
    }

    settings.registerMenu(MOD, "targetUsersMenu", {
      name: "Target Players",
      label: "Configure",
      hint: "Choose which players are affected by rotation macros.",
      icon: "fa-solid fa-user-check",
      type: TargetPlayersForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Failed to register Target Players submenu", e);
  }

  /* ── Rotate Button Visibility ─────────────────────────────── */

  // Which players see the rotate button (GM-only; stored as CSV; hidden)
  settings.register(MOD, "rotateButtonPlayerIds", {
    name: "Rotate Button Players (storage)",
    hint: "Internal storage for player IDs who see the rotate button.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  // GM-only submenu to configure which players see the rotate button
  try {
    const RotBtnFormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RotBtnBaseWithDefaults = RotBtnFormAppBase as any;
    class RotateButtonPlayersForm extends RotBtnBaseWithDefaults {
      static get defaultOptions() {
        const base = RotBtnBaseWithDefaults.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-rotate-button-players`,
          title: "Rotate Button Players",
          template: `modules/${MOD}/templates/rotate-button-players.hbs`,
          width: 420,
        }, {inplace: false});
      }
      async getData() {
        const selected = new Set(rotateButtonPlayerIds());
        const users = getPlayerUsers();
        return {
          users: users.map((u) => ({ id: u.id, name: u.name, selected: selected.has(u.id), isActive: u.active })),
        };
      }
      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const raw = formData["userIds"];
        const ids: string[] = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
        await setSetting(MOD, "rotateButtonPlayerIds", ids.join(","));
      }
    }

    settings.registerMenu(MOD, "rotateButtonPlayersMenu", {
      name: "Rotate Button Players",
      label: "Configure",
      hint: "Choose which players see the rotation button on their windows.",
      icon: "fa-solid fa-arrows-rotate",
      type: RotateButtonPlayersForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Failed to register Rotate Button Players submenu", e);
  }

  /* ── Kiosk Mode Settings ──────────────────────────────────── */

  // Kiosk player IDs (GM-only; stored as CSV; hidden - configured via submenu)
  settings.register(MOD, "kioskPlayerIds", {
    name: "Kiosk Players (storage)",
    hint: "Internal storage for kiosk player IDs.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  // Kiosk canvas mode
  settings.register(MOD, "kioskCanvasMode", {
    name: "Kiosk Canvas Mode",
    hint: "Controls canvas behavior for kiosk players. 'Disable' prevents canvas from loading (best performance). 'Low' sets Foundry performance mode to Low. 'None' leaves the canvas unchanged.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      disable: "Disable Canvas",
      low: "Low Performance Mode",
      none: "Don't Touch Canvas",
    },
    default: "disable",
    restricted: true,
  });

  // GM-only submenu to configure kiosk players with checkboxes
  try {
    const KioskFormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const KioskBaseWithDefaults = KioskFormAppBase as any;
    class KioskPlayersForm extends KioskBaseWithDefaults {
      static get defaultOptions() {
        const base = KioskBaseWithDefaults.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-kiosk-players`,
          title: "Kiosk Players",
          template: `modules/${MOD}/templates/kiosk-players.hbs`,
          width: 420,
        }, {inplace: false});
      }
      async getData() {
        const selected = new Set(kioskPlayerIds());
        const users = getPlayerUsers();
        return {
          users: users.map((u) => ({ id: u.id, name: u.name, selected: selected.has(u.id), isActive: u.active })),
        };
      }
      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const raw = formData["userIds"];
        const ids: string[] = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
        await setSetting(MOD, "kioskPlayerIds", ids.join(","));
      }
    }

    settings.registerMenu(MOD, "kioskPlayersMenu", {
      name: "Kiosk Players",
      label: "Configure",
      hint: "Choose which players enter kiosk mode (full-screen sheet, hidden UI) on login.",
      icon: "fa-solid fa-tv",
      type: KioskPlayersForm,
      restricted: true,
    });
  } catch (e) {
    Log.warn("Failed to register Kiosk Players submenu", e);
  }

  // Print Defaults submenu
  try {
    // FormApplication inheritance requires careful typing - use base class pattern
    const FormAppBase = getFormApplicationClass() ?? class {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BaseWithDefaults = FormAppBase as any;

    // Register Handlebars helper for equality check
    const Hbs = getHandlebars();
    if (Hbs && !Hbs.helpers?.eq) {
      Hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);
    }

    class PrintDefaultsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        // foundry.utils.mergeObject is the canonical Foundry v13 pattern for defaultOptions.
        // inplace:false ensures the base class options object is not mutated.
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-print-defaults`,
          title: "Print Defaults",
          template: `modules/${MOD}/templates/print-defaults.hbs`,
          width: 520,
          height: "auto",
        }, {inplace: false});
      }

      async getData() {
        const sheetTypes = (["character", "npc", "encounter", "party"] as SheetType[]).map((key) => {
          const defaults = getPrintDefaults(key);
          const labels = getSectionLabels(key);
          return {
            key,
            label: SHEET_TYPE_LABELS[key],
            paperSize: defaults.paperSize,
            portrait: defaults.portrait,
            showPortrait: key === "character" || key === "npc",
            sections: SECTION_DEFINITIONS[key].map((s) => ({
              key: s.key,
              label: labels[s.key] ?? s.key,
              checked: defaults.sections[s.key] ?? s.default,
            })),
          };
        });
        return { sheetTypes };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        for (const sheetType of ["character", "npc", "encounter", "party"] as SheetType[]) {
          const paperSize = (formData[`${sheetType}_paperSize`] as PaperSize) ?? "letter";
          const portrait = (formData[`${sheetType}_portrait`] as PortraitMode) ?? "portrait";
          const sections: Record<string, boolean> = {};
          for (const s of SECTION_DEFINITIONS[sheetType]) {
            sections[s.key] = !!formData[`${sheetType}_section_${s.key}`];
          }
          const options: DefaultPrintOptions = { paperSize, portrait, sections };
          await setSetting(MOD, `printDefaults_${sheetType}`, JSON.stringify(options));
        }
        getUI()?.notifications?.info?.("Print defaults saved.");
      }
    }

    settings.registerMenu(MOD, "printDefaultsMenu", {
      name: "Print Defaults",
      label: "Configure",
      hint: "Set default print options for each sheet type (paper size, image, sections).",
      icon: "fa-solid fa-print",
      type: PrintDefaultsForm,
      restricted: false,
    });
  } catch (e) {
    Log.warn("Failed to register Print Defaults submenu", e);
  }
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
  const raw = getSetting<string>(MOD, "targetUserIds") ?? "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
};

/* ── Rotate Button Settings Getters ────────────────────────── */

export const rotateButtonPlayerIds = (): string[] => {
  const raw = getSetting<string>(MOD, "rotateButtonPlayerIds") ?? "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
};

/** Returns true if the current user should see the rotate button.
 *  GMs always see it; players only if they are in the list. */
export const shouldShowRotateButton = (): boolean => {
  if (getGame()?.user?.isGM) return true;
  const userId = getCurrentUserId();
  if (!userId) return false;
  return rotateButtonPlayerIds().includes(userId);
};

/* ── Kiosk Settings Getters ────────────────────────────────── */

export const kioskPlayerIds = (): string[] => {
  const raw = getSetting<string>(MOD, "kioskPlayerIds") ?? "";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
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
  try {
    const raw = getSetting<string>(MOD, `printDefaults_${sheetType}`);
    if (raw) {
      return JSON.parse(raw) as DefaultPrintOptions;
    }
  } catch {
    // Fall through to default
  }
  return getDefaultPrintOptions(sheetType);
};

/** Save print defaults for a sheet type */
export const setPrintDefaults = async (sheetType: SheetType, options: DefaultPrintOptions): Promise<void> => {
  try {
    await setSetting(MOD, `printDefaults_${sheetType}`, JSON.stringify(options));
  } catch (e) {
    Log.warn(`Failed to save print defaults for ${sheetType}`, e);
  }
};


