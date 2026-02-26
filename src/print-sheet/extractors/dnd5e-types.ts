/**
 * Type definitions for dnd5e extracted print data.
 * These interfaces define the normalized shape that the extractor produces
 * and the renderer consumes.
 */

/* ── Character Sheet ───────────────────────────────────────── */

export interface CharacterData {
  name: string;
  img: string;
  tokenImg: string;
  details: CharacterDetails;
  abilities: AbilityData[];
  skills: SkillData[];
  combat: CombatData;
  actions: CharacterActions;
  spellcasting: SpellcastingData | null;
  inventory: InventoryItem[];
  features: FeatureGroup[];
  proficiencies: ProficiencyData;
  favorites: Set<string>;
  backstory: string;
  traits: TraitData;
}

export interface ProficiencyData {
  armor: string[];
  weapons: string[];
  tools: string[];
  /** Individual weapon masteries the character has (e.g., "Longsword", "Javelin") */
  weaponMasteries: string[];
}

/** Character actions organized by activation type */
export interface CharacterActions {
  /** Weapon attacks displayed in table format */
  weapons: WeaponActionData[];
  /** Non-weapon actions (feats, class features with action activation) */
  actions: FeatureData[];
  bonusActions: FeatureData[];
  reactions: FeatureData[];
  /** Other features (like Sneak Attack) shown in separate table */
  other: FeatureData[];
}

/** Structured weapon data for table display */
export interface WeaponActionData {
  name: string;
  /** "Melee Weapon", "Ranged Weapon", "Melee or Ranged Weapon" */
  weaponType: string;
  /** Weapon mastery if applicable (e.g., "Vex", "Slow") */
  mastery: string;
  /** Whether the character has mastered this weapon type and can use the mastery */
  hasMastery: boolean;
  /** Range display: "5 ft." for reach, "80 (320)" for ranged */
  range: string;
  /** "Reach" or empty for ranged */
  rangeType: string;
  /** To-hit modifier: "+5" */
  toHit: string;
  /** Damage formula: "1d8+3" */
  damage: string;
  /** Damage type(s): "slashing", "piercing", etc. */
  damageType: string;
  /** Weapon properties: "Simple, Finesse, Light, Thrown" */
  properties: string;
  isFavorite: boolean;
}

export interface CharacterDetails {
  race: string;
  background: string;
  alignment: string;
  level: number;
  classes: ClassInfo[];
}

export interface ClassInfo {
  name: string;
  level: number;
  subclass: string;
}

export interface AbilityData {
  key: string;
  label: string;
  value: number;
  mod: number;
  save: number;
  proficient: boolean;
  saveProficient?: boolean;
}

export interface SkillData {
  key: string;
  label: string;
  total: number;
  passive: number;
  proficiency: number; // 0 | 0.5 | 1 | 2
  ability: string;
}

export interface CombatData {
  ac: number;
  hp: { value: number; max: number; temp: number; tempmax: number };
  death: { success: number; failure: number };
  initiative: number;
  speed: { key: string; value: number }[];
  proficiency: number;
  inspiration: boolean;
  senses: { key: string; value: number | string }[];
  /** Hit dice info by denomination, e.g., { "d10": { value: 2, max: 3 }, "d8": { value: 1, max: 1 } } */
  hitDice: Record<string, { value: number; max: number }>;
}

export interface TraitData {
  size: string;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  conditionImmunities: string[];
  languages: string[];
}

/* ── Spellcasting ──────────────────────────────────────────── */

export interface SpellcastingData {
  ability: string;
  attackMod: number;
  dc: number;
  slots: SpellSlotData[];
  spellsByLevel: Map<number, SpellData[]>;
}

export interface SpellSlotData {
  level: number;
  max: number;
  value: number;
  label: string;
}

export interface SpellData {
  name: string;
  level: number;
  school: string;
  components: string;
  /** Material component description if any */
  materials: string;
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  description: string;
  isFavorite: boolean;
  /** Casting time: "1A", "1BA", "1R", "1M", etc. */
  castingTime: string;
  /** Range: "Touch", "Self", "30 ft.", etc. */
  range: string;
  /** Duration: "Instant", "1m", "C 1h", etc. */
  duration: string;
  /** Attack or save info: "+4", "DC 12 WIS", etc. */
  attackSave: string;
  /** Effect type or damage: "Healing", "2d8+3", "Buff", etc. */
  effect: string;
  /** Source: "Cleric", "Magic Initiate (Druid)", etc. */
  source: string;
  /** Spell icon/image URL */
  img: string;
  /** Higher level scaling description */
  higherLevel: string;
}

/* ── Inventory ─────────────────────────────────────────────── */

export interface InventoryItem {
  /** Item ID (for container relationships) */
  id: string;
  name: string;
  type: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  rarity: string;
  attunement: boolean;
  uses: { value: number; max: number } | null;
  isFavorite: boolean;
  /** ID of container this item is inside (if any) */
  containerId: string | null;
  /** Items inside this container (populated during processing) */
  contents: InventoryItem[];
}

/* ── Features ──────────────────────────────────────────────── */

export interface FeatureGroup {
  category: string;
  features: FeatureData[];
}

export interface FeatureData {
  name: string;
  description: string;
  uses: { value: number; max: number; recovery: string } | null;
  isFavorite: boolean;
  /** For NPC attack actions - contains resolved attack/damage info */
  attack?: AttackData;
  /** Original item type: "weapon", "feat", etc. - used for sorting */
  itemType?: string;
}

export interface AttackData {
  /** "mwak" | "rwak" | "msak" | "rsak" | "save" | "other" */
  type: string;
  /** "+5" for attacks, or "" for non-attacks */
  toHit: string;
  /** "reach 5 ft" or "range 30/120 ft" or "reach 5 ft or range 20/60 ft" */
  reach: string;
  /** Damage entries: [{avg: 7, formula: "1d8 + 3", type: "Piercing"}] */
  damage: { avg: number; formula: string; type: string }[];
  /** For save-based: "DC 15 DEX" */
  save: string;
  /** True if this is a thrown melee weapon */
  thrown?: boolean;
}

/* ── NPC ───────────────────────────────────────────────────── */

export interface NPCData {
  name: string;
  img: string;
  tokenImg: string;
  cr: string;
  xp: number;
  proficiencyBonus: number;
  type: string;
  size: string;
  alignment: string;
  ac: number;
  acFormula: string;
  hp: { value: number; max: number; formula: string };
  initiative: number;
  speed: { key: string; value: number }[];
  abilities: AbilityData[];
  skills: { name: string; mod: number }[];
  gear: string[];
  traits: TraitData;
  senses: { key: string; value: number | string }[];
  passivePerception: number;
  languages: string[];
  features: FeatureData[];
  actions: FeatureData[];
  bonusActions: FeatureData[];
  reactions: FeatureData[];
  legendaryActions: { description: string; actions: FeatureData[] };
  lairActions: { description: string; actions: FeatureData[] };
  spellcasting: SpellcastingData | null;
}

/* ── Groups ────────────────────────────────────────────────── */

export interface EncounterGroupData {
  name: string;
  actors: NPCData[];
}

export interface PartySummaryData {
  name: string;
  members: PartyMemberSummary[];
}

export interface PartyMemberSummary {
  name: string;
  classes: string;
  level: number;
  species: string;
  background: string;
  senses: string;
  ac: number;
  hp: { max: number };
  proficiency: number;
  initiative: number;
  passives: { perception: number; insight: number; investigation: number };
  spellDC: number | null;
  saves: { key: string; mod: number; proficient: boolean }[];
  proficientSkills: { name: string; abbr: string; mod: number; ability: string }[];
  /** Spell slots by level (1-9), value is max slots */
  spellSlots: { level: number; max: number }[];
  /** Pact magic slots if warlock */
  pactSlots: { max: number; level: number } | null;
}

