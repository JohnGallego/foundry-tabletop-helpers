/**
 * Abstract base for system-specific HTML renderers.
 * Each game system (dnd5e, pf2e, etc.) provides its own subclass.
 */

import type { PrintOptions } from "../types";

export abstract class BaseRenderer {
  abstract readonly systemId: string;

  /** Render a character sheet as an HTML string */
  abstract renderCharacter(data: any, options: PrintOptions): string;

  /** Render an NPC stat block as an HTML string */
  abstract renderNPC(data: any, options: PrintOptions): string;

  /** Render multiple NPC stat blocks for an encounter group */
  abstract renderEncounterGroup(data: any, options: PrintOptions): string;

  /** Render a party summary table */
  abstract renderPartySummary(data: any, options: PrintOptions): string;

  /** Return the CSS for print styling (injected into the print window) */
  abstract getStyles(): string;
}

/* ── Renderer registry ─────────────────────────────────────── */

const renderers = new Map<string, BaseRenderer>();

/** Register a renderer for a game system */
export function registerRenderer(renderer: BaseRenderer): void {
  renderers.set(renderer.systemId, renderer);
}

/** Get the renderer for the current game system (or null if unsupported) */
export function getRenderer(systemId: string): BaseRenderer | null {
  return renderers.get(systemId) ?? null;
}

