/**
 * Encounter Group ViewModel - "Render-ready" data structure for encounter printouts.
 * 
 * This is a simple wrapper that contains the group name and pre-rendered NPC blocks.
 */

export interface EncounterGroupViewModel {
  name: string;
  /** Pre-rendered NPC stat block HTML strings */
  npcBlocks: string[];
  paperClass: string;
}

