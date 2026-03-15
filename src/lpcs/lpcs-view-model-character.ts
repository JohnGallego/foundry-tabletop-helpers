import type { LPCSFeature, LPCSFeatureGroup, LPCSProficiencies, LPCSTraitGroup } from "./lpcs-types";

import { getFeatureSummary } from "../print-sheet/data/feature-summaries";
import type { SummaryContext } from "../print-sheet/data/feature-summaries";

interface BuildFeaturesOptions {
  stripFoundryRefs(html: string): string;
  getFeatureAnnotations(itemId: string): LPCSFeature["effectAnnotations"];
}

interface BuildProficienciesOptions {
  capitalize(value: string): string;
}

const TRAIT_LABELS: Record<string, string> = {
  dr: "Damage Resistances",
  di: "Damage Immunities",
  dv: "Damage Vulnerabilities",
  dm: "Damage Modification",
  ci: "Condition Immunities",
};

const ARMOR_LABELS: Record<string, string> = {
  lgt: "Light Armor", med: "Medium Armor", hvy: "Heavy Armor", shl: "Shields",
};

const WEAPON_LABELS: Record<string, string> = {
  sim: "Simple Weapons", mar: "Martial Weapons",
};

const TOOL_LABELS: Record<string, string> = {
  alchemist: "Alchemist's Supplies", brewer: "Brewer's Supplies",
  calligrapher: "Calligrapher's Supplies", carpenter: "Carpenter's Tools",
  cartographer: "Cartographer's Tools", cobbler: "Cobbler's Tools",
  cook: "Cook's Utensils", glassblower: "Glassblower's Tools",
  jeweler: "Jeweler's Tools", leatherworker: "Leatherworker's Tools",
  mason: "Mason's Tools", painter: "Painter's Supplies",
  potter: "Potter's Tools", smith: "Smith's Tools",
  tinker: "Tinker's Tools", weaver: "Weaver's Tools",
  woodcarver: "Woodcarver's Tools", disguise: "Disguise Kit",
  forgery: "Forgery Kit", herbalism: "Herbalism Kit",
  poisoner: "Poisoner's Kit", navigator: "Navigator's Tools",
  thief: "Thieves' Tools", vehicle: "Vehicles",
};

export function buildSummaryContext(actor: Record<string, unknown>): SummaryContext {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const system = actor.system as Record<string, unknown> ?? {};
  const details = system.details as Record<string, unknown> | undefined ?? {};
  const level = (details.level as number) ?? 0;
  const prof = (system.attributes as Record<string, unknown> | undefined)?.prof as number ?? 2;

  const classes = items
    .filter((item) => item.type === "class")
    .map((item) => ({
      name: String(item.name ?? ""),
      level: ((item.system as Record<string, unknown> | undefined)?.levels as number) ?? 0,
    }));

  const classLevel = (name: string) => classes.find((item) => item.name.toLowerCase() === name)?.level ?? 0;

  const rogueLevel = classLevel("rogue");
  const monkLevel = classLevel("monk");
  const paladinLevel = classLevel("paladin");
  const sorcererLevel = classLevel("sorcerer");
  const bardLevel = classLevel("bard");

  return {
    level,
    proficiencyBonus: prof,
    classes,
    sneakAttackDice: rogueLevel > 0 ? `${Math.ceil(rogueLevel / 2)}d6` : null,
    kiPoints: monkLevel > 0 ? monkLevel : null,
    layOnHandsPool: paladinLevel > 0 ? paladinLevel * 5 : null,
    sorceryPoints: sorcererLevel > 0 ? sorcererLevel : null,
    bardicInspirationDie: bardLevel >= 15 ? "d12" : bardLevel >= 10 ? "d10" : bardLevel >= 5 ? "d8" : bardLevel > 0 ? "d6" : null,
  };
}

function featureDescription(name: string, rawHtml: string, ctx: SummaryContext, options: BuildFeaturesOptions): string {
  const stripped = options.stripFoundryRefs(rawHtml);
  return getFeatureSummary(name, stripped, ctx, rawHtml);
}

export function buildFeatures(
  actor: Record<string, unknown>,
  options: BuildFeaturesOptions,
): { mainGroups: LPCSFeatureGroup[]; speciesGroup: LPCSFeatureGroup[] } {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const context = buildSummaryContext(actor);

  const feats: LPCSFeature[] = [];
  const originFeats: LPCSFeature[] = [];
  const classGroups = new Map<string, LPCSFeature[]>();
  const speciesTraits: LPCSFeature[] = [];
  const other: LPCSFeature[] = [];

  for (const item of items.filter((entry) => entry.type === "feat")) {
    const system = item.system as Record<string, unknown> ?? {};
    const typeObj = system.type as Record<string, string> | undefined ?? {};
    const typeValue = typeObj.value ?? "";
    const subtype = typeObj.subtype ?? "";

    const uses = system.uses as Record<string, number> | undefined;
    const rawHtml = String((system.description as Record<string, string> | undefined)?.value ?? "");
    const itemId = String(item.id ?? "");
    const feature: LPCSFeature = {
      id: itemId,
      name: String(item.name ?? ""),
      img: String(item.img ?? ""),
      description: featureDescription(String(item.name ?? ""), rawHtml, context, options),
      uses: uses?.max ? { value: uses.value ?? 0, max: uses.max } : null,
      source: subtype || typeValue || "Other",
      effectAnnotations: options.getFeatureAnnotations(itemId),
    };

    if (typeValue === "class") {
      const className = subtype || "Class";
      if (!classGroups.has(className)) classGroups.set(className, []);
      classGroups.get(className)!.push(feature);
    } else if (typeValue === "race") {
      speciesTraits.push(feature);
    } else if (typeValue === "background" || subtype === "origin") {
      originFeats.push(feature);
    } else if (typeValue === "feat") {
      feats.push(feature);
    } else {
      other.push(feature);
    }
  }

  const mainGroups: LPCSFeatureGroup[] = [];
  if (feats.length) mainGroups.push({ label: "Feats", features: feats });
  if (originFeats.length) mainGroups.push({ label: "Origin Feats", features: originFeats });
  for (const [className, features] of [...classGroups.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    mainGroups.push({ label: `${className} Features`, features });
  }
  if (other.length) mainGroups.push({ label: "Other", features: other });

  const speciesGroup: LPCSFeatureGroup[] = [];
  if (speciesTraits.length) speciesGroup.push({ label: "Species Traits", features: speciesTraits });

  return { mainGroups, speciesGroup };
}

export function buildTraits(system: Record<string, unknown>): LPCSTraitGroup[] {
  const traits = system.traits as Record<string, unknown> | undefined ?? {};
  const result: LPCSTraitGroup[] = [];

  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    const trait = traits[key] as Record<string, unknown> | undefined;
    if (!trait) continue;
    const values: string[] = [];
    const raw = trait.value;
    if (raw instanceof Set) for (const value of raw) values.push(String(value));
    else if (Array.isArray(raw)) for (const value of raw) values.push(String(value));
    const custom = trait.custom as string | undefined;
    if (custom?.trim()) values.unshift(...custom.split(";").map((value) => value.trim()).filter(Boolean));
    if (values.length > 0) result.push({ key, label, values: values.join(", ") });
  }

  return result;
}

function resolveProfLabel(abbrev: string, labelMap: Record<string, string>, capitalize: BuildProficienciesOptions["capitalize"]): string {
  return labelMap[abbrev.toLowerCase()] ?? capitalize(abbrev);
}

export function buildProficiencies(
  actor: Record<string, unknown>,
  options: BuildProficienciesOptions,
): LPCSProficiencies {
  const system = actor.system as Record<string, unknown> ?? {};
  const traits = system.traits as Record<string, unknown> | undefined ?? {};

  const extractTrait = (key: string, labelMap: Record<string, string>): string[] => {
    const trait = traits[key] as Record<string, unknown> | undefined;
    if (!trait) return [];
    const values: string[] = [];
    const raw = trait.value;
    if (raw instanceof Set) for (const value of raw) values.push(resolveProfLabel(String(value), labelMap, options.capitalize));
    else if (Array.isArray(raw)) for (const value of raw) values.push(resolveProfLabel(String(value), labelMap, options.capitalize));
    const custom = trait.custom as string | undefined;
    if (custom?.trim()) values.unshift(...custom.split(";").map((value) => value.trim()).filter(Boolean));
    return values;
  };

  return {
    armor: extractTrait("armorProf", ARMOR_LABELS).join(", "),
    weapons: extractTrait("weaponProf", WEAPON_LABELS).join(", "),
    tools: extractTrait("toolProf", TOOL_LABELS).join(", "),
    languages: extractTrait("languages", {}).join(", "),
  };
}
