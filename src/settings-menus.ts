import type { PaperSize, PortraitMode, SheetType } from "./print-sheet/types";

import { getSectionLabels, SECTION_DEFINITIONS } from "./print-sheet/section-definitions";
import { Log, MOD } from "./logger";
import {
  getAllUsers,
  getFormApplicationClass,
  getHandlebars,
  getPlayerUsers,
  getUI,
  setSetting,
} from "./types";

import type { DefaultPrintOptions } from "./settings";
import { printDefaultsSettingKey } from "./settings-utils";

type SettingsRegistrar = {
  registerMenu(module: string, key: string, data: { type: new () => unknown } & Record<string, unknown>): void;
};

interface SettingsMenuOptions {
  targetUserIds(): string[];
  rotateButtonPlayerIds(): string[];
  kioskPlayerIds(): string[];
  getDefaultPrintOptions(sheetType: SheetType): DefaultPrintOptions;
  getPrintDefaults(sheetType: SheetType): DefaultPrintOptions;
  sheetTypeLabels: Record<SheetType, string>;
}

function getFoundryMergeObject() {
  return foundry.utils.mergeObject;
}

function parseUserIds(formData: Record<string, unknown>): string[] {
  const raw = formData.userIds;
  return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
}

function registerUserSelectionMenu(
  settings: SettingsRegistrar,
  {
    menuKey,
    title,
    template,
    hint,
    icon,
    getSelectedIds,
    getUsers,
    settingKey,
  }: {
    menuKey: string;
    title: string;
    template: string;
    hint: string;
    icon: string;
    getSelectedIds(): string[];
    getUsers(): Array<{ id: string; name: string; active?: boolean }>;
    settingKey: string;
  },
): void {
  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    const BaseWithDefaults = FormAppBase as {
      defaultOptions?: Record<string, unknown>;
      new (): {
        getData?(): Promise<Record<string, unknown>>;
        _updateObject?(_event: Event, formData: Record<string, unknown>): Promise<void>;
      };
    };

    class UserSelectionForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return getFoundryMergeObject()(base, {
          id: `${MOD}-${menuKey}`,
          title,
          template,
          width: 420,
        }, { inplace: false });
      }

      async getData() {
        const selected = new Set(getSelectedIds());
        return {
          users: getUsers().map((user) => ({
            id: user.id,
            name: user.name,
            selected: selected.has(user.id),
            isActive: !!user.active,
          })),
        };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        await setSetting(MOD, settingKey, parseUserIds(formData).join(","));
      }
    }

    settings.registerMenu(MOD, menuKey, {
      name: title,
      label: "Configure",
      hint,
      icon,
      type: UserSelectionForm,
      restricted: true,
    });
  } catch (error) {
    Log.warn(`Failed to register ${title} submenu`, error);
  }
}

export function registerSettingsMenus(settings: SettingsRegistrar, options: SettingsMenuOptions): void {
  registerUserSelectionMenu(settings, {
    menuKey: "targetUsersMenu",
    title: "Target Players",
    template: `modules/${MOD}/templates/target-users.hbs`,
    hint: "Choose which players are affected by rotation macros.",
    icon: "fa-solid fa-user-check",
    getSelectedIds: options.targetUserIds,
    getUsers: getPlayerUsers,
    settingKey: "targetUserIds",
  });

  registerUserSelectionMenu(settings, {
    menuKey: "rotateButtonPlayersMenu",
    title: "Rotate Button Users",
    template: `modules/${MOD}/templates/rotate-button-players.hbs`,
    hint: "Choose which users (including GMs) see the rotation button on their windows.",
    icon: "fa-solid fa-arrows-rotate",
    getSelectedIds: options.rotateButtonPlayerIds,
    getUsers: getAllUsers,
    settingKey: "rotateButtonPlayerIds",
  });

  registerUserSelectionMenu(settings, {
    menuKey: "kioskPlayersMenu",
    title: "Kiosk Players",
    template: `modules/${MOD}/templates/kiosk-players.hbs`,
    hint: "Choose which players enter kiosk mode (full-screen sheet, hidden UI) on login.",
    icon: "fa-solid fa-tv",
    getSelectedIds: options.kioskPlayerIds,
    getUsers: getPlayerUsers,
    settingKey: "kioskPlayerIds",
  });

  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    const BaseWithDefaults = FormAppBase as {
      defaultOptions?: Record<string, unknown>;
      new (): {
        getData?(): Promise<Record<string, unknown>>;
        _updateObject?(_event: Event, formData: Record<string, unknown>): Promise<void>;
      };
    };

    const handlebars = getHandlebars();
    if (handlebars && !handlebars.helpers?.eq) {
      handlebars.registerHelper("eq", (left: unknown, right: unknown) => left === right);
    }

    class PrintDefaultsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return getFoundryMergeObject()(base, {
          id: `${MOD}-print-defaults`,
          title: "Print Defaults",
          template: `modules/${MOD}/templates/print-defaults.hbs`,
          width: 520,
          height: "auto",
        }, { inplace: false });
      }

      async getData() {
        const sheetTypes = (["character", "npc", "encounter", "party"] as SheetType[]).map((key) => {
          const defaults = options.getPrintDefaults(key);
          const labels = getSectionLabels(key);
          return {
            key,
            label: options.sheetTypeLabels[key],
            paperSize: defaults.paperSize,
            portrait: defaults.portrait,
            showPortrait: key === "character" || key === "npc",
            sections: SECTION_DEFINITIONS[key].map((section) => ({
              key: section.key,
              label: labels[section.key] ?? section.key,
              checked: defaults.sections[section.key] ?? section.default,
            })),
          };
        });
        return { sheetTypes };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        for (const sheetType of ["character", "npc", "encounter", "party"] as SheetType[]) {
          const fallback = options.getDefaultPrintOptions(sheetType);
          const paperSize = (formData[`${sheetType}_paperSize`] as PaperSize) ?? fallback.paperSize;
          const portrait = (formData[`${sheetType}_portrait`] as PortraitMode) ?? fallback.portrait;
          const sections: Record<string, boolean> = {};
          for (const section of SECTION_DEFINITIONS[sheetType]) {
            sections[section.key] = !!formData[`${sheetType}_section_${section.key}`];
          }
          const printDefaults: DefaultPrintOptions = { paperSize, portrait, sections };
          await setSetting(MOD, printDefaultsSettingKey(sheetType), JSON.stringify(printDefaults));
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
  } catch (error) {
    Log.warn("Failed to register Print Defaults submenu", error);
  }
}
