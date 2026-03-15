import { Log, MOD } from "../logger";
import { getFormApplicationClass, getGame, getUI, setSetting } from "../types";
import type { AbilityScoreMethod, PackSourceConfig } from "./character-creator-types";
import { compendiumIndexer } from "./data/compendium-indexer";
import {
  allowMulticlass,
  ccAutoOpen,
  ccEnabled,
  ccLevelUpEnabled,
  getAllowedAbilityMethods,
  getEquipmentMethod,
  getLevel1HpMethod,
  getMaxRerolls,
  getPackSources,
  getStartingLevel,
  setPackSources,
} from "./character-creator-settings-accessors";
import { CC_SETTINGS } from "./character-creator-settings-shared";

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

async function detectPacks(sourceKey: string, currentSources: string[]): Promise<DetectedPack[]> {
  const game = getGame();
  if (!game?.packs) return [];

  const info = CONTENT_TYPE_ITEM_TYPES[sourceKey];
  if (!info) return [];

  const enabledSet = new Set(currentSources);
  const results: DetectedPack[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const pack of game.packs as any) {
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
      /* Skip packs that fail to index */
    }
  }

  return results;
}

export function registerCharacterCreatorSettingsMenus(settings: {
  registerMenu(module: string, key: string, data: Record<string, unknown>): void;
}): void {
  registerSettingsMenu(settings);
  registerCompendiumSelectMenu(settings);
}

function registerSettingsMenu(settings: {
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
        const methods: AbilityScoreMethod[] = [];
        if (formData.method_4d6) methods.push("4d6");
        if (formData.method_pointBuy) methods.push("pointBuy");
        if (formData.method_standardArray) methods.push("standardArray");

        if (methods.length === 0) {
          getUI()?.notifications?.warn?.("At least one ability score method must be enabled. Defaulting to Roll 4d6.");
          methods.push("4d6");
        }

        const rawLevel = Number(formData.startingLevel) || 1;
        const startingLevel = Math.max(1, Math.min(20, rawLevel));
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
  } catch (error) {
    Log.warn("Character Creator: failed to register settings menu", error);
  }
}

function registerCompendiumSelectMenu(settings: {
  registerMenu(module: string, key: string, data: Record<string, unknown>): void;
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
        const groups: Array<{ type: string; label: string; packs: DetectedPack[] }> = [];

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
          const parts = key.split("__");
          if (parts.length < 3) continue;
          const sourceKey = parts[1];
          const collection = parts.slice(2).join("__");
          if (newSources[sourceKey]) newSources[sourceKey].push(collection);
        }

        await setPackSources(newSources as unknown as PackSourceConfig);
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
  } catch (error) {
    Log.warn("Character Creator: failed to register compendium select menu", error);
  }
}
