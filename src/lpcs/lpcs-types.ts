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

  /** Spells tab */
  spellcasting: LPCSSpellcasting | null;
  spellSlots: LPCSSpellSlotLevel[];
  spells: LPCSSpellLevel[];

  /** Inventory tab */
  inventory: LPCSInventoryItem[];
  currency: LPCSCurrencyEntry[];
  encumbrance: LPCSEncumbrance;

  /** Features tab */
  features: LPCSFeatureGroup[];
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
  range: string;
  properties: string[];
  mastery: string | null;
  img: string;
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

export interface LPCSInventoryItem {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  type: string;
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

