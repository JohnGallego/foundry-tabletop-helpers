import { Log } from "../../logger";

import type { CharacterActions, FeatureData, WeaponActionData } from "./dnd5e-types";
import { getActivityValues } from "./dnd5e-system-types";

function capitalizeFirst(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMastery(mastery: string): string {
  if (!mastery) return "";
  return mastery.charAt(0).toUpperCase() + mastery.slice(1);
}

function getProficiencyFullName(abbrev: string, type: "armor" | "weapon" | "tool"): string {
  const armorMap: Record<string, string> = {
    lgt: "Light Armor",
    med: "Medium Armor",
    hvy: "Heavy Armor",
    shl: "Shields",
  };

  const weaponMap: Record<string, string> = {
    sim: "Simple Weapons",
    mar: "Martial Weapons",
  };

  const toolMap: Record<string, string> = {
    alchemist: "Alchemist's Supplies",
    brewer: "Brewer's Supplies",
    calligrapher: "Calligrapher's Supplies",
    carpenter: "Carpenter's Tools",
    cartographer: "Cartographer's Tools",
    cobbler: "Cobbler's Tools",
    cook: "Cook's Utensils",
    glassblower: "Glassblower's Tools",
    jeweler: "Jeweler's Tools",
    leatherworker: "Leatherworker's Tools",
    mason: "Mason's Tools",
    painter: "Painter's Supplies",
    potter: "Potter's Tools",
    smith: "Smith's Tools",
    tinker: "Tinker's Tools",
    weaver: "Weaver's Tools",
    woodcarver: "Woodcarver's Tools",
    disguise: "Disguise Kit",
    forgery: "Forgery Kit",
    herbalism: "Herbalism Kit",
    poisoner: "Poisoner's Kit",
    navigator: "Navigator's Tools",
    thief: "Thieves' Tools",
    vehicle: "Vehicles",
  };

  const lower = abbrev.toLowerCase();

  if (type === "armor" && armorMap[lower]) return armorMap[lower];
  if (type === "weapon" && weaponMap[lower]) return weaponMap[lower];
  if (type === "tool" && toolMap[lower]) return toolMap[lower];
  return capitalizeFirst(abbrev);
}

function resolveProfs(traitObj: unknown, type: "armor" | "weapon" | "tool" = "tool"): string[] {
  if (!traitObj || typeof traitObj !== "object") return [];
  const trait = traitObj as { custom?: unknown; value?: unknown };
  const results: string[] = [];

  if (typeof trait.custom === "string") {
    results.push(...trait.custom.split(";").map((value) => value.trim()).filter(Boolean));
  }

  const values = trait.value;
  const entries = values instanceof Set ? Array.from(values) : Array.isArray(values) ? values : [];
  for (const entry of entries) {
    if (typeof entry === "string" && entry) {
      results.push(getProficiencyFullName(entry, type));
    }
  }

  return results;
}

function extractWeaponProperties(sys: Record<string, unknown>): string {
  const props: string[] = [];
  const weaponType = (sys.type as Record<string, string> | undefined)?.value ?? "";
  if (weaponType.startsWith("simple")) props.push("Simple");
  else if (weaponType.startsWith("martial")) props.push("Martial");

  const propSet = sys.properties as { has?(key: string): boolean } | undefined;
  if (propSet?.has) {
    const propMap: Record<string, string> = {
      amm: "Ammunition",
      fin: "Finesse",
      hvy: "Heavy",
      lgt: "Light",
      lod: "Loading",
      rch: "Reach",
      rel: "Reload",
      ret: "Returning",
      spc: "Special",
      thr: "Thrown",
      two: "Two-Handed",
      ver: "Versatile",
      mgc: "Magical",
    };

    for (const [key, label] of Object.entries(propMap)) {
      if (propSet.has(key)) props.push(label);
    }
  }

  if (typeof sys.mastery === "string" && sys.mastery) {
    props.push(formatMastery(sys.mastery));
  }

  return props.join(", ");
}

function extractWeaponActionData(item: any, actor: any, favorites: Set<string>): WeaponActionData | null {
  try {
    const sys = item.system ?? {};
    const labels = item.labels ?? {};

    const attackType = sys.attackType ?? "melee";
    const isThrown = sys.properties?.has?.("thr") ?? false;
    let weaponType = attackType === "melee" ? "Melee Weapon" : "Ranged Weapon";
    if (isThrown && attackType === "melee") weaponType = "Melee or Ranged Weapon";

    const mastery = typeof sys.mastery === "string" ? formatMastery(sys.mastery) : "";

    let hasMastery = false;
    if (mastery) {
      const baseItem = String(sys.type?.baseItem ?? "");
      const masterySet = actor?.system?.traits?.weaponProf?.mastery?.value;
      const masteryArr = masterySet instanceof Set ? [...masterySet] : Array.isArray(masterySet) ? masterySet : [];
      hasMastery = masteryArr.some((weaponId: string) =>
        weaponId.toLowerCase() === baseItem.toLowerCase()
        || weaponId.toLowerCase().replace(/-/g, " ") === baseItem.toLowerCase().replace(/-/g, " ")
      );
    }

    const range = sys.range ?? {};
    let rangeStr = "";
    let rangeType = "";
    if (attackType === "melee" && !isThrown) {
      const reach = range.reach ?? 5;
      rangeStr = `${reach} ft.`;
      rangeType = "Reach";
    } else if (isThrown) {
      const short = range.value ?? 20;
      const long = range.long ?? short * 3;
      rangeStr = `${short} (${long})`;
    } else {
      const short = range.value ?? 80;
      const long = range.long ?? short;
      rangeStr = short === long ? `${short}` : `${short} (${long})`;
    }

    let toHit = labels.modifier ?? labels.toHit ?? "";
    if (toHit && !String(toHit).startsWith("+") && !String(toHit).startsWith("-")) {
      toHit = `+${toHit}`;
    }

    let damageFormula = "";
    let damageTypes = "";
    let hasAbilityMod = false;

    const activityList = getActivityValues(sys.activities);
    if (activityList.length > 0) {
      try {
        const activity = activityList[0];
        let damageParts: unknown[] = [];
        const rawParts = activity?.damage?.parts;
        if (rawParts) {
          if (Array.isArray(rawParts)) damageParts = rawParts;
          else if (typeof (rawParts as { forEach?: unknown }).forEach === "function") {
            (rawParts as { forEach(cb: (part: unknown) => void): void }).forEach((part) => damageParts.push(part));
          } else if (typeof rawParts === "object") {
            damageParts = Object.values(rawParts as Record<string, unknown>);
          }
        }

        if (damageParts.length > 0) {
          const firstDamage = damageParts[0] as Record<string, unknown> | string | unknown[] | null;
          if (firstDamage && typeof firstDamage === "object" && !Array.isArray(firstDamage) &&
              firstDamage.number && firstDamage.denomination) {
            damageFormula = `${firstDamage.number}d${firstDamage.denomination}`;
            if (typeof firstDamage.bonus === "string") {
              damageFormula += ` + ${firstDamage.bonus}`;
              hasAbilityMod = firstDamage.bonus.includes("@mod")
                || firstDamage.bonus.includes("@str")
                || firstDamage.bonus.includes("@dex");
            }
          } else if (typeof firstDamage === "string") {
            damageFormula = firstDamage;
            hasAbilityMod = firstDamage.includes("@mod") || firstDamage.includes("@str") || firstDamage.includes("@dex");
          } else if (firstDamage && typeof firstDamage === "object" && !Array.isArray(firstDamage) && firstDamage.formula) {
            const formula = String(firstDamage.formula);
            damageFormula = formula;
            hasAbilityMod = formula.includes("@mod") || formula.includes("@str") || formula.includes("@dex");
          } else if (Array.isArray(firstDamage)) {
            damageFormula = String(firstDamage[0] ?? "");
            hasAbilityMod = damageFormula.includes("@mod") || damageFormula.includes("@str") || damageFormula.includes("@dex");
          }

          const types = firstDamage && typeof firstDamage === "object" && !Array.isArray(firstDamage)
            ? firstDamage.types
            : undefined;
          if (types) {
            const typeArr = types instanceof Set ? [...types] : Array.isArray(types) ? types : [];
            damageTypes = (typeArr as string[]).map(capitalizeFirst).join(", ");
          } else if (Array.isArray(firstDamage) && firstDamage[1]) {
            damageTypes = capitalizeFirst(String(firstDamage[1]));
          }
        }
      } catch {
        // Fall back to labels below
      }
    }

    if (!damageFormula) {
      damageFormula = labels.damage ?? sys.damage?.base?.formula ?? "";
      hasAbilityMod = damageFormula.includes("@mod") || damageFormula.includes("@str") || damageFormula.includes("@dex");
    }

    if (!damageTypes) {
      const baseTypes = sys.damage?.base?.types;
      const typesArray: string[] = baseTypes ? Array.from(baseTypes as Iterable<string>) : [];
      damageTypes = labels.damageTypes ?? typesArray.map(capitalizeFirst).join(", ") ?? "";
    }

    const str = actor?.system?.abilities?.str?.mod ?? 0;
    const dex = actor?.system?.abilities?.dex?.mod ?? 0;
    const isFinesse = sys.properties?.has?.("fin") ?? false;
    const abilityMod = isFinesse ? Math.max(str, dex) : (attackType === "melee" ? str : dex);

    if (!hasAbilityMod && damageFormula && abilityMod !== 0) {
      damageFormula += abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod);
    }

    if (damageFormula.includes("@mod")) {
      damageFormula = damageFormula.replace(/@mod/g, abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod));
    }
    if (damageFormula.includes("@str")) {
      damageFormula = damageFormula.replace(/@str/g, str >= 0 ? `+${str}` : String(str));
    }
    if (damageFormula.includes("@dex")) {
      damageFormula = damageFormula.replace(/@dex/g, dex >= 0 ? `+${dex}` : String(dex));
    }

    damageFormula = damageFormula.replace(/\s*\+\s*/g, "+").replace(/\s*-\s*/g, "-");
    damageFormula = damageFormula.replace(/\+\+/g, "+").replace(/\+-/g, "-").replace(/-\+/g, "-");

    return {
      name: item.name ?? "",
      weaponType,
      mastery,
      hasMastery,
      range: rangeStr,
      rangeType,
      toHit: String(toHit),
      damage: damageFormula,
      damageType: damageTypes,
      properties: extractWeaponProperties(sys),
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
    };
  } catch (error) {
    Log.warn("Failed to extract weapon action data", { item: item?.name, err: String(error) });
    return null;
  }
}

export function extractCharacterProficiencies(actor: any): {
  armor: string[];
  weapons: string[];
  tools: string[];
  weaponMasteries: string[];
} {
  const traits = actor.system?.traits ?? {};

  const armorProfs = resolveProfs(traits.armorProf, "armor");
  const weaponProfs = resolveProfs(traits.weaponProf, "weapon");

  let toolProfs = resolveProfs(traits.toolProf, "tool");
  if (toolProfs.length === 0 && actor.system?.tools) {
    for (const [key, tool] of Object.entries(actor.system.tools)) {
      const entry = tool as { value?: number };
      if ((entry.value ?? 0) >= 1) {
        toolProfs.push(getProficiencyFullName(key, "tool"));
      }
    }
  }

  if (toolProfs.length === 0) {
    const toolItems = actor.items?.filter?.((item: any) => item.type === "tool") ?? [];
    for (const item of toolItems) {
      if (item.system?.proficient >= 1 || item.system?.prof?.hasProficiency) {
        toolProfs.push(item.name);
      }
    }
  }

  const weaponMasteries: string[] = [];
  const masterySet = traits.weaponProf?.mastery?.value;
  if (masterySet) {
    const masteryArr = masterySet instanceof Set ? [...masterySet] : Array.isArray(masterySet) ? masterySet : [];
    for (const weaponId of masteryArr) {
      weaponMasteries.push(capitalizeFirst(String(weaponId).replace(/-/g, " ")));
    }
  }

  return { armor: armorProfs, weapons: weaponProfs, tools: toolProfs, weaponMasteries };
}

export function extractCurrency(actor: unknown): { pp: number; gp: number; ep: number; sp: number; cp: number } {
  const currency = (actor as { system?: { currency?: Record<string, unknown> } })?.system?.currency ?? {};
  return {
    pp: typeof currency.pp === "number" ? currency.pp : 0,
    gp: typeof currency.gp === "number" ? currency.gp : 0,
    ep: typeof currency.ep === "number" ? currency.ep : 0,
    sp: typeof currency.sp === "number" ? currency.sp : 0,
    cp: typeof currency.cp === "number" ? currency.cp : 0,
  };
}

export async function extractCharacterActions(
  actor: any,
  favorites: Set<string>,
  options: {
    stripEnrichedText(html: string, actorName?: string, rollData?: Record<string, unknown>): string;
    extractItemUses(item: any): FeatureData["uses"] | null;
  },
): Promise<CharacterActions> {
  const result: CharacterActions = {
    weapons: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    other: [],
  };

  const items = actor.items?.contents ?? [];
  Log.debug("Character actions extraction", {
    name: actor.name,
    itemCount: items.length,
  });

  for (const item of items) {
    if (item.type === "weapon") {
      const weaponData = extractWeaponActionData(item, actor, favorites);
      if (weaponData) result.weapons.push(weaponData);
      continue;
    }

    if (item.type === "spell" || item.type === "equipment" || item.type === "loot" ||
        item.type === "consumable" || item.type === "backpack" || item.type === "tool") {
      continue;
    }

    const actValues = getActivityValues(item.system?.activities);
    const activation = item.system?.activation?.type;
    if (actValues.length === 0 && !activation) continue;

    let activationType = "action";
    if (activation) activationType = activation;
    else if (actValues.length > 0 && actValues[0]?.activation?.type) activationType = actValues[0].activation.type;

    const featureData: FeatureData = {
      name: item.name ?? "",
      description: options.stripEnrichedText(
        item.system?.description?.value ?? "",
        actor.name,
        typeof actor.getRollData === "function" ? actor.getRollData() : undefined,
      ),
      uses: null,
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
      itemType: item.type,
    };

    if (item.system?.uses?.max) {
      featureData.uses = options.extractItemUses(item);
    }

    const isOther = item.type === "feat" && !activation &&
      (item.name.toLowerCase().includes("sneak attack") || item.system?.type?.value === "class");

    if (isOther) result.other.push(featureData);
    else if (activationType === "action" || activationType === "attack") result.actions.push(featureData);
    else if (activationType === "bonus") result.bonusActions.push(featureData);
    else if (activationType === "reaction") result.reactions.push(featureData);
  }

  Log.debug("Character actions extraction results", {
    name: actor.name,
    weapons: result.weapons.length,
    actions: result.actions.length,
    bonusActions: result.bonusActions.length,
    reactions: result.reactions.length,
    other: result.other.length,
  });

  return result;
}
