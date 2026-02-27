/**
 * Character ViewModel - "Render-ready" data structure for PC character sheets.
 * 
 * This interface contains all values pre-formatted for display,
 * so templates can render them without transformation logic.
 * All string values are pre-escaped for HTML safety.
 */

/* ── Main ViewModel ─────────────────────────────────────────── */

export interface CharacterViewModel {
  // Identity
  name: string;
  portraitUrl: string;
  hasPortrait: boolean;
  
  // Subtitle: "Level 5 Fighter 3 / Rogue 2 (Champion) • Human • Soldier • Neutral Good"
  subtitle: string;
  
  // Header tracking widgets
  passives: PassiveScoreViewModel[];
  shortRestCheckboxes: string; // "☐ ☐"
  
  // Senses and defenses (header area)
  sensesLine: string;
  defensesLine: string;
  hasDefenses: boolean;
  
  // Combat stats
  combat: CombatStatsViewModel;
  
  // Abilities (6 ability scores)
  abilities: AbilityViewModel[];
  
  // Saves widget
  saves: SavesWidgetViewModel;
  
  // Skills
  skills: SkillViewModel[];
  
  // Actions section
  actions: ActionsViewModel;
  hasActions: boolean;
  
  // Spellcasting
  spellcasting: SpellcastingViewModel | null;
  hasSpellcasting: boolean;
  
  // Features & Traits
  featureGroups: FeatureGroupViewModel[];
  hasFeatures: boolean;
  
  // Proficiencies
  proficiencies: ProficiencyViewModel;
  hasProficiencies: boolean;
  
  // Inventory
  inventory: InventoryViewModel;
  hasInventory: boolean;

  // Currency
  currency: CurrencyViewModel;
  hasCurrency: boolean;

  // Spell cards (separate page)
  spellCards: SpellCardViewModel[];
  hasSpellCards: boolean;
  
  // Backstory
  backstory: string;
  hasBackstory: boolean;
  
  // CSS classes
  paperClass: string;
  
  // Section visibility (from options)
  showAbilities: boolean;
  showSkills: boolean;
  showActions: boolean;
  showSpells: boolean;
  showFeatures: boolean;
  showInventory: boolean;
  showBackstory: boolean;
}

/* ── Sub-ViewModels ─────────────────────────────────────────── */

export interface PassiveScoreViewModel {
  value: number;
  label: string;
}

export interface CombatStatsViewModel {
  ac: number;
  hpMax: number;
  hitDice: string;      // "3d10, 2d8"
  hitDieType: string;   // "d8", "d10", etc. (primary die type for icon)
  hitDieIcon: string;   // Unicode die icon or placeholder
  initiative: string;   // "+2"
  speed: string;        // "30 ft., 10 ft. swim"
  proficiency: string;  // "+3"
}

export interface AbilityViewModel {
  label: string;        // "STR"
  mod: string;          // "+3"
  score: number;        // 16
}

export interface SavesWidgetViewModel {
  leftColumn: SaveItemViewModel[];   // STR, DEX, CON
  rightColumn: SaveItemViewModel[];  // INT, WIS, CHA
  saveFeatures: string[];            // Pre-formatted save-related feature notes
}

export interface SaveItemViewModel {
  profIcon: string;     // "●" or "○"
  label: string;        // "Strength"
  abbr: string;         // "STR" (for compact displays)
  value: string;        // "+5"
}

export interface SkillViewModel {
  profIcon: string;     // "○", "◐", "●", "◆"
  mod: string;          // "+5"
  name: string;         // "Acrobatics"
  ability: string;      // "DEX"
  cssClass: string;     // "fth-skill" or "fth-skill fth-skill-prof" etc.
}

export interface ActionsViewModel {
  weapons: WeaponRowViewModel[];
  hasWeapons: boolean;
  combatActionsRef: string;  // Static reference text
  otherActions: ActionGroupViewModel[];
  bonusActions: ActionGroupViewModel[];
  reactions: ActionGroupViewModel[];
  other: ActionGroupViewModel[];
  masteryDescriptions: MasteryDescViewModel[];
  hasMasteryDescriptions: boolean;
}

export interface WeaponRowViewModel {
  favStar: string;
  name: string;
  masteryBadge: string;
  hasMastery: boolean;
  weaponType: string;
  range: string;
  rangeType: string;
  toHit: string;
  damage: string;
  damageType: string;
  properties: string;
}

export interface ActionGroupViewModel {
  title: string;
  items: ActionItemViewModel[];
  hasItems: boolean;
}

export interface ActionItemViewModel {
  favStar: string;
  name: string;
  usesDisplay: string;   // "(3/Long Rest)"
  checkboxes: string;    // "☐☐☐"
  description: string;
}

export interface MasteryDescViewModel {
  name: string;
  description: string;  // Pre-formatted with adv/dis symbols
}

/* ── Spellcasting ───────────────────────────────────────────── */

export interface SpellcastingViewModel {
  modifier: string;       // "+3"
  attackMod: string;      // "+5"
  saveDC: number;
  spellLevels: SpellLevelViewModel[];
}

export interface SpellLevelViewModel {
  levelLabel: string;     // "CANTRIPS" or "1ST LEVEL"
  slotCheckboxes: string; // "☐☐☐☐" or empty for cantrips
  hasSlots: boolean;
  spells: SpellRowViewModel[];
}

export interface SpellRowViewModel {
  favStar: string;
  name: string;
  tags: string;           // "(C)" or "(R)" or "(C)(R)"
  time: string;
  range: string;
  hitDc: string;
  effect: string;
  notes: string;
}

export interface SpellCardViewModel {
  name: string;
  concTag: string;        // '<span class="fth-spell-tag fth-tag-conc">C</span>' or ""
  ritualTag: string;
  levelSchool: string;    // "1st Level Evocation"
  imgUrl: string;
  hasImg: boolean;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  hasAttackSave: boolean;
  attackSave: string;
  effect: string;
  description: string;
  higherLevel: string;
  hasHigherLevel: boolean;
  source: string;
  hasSource: boolean;
}

/* ── Features ───────────────────────────────────────────────── */

export interface FeatureGroupViewModel {
  category: string;
  features: FeatureItemViewModel[];
}

export interface FeatureItemViewModel {
  favStar: string;
  name: string;
  usesDisplay: string;
  checkboxes: string;
  description: string;    // Pre-formatted with adv/dis symbols
}

/* ── Proficiencies ───────────────────────────────────────────── */

export interface ProficiencyViewModel {
  armor: string;
  hasArmor: boolean;
  weapons: string;
  hasWeapons: boolean;
  weaponMasteries: string;  // "⚔ Longsword, ⚔ Javelin"
  hasWeaponMasteries: boolean;
  tools: string;
  hasTools: boolean;
  languages: string;
  hasLanguages: boolean;
}

/* ── Inventory ───────────────────────────────────────────────── */

export interface InventoryViewModel {
  totalWeight: string;    // "45.5 lb"
  items: InventoryItemViewModel[];
}

export interface InventoryItemViewModel {
  eqIndicator: string;    // "■" or "—"
  imgUrl: string;
  hasImg: boolean;
  favStar: string;
  name: string;
  usesDisplay: string;    // "(3/5)" or ""
  meta: string;           // "×2 5lb"
  isIndented: boolean;    // For items in containers
  cssClass: string;
  // Pro sheet fields
  quantity: number;       // Raw quantity for display
  quantityDisplay: string; // "×3" or "" if 1
  cost: string;           // "50 gp" or ""
  hasCost: boolean;
  weight: string;         // "2 lb" or ""
  hasWeight: boolean;
  // Container groups
  isContainerGroup: boolean;
  containerItems: InventoryItemViewModel[];
}

/* ── Currency ────────────────────────────────────────────────── */

export interface CurrencyViewModel {
  coins: CoinViewModel[];
  totalGpValue: string;   // "125.5 gp" (total value converted to gold)
}

export interface CoinViewModel {
  type: string;           // "pp", "gp", "ep", "sp", "cp"
  label: string;          // "Platinum", "Gold", etc.
  abbr: string;           // "PP", "GP", etc.
  icon: string;           // Coin emoji/icon
  amount: number;         // Raw amount
  amountDisplay: string;  // Formatted display "1,234"
  hasCoins: boolean;      // true if amount > 0
}
