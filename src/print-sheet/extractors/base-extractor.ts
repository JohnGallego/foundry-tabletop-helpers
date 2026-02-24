/**
 * Abstract base for system-specific data extractors.
 * Each game system (dnd5e, pf2e, etc.) provides its own subclass.
 */

import type { PrintOptions, SectionDef, SheetType } from "../types";

export abstract class BaseExtractor {
  abstract readonly systemId: string;

  /** Return the available section toggles for a given sheet type */
  abstract getSections(type: SheetType): SectionDef[];

  /** Extract all data needed to render a character sheet */
  abstract extractCharacter(actor: any, options: PrintOptions): Promise<any>;

  /** Extract all data needed to render an NPC stat block */
  abstract extractNPC(actor: any, options: PrintOptions): Promise<any>;

  /** Extract data for all actors in an encounter group */
  abstract extractEncounterGroup(group: any, options: PrintOptions): Promise<any>;

  /** Extract party summary data from a party group */
  abstract extractPartySummary(group: any, options: PrintOptions): Promise<any>;
}

/* ── Extractor registry ────────────────────────────────────── */

const extractors = new Map<string, BaseExtractor>();

/** Register an extractor for a game system */
export function registerExtractor(extractor: BaseExtractor): void {
  extractors.set(extractor.systemId, extractor);
}

/** Get the extractor for the current game system (or null if unsupported) */
export function getExtractor(systemId: string): BaseExtractor | null {
  return extractors.get(systemId) ?? null;
}

