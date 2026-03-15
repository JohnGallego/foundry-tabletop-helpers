import { Log } from "../../logger";

import { extractAbilities, extractSpellcasting, extractTraits, resolveTraitSet } from "./dnd5e-extract-helpers";
import type { FeatureData, NPCData } from "./dnd5e-types";
import type { Dnd5eEmbedAction, Dnd5eEmbedActionSections, Dnd5eEmbedContext } from "./dnd5e-system-types";

interface NpcExtractorOptions {
  stripEnrichedText(html: string, actorName?: string, rollData?: Record<string, unknown>): string;
  skillKeyToName(key: string): string;
  extractGear(weaponItems: any[], equipmentItems: any[]): string[];
  itemToFeatureData(item: any, favorites: Set<string>, actor?: any): FeatureData;
  getActivationType(item: any): string;
  crToXP(cr: number): number;
  formatCR(cr: number): string;
  sizeCodeToName(code: string): string;
}

function sortNpcActions(actions: FeatureData[]): void {
  actions.sort((left, right) => {
    const leftIsMultiattack = left.name.toLowerCase().includes("multiattack");
    const rightIsMultiattack = right.name.toLowerCase().includes("multiattack");
    if (leftIsMultiattack && !rightIsMultiattack) return -1;
    if (!leftIsMultiattack && rightIsMultiattack) return 1;
    if (left.itemType === "weapon" && right.itemType !== "weapon") return -1;
    if (left.itemType !== "weapon" && right.itemType === "weapon") return 1;
    return 0;
  });
}

export function embedActionToFeatureData(
  action: Dnd5eEmbedAction,
  favorites: Set<string>,
  actor: any,
  options: Pick<NpcExtractorOptions, "stripEnrichedText">,
): FeatureData {
  const itemId = action.dataset?.id;
  const item = itemId && actor?.items?.get ? actor.items.get(itemId) : null;

  const name = action.name ?? item?.name ?? "";
  let description = action.description ?? "";
  if (action.openingTag && !description.startsWith("<")) {
    description = action.openingTag + description;
  }

  description = options.stripEnrichedText(
    description,
    actor?.name,
    typeof actor?.getRollData === "function" ? actor.getRollData() : undefined,
  );

  return {
    name,
    description,
    uses: null,
    isFavorite: favorites.has(itemId) || favorites.has(item?.uuid),
    attack: undefined,
    itemType: item?.type ?? "feat",
  };
}

export function extractSkillsFromContext(
  ctx: Dnd5eEmbedContext,
  actor: any,
  options: Pick<NpcExtractorOptions, "skillKeyToName">,
): { name: string; mod: number }[] {
  if (ctx.summary?.skills) {
    const skills: { name: string; mod: number }[] = [];
    for (const part of ctx.summary.skills.split(",").map((value: string) => value.trim())) {
      const match = part.match(/(.+?)\s+([+-]?\d+)/);
      if (match) skills.push({ name: match[1].trim(), mod: parseInt(match[2], 10) });
    }
    if (skills.length > 0) return skills;
  }

  const skillsObj = actor.system?.skills ?? {};
  const skills: { name: string; mod: number }[] = [];
  for (const [key, skill] of Object.entries(skillsObj)) {
    const entry = skill as any;
    if (entry.proficient || entry.total !== (actor.system?.abilities?.[entry.ability]?.mod ?? 0)) {
      skills.push({ name: options.skillKeyToName(key), mod: entry.total ?? 0 });
    }
  }
  return skills;
}

export function extractSensesFromContext(_ctx: Dnd5eEmbedContext, actor: any): { key: string; value: number | string }[] {
  const senses: { key: string; value: number | string }[] = [];
  const attrSenses = actor.system?.attributes?.senses ?? {};

  for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    const value = attrSenses[key];
    if (value && value > 0) senses.push({ key, value });
  }
  if (attrSenses.special) senses.push({ key: "special", value: attrSenses.special });

  return senses;
}

export function extractGearFromSystem(actor: any, options: Pick<NpcExtractorOptions, "extractGear">): string[] {
  try {
    if (typeof actor.system?.getGear === "function") {
      const gearItems = actor.system.getGear();
      if (Array.isArray(gearItems)) {
        return gearItems.map((item: any) => {
          let name = item.name ?? "";
          if (item.system?.quantity > 1) name += ` (${item.system.quantity})`;
          return name;
        }).filter(Boolean);
      }
    }
  } catch (error) {
    Log.debug("getGear() failed, using manual extraction", { err: String(error) });
  }

  const items = actor.items ?? [];
  const weaponItems = items.filter?.((item: any) => item.type === "weapon") ?? [];
  const equipmentItems = items.filter?.((item: any) => item.type === "equipment") ?? [];
  return options.extractGear(weaponItems, equipmentItems);
}

export async function extractNPCFromEmbedContext(
  actor: any,
  ctx: Dnd5eEmbedContext,
  favorites: Set<string>,
  options: NpcExtractorOptions,
): Promise<NPCData> {
  const details = actor.system?.details ?? {};
  const attrs = actor.system?.attributes ?? {};
  const hp = attrs.hp ?? {};

  const cr = details.cr ?? 0;
  const xp = options.crToXP(cr);
  const proficiencyBonus = attrs.prof ?? Math.floor((cr >= 1 ? cr : 1) / 4) + 2;

  const summary = ctx.summary;
  const speed: { key: string; value: number }[] = [];
  if (summary?.speed) {
    for (const part of summary.speed.split(",").map((value: string) => value.trim())) {
      const match = part.match(/(?:(\w+)\s+)?(\d+)\s*ft/i);
      if (match) speed.push({ key: match[1]?.toLowerCase() || "walk", value: parseInt(match[2], 10) });
    }
  }
  if (speed.length === 0) speed.push({ key: "walk", value: 30 });

  const skills = extractSkillsFromContext(ctx, actor, options);
  const senses = extractSensesFromContext(ctx, actor);
  const passivePerception = actor.system?.skills?.prc?.passive ?? 10;
  const gear = extractGearFromSystem(actor, options);

  const features: FeatureData[] = [];
  const actions: FeatureData[] = [];
  const bonusActions: FeatureData[] = [];
  const reactions: FeatureData[] = [];
  const legendaryActionList: FeatureData[] = [];
  const lairActionList: FeatureData[] = [];
  const actionSections: Dnd5eEmbedActionSections = ctx.actionSections ?? {};

  if (actionSections.trait?.actions) {
    for (const action of actionSections.trait.actions) {
      features.push(embedActionToFeatureData(action, favorites, actor, options));
    }
  }
  if (actionSections.action?.actions) {
    for (const action of actionSections.action.actions) {
      actions.push(embedActionToFeatureData(action, favorites, actor, options));
    }
  }
  if (actionSections.bonus?.actions) {
    for (const action of actionSections.bonus.actions) {
      bonusActions.push(embedActionToFeatureData(action, favorites, actor, options));
    }
  }
  if (actionSections.reaction?.actions) {
    for (const action of actionSections.reaction.actions) {
      reactions.push(embedActionToFeatureData(action, favorites, actor, options));
    }
  }
  if (actionSections.legendary?.actions) {
    for (const action of actionSections.legendary.actions) {
      legendaryActionList.push(embedActionToFeatureData(action, favorites, actor, options));
    }
  }

  sortNpcActions(actions);

  return {
    name: actor.name ?? "Unknown",
    img: actor.img ?? "",
    tokenImg: actor.prototypeToken?.texture?.src ?? "",
    cr: options.formatCR(cr),
    xp,
    proficiencyBonus,
    type: details.type?.value ?? "",
    size: options.sizeCodeToName(actor.system?.traits?.size ?? "med"),
    alignment: details.alignment ?? "",
    ac: attrs.ac?.value ?? 10,
    acFormula: attrs.ac?.formula ?? "",
    hp: { value: hp.value ?? 0, max: hp.max ?? 0, formula: hp.formula ?? "" },
    initiative: summary.initiative ? parseInt(summary.initiative, 10) || 0 : (attrs.init?.total ?? 0),
    speed,
    abilities: extractAbilities(actor),
    skills,
    gear,
    traits: extractTraits(actor),
    senses,
    passivePerception,
    languages: resolveTraitSet(actor.system?.traits?.languages),
    features,
    actions,
    bonusActions,
    reactions,
    legendaryActions: {
      description: actionSections.legendary?.description ?? details.legendary?.description ?? "",
      actions: legendaryActionList,
    },
    lairActions: {
      description: details.lair?.description ?? "",
      actions: lairActionList,
    },
    spellcasting: extractSpellcasting(actor, favorites),
  };
}

export async function extractNPCManual(
  actor: any,
  favorites: Set<string>,
  options: NpcExtractorOptions,
): Promise<NPCData> {
  Log.debug("Using manual NPC extraction", { name: actor.name });
  const items = actor.items ?? [];
  const details = actor.system?.details ?? {};
  const attrs = actor.system?.attributes ?? {};
  const movement = attrs.movement ?? {};
  const senses = attrs.senses ?? {};
  const hp = attrs.hp ?? {};

  const cr = details.cr ?? 0;
  const xp = options.crToXP(cr);
  const proficiencyBonus = attrs.prof ?? Math.floor((cr >= 1 ? cr : 1) / 4) + 2;
  const dexMod = actor.system?.abilities?.dex?.mod ?? 0;
  const initiative = attrs.init?.total ?? dexMod;

  const skillsObj = actor.system?.skills ?? {};
  const skills: { name: string; mod: number }[] = [];
  for (const [key, skill] of Object.entries(skillsObj)) {
    const entry = skill as any;
    if (entry.proficient || entry.total !== (actor.system?.abilities?.[entry.ability]?.mod ?? 0)) {
      skills.push({ name: options.skillKeyToName(key), mod: entry.total ?? 0 });
    }
  }

  const prcSkill = skillsObj.prc as any;
  const passivePerception = senses.passive ?? (10 + (prcSkill?.total ?? 0));

  const speed: { key: string; value: number }[] = [];
  for (const key of ["walk", "fly", "swim", "climb", "burrow"]) {
    const value = movement[key];
    if (value && value > 0) speed.push({ key, value });
  }
  if (speed.length === 0) speed.push({ key: "walk", value: 30 });

  const senseEntries: { key: string; value: number | string }[] = [];
  for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    const value = senses[key];
    if (value && value > 0) senseEntries.push({ key, value });
  }
  if (senses.special) senseEntries.push({ key: "special", value: senses.special });

  const featItems = items.filter?.((item: any) => item.type === "feat") ?? [];
  const weaponItems = items.filter?.((item: any) => item.type === "weapon") ?? [];
  const equipmentItems = items.filter?.((item: any) => item.type === "equipment") ?? [];
  const actionItems = [...featItems, ...weaponItems];

  const features: FeatureData[] = [];
  const actions: FeatureData[] = [];
  const bonusActions: FeatureData[] = [];
  const reactions: FeatureData[] = [];
  const legendaryActionList: FeatureData[] = [];
  const lairActionList: FeatureData[] = [];

  for (const item of actionItems) {
    const feature = options.itemToFeatureData(item, favorites, actor);
    const activationType = options.getActivationType(item);

    switch (activationType) {
      case "legendary": legendaryActionList.push(feature); break;
      case "lair": lairActionList.push(feature); break;
      case "bonus": bonusActions.push(feature); break;
      case "reaction": reactions.push(feature); break;
      case "action":
      case "attack": actions.push(feature); break;
      default: features.push(feature); break;
    }
  }

  sortNpcActions(actions);

  return {
    name: actor.name ?? "Unknown",
    img: actor.img ?? "",
    tokenImg: actor.prototypeToken?.texture?.src ?? "",
    cr: options.formatCR(cr),
    xp,
    proficiencyBonus,
    type: details.type?.value ?? "",
    size: options.sizeCodeToName(actor.system?.traits?.size ?? "med"),
    alignment: details.alignment ?? "",
    ac: attrs.ac?.value ?? 10,
    acFormula: attrs.ac?.formula ?? "",
    hp: { value: hp.value ?? 0, max: hp.max ?? 0, formula: hp.formula ?? "" },
    initiative,
    speed,
    abilities: extractAbilities(actor),
    skills,
    gear: options.extractGear(weaponItems, equipmentItems),
    traits: extractTraits(actor),
    senses: senseEntries,
    passivePerception,
    languages: resolveTraitSet(actor.system?.traits?.languages),
    features,
    actions,
    bonusActions,
    reactions,
    legendaryActions: {
      description: details.legendary?.description ?? "",
      actions: legendaryActionList,
    },
    lairActions: {
      description: details.lair?.description ?? "",
      actions: lairActionList,
    },
    spellcasting: extractSpellcasting(actor, favorites),
  };
}
