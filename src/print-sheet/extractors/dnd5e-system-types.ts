/**
 * TypeScript type definitions for dnd5e 5.x system data structures.
 * Based on official source: https://github.com/foundryvtt/dnd5e (branch 5.3.x)
 *
 * These types reflect the actual runtime data structures in Foundry VTT with dnd5e 5.x.
 * Note: Many properties use Set<string> instead of string[] for collections.
 */

// =============================================================================
// DAMAGE DATA
// =============================================================================
// Source: module/data/shared/damage-field.mjs

/** A single damage part in an activity */
export interface Dnd5eDamageData {
  /** Number of dice (e.g., 4 for 4d10) */
  number?: number;
  /** Die size (e.g., 10 for d10) */
  denomination?: number;
  /** Bonus formula (e.g., "@mod", "+2") */
  bonus?: string;
  /** Damage types - NOTE: This is a Set, not an array! */
  types: Set<string>;
  /** Custom formula override */
  custom?: {
    enabled: boolean;
    formula?: string;
  };
  /** Scaling configuration */
  scaling?: {
    mode?: string;
    number?: number;
    formula?: string;
  };
}

// =============================================================================
// USES & RECOVERY
// =============================================================================
// Source: module/data/shared/uses-field.mjs, module/data/activity/base-activity.mjs

/** Recovery configuration for uses */
export interface Dnd5eRecoveryData {
  /**
   * Recovery period. For recharge abilities, this is just "recharge".
   * Other values: "lr" (long rest), "sr" (short rest), "day", "dawn", "dusk"
   */
  period: string;
  /**
   * For recharge: the minimum roll value (e.g., "5" for Recharge 5-6).
   * For other periods: may contain a formula.
   */
  formula?: string;
  /** Recovery type: "recoverAll", "formula", etc. */
  type?: string;
}

/** Item uses data */
export interface Dnd5eUsesData {
  /** Current uses remaining */
  value?: number;
  /** Maximum uses */
  max?: number;
  /** How uses are spent */
  spent?: number;
  /** Recovery configuration - array of recovery options */
  recovery?: Dnd5eRecoveryData[];
  /** Legacy: recovery period shorthand */
  per?: string;
}

// =============================================================================
// ACTIVITIES
// =============================================================================
// Source: module/data/activity/

/** Base activity data shared by all activity types */
export interface Dnd5eBaseActivityData {
  _id: string;
  type: "attack" | "save" | "damage" | "heal" | "utility" | "check" | "cast" | "enchant" | "forward" | "summon" | "transform";
  activation?: {
    type?: string; // "action", "bonus", "reaction", "attack", etc.
    value?: number;
    override?: boolean;
  };
  consumption?: {
    targets?: Array<{
      type: string; // "itemUses", "attribute", etc.
      target: string;
      value?: string;
    }>;
  };
  uses?: Dnd5eUsesData;
}

/** Attack activity data */
export interface Dnd5eAttackActivityData extends Dnd5eBaseActivityData {
  type: "attack";
  attack?: {
    ability?: string;
    bonus?: string;
    type?: {
      value?: string; // "melee", "ranged"
      classification?: string; // "weapon", "spell"
    };
  };
  damage?: {
    /** Include base weapon damage */
    includeBase?: boolean;
    /** Additional damage parts */
    parts?: Dnd5eDamageData[];
  };
}

/** Save activity data (breath weapons, etc.) */
export interface Dnd5eSaveActivityData extends Dnd5eBaseActivityData {
  type: "save";
  damage?: {
    /** What happens on successful save: "half", "none" */
    onSave?: string;
    /** Damage parts */
    parts?: Dnd5eDamageData[];
  };
  save?: {
    /** Ability for the save - NOTE: This is a Set, not a string! */
    ability: Set<string>;
    dc?: {
      /** DC calculation method: "spellcasting", ability key, or "" for flat */
      calculation?: string;
      /** Flat DC formula */
      formula?: string;
      /** Computed DC value (after preparation) */
      value?: number;
    };
  };
}

// =============================================================================
// ABILITY SCORES
// =============================================================================

/** Ability score save data - can be number or object */
export interface Dnd5eAbilitySaveData {
  value: number;
  roll?: {
    min?: number | null;
    max?: number | null;
    mode?: number;
  };
}

/** Single ability score data */
export interface Dnd5eAbilityData {
  value: number;
  /** Calculated modifier */
  mod?: number;
  /** Save bonus - can be a number OR an object with .value property */
  save?: number | Dnd5eAbilitySaveData;
  /** Proficiency in saves: 0 = none, 1 = proficient, 2 = expertise */
  proficient?: number;
  /** Bonuses */
  bonuses?: {
    check?: string;
    save?: string;
  };
  /** Minimum value */
  min?: number;
  /** Calculated DC for this ability */
  dc?: number;
}

/** All ability scores */
export interface Dnd5eAbilitiesData {
  str: Dnd5eAbilityData;
  dex: Dnd5eAbilityData;
  con: Dnd5eAbilityData;
  int: Dnd5eAbilityData;
  wis: Dnd5eAbilityData;
  cha: Dnd5eAbilityData;
}

// =============================================================================
// SKILLS
// =============================================================================

/** Single skill data */
export interface Dnd5eSkillData {
  value: number; // 0 = untrained, 1 = proficient, 2 = expertise, 0.5 = half-proficient
  ability: string; // "str", "dex", etc.
  /** Calculated total bonus */
  total?: number;
  /** Calculated passive score */
  passive?: number;
  bonuses?: {
    check?: string;
    passive?: string;
  };
}

/** All skills */
export interface Dnd5eSkillsData {
  acr: Dnd5eSkillData; // Acrobatics
  ani: Dnd5eSkillData; // Animal Handling
  arc: Dnd5eSkillData; // Arcana
  ath: Dnd5eSkillData; // Athletics
  dec: Dnd5eSkillData; // Deception
  his: Dnd5eSkillData; // History
  ins: Dnd5eSkillData; // Insight
  itm: Dnd5eSkillData; // Intimidation
  inv: Dnd5eSkillData; // Investigation
  med: Dnd5eSkillData; // Medicine
  nat: Dnd5eSkillData; // Nature
  prc: Dnd5eSkillData; // Perception
  prf: Dnd5eSkillData; // Performance
  per: Dnd5eSkillData; // Persuasion
  rel: Dnd5eSkillData; // Religion
  slt: Dnd5eSkillData; // Sleight of Hand
  ste: Dnd5eSkillData; // Stealth
  sur: Dnd5eSkillData; // Survival
}

// =============================================================================
// TRAITS (Resistances, Immunities, etc.)
// =============================================================================

/** Trait data (resistances, immunities, etc.) */
export interface Dnd5eTraitData {
  /** Values - NOTE: Can be Set<string> in 5.x! */
  value: Set<string> | string[];
  /** Bypasses (for resistances/immunities) */
  bypasses?: Set<string> | string[];
  /** Custom additions */
  custom?: string;
}

/** All creature traits */
export interface Dnd5eTraitsData {
  /** Size: "tiny", "sm", "med", "lg", "huge", "grg" */
  size?: string;
  /** Damage immunities */
  di?: Dnd5eTraitData;
  /** Damage resistances */
  dr?: Dnd5eTraitData;
  /** Damage vulnerabilities */
  dv?: Dnd5eTraitData;
  /** Condition immunities */
  ci?: Dnd5eTraitData;
  /** Languages */
  languages?: Dnd5eTraitData;
  /** Weapon proficiencies */
  weaponProf?: Dnd5eTraitData;
  /** Armor proficiencies */
  armorProf?: Dnd5eTraitData;
  /** Tool proficiencies */
  toolProf?: Dnd5eTraitData;
}

// =============================================================================
// SENSES
// =============================================================================

/** Creature senses */
export interface Dnd5eSensesData {
  darkvision?: number;
  blindsight?: number;
  tremorsense?: number;
  truesight?: number;
  /** Special sense notes */
  special?: string;
  /** Units: "ft", "m", etc. */
  units?: string;
}

// =============================================================================
// ACTOR SYSTEM DATA
// =============================================================================

/** Actor details (varies by actor type) */
export interface Dnd5eActorDetailsData {
  /** For NPCs: Challenge Rating (can be fraction like 0.125 for CR 1/8) */
  cr?: number;
  /** XP value */
  xp?: { value?: number };
  /** Creature type info */
  type?: {
    value?: string; // "humanoid", "dragon", etc.
    subtype?: string;
    custom?: string;
  };
  /** For characters: level */
  level?: number;
  /** For characters: race/species */
  race?: string | { name?: string };
  /** For characters: background */
  background?: string | { name?: string };
  /** Alignment */
  alignment?: string;
  /** Biography */
  biography?: {
    value?: string;
    public?: string;
  };
}

/** Actor attributes */
export interface Dnd5eActorAttributesData {
  /** Armor Class */
  ac?: {
    value?: number;
    flat?: number;
    calc?: string;
    formula?: string;
  };
  /** Hit Points */
  hp?: {
    value?: number;
    max?: number;
    temp?: number;
    tempmax?: number;
    formula?: string;
  };
  /** Initiative */
  init?: {
    ability?: string;
    bonus?: string | number;
    mod?: number;
    total?: number;
  };
  /** Movement speeds */
  movement?: {
    walk?: number;
    burrow?: number;
    climb?: number;
    fly?: number;
    swim?: number;
    hover?: boolean;
    units?: string;
  };
  /** Senses */
  senses?: Dnd5eSensesData;
  /** Spellcasting */
  spellcasting?: string; // Ability used for spellcasting
  /** Proficiency bonus */
  prof?: number;
  /** Spellcasting DC */
  spelldc?: number;
}

/** NPC-specific system data */
export interface Dnd5eNpcSystemData {
  abilities: Dnd5eAbilitiesData;
  attributes: Dnd5eActorAttributesData;
  details: Dnd5eActorDetailsData;
  traits: Dnd5eTraitsData;
  skills: Dnd5eSkillsData;
}

/** Character-specific system data */
export interface Dnd5eCharacterSystemData extends Dnd5eNpcSystemData {
  /** Character classes (embedded items) */
  classes?: Record<string, unknown>;
  /** Spell slots */
  spells?: Record<string, { value?: number; max?: number; override?: number }>;
  /** Resources */
  resources?: {
    primary?: { value?: number; max?: number; label?: string };
    secondary?: { value?: number; max?: number; label?: string };
    tertiary?: { value?: number; max?: number; label?: string };
  };
}

// =============================================================================
// ITEM SYSTEM DATA
// =============================================================================

/** Weapon range data */
export interface Dnd5eRangeData {
  value?: number;
  long?: number;
  units?: string; // "ft", "m", etc.
  reach?: number;
}

/** Weapon properties */
export interface Dnd5eWeaponPropertiesData {
  /** Set of property keys: "fin", "hvy", "lgt", "rch", "thr", "two", "ver", etc. */
  value?: Set<string> | string[];
}

/** Base item system data */
export interface Dnd5eItemSystemData {
  description?: {
    value?: string;
    chat?: string;
    unidentified?: string;
  };
  /** Item uses */
  uses?: Dnd5eUsesData;
  /**
   * Activities - Collection/Map of activity data.
   * Key is activity ID, value is activity data.
   */
  activities?: Map<string, Dnd5eBaseActivityData> | Record<string, Dnd5eBaseActivityData>;
  /** Source reference */
  source?: { custom?: string } | string;
}

/** Weapon item system data */
export interface Dnd5eWeaponSystemData extends Dnd5eItemSystemData {
  /** Weapon type: "simpleM", "simpleR", "martialM", "martialR" */
  type?: { value?: string; baseItem?: string };
  /** Range data */
  range?: Dnd5eRangeData;
  /** Weapon properties */
  properties?: Set<string> | string[];
  /** Damage formula (legacy - now in activities) */
  damage?: { parts?: Array<[string, string]>; versatile?: string };
  /** Proficiency: "sim" or "mar" */
  proficient?: boolean | number;
  /** Attack bonus */
  attackBonus?: string;
  /** Ability used for attack */
  ability?: string;
  /** Mastery property */
  mastery?: string;
}

/** Spell item system data */
export interface Dnd5eSpellSystemData extends Dnd5eItemSystemData {
  level?: number;
  school?: string;
  components?: {
    vocal?: boolean;
    somatic?: boolean;
    material?: boolean;
    concentration?: boolean;
    ritual?: boolean;
  };
  materials?: {
    value?: string;
    consumed?: boolean;
    cost?: number;
    supply?: number;
  };
  preparation?: {
    mode?: string;
    prepared?: boolean;
  };
  duration?: {
    value?: string | number;
    units?: string;
  };
  target?: {
    value?: number;
    units?: string;
    type?: string;
    width?: number;
  };
}

/** Feature/Feat item system data */
export interface Dnd5eFeatureSystemData extends Dnd5eItemSystemData {
  /** Feature type info */
  type?: {
    value?: string; // "class", "race", "monster", etc.
    subtype?: string;
  };
  /** Requirements */
  requirements?: string;
  /** Recharge (legacy - now in uses.recovery) */
  recharge?: {
    value?: number;
    charged?: boolean;
  };
}

// =============================================================================
// GROUP ACTOR DATA (Party/Encounter)
// =============================================================================

/** Group actor system data */
export interface Dnd5eGroupSystemData {
  /** Group type: "party" or "encounter" */
  type?: {
    value?: "party" | "encounter";
  };
  /** Member actors */
  members?: Array<{
    actor?: { id?: string; uuid?: string };
  }>;
  /** Group description */
  description?: {
    full?: string;
    summary?: string;
  };
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/** Activity union type (for when the concrete subtype is known) */
export type Dnd5eActivityData =
  | Dnd5eAttackActivityData
  | Dnd5eSaveActivityData
  | Dnd5eBaseActivityData;

/**
 * A broad activity shape that includes every optional field accessed by the
 * extractor layer. dnd5e activities vary by type, and the union type above is
 * too narrow for duck-typed access patterns. Use this when you need to read
 * optional sub-type fields without narrowing first.
 *
 * All non-base fields are optional so code that doesn't know the concrete
 * activity type can still do safe optional-chaining access.
 */
export interface Dnd5eAnyActivityData extends Dnd5eBaseActivityData {
  /** Attack configuration (present on "attack" activities) */
  attack?: {
    ability?: string;
    bonus?: string;
    flat?: number;
    type?: {
      value?: string;         // "melee" | "ranged"
      classification?: string; // "weapon" | "spell"
    };
  };
  /** Damage parts (present on "attack", "save", "damage" activities) */
  damage?: {
    includeBase?: boolean;
    onSave?: string;
    parts?: Dnd5eDamageData[] | Map<string, Dnd5eDamageData> | Record<string, Dnd5eDamageData>;
  };
  /** Save configuration (present on "save" activities) */
  save?: {
    ability?: Set<string> | string;
    dc?: {
      calculation?: string;
      formula?: string;
      value?: number;
    };
  };
  /** Healing configuration (present on "heal" activities) */
  healing?: {
    formula?: string;
    parts?: Dnd5eDamageData[];
  };
  /** Scaling configuration (present on spells and some features) */
  scaling?: {
    formula?: string;
    mode?: string;
  };
}

/**
 * Safely extract all activity values from a dnd5e `item.system.activities` object.
 *
 * dnd5e 4.x/5.x stores activities as one of three shapes at runtime:
 *   - `Map<string, ActivityData>`          — the native JS Map used internally
 *   - A Collection instance (Map-like)     — Foundry's Collection class with `.values()`
 *   - `Record<string, ActivityData>`       — plain object (older serialized forms)
 *
 * This helper normalises all three into a simple array so callers never need
 * to repeat the three-way duck-typing logic.
 *
 * Returns `Dnd5eAnyActivityData[]` so callers can safely access optional
 * sub-type fields without casting.
 *
 * @param activities - The raw value of `item.system.activities` (may be null/undefined).
 * @returns An array of activity data objects; empty array when input is absent.
 */
export function getActivityValues(
  activities:
    | Map<string, Dnd5eBaseActivityData>
    | Record<string, Dnd5eBaseActivityData>
    | null
    | undefined,
): Dnd5eAnyActivityData[] {
  if (!activities) return [];
  if (activities instanceof Map) {
    return Array.from(activities.values()) as Dnd5eAnyActivityData[];
  }
  // Foundry Collection and other Map-like objects expose `.values()`
  if (typeof (activities as { values?: unknown }).values === "function") {
    type Iterable = { values(): IterableIterator<Dnd5eBaseActivityData> };
    return Array.from((activities as unknown as Iterable).values()) as Dnd5eAnyActivityData[];
  }
  return Object.values(activities) as Dnd5eAnyActivityData[];
}

/**
 * Helper to safely extract first value from a Set or Array.
 * Use this when dealing with fields that can be Set<string> or string[].
 */
export function getFirstFromSetOrArray<T>(value: Set<T> | T[] | T | undefined): T | undefined {
  if (value instanceof Set) {
    return [...value][0];
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Helper to convert Set or Array to Array.
 * Use this when you need to iterate over values that might be Set or Array.
 */
export function toArray<T>(value: Set<T> | T[] | undefined): T[] {
  if (value instanceof Set) {
    return [...value];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

// =============================================================================
// EMBED CONTEXT TYPES
// =============================================================================
// Source: module/data/actor/npc.mjs - _prepareEmbedContext()
// These types describe what _prepareEmbedContext("2024") returns for NPCs

/**
 * A single action entry from the embed context.
 * The embed context provides pre-enriched HTML descriptions with resolved formulas.
 */
export interface Dnd5eEmbedAction {
  /** Action name, already includes uses label (e.g., "Breath Weapon (Recharge 5-6)") */
  name: string;
  /** Enriched HTML description with resolved damage formulas and inline rolls */
  description: string;
  /** Dataset for looking up the source item */
  dataset: {
    /** The item's ID within the actor */
    id: string;
    /** The item's identifier (e.g., "legendary-actions") */
    identifier?: string;
  };
  /** HTML opening tag if description started with one (e.g., "<p>") */
  openingTag?: string;
  /** Sort order from the source item */
  sort: number;
}

/**
 * An action section in the embed context (trait, action, bonus, reaction, legendary, mythic).
 */
export interface Dnd5eEmbedActionSection {
  /** Localized label for the section (e.g., "Actions", "Traits") */
  label: string;
  /** Whether to hide the label (e.g., for 2014 style traits) */
  hideLabel?: boolean;
  /** Section description (used for legendary/mythic actions intro text) */
  description?: string;
  /** Array of actions in this section */
  actions: Dnd5eEmbedAction[];
}

/**
 * The actionSections object structure from embed context.
 * Each key maps to a section with label and actions array.
 */
export interface Dnd5eEmbedActionSections {
  /** Passive traits (e.g., Keen Senses, Pack Tactics) */
  trait?: Dnd5eEmbedActionSection;
  /** Standard actions */
  action?: Dnd5eEmbedActionSection;
  /** Bonus actions */
  bonus?: Dnd5eEmbedActionSection;
  /** Reactions */
  reaction?: Dnd5eEmbedActionSection;
  /** Legendary actions */
  legendary?: Dnd5eEmbedActionSection;
  /** Mythic actions */
  mythic?: Dnd5eEmbedActionSection;
}

/**
 * Definition entry for stat block display (AC, HP, Speed, etc.)
 */
export interface Dnd5eEmbedDefinition {
  /** Localization key for the label */
  label: string;
  /** CSS classes (e.g., "half-width") */
  classes?: string;
  /** Array of definition values to display */
  definitions: (string | number)[];
}

/**
 * Ability table entry for 2024 style stat blocks.
 */
export interface Dnd5eEmbedAbilityTable {
  abilities: Array<{
    label: string;
    value: number;
    mod: number;
    save: { value: number };
  }>;
}

/**
 * Summary data with pre-formatted strings for stat block display.
 */
export interface Dnd5eEmbedSummary {
  /** Condition immunities (e.g., "Charmed, Frightened") */
  conditionImmunities?: string;
  /** CR with XP and PB (e.g., "4 (XP 1,100; PB +2)") */
  cr: string;
  /** Gear list (e.g., "Longsword, Shield") */
  gear?: string;
  /** Initiative (e.g., "+4 (14)") */
  initiative?: string;
  /** Languages (e.g., "Common, Draconic") */
  languages: string;
  /** Save proficiencies (e.g., "Dex +7, Con +5") */
  saves?: string;
  /** Senses with passive perception (e.g., "Darkvision 60 ft.; Passive Perception 14") */
  senses: string;
  /** Skills (e.g., "Perception +7, Stealth +6") */
  skills?: string;
  /** Speed (e.g., "30 ft., Fly 60 ft.") */
  speed: string;
  /** Tag line (e.g., "Medium Humanoid, Neutral Evil") */
  tag: string;
  /** Damage vulnerabilities */
  vulnerabilities?: string;
  /** Damage resistances */
  resistances?: string;
  /** Damage immunities */
  immunities?: string;
}

/**
 * The full context object returned by actor.system._prepareEmbedContext().
 * This provides all data needed to render an NPC stat block.
 */
export interface Dnd5eEmbedContext {
  /** Ability tables for 2024 style (3 tables of 2 abilities each) */
  abilityTables: Dnd5eEmbedAbilityTable[] | null;
  /** Action sections keyed by type */
  actionSections: Dnd5eEmbedActionSections;
  /** Reference to CONFIG.DND5E */
  CONFIG: unknown;
  /** Upper and lower definition rows for stat block */
  definitions: {
    lower: Dnd5eEmbedDefinition[];
    upper: Dnd5eEmbedDefinition[];
  };
  /** The source actor document */
  document: unknown;
  /** Rules version: "2014" or "2024" */
  rulesVersion: "2014" | "2024";
  /** Pre-formatted summary strings */
  summary: Dnd5eEmbedSummary;
  /** Reference to actor.system */
  system: unknown;
}
