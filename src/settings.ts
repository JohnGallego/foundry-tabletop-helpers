import { Log, MOD } from "./logger";
import type { PaperSize, PortraitMode, PrintOptions, SheetType } from "./print-sheet/types";

export type RotMode = 90 | 180;

/** Default print options structure */
export interface DefaultPrintOptions {
  paperSize: PaperSize;
  portrait: PortraitMode;
  sections: Record<string, boolean>;
}

/** Section definitions per sheet type (mirrors dnd5e-extractor.ts) */
/** Section definitions per sheet type (mirrors dnd5e-extractor.ts) */
const SECTION_DEFAULTS: Record<SheetType, Record<string, boolean>> = {
  character: {
    abilities: true, skills: true, combat: true, actions: true,
    features: true, spells: true, inventory: true, backstory: true, reference: true,
  },
  npc: {
    stats: true, traits: true, actions: true, legendary: true, lair: true, spells: true,
  },
  encounter: {
    statblocks: true,
  },
  party: {
    summary: true, skills: true,
  },
};

/** Human-readable labels for sections */
const SECTION_LABELS: Record<SheetType, Record<string, string>> = {
  character: {
    abilities: "Ability Scores & Saves", skills: "Skills", combat: "Combat Stats",
    actions: "Actions", features: "Features & Traits", spells: "Spellcasting",
    inventory: "Inventory", backstory: "Backstory & Notes", reference: "Rules Reference Page",
  },
  npc: {
    stats: "Core Stats", traits: "Traits", actions: "Actions",
    legendary: "Legendary Actions", lair: "Lair Actions", spells: "Spellcasting",
  },
  encounter: {
    statblocks: "NPC Stat Blocks",
  },
  party: {
    summary: "Party Summary Table", skills: "Top Skills per Member",
  },
};

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
    sections: { ...SECTION_DEFAULTS[sheetType] },
  };
}

export function registerSettings(): void {
  const G: any = (globalThis as any).game;
  if (!G?.settings) return;

  // Log level
  G.settings.register(MOD, "logLevel", {
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
    onChange: (v: string) => Log.setLevel(v as any),
  });

  // Rotation mode (90/180)
  G.settings.register(MOD, "rotationMode", {
    name: "Rotation",
    hint: "How much each press rotates: 90° steps or 180° flip.",
    scope: "client",
    config: true,
    type: String,
    choices: { "90": "Rotate 90°", "180": "Flip 180°" },
    default: "90",
  });

  // Animations toggle
  G.settings.register(MOD, "enableAnimations", {
    name: "Animations",
    hint: "Enable snappy rotation animations with a polished easing curve.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Optional legacy V1 support
  G.settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows (legacy)",
    hint: "Enable only if you need the Flip 180° button on V1 applications (deprecated since V13).",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  /* ── Print Sheet Settings ─────────────────────────────────── */

  // Print button visibility
  G.settings.register(MOD, "showPrintButton", {
    name: "Show Print Button",
    hint: "Show the Print button on character, NPC, and group sheets.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Preview button visibility
  G.settings.register(MOD, "showPreviewButton", {
    name: "Show Preview Button",
    hint: "Show a Preview button that opens the print view without printing (useful for digital reference).",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Show print options dialog
  G.settings.register(MOD, "showPrintOptionsDialog", {
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
    G.settings.register(MOD, `printDefaults_${sheetType}`, {
      name: `Print Defaults (${sheetType})`,
      hint: `Default print options for ${sheetType} sheets.`,
      scope: "client",
      config: false,
      type: String,
      default: JSON.stringify(getDefaultPrintOptions(sheetType)),
    });
  }

  // Target players list (GM-only; stored as CSV; hidden - configured via submenu)
  G.settings.register(MOD, "targetUserIds", {
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
    const Base: any = (globalThis as any).FormApplication || class {};
    class TargetPlayersForm extends Base {
      static get defaultOptions() {
        const base: any = (Base as any).defaultOptions ?? {};
        return Object.assign({}, base, {
          id: `${MOD}-target-players`,
          title: "Target Players",
          template: `modules/${MOD}/templates/target-users.hbs`,
          width: 420,
        });
      }
      async getData() {
        const G: any = (globalThis as any).game;
        const selected = new Set(targetUserIds());
        const users = (G?.users ?? []).filter((u: any) => !u?.isGM);
        return {
          users: users.map((u: any) => ({ id: u.id, name: u.name, selected: selected.has(u.id), isActive: u.active })),
        };
      }
      async _updateObject(_event: any, formData: any) {
        const raw = (formData as any)["userIds"];
        const ids: string[] = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
        await (globalThis as any).game?.settings?.set(MOD, "targetUserIds", ids.join(","));
      }
    }

    G.settings.registerMenu(MOD, "targetUsersMenu", {
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

  // Print Defaults submenu
  try {
    const Base: any = (globalThis as any).FormApplication || class {};

    // Register Handlebars helper for equality check
    const Handlebars: any = (globalThis as any).Handlebars;
    if (Handlebars && !Handlebars.helpers?.eq) {
      Handlebars.registerHelper("eq", (a: any, b: any) => a === b);
    }

    class PrintDefaultsForm extends Base {
      static get defaultOptions() {
        const base: any = (Base as any).defaultOptions ?? {};
        return Object.assign({}, base, {
          id: `${MOD}-print-defaults`,
          title: "Print Defaults",
          template: `modules/${MOD}/templates/print-defaults.hbs`,
          width: 520,
          height: "auto",
        });
      }

      async getData() {
        const sheetTypes = (["character", "npc", "encounter", "party"] as SheetType[]).map((key) => {
          const defaults = getPrintDefaults(key);
          const sectionKeys = Object.keys(SECTION_DEFAULTS[key]);
          return {
            key,
            label: SHEET_TYPE_LABELS[key],
            paperSize: defaults.paperSize,
            portrait: defaults.portrait,
            showPortrait: key === "character" || key === "npc",
            sections: sectionKeys.map((sKey) => ({
              key: sKey,
              label: SECTION_LABELS[key][sKey] ?? sKey,
              checked: defaults.sections[sKey] ?? true,
            })),
          };
        });
        return { sheetTypes };
      }

      async _updateObject(_event: any, formData: any) {
        const G: any = (globalThis as any).game;
        for (const sheetType of ["character", "npc", "encounter", "party"] as SheetType[]) {
          const paperSize = formData[`${sheetType}_paperSize`] ?? "letter";
          const portrait = formData[`${sheetType}_portrait`] ?? "portrait";
          const sections: Record<string, boolean> = {};
          for (const sKey of Object.keys(SECTION_DEFAULTS[sheetType])) {
            sections[sKey] = !!formData[`${sheetType}_section_${sKey}`];
          }
          const options: DefaultPrintOptions = { paperSize, portrait, sections };
          await G?.settings?.set(MOD, `printDefaults_${sheetType}`, JSON.stringify(options));
        }
        (globalThis as any).ui?.notifications?.info?.("Print defaults saved.");
      }
    }

    G.settings.registerMenu(MOD, "printDefaultsMenu", {
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
  try {
    const v = (globalThis as any).game?.settings?.get(MOD, "rotationMode");
    return Number(v) === 180 ? 180 : 90;
  } catch {
    return 90;
  }
};

export const rotationLabel = () => (rotationMode() === 180 ? "Flip 180°" : "Rotate 90°");

export const animationsEnabled = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "enableAnimations"));
  } catch {
    return true;
  }
};

export const supportV1 = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "supportV1"));
  } catch {
    return false;
  }
};

export const targetUserIds = (): string[] => {
  try {
    const raw = String((globalThis as any).game?.settings?.get(MOD, "targetUserIds") ?? "");
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
};

/* ── Print Settings Getters ────────────────────────────────── */

export const showPrintButton = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "showPrintButton"));
  } catch {
    return true;
  }
};

export const showPreviewButton = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "showPreviewButton"));
  } catch {
    return true;
  }
};

export const showPrintOptionsDialog = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "showPrintOptionsDialog"));
  } catch {
    return true;
  }
};

/** Get saved print defaults for a sheet type, or return standard defaults */
export const getPrintDefaults = (sheetType: SheetType): DefaultPrintOptions => {
  try {
    const raw = (globalThis as any).game?.settings?.get(MOD, `printDefaults_${sheetType}`);
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
    await (globalThis as any).game?.settings?.set(MOD, `printDefaults_${sheetType}`, JSON.stringify(options));
  } catch (e) {
    Log.warn(`Failed to save print defaults for ${sheetType}`, e);
  }
};
