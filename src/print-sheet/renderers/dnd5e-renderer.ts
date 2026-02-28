/**
 * D&D 5e (2024) HTML renderer.
 * Generates print-optimized HTML for character sheets, NPC stat blocks,
 * encounter groups, and party summaries.
 *
 * All rendering uses Handlebars templates via the ViewModel + Transformer pattern.
 */

import { BaseRenderer, registerRenderer } from "./base-renderer";
import printStyles from "./dnd5e-print.css?raw";
import {
  renderPrintTemplate,
  renderCharacterSheet,
  renderPartySummary,
  renderEncounterGroup,
} from "./template-engine";
import {
  transformNPCToViewModel,
  transformCharacterToViewModel,
  transformPartySummaryToViewModel,
  transformEncounterGroupToViewModel,
} from "./viewmodels";

import type { PrintOptions } from "../types";
import type {
  CharacterData, NPCData, EncounterGroupData, PartySummaryData,
} from "../extractors/dnd5e-types";

/* ── Renderer ────────────────────────────────────────────── */

export class Dnd5eRenderer extends BaseRenderer {
  readonly systemId = "dnd5e";

  /* ── Character Sheet ───────────────────────────────────── */

  async renderCharacter(data: CharacterData, options: PrintOptions): Promise<string> {
    // Use template-based rendering via ViewModel
    const viewModel = transformCharacterToViewModel(data, options);
    return renderCharacterSheet(viewModel);
  }

  /* ── NPC Stat Block ────────────────────────────────────── */

  async renderNPC(data: NPCData, options: PrintOptions): Promise<string> {
    // Use template-based rendering via ViewModel
    const viewModel = transformNPCToViewModel(data, options, false);
    return renderPrintTemplate("npc/statblock.hbs", viewModel);
  }

  /* ── Encounter Group ───────────────────────────────────── */

  async renderEncounterGroup(data: EncounterGroupData, options: PrintOptions): Promise<string> {
    // Render each NPC using template-based approach
    const blockPromises = data.actors.map(async npc => {
      const viewModel = transformNPCToViewModel(npc, options, true);
      return renderPrintTemplate("npc/statblock.hbs", viewModel);
    });
    const npcBlocks = await Promise.all(blockPromises);

    // Use template-based rendering via ViewModel
    const viewModel = transformEncounterGroupToViewModel(data, options, npcBlocks);
    return renderEncounterGroup(viewModel);
  }

  /* ── Party Summary (DM Screen Style) ─────────────────────── */

  async renderPartySummary(data: PartySummaryData, options: PrintOptions): Promise<string> {
    // Use template-based rendering via ViewModel
    const viewModel = transformPartySummaryToViewModel(data, options);
    return renderPartySummary(viewModel);
  }

  /* ── Styles ────────────────────────────────────────────── */

  getStyles(): string {
    return printStyles;
  }
}

// Auto-register when this module is imported
registerRenderer(new Dnd5eRenderer());
