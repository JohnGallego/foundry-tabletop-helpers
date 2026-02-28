/**
 * Helper functions for extracting dnd5e actor data.
 * Kept separate from the main extractor class to stay manageable.
 */

import { getConfig } from "../../types";
import type {
  AbilityData, SkillData, CombatData, CharacterDetails, ClassInfo,
  TraitData, SpellcastingData, SpellSlotData, SpellData,
  InventoryItem, FeatureGroup, FeatureData,
} from "./dnd5e-types";
import type {
  Dnd5eAbilityData, Dnd5eAbilitiesData, Dnd5eAbilitySaveData,
  Dnd5eTraitData,
} from "./dnd5e-system-types";
import { getActivityValues } from "./dnd5e-system-types";
import { toArray } from "./dnd5e-system-types";

/* ── Constants ────────────────────────────────────────────── */

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

const ABILITY_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

const SKILL_LABELS: Record<string, string> = {
  acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics",
  dec: "Deception", his: "History", ins: "Insight", itm: "Intimidation",
  inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception",
  prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand",
  ste: "Stealth", sur: "Survival",
};

const FEAT_CATEGORY_LABELS: Record<string, string> = {
  class: "Class Feature", race: "Race", background: "Background",
  feat: "Feat", other: "Other", monster: "Monster",
  supernaturalGift: "Supernatural Gift",
};

/* ── Label helpers ────────────────────────────────────────── */

export function abilityLabel(key: string): string {
  const cfg = (getConfig()?.DND5E as Record<string, unknown> | undefined)?.abilities as
    Record<string, { label?: string }> | undefined;
  return cfg?.[key]?.label ?? ABILITY_LABELS[key] ?? key.toUpperCase();
}

function skillLabel(key: string): string {
  const cfg = (getConfig()?.DND5E as Record<string, unknown> | undefined)?.skills as
    Record<string, { label?: string }> | undefined;
  return cfg?.[key]?.label ?? SKILL_LABELS[key] ?? key;
}

/* ── Favorites ────────────────────────────────────────────── */

export function buildFavoritesSet(actor: any): Set<string> {
  const favs = new Set<string>();
  const favorites = actor.favorites;
  if (Array.isArray(favorites)) {
    for (const f of favorites) {
      const id = f.id ?? f.source ?? "";
      if (id) favs.add(id);
    }
  }
  return favs;
}

/* ── Trait set resolution ─────────────────────────────────── */

/**
 * Resolve a dnd5e trait object to an array of strings.
 * Handles both Set<string> and string[] for the value property.
 * Custom entries come first, followed by standard ones.
 * @param traitObj - A Dnd5eTraitData object (or any with value/custom properties)
 */
export function resolveTraitSet(traitObj: Dnd5eTraitData | null | undefined): string[] {
  if (!traitObj) return [];

  const customResults: string[] = [];
  const standardResults: string[] = [];

  // Handle custom entries first (semicolon-separated string)
  const custom = traitObj.custom;
  if (typeof custom === "string" && custom.trim()) {
    for (const c of custom.split(";")) {
      const trimmed = c.trim();
      if (trimmed) customResults.push(trimmed);
    }
  }

  // Use toArray helper to handle Set or Array for standard values
  const values = toArray(traitObj.value);
  for (const v of values) {
    if (typeof v === "string" && v) standardResults.push(v);
  }

  // Return custom entries first, then standard ones
  return [...customResults, ...standardResults];
}

/* ── Abilities ────────────────────────────────────────────── */

/**
 * Extract ability score data from a dnd5e actor.
 * Handles the dnd5e 5.x format where save can be a number or an object with .value property.
 */
export function extractAbilities(actor: any): AbilityData[] {
  const abilities = (actor.system?.abilities ?? {}) as Partial<Dnd5eAbilitiesData>;
  const prof = (actor.system?.attributes?.prof ?? 2) as number;

  return ABILITY_KEYS.map((key) => {
    const a: Dnd5eAbilityData = abilities[key as keyof Dnd5eAbilitiesData] ?? { value: 10 };
    const mod = a.mod ?? Math.floor(((a.value ?? 10) - 10) / 2);
    const isProficient = !!(a.proficient);
    // Calculate save: if proficient, add proficiency bonus to modifier
    const calculatedSave = isProficient ? mod + prof : mod;

    // a.save can be a number or an object with .value property (Dnd5eAbilitySaveData)
    let save: number;
    if (typeof a.save === "number") {
      save = a.save;
    } else if (typeof a.save === "object" && a.save !== null) {
      // It's a Dnd5eAbilitySaveData object
      save = (a.save as Dnd5eAbilitySaveData).value ?? calculatedSave;
    } else {
      save = calculatedSave;
    }

    return {
      key,
      label: abilityLabel(key),
      value: a.value ?? 10,
      mod,
      save,
      proficient: isProficient,
      saveProficient: isProficient,
    };
  });
}

/* ── Skills ───────────────────────────────────────────────── */

export function extractSkills(actor: any): SkillData[] {
  const skills = actor.system?.skills ?? {};
  return Object.entries(skills)
    .map(([key, s]: [string, any]) => ({
      key,
      label: skillLabel(key),
      total: s.total ?? s.mod ?? 0,
      passive: s.passive ?? (10 + (s.total ?? s.mod ?? 0)),
      proficiency: s.value ?? 0,
      ability: s.ability ?? "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/* ── Combat stats ─────────────────────────────────────────── */

export function extractCombat(actor: any): CombatData {
  const attrs = actor.system?.attributes ?? {};
  const hp = attrs.hp ?? {};
  const death = attrs.death ?? {};
  const movement = attrs.movement ?? {};
  const senses = attrs.senses ?? {};

  const speedEntries: { key: string; value: number }[] = [];
  for (const key of ["walk", "fly", "swim", "climb", "burrow"]) {
    const val = movement[key];
    if (val && val > 0) speedEntries.push({ key, value: val });
  }
  if (speedEntries.length === 0) speedEntries.push({ key: "walk", value: 30 });

  const senseEntries: { key: string; value: number | string }[] = [];
  for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    const val = senses[key];
    if (val && val > 0) senseEntries.push({ key, value: val });
  }
  if (senses.special) senseEntries.push({ key: "special", value: senses.special });

  // Extract hit dice from class items
  // dnd5e 5.x: class items have system.hd.denomination (e.g., "d10") and system.hd.value/max
  const hitDice: Record<string, { value: number; max: number }> = {};
  const classItems = actor.items?.filter?.((i: any) => i.type === "class") ?? [];
  for (const cls of classItems) {
    const hd = cls.system?.hd;
    if (hd?.denomination) {
      const denom = hd.denomination; // e.g., "d10"
      if (!hitDice[denom]) {
        hitDice[denom] = { value: 0, max: 0 };
      }
      hitDice[denom].value += hd.value ?? 0;
      hitDice[denom].max += hd.max ?? cls.system?.levels ?? 0;
    }
  }

  return {
    ac: attrs.ac?.value ?? 10,
    hp: { value: hp.value ?? 0, max: hp.max ?? 0, temp: hp.temp ?? 0, tempmax: hp.tempmax ?? 0 },
    death: { success: death.success ?? 0, failure: death.failure ?? 0 },
    initiative: attrs.init?.total ?? attrs.init?.mod ?? 0,
    speed: speedEntries,
    proficiency: attrs.prof ?? 0,
    inspiration: !!attrs.inspiration,
    senses: senseEntries,
    hitDice,
  };
}

/* ── Character details ────────────────────────────────────── */

export function extractDetails(actor: any): CharacterDetails {
  const details = actor.system?.details ?? {};
  const items = actor.items;

  // Race / species — might be a string, an object with .name, or a linked item
  let race = "";
  if (typeof details.race === "string") race = details.race;
  else if (details.race?.name) race = details.race.name;
  if (!race) {
    const raceItem = items?.find?.((i: any) => i.type === "race");
    race = raceItem?.name ?? "";
  }

  // Background
  let background = "";
  if (typeof details.background === "string") background = details.background;
  else if (details.background?.name) background = details.background.name;
  if (!background) {
    const bgItem = items?.find?.((i: any) => i.type === "background");
    background = bgItem?.name ?? "";
  }

  // Classes
  const classItems = items?.filter?.((i: any) => i.type === "class") ?? [];
  const classes: ClassInfo[] = classItems.map((c: any) => {
    let subclass = "";
    const subclassItem = items?.find?.((i: any) =>
      i.type === "subclass" && i.system?.classIdentifier === c.system?.identifier,
    );
    if (subclassItem) subclass = subclassItem.name;
    return {
      name: c.name ?? "Unknown",
      level: c.system?.levels ?? 1,
      subclass,
    };
  });

  return {
    race,
    background,
    alignment: details.alignment ?? "",
    level: details.level ?? (classes.reduce((sum: number, c: ClassInfo) => sum + c.level, 0) || 1),
    classes,
  };
}

/* ── Traits ───────────────────────────────────────────────── */

export function extractTraits(actor: any): TraitData {
  const traits = actor.system?.traits ?? {};
  return {
    size: traits.size ?? "med",
    resistances: resolveTraitSet(traits.dr),
    immunities: resolveTraitSet(traits.di),
    vulnerabilities: resolveTraitSet(traits.dv),
    conditionImmunities: resolveTraitSet(traits.ci),
    languages: resolveTraitSet(traits.languages),
  };
}



/* ── Spellcasting ─────────────────────────────────────────── */

function hasProperty(set: any, prop: string): boolean {
  if (set instanceof Set) return set.has(prop);
  if (Array.isArray(set)) return set.includes(prop);
  return false;
}

export function extractSpellcasting(actor: any, favorites: Set<string>): SpellcastingData | null {
  const spellcastingAbility = actor.system?.attributes?.spellcasting;
  if (!spellcastingAbility) return null;

  const spellItems = actor.items?.filter?.((i: any) => i.type === "spell") ?? [];
  if (spellItems.length === 0) return null;

  const prof = actor.system?.attributes?.prof ?? 0;
  const abilityMod = actor.system?.abilities?.[spellcastingAbility]?.mod ?? 0;

  // Spell slots
  const slotsData = actor.system?.spells ?? {};
  const slots: SpellSlotData[] = [];
  for (let level = 1; level <= 9; level++) {
    const slot = slotsData[`spell${level}`];
    if (slot && slot.max > 0) {
      slots.push({ level, max: slot.max ?? 0, value: slot.value ?? 0, label: `Level ${level}` });
    }
  }
  // Pact slots
  const pact = slotsData.pact;
  if (pact && pact.max > 0) {
    slots.push({ level: pact.level ?? 1, max: pact.max ?? 0, value: pact.value ?? 0, label: `Pact (Level ${pact.level ?? 1})` });
  }

  // Group spells by level
  const spellsByLevel = new Map<number, SpellData[]>();
  const attackMod = prof + abilityMod;
  const dc = 8 + prof + abilityMod;

  for (const item of spellItems) {
    const level = item.system?.level ?? 0;
    const props = item.system?.properties;
    const sys = item.system;

    // Build components string
    let components = "";
    if (props) {
      const parts: string[] = [];
      if (hasProperty(props, "vocal")) parts.push("V");
      if (hasProperty(props, "somatic")) parts.push("S");
      if (hasProperty(props, "material")) parts.push("M");
      components = parts.join("/");
    }

    // Extract casting time
    const activation = sys?.activation ?? {};
    let castingTime = "";
    const actType = activation.type ?? "";
    const actVal = activation.value ?? 1;
    if (actType === "action") castingTime = actVal > 1 ? `${actVal}A` : "1A";
    else if (actType === "bonus") castingTime = "1BA";
    else if (actType === "reaction") castingTime = "1R";
    else if (actType === "minute") castingTime = `${actVal}m`;
    else if (actType === "hour") castingTime = `${actVal}h`;
    else if (actType) castingTime = actType;

    // Extract range
    const rangeData = sys?.range ?? {};
    let range = "";
    if (rangeData.units === "self") range = "Self";
    else if (rangeData.units === "touch") range = "Touch";
    else if (rangeData.value) range = `${rangeData.value} ft.`;
    else if (rangeData.units) range = rangeData.units;

    // Extract duration
    const durData = sys?.duration ?? {};
    let duration = "";
    const isConc = !!(props && hasProperty(props, "concentration"));
    if (durData.units === "inst") duration = "Instant";
    else if (durData.units === "perm") duration = "Permanent";
    else if (durData.units === "spec") duration = "Special";
    else if (durData.value) {
      const prefix = isConc ? "C " : "";
      const unit = durData.units === "minute" ? "m" : durData.units === "hour" ? "h" : durData.units === "round" ? "r" : durData.units ?? "";
      duration = `${prefix}${durData.value}${unit}`;
    } else if (isConc) {
      duration = "C";
    }

    // Determine attack/save info and effect
    let attackSave = "";
    let effect = "";

    // Try to get from activities (dnd5e 5.x)
    const activityList = getActivityValues(sys?.activities);
    if (activityList.length > 0) {
      try {
        const act = activityList[0];
        // Check for attack
        if (act?.attack?.type) {
          attackSave = `+${attackMod}`;
        }
        // Check for save
        if (act?.save?.dc?.calculation) {
          // save.ability can be Set<string> or string
          const ability = act.save.ability;
          const saveAbility = (ability instanceof Set ? [...ability][0] : (ability ?? "")).toUpperCase().slice(0, 3);
          attackSave = `DC ${dc}${saveAbility ? " " + saveAbility : ""}`;
        }
        // Check for damage/healing
        const damageParts = act?.damage?.parts;
        const rawDamageArr = Array.isArray(damageParts) ? damageParts :
          damageParts instanceof Map ? Array.from(damageParts.values()) :
          damageParts && typeof damageParts === "object" ? Object.values(damageParts) : [];
        if (rawDamageArr.length > 0) {
          const first = rawDamageArr[0] as unknown;
          const formula = typeof first === "string" ? first :
            (first !== null && typeof first === "object" && "bonus" in first && typeof (first as { bonus: unknown }).bonus === "string"
              ? String((first as { bonus: string }).bonus) : "");
          if (formula) {
            // Resolve @mod
            effect = formula.replace(/@mod/g, String(abilityMod));
          }
        } else if (act?.healing?.formula) {
          effect = String(act.healing.formula).replace(/@mod/g, String(abilityMod));
        }
      } catch { /* ignore */ }
    }

    // Determine effect type if no damage/healing
    if (!effect) {
      // Check spell school to guess effect type
      const school = sys?.school ?? "";
      if (school === "enc" || school === "abj") effect = "Buff";
      else if (school === "ill") effect = "Control";
      else if (school === "div") effect = "Utility";
      else if (school === "nec") effect = "Debuff";
    }

    // Get source (class or feat that granted the spell)
    const source = sys?.sourceClass ?? item.flags?.dnd5e?.sourceClass ?? "";

    // Get material components description
    const materials = sys?.materials?.value ?? "";

    // Get higher level scaling description
    // In dnd5e 5.x, this is in the activities scaling or in the description
    let higherLevel = "";
    try {
      for (const act of getActivityValues(sys?.activities)) {
        if (act?.scaling?.formula || act?.scaling?.mode) {
          // There's scaling info, but actual text is often in description
          break;
        }
      }
    } catch { /* ignore */ }
    // Check for "At Higher Levels" section in description
    const descVal = sys?.description?.value ?? "";
    const higherMatch = descVal.match(/<p><strong>At Higher Levels[.:]?<\/strong>\s*(.*?)<\/p>/i) ||
                        descVal.match(/At Higher Levels[.:]?\s*([^<]+)/i);
    if (higherMatch) {
      higherLevel = higherMatch[1].replace(/<[^>]+>/g, "").trim();
    }

    // dnd5e 5.x: preparation.mode is deprecated, use method instead
    // preparation.prepared is deprecated, use prepared directly
    const spell: SpellData = {
      name: item.name ?? "",
      level,
      school: sys?.school ?? "",
      components,
      materials,
      concentration: isConc,
      ritual: !!(props && hasProperty(props, "ritual")),
      prepared: sys?.prepared ?? sys?.preparation?.prepared ?? false,
      description: sys?.description?.value ?? "",
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
      castingTime,
      range,
      duration,
      attackSave,
      effect,
      source,
      img: item.img ?? "",
      higherLevel,
    };

    if (!spellsByLevel.has(level)) spellsByLevel.set(level, []);
    spellsByLevel.get(level)!.push(spell);
  }

  // Sort each level: favorites first, then alphabetical
  for (const [, spells] of spellsByLevel) {
    spells.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return {
    ability: abilityLabel(spellcastingAbility),
    attackMod: prof + abilityMod,
    dc: 8 + prof + abilityMod,
    slots,
    spellsByLevel,
  };
}

/* ── Inventory ────────────────────────────────────────────── */

export function extractInventory(actor: any, favorites: Set<string>): InventoryItem[] {
  const inventoryTypes = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);
  const items = actor.items?.filter?.((i: any) => inventoryTypes.has(i.type)) ?? [];

  // Build a map of all items by ID
  const itemsById = new Map<string, InventoryItem>();
  const allItems: InventoryItem[] = [];

  for (const item of items) {
    const uses = item.system?.uses;
    // In dnd5e 5.x, items inside containers have system.container pointing to parent container ID
    const containerId = item.system?.container ?? null;

    // Extract price data (dnd5e stores it as system.price with value and denomination)
    const priceData = item.system?.price;
    const price = (priceData && typeof priceData.value === "number" && priceData.value > 0)
      ? { value: priceData.value, denomination: priceData.denomination ?? "gp" }
      : null;

    const invItem: InventoryItem = {
      id: item.id ?? "",
      name: item.name ?? "",
      type: item.type ?? "",
      img: item.img ?? "",
      quantity: item.system?.quantity ?? 1,
      weight: item.system?.weight?.value ?? item.system?.weight ?? 0,
      equipped: !!item.system?.equipped,
      rarity: item.system?.rarity ?? "",
      attunement: !!(item.system?.attunement),
      uses: (uses && uses.max) ? { value: uses.value ?? 0, max: uses.max ?? 0 } : null,
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
      containerId,
      contents: [],
      price,
    };

    allItems.push(invItem);
    if (invItem.id) {
      itemsById.set(invItem.id, invItem);
    }
  }

  // Build container hierarchy: assign items to their parent containers
  const topLevelItems: InventoryItem[] = [];
  const containers: InventoryItem[] = [];

  for (const item of allItems) {
    if (item.containerId && itemsById.has(item.containerId)) {
      // This item is inside a container - add it to the container's contents
      const container = itemsById.get(item.containerId)!;
      container.contents.push(item);
    } else if (item.type === "container") {
      // This is a top-level container
      containers.push(item);
    } else {
      // Top-level non-container item
      topLevelItems.push(item);
    }
  }

  // Sort top-level items: favorites first, then equipped, then alphabetical
  topLevelItems.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Sort containers alphabetically
  containers.sort((a, b) => a.name.localeCompare(b.name));

  // Sort contents within each container alphabetically
  for (const container of containers) {
    container.contents.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Return top-level items first, then containers at the bottom
  return [...topLevelItems, ...containers];
}

/* ── Features ─────────────────────────────────────────────── */

function getCategoryLabel(category: string): string {
  return FEAT_CATEGORY_LABELS[category] ?? category;
}

/**
 * Resolve a dot-separated path (e.g. "abilities.dex.mod") through a nested object,
 * returning the terminal value or undefined if any segment is missing.
 *
 * Delegates to `foundry.utils.getProperty`, which handles dot-notation traversal
 * natively and is the canonical Foundry v13 API for this operation.
 *
 * Used to resolve [[lookup @abilities.dex.mod]] style Foundry placeholders against
 * the actor's getRollData() output.
 */
function resolveRollDataPath(data: Record<string, unknown>, path: string): unknown {
  return foundry.utils.getProperty(data, path);
}

/**
 * Strip Foundry-specific enriched text for clean print output.
 * Handles @UUID references, [[lookup]] placeholders, and HTML tags.
 *
 * @param html     Raw HTML string from the item/actor description field.
 * @param rollData Optional actor roll data (from `actor.getRollData()`). When
 *                 provided, `[[lookup @variable]]` placeholders are resolved to
 *                 their actual values instead of being blanked out. This prevents
 *                 artefacts like "(currently )" where the number was stripped away.
 */
function stripEnrichedText(html: string, rollData?: Record<string, unknown>): string {
  return html
    // @UUID[Compendium.xxx.xxx]{DisplayName} -> "DisplayName"
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
    // [[lookup @name lowercase]] -> "the creature"
    .replace(/\[\[lookup\s+@name\s+lowercase\]\]/gi, "the creature")
    // [[lookup @name]] -> "The creature"
    .replace(/\[\[lookup\s+@name\]\]/gi, "The creature")
    // [[lookup @variable]] — resolve via roll data when available, otherwise strip.
    // The pattern optionally allows trailing modifier words like "lowercase".
    .replace(/\[\[lookup\s+@([a-zA-Z0-9_.]+)(?:\s+[a-z]+)?\]\]/gi, (_match, path: string) => {
      if (rollData) {
        const value = resolveRollDataPath(rollData, path);
        if (value !== undefined && value !== null) return String(value);
      }
      return "";
    })
    // [[/item Name]] -> "Name"
    .replace(/\[\[\/item\s+([^\]]+)\]\]/gi, "$1")
    // Remove other placeholders like [[/attack]], [[/damage average]], etc.
    .replace(/\[\[\/[^\]]+\]\]/g, "")
    // Remove remaining [[...]] placeholders
    .replace(/\[\[[^\]]*\]\]/g, "")
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Clean up "Foundry Note" text that sometimes appears
    .replace(/Foundry Note[^.]*\./gi, "")
    .trim();
}

/**
 * Extract item uses with proper recovery period handling for dnd5e 5.x.
 * Handles multiple formats:
 * - uses.recovery as array of objects [{period: "sr", ...}]
 * - uses.recovery as Collection (Map-like) - iterate with forEach
 * - uses.recovery as single object {period: "lr"}
 * - uses.recovery as string "lr"
 * - uses.per as legacy string ("sr", "lr", "day")
 */
function extractItemUses(item: any): FeatureData["uses"] | null {
  const uses = item?.system?.uses;
  if (!uses?.max) return null;

  let recovery = "";

  // Try to get recovery from the recovery array/collection (dnd5e 5.x)
  let recoveryArr: any[] = [];
  if (uses.recovery) {
    if (Array.isArray(uses.recovery)) {
      recoveryArr = uses.recovery;
    } else if (typeof uses.recovery.forEach === "function") {
      // Handle Collection/Map-like objects
      uses.recovery.forEach((r: any) => recoveryArr.push(r));
    } else if (typeof uses.recovery === "object" && uses.recovery.period) {
      // Single recovery object
      recoveryArr = [uses.recovery];
    } else if (typeof uses.recovery === "string") {
      // Legacy string format
      recovery = uses.recovery;
    }
  }

  // Extract period from recovery array
  if (recoveryArr.length > 0 && !recovery) {
    const rec = recoveryArr[0];
    if (rec?.period === "recharge" && rec?.formula) {
      const rechargeMin = parseInt(rec.formula) || 6;
      recovery = rechargeMin === 6 ? "Recharge 6" : `Recharge ${rechargeMin}–6`;
    } else if (rec?.period) {
      recovery = rec.period;
    }
  }

  // Fallback to uses.per (legacy format)
  if (!recovery && uses.per) {
    recovery = uses.per;
  }

  return {
    value: uses.value ?? 0,
    max: uses.max ?? 0,
    recovery,
  };
}

export function extractFeatures(actor: any, favorites: Set<string>): FeatureGroup[] {
  const featItems = actor.items?.filter?.((i: any) => i.type === "feat") ?? [];
  const groups = new Map<string, FeatureData[]>();

  // Resolve actor roll data once so [[lookup @variable]] placeholders in feature
  // descriptions are replaced with real character values (e.g. proficiency bonus).
  const rollData: Record<string, unknown> =
    typeof actor.getRollData === "function" ? (actor.getRollData() as Record<string, unknown>) : {};

  for (const item of featItems) {
    const category = item.system?.type?.value ?? "other";
    const categoryLabel = getCategoryLabel(category);

    // Strip enriched text (UUID links, placeholders) for clean print output.
    // Pass rollData so [[lookup @prof]] etc. resolve to actual numbers.
    const rawDescription = item.system?.description?.value ?? "";
    const cleanDescription = stripEnrichedText(rawDescription, rollData);

    const feature: FeatureData = {
      name: item.name ?? "",
      description: cleanDescription,
      uses: extractItemUses(item),
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
    };

    if (!groups.has(categoryLabel)) groups.set(categoryLabel, []);
    groups.get(categoryLabel)!.push(feature);
  }

  // Sort within each group: favorites first, then alphabetical
  const result: FeatureGroup[] = [];
  for (const [category, features] of groups) {
    features.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    result.push({ category, features });
  }

  // Sort groups by canonical order
  const order = ["Class Feature", "Race", "Background", "Feat", "Other"];
  result.sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return result;
}