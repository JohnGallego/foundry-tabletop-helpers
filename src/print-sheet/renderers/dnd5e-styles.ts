/**
 * Print-optimized CSS for dnd5e character sheets, stat blocks, and summaries.
 * Returned as a string to be injected into the print window's <style> tag.
 */

export function getDnd5eStyles(): string {
  return `
/* ── Reset & Base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #1a1a1a;
  background: #fff;
  padding: 0.4in;
}

h1, h2, h3, h4 { font-family: "Segoe UI", Roboto, sans-serif; }

/* ── Character Sheet ──────────────────────────────────────── */
.fth-character { max-width: 7.5in; margin: 0 auto; }

.fth-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; border-bottom: 3px solid #7a200d; padding-bottom: 8px; }
.fth-portrait { width: 1.2in; height: 1.2in; object-fit: contain; object-position: center; border: 1px solid #999; border-radius: 4px; background: #f5f5f5; }
.fth-header-info { flex: 1; }
.fth-header-info h1 { font-size: 18pt; line-height: 1.1; color: #7a200d; }
.fth-subtitle { font-size: 9pt; color: #444; margin-top: 2px; }

/* HP Tracking area (pen and paper) */
.fth-hp-tracking { display: flex; flex-direction: column; gap: 4px; border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; background: #f9f9f9; min-width: 1.4in; }
.fth-track-row { display: flex; align-items: center; gap: 6px; font-size: 8pt; }
.fth-track-label { font-weight: 700; color: #555; text-transform: uppercase; font-size: 7pt; min-width: 0.7in; }
.fth-track-box { border: 1px solid #999; border-radius: 2px; min-width: 0.5in; height: 0.25in; background: white; }
.fth-track-box-sm { min-width: 0.35in; height: 0.2in; }
.fth-death-saves { flex-direction: column; align-items: flex-start; gap: 2px; }
.fth-save-row { display: flex; align-items: center; gap: 4px; }
.fth-save-label { font-size: 9pt; width: 12px; }
.fth-save-circles { font-size: 10pt; letter-spacing: 2px; }

/* Abilities and Saves row - same height */
.fth-abilities-saves-row { display: flex; gap: 12px; align-items: stretch; margin: 8px 0; }

/* Ability scores */
.fth-abilities { display: flex; gap: 6px; justify-content: center; flex: 1; }
.fth-ability { text-align: center; border: 1.5px solid #7a200d; border-radius: 4px; padding: 4px 6px; min-width: 0.7in; display: flex; flex-direction: column; justify-content: center; }
.fth-ability-label { display: block; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #7a200d; letter-spacing: 0.5px; }
.fth-ability-mod { display: block; font-size: 14pt; font-weight: 700; color: #1a1a1a; }
.fth-ability-score { display: block; font-size: 9pt; color: #666; }

/* Saves widget - matches ability box height */
.fth-saves-widget { border: 1.5px solid #7a200d; border-radius: 4px; padding: 6px 10px; background: #fdf8f6; min-width: 1.8in; display: flex; flex-direction: column; }
.fth-saves-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #7a200d; text-align: center; margin-bottom: 4px; letter-spacing: 0.5px; }
.fth-saves-grid { display: flex; gap: 12px; flex: 1; }
.fth-saves-column { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.fth-save-item { display: flex; align-items: center; gap: 4px; font-size: 8pt; padding: 2px 0; }
.fth-save-prof { font-size: 7pt; width: 10px; }
.fth-save-label { flex: 1; font-weight: 600; color: #333; }
.fth-save-value { font-weight: 700; color: #1a1a1a; min-width: 20px; text-align: right; }
.fth-save-features { margin-top: 6px; padding-top: 4px; border-top: 1px solid #ddd; }
.fth-save-feature { font-size: 6.5pt; color: #555; line-height: 1.3; margin-bottom: 2px; }

/* Advantage/Disadvantage symbols */
.fth-adv-symbol, .fth-dis-symbol { position: relative; display: inline-block; font-size: 1em; line-height: 1; }
.fth-adv-symbol { color: #2a7d2a; }
.fth-dis-symbol { color: #7d2a2a; }
.fth-adv-symbol > span, .fth-dis-symbol > span { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.5em; font-weight: 700; color: white; }

/* Combat stats row */
.fth-combat { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; justify-content: center; }
.fth-stat-box { text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; min-width: 1in; background: #f9f9f9; }
.fth-stat-label { display: block; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #555; }
.fth-stat-value { display: block; font-size: 12pt; font-weight: 700; }
.fth-checkbox { font-size: 14pt; }

/* Traits line */
.fth-traits-line { font-size: 8.5pt; color: #444; margin: 4px 0; }
.fth-traits-line strong { color: #1a1a1a; }

/* Header widgets row (passive scores + short rest) */
.fth-header-row-widgets { display: flex; gap: 12px; align-items: center; margin-top: 6px; }

/* Passive scores widget */
.fth-passive-scores { display: flex; gap: 8px; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; background: #f9f9f9; }
.fth-passive-item { text-align: center; min-width: 0.5in; }
.fth-passive-value { display: block; font-size: 11pt; font-weight: 700; color: #1a1a1a; }
.fth-passive-label { display: block; font-size: 5.5pt; font-weight: 600; text-transform: uppercase; color: #666; line-height: 1.1; }

/* Short rest tracker (with sun icon) */
.fth-short-rest-tracking { display: flex; align-items: center; gap: 6px; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; background: #f9f9f9; }
.fth-rest-icon { font-size: 14pt; color: #d4a017; }
.fth-rest-checkboxes { font-family: sans-serif; letter-spacing: 4px; font-size: 12pt; }

/* Header senses and defenses (under widgets) */
.fth-senses-defenses { margin-top: 4px; }
.fth-header-senses { font-size: 8pt; color: #555; }
.fth-header-defenses { font-size: 7.5pt; color: #555; margin-top: 2px; }
.fth-header-defenses strong { color: #333; }

/* Skills grid */
.fth-skills { margin: 8px 0; }
.fth-section-title { font-size: 11pt; font-weight: 700; color: #7a200d; border-bottom: 1.5px solid #7a200d; padding-bottom: 2px; margin-bottom: 6px; }
.fth-skills-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px 12px; font-size: 8.5pt; margin-left: 12px; }
.fth-skill { padding: 1px 0; }
.fth-skill-prof { font-weight: 700; }
.fth-skill-expert { font-weight: 700; color: #7a200d; }
.fth-fav { color: #d4a017; }
.fth-languages { font-size: 8.5pt; margin-top: 6px; padding-top: 4px; border-top: 1px solid #ddd; margin-left: 12px; }

/* Actions */
.fth-actions { margin: 8px 0; }
.fth-actions-content { margin-left: 12px; }
.fth-action-group { margin-bottom: 10px; margin-left: 8px; }
.fth-action-group h3 { font-size: 9pt; font-weight: 700; color: #555; margin-bottom: 4px; text-transform: uppercase; }
.fth-action-list { margin-left: 12px; }
.fth-action-item { font-size: 8.5pt; margin-bottom: 4px; line-height: 1.3; }
.fth-action-item strong { color: #1a1a1a; }
.fth-action-uses { font-size: 7.5pt; color: #666; margin-left: 4px; }
.fth-action-checkboxes { font-family: sans-serif; letter-spacing: 2px; font-size: 10pt; margin-left: 6px; }

/* Attack Table */
.fth-attack-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 6px; }
.fth-attack-table thead th {
  text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
  color: #555; border-bottom: 1.5px solid #999; padding: 3px 4px;
}
.fth-attack-table tbody td { padding: 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
.fth-attack-table tbody tr:last-child td { border-bottom: none; }

.fth-atk-name { min-width: 100px; }
.fth-atk-name strong { font-size: 9pt; }
.fth-atk-type { font-size: 7pt; color: #666; margin-top: 1px; display: flex; align-items: center; gap: 4px; }
.fth-mastery {
  display: inline-block; background: #7a200d; color: #fff; font-size: 6.5pt;
  padding: 1px 4px; border-radius: 2px; font-weight: 600; text-transform: uppercase;
}

.fth-atk-range { text-align: center; min-width: 50px; }
.fth-atk-range-val { font-weight: 600; }
.fth-atk-range-type { font-size: 7pt; color: #666; }

.fth-atk-hit { text-align: center; min-width: 40px; }
.fth-hit-val { font-weight: 700; font-size: 10pt; color: #333; }

.fth-atk-dmg { min-width: 70px; }
.fth-dmg-formula { font-weight: 600; display: block; }
.fth-dmg-type { font-size: 7pt; color: #666; display: block; }

.fth-atk-notes { font-size: 7.5pt; color: #555; max-width: 180px; line-height: 1.2; }

/* Combat actions reference */
.fth-combat-actions {
  font-size: 7.5pt; color: #555; margin: 6px 0; padding: 4px 6px;
  background: #f5f5f5; border-radius: 2px; line-height: 1.3;
}
.fth-combat-actions strong { color: #333; }

/* Feature-based actions */
.fth-feature-actions { margin-top: 8px; }

/* Spellcasting */
.fth-spellcasting { margin: 8px 0; }

/* Spellcasting stats header - compact design */
.fth-spell-stats {
  display: flex; justify-content: center; gap: 16px;
  margin: 4px 0 8px; padding: 4px 0;
  background: #f5f5f5; border-radius: 4px;
}
.fth-spell-stat { text-align: center; }
.fth-spell-stat-value { font-size: 11pt; font-weight: 700; color: #1a1a1a; display: block; }
.fth-spell-stat-label { font-size: 6pt; font-weight: 600; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }

/* Spell level groups - indented */
.fth-spell-level-group { margin-bottom: 10px; margin-left: 12px; break-inside: avoid; }
.fth-spell-level-header {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 2px solid #333; margin-bottom: 4px; padding-bottom: 2px;
}
.fth-level-label { font-size: 9pt; font-weight: 700; text-transform: uppercase; color: #333; }
.fth-slot-display { font-size: 8pt; color: #555; }
.fth-spell-slot-checkboxes { font-family: sans-serif; letter-spacing: 2px; font-size: 10pt; }

/* Spell table */
.fth-spell-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.fth-spell-table th {
  text-align: left; font-size: 7pt; font-weight: 600; text-transform: uppercase;
  color: #666; padding: 2px 4px; border-bottom: 1px solid #ccc;
}
.fth-spell-table td { padding: 3px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
.fth-spell-table tbody tr:last-child td { border-bottom: none; }
.fth-spell-name { font-weight: 500; min-width: 100px; }
.fth-spell-time { width: 35px; text-align: center; }
.fth-spell-range { width: 50px; }
.fth-spell-hit { width: 50px; text-align: center; }
.fth-spell-effect { width: 60px; }
.fth-spell-notes { width: 50px; font-size: 7.5pt; color: #666; }

/* Features */
.fth-features { margin: 8px 0; }
.fth-features-content { margin-left: 12px; }
.fth-feat-group { margin-bottom: 10px; margin-left: 8px; }
.fth-feat-group h3 {
  font-size: 9.5pt; font-weight: 700; color: #7a200d;
  margin: 8px 0 4px; padding-bottom: 2px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.fth-feat-list { margin-left: 12px; }
.fth-feat { margin-bottom: 5px; font-size: 8.5pt; }
.fth-feat-name { font-weight: 700; }
.fth-feat-uses { font-size: 7.5pt; color: #666; margin-left: 4px; }
.fth-feat-checkboxes { font-family: sans-serif; letter-spacing: 2px; font-size: 10pt; margin-left: 6px; }
.fth-feat-desc { color: #444; }

/* Proficiencies - own section */
.fth-proficiencies { margin: 8px 0; }
.fth-prof-content { margin-left: 12px; }
.fth-prof-line { font-size: 8.5pt; margin-bottom: 3px; }

/* Inventory */
.fth-inventory { margin: 8px 0; }
.fth-inv-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-left: 12px; max-width: calc(100% - 12px); }
.fth-inv-table th { text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #555; border-bottom: 1px solid #999; padding: 4px 6px; }
.fth-inv-table td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.fth-inv-col-active { width: 40px; text-align: center; }
.fth-inv-col-name { }
.fth-inv-col-weight { width: 50px; }
.fth-inv-col-qty { width: 35px; text-align: center; }
.fth-inv-active { text-align: center; }
.fth-eq-active { color: #7a200d; font-size: 10pt; }
.fth-eq-inactive { color: #999; }
.fth-inv-name-cell { }
.fth-inv-name-row { display: flex; align-items: center; gap: 4px; }
.fth-inv-item-name { font-weight: 600; }
.fth-inv-item-type { font-size: 7.5pt; color: #666; margin-left: 20px; }
.fth-inv-icon { width: 16px; height: 16px; object-fit: contain; flex-shrink: 0; }
.fth-inv-icon-placeholder { width: 16px; height: 16px; flex-shrink: 0; }
.fth-inv-weight { }
.fth-inv-qty { text-align: center; }
.fth-inv-total td { border-top: 1px solid #999; border-bottom: none; padding-top: 6px; }
/* Container contents indentation */
.fth-inv-contained { background-color: #f9f9f9; }
.fth-inv-indented { padding-left: 24px !important; }
.fth-inv-indented .fth-inv-item-name { font-weight: normal; font-style: italic; }
.fth-inv-indented .fth-inv-item-type { margin-left: 20px; }

/* Backstory */
.fth-backstory { margin: 8px 0; font-size: 8.5pt; }
.fth-backstory-content { max-height: 3in; overflow: hidden; color: #333; }

/* ── NPC Stat Block (2024 style) ──────────────────────────── */
.fth-statblock { max-width: 3.6in; border: 1.5px solid #7a200d; padding: 8px 10px; margin: 0 auto 16px; break-inside: avoid; }
.fth-statblock.fth-encounter-block { margin: 0 0 16px; }
.fth-sb-header h1 { font-size: 14pt; color: #7a200d; margin: 0; line-height: 1.1; }
.fth-sb-meta { font-size: 8pt; font-style: italic; color: #444; }
.fth-sb-portrait { width: 0.9in; height: 0.9in; object-fit: contain; object-position: center; float: right; margin: 0 0 4px 8px; border-radius: 3px; background: #f5f5f5; }
.fth-sb-divider { border: 0; border-top: 1.5px solid #7a200d; margin: 4px 0; }
.fth-sb-stats p { font-size: 8.5pt; margin: 1px 0; }
.fth-sb-stats strong { color: #1a1a1a; }
.fth-sb-abilities { width: 100%; border-collapse: collapse; text-align: center; font-size: 8pt; margin: 2px 0; }
.fth-sb-abilities th { font-size: 7pt; font-weight: 700; color: #7a200d; text-transform: uppercase; padding: 1px 4px; }
.fth-sb-abilities td { font-size: 8.5pt; padding: 1px 4px; }
.fth-sb-abilities-2024 { border: 1px solid #7a200d; }
.fth-sb-abilities-2024 thead th { font-size: 6.5pt; color: #666; padding: 2px 3px; border-bottom: 1px solid #7a200d; }
.fth-sb-abilities-2024 tbody th { font-weight: 700; color: #7a200d; text-align: left; padding: 2px 4px; }
.fth-sb-abilities-2024 tbody td { padding: 2px 4px; }
.fth-sb-abilities-2024 tbody td.score { font-weight: 600; }
.fth-sb-traits p { font-size: 8.5pt; margin: 1px 0; }
.fth-sb-section { margin: 4px 0; }
.fth-sb-section-title { font-size: 10pt; font-weight: 700; color: #7a200d; border-bottom: 1px solid #7a200d; margin: 6px 0 3px; }
.fth-sb-trait { font-size: 8.5pt; margin: 2px 0; }
.fth-sb-trait em { font-style: italic; }

/* ── Encounter Group ──────────────────────────────────────── */
.fth-encounter { max-width: 7.5in; margin: 0 auto; }
.fth-encounter > h1 { font-size: 16pt; color: #7a200d; border-bottom: 2px solid #7a200d; padding-bottom: 4px; margin-bottom: 10px; }
.fth-encounter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* ── Party Summary ────────────────────────────────────────── */
.fth-party { max-width: 7.5in; margin: 0 auto; }
.fth-party > h1 { font-size: 16pt; color: #7a200d; border-bottom: 2px solid #7a200d; padding-bottom: 4px; margin-bottom: 10px; }
.fth-party-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.fth-party-table th { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #555; border-bottom: 2px solid #7a200d; padding: 3px 5px; text-align: left; }
.fth-party-table td { padding: 3px 5px; border-bottom: 1px solid #ddd; }
.fth-party-table tr:nth-child(even) td { background: #f7f7f7; }
.fth-party-skills { font-size: 7.5pt; color: #555; }

/* ── Print Media ──────────────────────────────────────────── */
@media print {
  body { padding: 0; }
  @page { margin: 0.4in; }
  .fth-statblock { break-inside: avoid; }
  .fth-feat-group { break-inside: avoid; }
  .fth-spell-level { break-inside: avoid; }
  .fth-party-table tr { break-inside: avoid; }
  .fth-stat-box { background: none !important; }
  .fth-party-table tr:nth-child(even) td { background: none !important; }
}

@media print and (min-width: 0) {
  .fth-paper-letter { }
  .fth-paper-a4 { }
}
`;
}

