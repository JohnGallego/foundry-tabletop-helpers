import type { LPCSContainerCurrency, LPCSEncumbrance, LPCSInventoryItem } from "./lpcs-types";

interface BuildInventoryOptions {
  capitalize(value: string): string;
  drawerDesc(html: string): string;
}

const DENOMINATION_DISPLAY: Record<string, { icon: string; label: string; cssClass: string }> = {
  pp: { icon: "fas fa-coins", label: "pp", cssClass: "lpcs-coin-icon--pp" },
  gp: { icon: "fas fa-coins", label: "gp", cssClass: "lpcs-coin-icon--gp" },
  ep: { icon: "fas fa-coins", label: "ep", cssClass: "lpcs-coin-icon--ep" },
  sp: { icon: "fas fa-coins", label: "sp", cssClass: "lpcs-coin-icon--sp" },
  cp: { icon: "fas fa-coins", label: "cp", cssClass: "lpcs-coin-icon--cp" },
};

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  veryRare: "Very Rare",
  legendary: "Legendary",
  artifact: "Artifact",
};

const TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon",
  equipment: "Equipment",
  consumable: "Consumable",
  tool: "Tool",
  loot: "Loot",
  container: "Container",
  facility: "Facility",
};

const WEAPON_PROP_LABELS: Record<string, string> = {
  fin: "Finesse", hvy: "Heavy", lgt: "Light", lod: "Loading",
  rch: "Reach", thr: "Thrown", two: "Two-handed", ver: "Versatile", amm: "Ammunition",
  ret: "Returning", rel: "Reload", spc: "Special",
};

const ARMOR_TYPE_LABELS: Record<string, string> = {
  light: "Light Armor", medium: "Medium Armor", heavy: "Heavy Armor",
  shield: "Shield", natural: "Natural Armor", bonus: "Bonus",
};

function buildWeaponStatsBlock(sys: Record<string, unknown>, capitalize: BuildInventoryOptions["capitalize"]): string {
  const lines: string[] = [];

  const propSet = sys.properties as { has?: (key: string) => boolean } | undefined;
  const hasProp = (key: string) => propSet && typeof propSet.has === "function" && propSet.has(key);
  if (hasProp("mgc")) lines.push("Magical");

  const damageRaw = sys.damage as Record<string, unknown> | undefined;
  let damageStr = "";
  let damageType = "";
  if (damageRaw) {
    const base = damageRaw.base;
    if (base && typeof base === "object") {
      const damageParts = base as Record<string, unknown>;
      const num = (damageParts.number as number) ?? 1;
      const den = damageParts.denomination as number | undefined;
      const bonus = damageParts.bonus as string | undefined;
      if (den) {
        damageStr = `${num}d${den}`;
        if (bonus && bonus !== "@mod") {
          const cleanBonus = bonus.replace(/@mod/g, "").replace(/^\+$/, "").replace(/^-$/, "");
          if (cleanBonus) {
            damageStr += cleanBonus.startsWith("+") || cleanBonus.startsWith("-") ? cleanBonus : `+${cleanBonus}`;
          }
        }
      }
      const types = damageParts.types;
      if (types instanceof Set) damageType = [...types][0] ?? "";
      else if (Array.isArray(types)) damageType = types[0] ?? "";
    }
  }

  const mastery = (sys.mastery as string | undefined) ?? "";
  const damageLine = [damageStr, damageType, mastery ? `(${capitalize(mastery)})` : ""].filter(Boolean).join(" ");
  if (damageLine) lines.push(damageLine);

  const propWords: string[] = [];
  for (const property of ["fin", "hvy", "lgt", "lod", "rch", "thr", "two", "ver", "amm", "ret", "rel", "spc"]) {
    if (hasProp(property)) propWords.push(WEAPON_PROP_LABELS[property]);
  }
  if (propWords.length) lines.push(propWords.join(", "));

  const rangeData = sys.range as Record<string, number | string> | undefined;
  if (rangeData?.value) {
    let range = `Range: ${rangeData.value} ft.`;
    if (rangeData.long) range += `/${rangeData.long} ft.`;
    lines.push(range);
  }

  return lines.join("\n");
}

function buildArmorStatsBlock(sys: Record<string, unknown>): string {
  const lines: string[] = [];

  const propSet = sys.properties as { has?: (key: string) => boolean } | undefined;
  const hasProp = (key: string) => propSet && typeof propSet.has === "function" && propSet.has(key);
  if (hasProp("mgc")) lines.push("Magical");

  const armor = sys.armor as Record<string, number> | undefined;
  const typeData = sys.type as Record<string, string> | undefined;
  const armorType = typeData?.value ?? "";
  const armorTypeLabel = ARMOR_TYPE_LABELS[armorType] ?? "";
  const acValue = armor?.value ?? 0;

  if (acValue > 0 || armorTypeLabel) {
    const parts: string[] = [];
    if (acValue > 0) parts.push(`AC ${acValue}`);
    if (armorTypeLabel) parts.push(armorTypeLabel);
    lines.push(parts.join(" · "));
  }

  return lines.join("\n");
}

function buildOneInventoryItem(item: Record<string, unknown>, options: BuildInventoryOptions): LPCSInventoryItem {
  const sys = item.system as Record<string, unknown> ?? {};
  const rawType = String(item.type ?? "");
  const rawRarity = String(sys.rarity ?? "");

  const priceData = sys.price as Record<string, unknown> | undefined;
  const priceValue = (priceData?.value as number) ?? 0;
  const priceDenom = String(priceData?.denomination ?? "gp");
  const price = priceValue > 0
    ? { value: priceValue, denomination: priceDenom }
    : null;

  const priceDisplay = price
    ? [{ ...(DENOMINATION_DISPLAY[price.denomination] ?? DENOMINATION_DISPLAY.gp), label: String(price.value) }]
    : [];

  const descHtml = String((sys.description as Record<string, string> | undefined)?.value ?? "");
  const description = options.drawerDesc(descHtml);

  let statsBlock = "";
  if (rawType === "weapon") statsBlock = buildWeaponStatsBlock(sys, options.capitalize);
  else if (rawType === "equipment") statsBlock = buildArmorStatsBlock(sys);

  const rawWeight = sys.weight;
  const weight = typeof rawWeight === "object" && rawWeight !== null
    ? ((rawWeight as Record<string, unknown>).value as number) ?? 0
    : (rawWeight as number) ?? 0;

  const containerCurrency: LPCSContainerCurrency[] = [];
  if (rawType === "container") {
    const currency = sys.currency as Record<string, number> | undefined;
    if (currency) {
      for (const key of ["pp", "gp", "ep", "sp", "cp"]) {
        const amount = currency[key] ?? 0;
        if (amount > 0) containerCurrency.push({ key, amount });
      }
    }
  }

  let capacityLabel = "";
  let contentsWeightVal = 0;
  let capacityMax = 0;
  let capacityPct = 0;
  if (rawType === "container") {
    const capacity = sys.capacity as Record<string, unknown> | undefined;
    const capWeight = (capacity?.weight as Record<string, unknown> | undefined)?.value as number | undefined;
    const capCount = capacity?.count as number | undefined;
    const contentsWeight = sys.contentsWeight as number | undefined;
    contentsWeightVal = contentsWeight != null ? Math.round(contentsWeight * 10) / 10 : 0;
    if (capWeight && capWeight > 0) {
      capacityMax = capWeight;
      capacityPct = Math.min(100, Math.round((contentsWeightVal / capWeight) * 100));
      capacityLabel = `${contentsWeightVal} / ${capWeight} lb`;
    } else if (capCount && capCount > 0) {
      const contentsCount = sys.contentsCount as number | undefined;
      capacityLabel = `${contentsCount ?? 0} / ${capCount} items`;
      capacityPct = Math.min(100, Math.round(((contentsCount ?? 0) / capCount) * 100));
    }
  }

  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    img: String(item.img ?? ""),
    quantity: (sys.quantity as number) ?? 1,
    weight,
    equipped: !!(sys.equipped),
    attuned: !!(sys.attuned),
    type: rawType,
    typeLabel: TYPE_LABELS[rawType] ?? options.capitalize(rawType),
    description,
    statsBlock,
    rarity: rawRarity,
    rarityLabel: RARITY_LABELS[rawRarity] ?? "",
    price,
    priceDisplay,
    isContainer: rawType === "container",
    contentsCount: 0,
    contents: [],
    containerCurrency,
    capacityLabel,
    contentsWeight: contentsWeightVal,
    capacityMax,
    capacityPct,
    capacityColor: capacityPct < 60 ? "#2d8a4e" : capacityPct < 85 ? "#c49a2a" : "#8b1e2d",
    containerId: (sys.container as string) ?? null,
    isEquippable: "equipped" in sys,
  };
}

export function buildInventory(
  actor: Record<string, unknown>,
  options: BuildInventoryOptions,
): { looseItems: LPCSInventoryItem[]; containers: LPCSInventoryItem[] } {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const skip = new Set(["spell", "class", "subclass", "background", "race", "feat"]);

  const allItems = items
    .filter((item) => !skip.has(String(item.type ?? "")))
    .map((item) => buildOneInventoryItem(item, options));

  const byId = new Map<string, LPCSInventoryItem>();
  for (const item of allItems) byId.set(item.id, item);

  const topLevel: LPCSInventoryItem[] = [];
  for (const item of allItems) {
    if (item.containerId && byId.has(item.containerId)) {
      byId.get(item.containerId)!.contents.push(item);
    } else {
      topLevel.push(item);
    }
  }

  for (const item of allItems) {
    if (item.isContainer) {
      item.contentsCount = item.contents.length;
      item.contents.sort((left, right) => left.name.localeCompare(right.name));
    }
  }

  const looseItems: LPCSInventoryItem[] = [];
  const containers: LPCSInventoryItem[] = [];
  for (const item of topLevel) {
    if (item.isContainer) containers.push(item);
    else looseItems.push(item);
  }

  return {
    looseItems: looseItems.sort((left, right) => left.name.localeCompare(right.name)),
    containers: containers.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function buildEncumbrance(system: Record<string, unknown>): LPCSEncumbrance {
  const enc = (system.attributes as Record<string, unknown> | undefined)?.encumbrance as
    Record<string, number> | undefined ?? {};
  const value = enc.value ?? 0;
  const max = enc.max ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return { value, max, pct, encumbered: pct >= 100 };
}
