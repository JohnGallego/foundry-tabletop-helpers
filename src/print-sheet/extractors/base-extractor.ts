/**
 * Abstract base for system-specific data extractors.
 * Each game system (dnd5e, pf2e, etc.) provides its own subclass.
 */

import type { PrintOptions, SectionDef, SheetType } from "../types";

export abstract class BaseExtractor {
  abstract readonly systemId: string;

  /** Return the available section toggles for a given sheet type */
  abstract getSections(type: SheetType): SectionDef[];

  /**
   * Extract all data needed to render a character sheet.
   * The `actor` shape is system-specific; concrete subclasses narrow this type.
   */
  abstract extractCharacter(actor: unknown, options: PrintOptions): Promise<unknown>;

  /**
   * Extract all data needed to render an NPC stat block.
   * The `actor` shape is system-specific; concrete subclasses narrow this type.
   */
  abstract extractNPC(actor: unknown, options: PrintOptions): Promise<unknown>;

  /**
   * Extract data for all actors in an encounter group.
   * The `group` shape is system-specific; concrete subclasses narrow this type.
   */
  abstract extractEncounterGroup(group: unknown, options: PrintOptions): Promise<unknown>;

  /**
   * Extract party summary data from a party group.
   * The `group` shape is system-specific; concrete subclasses narrow this type.
   */
  abstract extractPartySummary(group: unknown, options: PrintOptions): Promise<unknown>;
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

