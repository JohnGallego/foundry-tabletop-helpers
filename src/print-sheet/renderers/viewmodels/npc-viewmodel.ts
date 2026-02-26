/**
 * NPC ViewModel - "Render-ready" data structure for NPC stat blocks.
 * 
 * This interface contains all values pre-formatted for display,
 * so templates can render them without transformation logic.
 * All string values are pre-escaped for HTML safety.
 */

/* ── Main ViewModel ─────────────────────────────────────────── */

export interface NPCViewModel {
  // Identity
  name: string;
  /** Pre-selected image URL based on portrait option (or empty) */
  portraitUrl: string;
  hasPortrait: boolean;
  
  // Meta line: "Medium Humanoid (goblinoid), Lawful Evil"
  meta: string;
  
  // Core stats (all pre-formatted strings)
  ac: string;           // "16 (chain mail, shield)"
  initiative: string;   // "+2"
  hp: string;           // "65 (10d8 + 20)"
  speed: string;        // "30 ft., fly 60 ft."
  
  // Abilities in 2x3 grid layout (STR/INT, DEX/WIS, CON/CHA)
  abilityRows: AbilityRowViewModel[];
  
  // Trait lines (skills, resistances, senses, languages, CR)
  traitLines: TraitLineViewModel[];
  
  // Feature sections (each has title + entries)
  featureSections: FeatureSectionViewModel[];
  
  // CSS classes
  blockClass: string;   // "fth-statblock" or "fth-statblock fth-encounter-block"
  paperClass: string;   // "fth-paper-letter" or "fth-paper-a4"
  
  // Section visibility (from options)
  showStats: boolean;
  showAbilities: boolean;
  showTraits: boolean;
  showFeatures: boolean;
  showActions: boolean;
}

/* ── Ability Row (for 2x3 grid) ─────────────────────────────── */

export interface AbilityRowViewModel {
  left: AbilityCellViewModel | null;
  right: AbilityCellViewModel | null;
}

export interface AbilityCellViewModel {
  key: string;          // "STR"
  value: number;        // 16
  mod: string;          // "+3"
  save: string;         // "+5" or "+3" (if not proficient, same as mod)
}

/* ── Trait Lines ────────────────────────────────────────────── */

export interface TraitLineViewModel {
  label: string;        // "Skills", "Damage Resistances", etc.
  value: string;        // Pre-formatted value string
}

/* ── Feature Sections ───────────────────────────────────────── */

export interface FeatureSectionViewModel {
  title: string;        // "Traits", "Actions", "Legendary Actions"
  /** Optional intro text (for legendary/lair actions) */
  intro: string;
  entries: FeatureEntryViewModel[];
  hasEntries: boolean;  // Helper for {{#if}} in template
}

export interface FeatureEntryViewModel {
  /** Feature name with uses suffix: "Bite" or "Fire Breath (Recharge 5-6)" */
  nameWithUses: string;
  /** The full rendered description (may contain HTML for attacks) */
  description: string;
  /** True if description contains HTML that should not be escaped */
  isHtml: boolean;
}

