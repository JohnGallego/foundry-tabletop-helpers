/**
 * Party Summary ViewModel - "Render-ready" data structure for DM reference sheets.
 * 
 * This interface contains all values pre-formatted for display,
 * so templates can render them without transformation logic.
 */

/* ── Main ViewModel ─────────────────────────────────────────── */

export interface PartySummaryViewModel {
  name: string;
  members: PartyMemberRowViewModel[];
  trackingCards: PartyTrackingCardViewModel[];
  paperClass: string;
}

/* ── Party Member Row (for DM table) ────────────────────────── */

export interface PartyMemberRowViewModel {
  // Identity column
  name: string;
  classInfo: string;         // "Fighter 3 / Rogue 2 • Lvl 5"
  speciesBackground: string; // "Human • Soldier"
  senses: string;

  // Combat column
  ac: number;
  hpMax: number;
  proficiency: string;       // "+3"
  initiative: string;        // "+2"

  // Passives column (with emoji icons)
  passivePerception: string; // "👁15"
  passiveInsight: string;    // "💭12"
  passiveInvestigation: string; // "🔍10"

  // Spell DC
  spellDcDisplay: string;    // "DC 15" or "—"

  // Saves (formatted list)
  saves: PartySaveViewModel[];

  // Skills (formatted string)
  skillsDisplay: string;     // "Ath +5, Per +7, Ste +4"
}

export interface PartySaveViewModel {
  profIcon: string;          // "●" or ""
  key: string;               // "STR"
  mod: string;               // "+3"
}

/* ── Tracking Card (for session tracking) ───────────────────── */

export interface PartyTrackingCardViewModel {
  name: string;
  ac: number;
  hpMax: number;
  
  // Spell slots
  spellSlots: SpellSlotRowViewModel[];
  hasSpellSlots: boolean;
  pactSlotDisplay: string;   // "P3 ☐☐" or ""
  hasPactSlot: boolean;
}

export interface SpellSlotRowViewModel {
  level: number;
  checkboxes: string;        // "☐☐☐☐"
}

