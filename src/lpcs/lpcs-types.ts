/**
 * LPCS View Model types.
 * These define the exact shape of data passed to Handlebars templates.
 * Templates should NEVER reach into actor.system directly — only use these.
 */

export interface LPCSViewModel {
  /** Character identity */
  name: string;
  img: string;
  subtitle: string;       // e.g., "Human Rogue 1"
  classLabel: string;     // e.g., "Fighter 5 / Wizard 3"
  level: number;
  species: string;
  background: string;
  inspiration: boolean;

  /** Core stats bar */
  hp: LPCSHitPoints;
  ac: number;
  speed: LPCSSpeed;
  initiative: string;
  proficiencyBonus: string;

  /** XP (null if levelingMode === "noxp") */
  xp: LPCSExperience | null;

  /** Abilities tab */
  abilities: LPCSAbility[];
  saves: LPCSSave[];
  skills: LPCSSkill[];
  senses: LPCSSense[];

  /** Combat tab */
  weapons: LPCSWeapon[];
  actions: LPCSAction[];
  bonusActions: LPCSAction[];
  reactions: LPCSAction[];
  combatGroups: LPCSCombatGroup[];

  /** Spells tab */
  spellcasting: LPCSSpellcasting | null;
  spellSlots: LPCSSpellSlotLevel[];
  spells: LPCSSpellLevel[];

  /** Inventory tab */
  inventory: LPCSInventoryItem[];
  containers: LPCSInventoryItem[];
  currency: LPCSCurrencyEntry[];
  encumbrance: LPCSEncumbrance;

  /** Features tab */
  features: LPCSFeatureGroup[];
  speciesTraits: LPCSFeatureGroup[];
  traits: LPCSTraitGroup[];
  proficiencies: LPCSProficiencies;

  /** Death saves */
  deathSaves: LPCSDeathSaves;

  /** Hit dice */
  hitDice: LPCSHitDice[];
  /** Pre-computed summary for the header quick-stats widget */
  hitDiceSummary: LPCSHitDiceSummary;

  /** Conditions */
  exhaustion: LPCSExhaustion;
}

export interface LPCSHitPoints {
  value: number;
  max: number;
  temp: number;
  pct: number;      // 0–100
  color: string;    // CSS color based on HP %
}

export interface LPCSExperience {
  value: number;
  max: number;
  pct: number;
}

export interface LPCSSpeed {
  primary: number;
  label: string;
  all: Array<{ type: string; value: number }>;
}

export interface LPCSAbility {
  key: string;        // "str"
  label: string;      // "Strength"
  abbr: string;       // "STR"
  score: number;      // 18
  mod: string;        // "+4"
  modValue: number;   // 4
  saveMod: string;    // "+4" — formatted saving throw modifier
  saveProficient: boolean;
}

export interface LPCSSave {
  key: string;
  abbr: string;
  mod: string;
  proficient: boolean;
}

export interface LPCSSkill {
  key: string;
  label: string;
  mod: string;
  modValue: number;
  ability: string;      // "DEX"
  proficient: boolean;
  profLevel: number;    // 0, 0.5, 1, 2
  passive: number;
  /** true for Perception, Investigation, Insight — skills that show passive DC */
  isPassiveRelevant: boolean;
  /** FA icon class for proficiency level */
  profIcon: string;
  /** CSS class for proficiency coloring */
  profCss: string;
  /** Skill description for the info popup */
  description: string;
  /** Example uses for the info popup */
  examples: string[];
}

export interface LPCSSkillGroup {
  label: string;
  skills: LPCSSkill[];
}


export interface LPCSSense {
  label: string;
  /** Pre-formatted display string, e.g. "60 ft." or free-text special sense */
  value: string;
}

export interface LPCSWeapon {
  id: string;
  name: string;
  attackBonus: string;  // "+7"
  damage: string;       // "1d8+4 piercing"
  damageFormula: string; // "1d8+4"
  damageType: string;    // "piercing"
  damageTypeIcon: string; // "fas fa-crosshairs"
  damageTypeCss: string;  // "lpcs-dmg--piercing"
  category: "melee" | "ranged" | "other";
  range: string;
  properties: string[];
  notes: string;
  mastery: string | null;
  img: string;
  /** FA icon class fallback when img is empty (e.g. unarmed strike) */
  iconClass: string;
  /** Active effect annotations (e.g. Dueling +2 damage) */
  effectAnnotations: LPCSEffectAnnotation[];
}

/** An annotation badge showing an active effect bonus on a weapon or stat. */
export interface LPCSEffectAnnotation {
  /** Human-readable source name, e.g. "Dueling", "Archery" */
  source: string;
  /** The change value, e.g. "+2" */
  value: string;
  /** What this modifies: "attack", "damage", "save-dc", "ac", "hp", etc. */
  target: string;
  /** Human-readable target label for display, e.g. "melee damage", "spell attack" */
  targetLabel: string;
  /** Icon from the source effect or item */
  icon: string;
  /** Combined display label, e.g. "+2 Dueling" */
  label: string;
}

export interface LPCSAction {
  id: string;
  name: string;
  description: string;
  img: string;
  uses: { value: number; max: number } | null;
  recharge: string | null;
}

export interface LPCSSpellcasting {
  ability: string;      // "INT"
  attackBonus: string;  // "+7"
  saveDC: number;
}

export interface LPCSSpellSlotLevel {
  level: number;
  label: string;
  slots: { value: number; max: number };
  pips: Array<{ n: number; filled: boolean }>;
}

export interface LPCSSpellLevel {
  level: number;
  label: string;
  spells: LPCSSpell[];
}

export interface LPCSSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  img: string;
  prepared: boolean;
  concentration: boolean;
  ritual: boolean;
  components: string;
  castingTime: string;
  range: string;
  description: string;
}

export interface LPCSItemPrice {
  value: number;
  denomination: string; // "gp", "sp", "cp", "ep", "pp"
}

export interface LPCSContainerCurrency {
  key: string;
  amount: number;
}

export interface LPCSInventoryItem {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  type: string;
  typeLabel: string;
  description: string;
  /** Pre-built stats block for weapons/armor shown above description in the detail modal. */
  statsBlock: string;
  rarity: string;
  rarityLabel: string;
  price: LPCSItemPrice | null;
  priceDisplay: { icon: string; label: string; cssClass: string }[];
  /** True when this item is a container (backpack, chest, bag of holding, etc.). */
  isContainer: boolean;
  /** Number of items inside this container, or 0 for non-containers. */
  contentsCount: number;
  /** Items stored inside this container. Only populated for containers. */
  contents: LPCSInventoryItem[];
  /** Currency stored inside this container (e.g., Bag of Holding with coins). */
  containerCurrency: LPCSContainerCurrency[];
  /** Capacity info string for containers (e.g., "12 / 30 lb"). */
  capacityLabel: string;
  /** Weight of contents inside this container. */
  contentsWeight: number;
  /** Max weight capacity (0 if no weight-based capacity). */
  capacityMax: number;
  /** Fill percentage 0–100 for the capacity bar. */
  capacityPct: number;
  /** CSS color for the capacity bar (green→gold→red). */
  capacityColor: string;
  /** ID of the parent container, or null if top-level. */
  containerId: string | null;
  /** True when this item type supports equip/unequip (weapons, armor, equipment, tools). */
  isEquippable: boolean;
}

/** One row in the currency bar — pre-built so templates can iterate with plain `{{#each}}`. */
export interface LPCSCurrencyEntry {
  key: string;    // "gp", "sp", etc.
  amount: number;
}

export interface LPCSEncumbrance {
  value: number;
  max: number;
  pct: number;
  encumbered: boolean;
}

export interface LPCSFeatureGroup {
  label: string;
  features: LPCSFeature[];
}

export interface LPCSFeature {
  id: string;
  name: string;
  img: string;
  description: string;
  uses: { value: number; max: number } | null;
  source: string;
  /** Active effects originating from this feature */
  effectAnnotations: LPCSEffectAnnotation[];
}

export interface LPCSTraitGroup {
  key: string;
  label: string;
  /** Pre-joined display string, e.g. "fire, cold, poison". */
  values: string;
}

export interface LPCSProficiencies {
  /** Pre-joined display strings — empty string when none. */
  armor: string;
  weapons: string;
  tools: string;
  languages: string;
}

/** Exhaustion pre-built with pip array so templates need no arithmetic helpers. */
export interface LPCSExhaustion {
  level: number;
  pips: Array<{ n: number; active: boolean }>;
}

export interface LPCSCombatSpell {
  id: string;
  name: string;
  level: number;
  img: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  /** "C" for cantrips, "Lvl 1" for level 1, etc. */
  levelLabel: string;
  /** Source that grants this spell: class name, feat name, etc. ("Cleric", "Magic Initiate") */
  source: string;

  /** Table columns */
  attackSave: string;      // "+7", "DC 15 WIS", or ""
  damageFormula: string;   // "3d8", "" for non-damaging
  damageType: string;      // "fire", "radiant", "healing", ""
  damageTypeIcon: string;  // FA class
  damageTypeCss: string;   // color class
  isHealing: boolean;      // true → show heart icon instead of damage type
  /** Effect label for non-damage spells: "Creation", "Utility", "Control", etc. */
  effectLabel: string;
  range: string;           // "Self", "Touch", "120 ft."
  castingTime: string;     // "1A", "1BA", "1R", "10m", "1h"
  /** Pre-computed notes: restrictions, duration, AoE, components combined */
  notes: string;
  /** AoE icon class (rendered separately in template) */
  aoeIcon: string;
  /** AoE size label e.g. "20 ft." */
  aoeLabel: string;
  /** Usage restriction label, e.g. "1/LR", "2/SR" */
  usesLabel: string;
  school: string;          // "evo", "abj", etc.
  /** Full spell description HTML for expanded detail panel */
  fullDescription: string;
  /** Active effect annotations (e.g. spell attack/damage bonuses) */
  effectAnnotations: LPCSEffectAnnotation[];
}

export interface LPCSStandardAction {
  key: string;
  name: string;
  /** Description with interpolated character values */
  description: string;
  icon: string;
}

export interface LPCSWeaponSubGroup {
  category: string;   // "melee" | "ranged" | "other"
  label: string;      // "Melee" | "Ranged" | "Other"
  weapons: LPCSWeapon[];
}

export interface LPCSCombatGroup {
  key: string;       // "action" | "bonus" | "reaction" | "other"
  label: string;     // "Actions" | "Bonus Actions" | "Reactions" | "Other"
  weaponGroups: LPCSWeaponSubGroup[];
  spells: LPCSCombatSpell[];
  items: LPCSAction[];
  standardActions: LPCSStandardAction[];
  isEmpty: boolean;
  /** True when spells should render before weapons (spellcasting classes) */
  spellsFirst: boolean;
}

export interface LPCSDeathSaves {
  successes: number;
  failures: number;
  show: boolean;
  /** Pre-built pip arrays so templates don't need `times` or `add` helpers. */
  successPips: Array<{ n: number; filled: boolean }>;
  failurePips: Array<{ n: number; filled: boolean }>;
  /** Current roll mode: "physical" (tap group to record) or "digital" (Foundry roll button). */
  rollMode: "physical" | "digital";
}

export interface LPCSHitDice {
  die: string;
  value: number;
  max: number;
  class: string;
}

/** Pre-computed hit dice summary for the header quick-stats card. */
export interface LPCSHitDiceSummary {
  /** Primary die denomination, e.g. "d8". Multi-class uses the highest-level class die. */
  die: string;
  /** Total available hit dice across all classes. */
  current: number;
  /** Total maximum hit dice across all classes. */
  max: number;
}

