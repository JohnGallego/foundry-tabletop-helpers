import { MOD } from "../logger";
import { getSetting, setSetting } from "../types";
import type { AbilityScoreMethod, EquipmentMethod, HpMethod, PackSourceConfig } from "./character-creator-types";
import { DEFAULT_PACK_SOURCES } from "./data/dnd5e-constants";
import { CC_SETTINGS } from "./character-creator-settings-shared";

const DEFAULT_ABILITY_METHODS: AbilityScoreMethod[] = ["4d6", "pointBuy", "standardArray"];

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
  const raw = getSetting<string>(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS) ?? JSON.stringify(DEFAULT_ABILITY_METHODS);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AbilityScoreMethod[] : DEFAULT_ABILITY_METHODS;
  } catch {
    return DEFAULT_ABILITY_METHODS;
  }
}

export async function setAllowedAbilityMethods(methods: AbilityScoreMethod[]): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS, JSON.stringify(methods));
}

export function getStartingLevel(): number {
  const value = getSetting<number>(MOD, CC_SETTINGS.STARTING_LEVEL);
  return typeof value === "number" && value >= 1 && value <= 20 ? value : 1;
}

export function allowMulticlass(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_MULTICLASS) ?? false;
}

export function getEquipmentMethod(): EquipmentMethod {
  const value = getSetting<string>(MOD, CC_SETTINGS.EQUIPMENT_METHOD);
  if (value === "equipment" || value === "gold" || value === "both") return value;
  return "both";
}

export function getLevel1HpMethod(): HpMethod {
  const value = getSetting<string>(MOD, CC_SETTINGS.LEVEL1_HP_METHOD);
  if (value === "max" || value === "roll") return value;
  return "max";
}

export function getMaxRerolls(): number {
  const value = getSetting<number>(MOD, CC_SETTINGS.MAX_REROLLS);
  return typeof value === "number" && value >= 0 ? value : 0;
}

export function allowCustomBackgrounds(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS) ?? false;
}
