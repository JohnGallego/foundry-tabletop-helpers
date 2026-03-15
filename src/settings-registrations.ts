import { Log, MOD } from "./logger";
import type { Level } from "./logger";
import type { SheetType } from "./print-sheet/types";

import type { DefaultPrintOptions } from "./settings";
import { printDefaultsSettingKey } from "./settings-utils";

export interface SettingsRegistrar {
  register(module: string, key: string, data: Record<string, unknown>): void;
}

export function registerCoreSettings(settings: SettingsRegistrar): void {
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
    onChange: (value: unknown) => Log.setLevel(value as Level),
  });

  settings.register(MOD, "rotationMode", {
    name: "Rotation",
    hint: "How much each press rotates: 90° steps or 180° flip.",
    scope: "client",
    config: true,
    type: String,
    choices: { "90": "Rotate 90°", "180": "Flip 180°" },
    default: "90",
  });

  settings.register(MOD, "enableAnimations", {
    name: "Animations",
    hint: "Enable snappy rotation animations with a polished easing curve.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows",
    hint: "Adds the rotation button to V1 application windows (JournalSheet, Compendium, etc). Recommended to keep enabled since many windows in Foundry v13 still use the V1 Application framework.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });
}

export function registerPrintSettings(
  settings: SettingsRegistrar,
  getDefaultPrintOptions: (sheetType: SheetType) => DefaultPrintOptions,
): void {
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

  settings.register(MOD, "showPrintOptionsDialog", {
    name: "Show Print Options Dialog",
    hint: "When enabled, shows the print options dialog each time. When disabled, uses saved default options.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  for (const sheetType of ["character", "npc", "encounter", "party"] as const) {
    settings.register(MOD, printDefaultsSettingKey(sheetType), {
      name: `Print Defaults (${sheetType})`,
      hint: `Default print options for ${sheetType} sheets.`,
      scope: "client",
      config: false,
      type: String,
      default: JSON.stringify(getDefaultPrintOptions(sheetType)),
    });
  }
}

export function registerMenuBackingSettings(settings: SettingsRegistrar): void {
  settings.register(MOD, "targetUserIds", {
    name: "Target Players (storage)",
    hint: "Internal storage for selected player IDs.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  settings.register(MOD, "rotateButtonPlayerIds", {
    name: "Rotate Button Players (storage)",
    hint: "Internal storage for player IDs who see the rotate button.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

  settings.register(MOD, "kioskPlayerIds", {
    name: "Kiosk Players (storage)",
    hint: "Internal storage for kiosk player IDs.",
    scope: "world",
    config: false,
    type: String,
    default: "",
    restricted: true,
  });

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
}
