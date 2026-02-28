/**
 * Single source of truth for print-sheet section definitions.
 *
 * Each entry declares the section key, its human-readable label, and whether
 * the section is enabled by default.  Both the settings UI and the system
 * extractors derive their section lists from this module — keeping them
 * perfectly in sync without duplication.
 */

import type { SectionDef, SheetType } from "./types";

/**
 * Full section definitions keyed by SheetType.
 * Each value is an ordered array of SectionDef objects ready for use in both
 * the options dialog and the extractor's getSections() method.
 */
export const SECTION_DEFINITIONS: Record<SheetType, SectionDef[]> = {
  character: [
    { key: "abilities",  label: "Ability Scores & Saves", default: true },
    { key: "skills",     label: "Skills",                 default: true },
    { key: "combat",     label: "Combat Stats",           default: true },
    { key: "actions",    label: "Actions",                default: true },
    { key: "features",   label: "Features & Traits",      default: true },
    { key: "spells",     label: "Spellcasting",           default: true },
    { key: "inventory",  label: "Inventory",              default: true },
    { key: "backstory",  label: "Backstory & Notes",      default: true },
    { key: "reference",  label: "Rules Reference Page",   default: true },
  ],
  npc: [
    { key: "stats",      label: "Core Stats",             default: true },
    { key: "traits",     label: "Traits",                 default: true },
    { key: "actions",    label: "Actions",                default: true },
    { key: "legendary",  label: "Legendary Actions",      default: true },
    { key: "lair",       label: "Lair Actions",           default: true },
    { key: "spells",     label: "Spellcasting",           default: true },
  ],
  encounter: [
    { key: "statblocks", label: "NPC Stat Blocks",        default: true },
  ],
  party: [
    { key: "summary",    label: "Party Summary Table",    default: true },
    { key: "skills",     label: "Top Skills per Member",  default: true },
  ],
};

/**
 * Derive a key→boolean defaults map for a sheet type.
 * Equivalent to the old SECTION_DEFAULTS constant but computed on-demand.
 */
export function getSectionDefaults(sheetType: SheetType): Record<string, boolean> {
  return Object.fromEntries(
    SECTION_DEFINITIONS[sheetType].map((s) => [s.key, s.default])
  );
}

/**
 * Derive a key→label map for a sheet type.
 * Equivalent to the old SECTION_LABELS constant but computed on-demand.
 */
export function getSectionLabels(sheetType: SheetType): Record<string, string> {
  return Object.fromEntries(
    SECTION_DEFINITIONS[sheetType].map((s) => [s.key, s.label])
  );
}

