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

/* Abilities and Saves row - natural height */
.fth-abilities-saves-row { display: flex; gap: 12px; align-items: flex-start; margin: 8px 0; }

/* Ability scores */
.fth-abilities { display: flex; gap: 6px; justify-content: center; flex: 1; }
.fth-ability { text-align: center; border: 1.5px solid #7a200d; border-radius: 4px; padding: 4px 6px; min-width: 0.7in; }
.fth-ability-label { display: block; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #7a200d; letter-spacing: 0.5px; }
.fth-ability-mod { display: block; font-size: 14pt; font-weight: 700; color: #1a1a1a; }
.fth-ability-score { display: block; font-size: 9pt; color: #666; }

/* Saves widget */
.fth-saves-widget { border: 1.5px solid #7a200d; border-radius: 4px; padding: 6px 10px; background: #fdf8f6; min-width: 1.8in; }
.fth-saves-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #7a200d; text-align: center; margin-bottom: 4px; letter-spacing: 0.5px; }
.fth-saves-grid { display: flex; gap: 12px; }
.fth-saves-column { flex: 1; }
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
.fth-skill-mod { font-weight: 700; min-width: 22px; display: inline-block; }
.fth-skill-ability { font-size: 7pt; color: #888; }
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
  display: inline-block; background: #2d6a2d; color: #fff; font-size: 5.5pt;
  padding: 1px 3px; border-radius: 2px; font-weight: 600; text-transform: uppercase;
  margin-left: 4px; vertical-align: middle;
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

/* Spell Cards - new page with 2 cards per row */
.fth-spell-cards-page { page-break-before: always; margin-top: 12px; }
.fth-spell-cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-left: 12px; }
.fth-spell-card {
  position: relative;
  border: 1.5px solid #7a200d; border-radius: 6px; padding: 8px 10px 20px;
  background: #fefcfb; break-inside: avoid; font-size: 8pt;
}
.fth-spell-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.fth-spell-card-title { flex: 1; }
.fth-spell-card-name { display: inline; font-size: 11pt; font-weight: 700; color: #7a200d; line-height: 1.2; }
.fth-spell-card-name .fth-spell-tag { vertical-align: middle; margin-left: 6px; }
.fth-spell-card-level { display: block; font-size: 7.5pt; font-style: italic; color: #555; margin-top: 1px; }
.fth-spell-card-img { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; margin-left: 8px; border: 1px solid #ddd; }
.fth-spell-tag { font-size: 6.5pt; font-weight: 600; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; }
.fth-tag-conc { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
.fth-tag-ritual { background: #d4edda; color: #155724; border: 1px solid #28a745; }
.fth-spell-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; margin-bottom: 6px; font-size: 7.5pt; }
.fth-spell-card-stat strong { color: #333; }
.fth-spell-materials { font-style: italic; color: #666; font-size: 7pt; }
.fth-spell-card-atk { font-size: 7.5pt; margin-bottom: 4px; padding: 3px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
.fth-spell-card-desc { font-size: 7.5pt; color: #333; line-height: 1.35; margin-bottom: 4px; }
.fth-spell-higher { font-size: 7pt; color: #555; font-style: italic; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc; }
.fth-spell-source { position: absolute; bottom: 6px; right: 10px; font-size: 6.5pt; color: #888; }

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

/* Inventory - 2-column grid layout */
.fth-inventory { margin: 8px 0; }
.fth-inv-weight-total { font-weight: normal; font-size: 9pt; color: #666; }
.fth-inv-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 16px;
  font-size: 8pt; margin-left: 12px; max-width: calc(100% - 12px);
}
.fth-inv-item {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 0; border-bottom: 1px dotted #ddd;
}
.fth-inv-item-name { font-weight: 600; }
.fth-inv-uses { color: #666; font-size: 7pt; }
.fth-inv-meta { color: #888; font-size: 7pt; margin-left: auto; }
.fth-inv-icon { width: 14px; height: 14px; object-fit: contain; flex-shrink: 0; }
.fth-eq-active { color: #7a200d; font-size: 8pt; margin-right: 2px; }
.fth-eq-inactive { color: #bbb; font-size: 8pt; margin-right: 2px; }
/* Container groups stay together */
.fth-inv-container-group { break-inside: avoid; }
/* Container contents indentation */
.fth-inv-indented { padding-left: 16px; }
.fth-inv-indented .fth-inv-item-name { font-weight: normal; font-style: italic; }

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
.fth-encounter { max-width: 11in; margin: 0 auto; }
.fth-encounter > h1 { font-size: 16pt; color: #7a200d; border-bottom: 2px solid #7a200d; padding-bottom: 4px; margin-bottom: 10px; }
.fth-encounter-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: start; }
.fth-encounter-grid .fth-statblock { max-width: none; margin: 0; }

/* ── DM Screen / Party Summary ───────────────────────────── */
.fth-dm-screen { margin: 0 auto; }
.fth-dm-screen > h1 { font-size: 14pt; color: #7a200d; border-bottom: 2px solid #7a200d; padding-bottom: 4px; margin-bottom: 8px; }
.fth-dm-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.fth-dm-table th {
  font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #555;
  border-bottom: 2px solid #7a200d; padding: 3px 4px; text-align: left; white-space: nowrap;
}
.fth-dm-table td { padding: 4px 5px; border-bottom: 1px solid #ccc; vertical-align: top; }
.fth-dm-table tr:nth-child(even) td { background: #f9f9f9; }

/* Column widths */
.fth-dm-col-identity { width: 18%; }
.fth-dm-col-combat { width: 12%; }
.fth-dm-col-passives { width: 10%; }
.fth-dm-col-spell { width: 6%; text-align: center; }
.fth-dm-col-saves { width: 22%; }
.fth-dm-col-skills { width: 32%; }

/* Identity column */
.fth-dm-identity { }
.fth-dm-name { font-weight: 700; font-size: 9pt; color: #7a200d; }
.fth-dm-details { font-size: 7pt; color: #555; }
.fth-dm-senses { font-size: 6.5pt; color: #777; font-style: italic; margin-top: 2px; }

/* Combat stats */
.fth-dm-combat { }
.fth-dm-stat { display: inline-block; margin-right: 6px; white-space: nowrap; }
.fth-dm-label { font-size: 6.5pt; color: #666; text-transform: uppercase; }
.fth-dm-val { font-weight: 700; font-size: 9pt; }

/* Passives */
.fth-dm-passives { white-space: nowrap; }
.fth-dm-passive { display: inline-block; margin-right: 4px; font-size: 8pt; }

/* Spell DC */
.fth-dm-spelldc { text-align: center; font-weight: 600; }

/* Saves */
.fth-dm-saves { font-size: 7pt; }
.fth-dm-save { display: inline-block; margin-right: 4px; white-space: nowrap; }
.fth-dm-save:nth-child(3n)::after { content: ""; display: block; }

/* Skills */
.fth-dm-skills { font-size: 7pt; color: #444; line-height: 1.4; }

/* ── Session Tracking Cards ─────────────────────────────────── */
.fth-track-section { margin-top: 16px; }
.fth-track-section h2 { font-size: 12pt; color: #7a200d; border-bottom: 1px solid #7a200d; margin-bottom: 8px; }
.fth-track-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }

.fth-track-card {
  border: 1.5px solid #7a200d; border-radius: 4px; padding: 6px 8px;
  background: #fefcfb; break-inside: avoid; font-size: 8pt;
}
.fth-track-header {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px;
}
.fth-track-name { font-weight: 700; font-size: 10pt; color: #7a200d; }
.fth-track-ac { font-weight: 600; font-size: 9pt; }

.fth-track-body { }
.fth-track-row { display: flex; align-items: center; margin-bottom: 3px; gap: 6px; }
.fth-track-label { font-weight: 600; font-size: 7pt; text-transform: uppercase; color: #555; min-width: 55px; }
.fth-track-max { font-size: 9pt; font-weight: 600; }
.fth-track-box {
  flex: 1; height: 16px; border: 1px solid #999; border-radius: 2px;
  background: #fff; max-width: 60px;
}
.fth-track-box-sm { max-width: 40px; height: 14px; }
.fth-track-checks { font-size: 10pt; letter-spacing: 1px; }
.fth-track-inline { font-size: 8pt; }

/* Death saves */
.fth-death-success { color: #2d6a2d; margin-right: 8px; }
.fth-death-fail { color: #7a200d; }

/* Spell slots */
.fth-track-slots { align-items: flex-start; }
.fth-slots-grid { display: flex; flex-wrap: wrap; gap: 2px 8px; }
.fth-slot-row { white-space: nowrap; font-size: 9pt; }
.fth-slot-lvl {
  display: inline-block; width: 14px; height: 14px; line-height: 14px;
  text-align: center; background: #7a200d; color: #fff; border-radius: 2px;
  font-size: 7pt; font-weight: 600; margin-right: 2px;
}

/* Conditions */
.fth-track-conditions {
  display: flex; flex-wrap: wrap; gap: 2px 6px;
  margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;
}
.fth-cond { font-size: 7pt; white-space: nowrap; }

/* ── Print Media ──────────────────────────────────────────── */
@media print {
  body { padding: 0; }
  @page { margin: 0.4in; }

  /* SUBSECTIONS: Keep these atomic units together - never break inside */
  .fth-statblock { break-inside: avoid; }
  .fth-action-group { break-inside: avoid; }
  .fth-feat-group { break-inside: avoid; }
  .fth-spell-level { break-inside: avoid; }
  .fth-spell-card { break-inside: avoid; }
  .fth-inv-container-group { break-inside: avoid; }
  .fth-dm-table tr { break-inside: avoid; }
  .fth-track-card { break-inside: avoid; }
  .fth-combat { break-inside: avoid; }
  .fth-abilities-saves-row { break-inside: avoid; }
  .fth-skills { break-inside: avoid; }

  /* Section titles must stay with following content */
  .fth-section-title { break-after: avoid; }
  h3 { break-after: avoid; }

  /* PARENT SECTIONS: Allow breaks between subsections to avoid large gaps */
  /* These sections CAN break, but only between their child subsections */
  .fth-actions { break-before: auto; }
  .fth-features { break-before: auto; }
  .fth-inventory { break-before: auto; }
  .fth-spellcasting { break-before: auto; }

  /* Spell cards always on new page */
  .fth-spell-cards-page { page-break-before: always; }

  /* Orphans/widows - require at least 3 lines before/after page break */
  p, .fth-feat, .fth-action-item, .fth-inv-item { orphans: 3; widows: 3; }

  /* Background removal for print */
  .fth-stat-box { background: none !important; }
  .fth-dm-table tr:nth-child(even) td { background: none !important; }
}

/* DM Screen prints in landscape */
@media print {
  .fth-dm-screen {
    @page { size: landscape; margin: 0.3in; }
  }
}

@media print and (min-width: 0) {
  .fth-paper-letter { }
  .fth-paper-a4 { }
}

/* ══════════════════════════════════════════════════════════════════════════
   PRO CHARACTER SHEET STYLES - Premium RPG-themed design
   ══════════════════════════════════════════════════════════════════════════ */

.fth-pro-sheet {
  font-family: 'Crimson Text', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  color: #1a1a1a;
  background: #faf8f5;
  padding: 16px;
  line-height: 1.35;
  max-width: 8.5in;
  margin: 0 auto;
}

/* ─── Header ───────────────────────────────────────────────────────────── */
.fth-pro-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  background: linear-gradient(135deg, #2c1810 0%, #4a2c2a 50%, #2c1810 100%);
  border: 3px solid #8b4513;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
}
.fth-pro-header-portrait {
  height: 80px;
  width: 80px;
  flex-shrink: 0;
}
.fth-pro-portrait {
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 4px;
}
.fth-pro-header-center { text-align: center; }
.fth-pro-name {
  font-size: 24pt;
  font-weight: 700;
  color: #f4e4bc;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  margin: 0;
  letter-spacing: 1px;
}
.fth-pro-subtitle {
  font-size: 10pt;
  color: #d4a574;
  font-style: italic;
  margin-top: 2px;
}
.fth-pro-header-right { text-align: center; }
.fth-pro-hp-block {
  background: rgba(0,0,0,0.3);
  border: 1px solid #8b4513;
  border-radius: 6px;
  padding: 8px 12px;
}
.fth-pro-hp-label {
  font-size: 7pt;
  text-transform: uppercase;
  color: #d4a574;
  letter-spacing: 1px;
}
.fth-pro-hp-max {
  font-size: 20pt;
  font-weight: 700;
  color: #e74c3c;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}
.fth-pro-hp-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.fth-pro-hp-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.fth-pro-hp-cell-label {
  font-size: 6pt;
  color: #d4a574;
  text-transform: uppercase;
}
.fth-pro-hp-box {
  display: inline-block;
  width: 36px;
  height: 18px;
  border: 1px solid #666;
  background: #fff;
  border-radius: 2px;
}

/* ─── Core Stats Row (Stats + Saves + Death Saves) ────────────────────── */
.fth-pro-core-row {
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.fth-pro-stat-gem {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #f5f0e6 0%, #e8dcc8 100%);
  border: 2px solid #8b7355;
  border-radius: 8px;
  padding: 6px 12px;
  min-width: 60px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.fth-pro-stat-icon { font-size: 12pt; }
.fth-pro-stat-val {
  font-size: 14pt;
  font-weight: 700;
  color: #2c1810;
}
.fth-pro-stat-lbl {
  font-size: 6pt;
  text-transform: uppercase;
  color: #666;
  letter-spacing: 0.5px;
}

/* ─── Compact Saves Card (in core row) ─────────────────────────────────── */
.fth-pro-core-card {
  background: linear-gradient(145deg, #f5f0e6 0%, #e8dcc8 100%);
  border: 2px solid #8b7355;
  border-radius: 8px;
  padding: 6px 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.fth-pro-core-card-title {
  font-size: 7pt;
  text-transform: uppercase;
  color: #666;
  letter-spacing: 0.5px;
  text-align: center;
  margin-bottom: 4px;
  font-weight: 600;
}
.fth-pro-saves-compact { min-width: 100px; }
.fth-pro-saves-mini {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}
.fth-pro-save-mini {
  font-size: 8pt;
  display: flex;
  align-items: center;
  gap: 2px;
}
.fth-pro-save-mini-val {
  font-weight: 700;
  color: #2c1810;
  min-width: 20px;
}

/* ─── Compact Death Saves Card (in core row) ───────────────────────────── */
.fth-pro-death-compact { min-width: 70px; }
.fth-pro-death-mini { font-size: 9pt; }
.fth-pro-death-mini-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0;
}
.fth-pro-death-success { color: #2d6a2d; }
.fth-pro-death-fail { color: #a02020; }

/* ─── Ability Scores (Hex Layout) ──────────────────────────────────────── */
.fth-pro-abilities {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.fth-pro-ability-hex {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #4a2c2a 0%, #2c1810 100%);
  border: 2px solid #d4a574;
  border-radius: 6px;
  padding: 8px 10px;
  min-width: 52px;
  box-shadow: 0 3px 6px rgba(0,0,0,0.3);
}
.fth-pro-ability-mod {
  font-size: 16pt;
  font-weight: 700;
  color: #f4e4bc;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  line-height: 1;
}
.fth-pro-ability-name {
  font-size: 6pt;
  text-transform: uppercase;
  color: #d4a574;
  letter-spacing: 1px;
  margin: 2px 0;
}
.fth-pro-ability-score {
  font-size: 8pt;
  color: #999;
}

/* ─── Two Column Layout ────────────────────────────────────────────────── */
.fth-pro-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.fth-pro-col-left, .fth-pro-col-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ─── Card Components ──────────────────────────────────────────────────── */
.fth-pro-card {
  background: #fff;
  border: 1.5px solid #c9b896;
  border-radius: 6px;
  padding: 8px 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}
.fth-pro-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 2px solid #7a200d;
  padding-bottom: 4px;
  margin-bottom: 6px;
}
.fth-pro-card-header h2 {
  font-size: 10pt;
  font-weight: 700;
  color: #7a200d;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.fth-pro-card-icon { font-size: 12pt; }

/* ─── Saving Throws Card ───────────────────────────────────────────────── */
.fth-pro-saves-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 12px;
}
.fth-pro-save-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 8.5pt;
  padding: 1px 0;
}
.fth-pro-save-prof { width: 12px; text-align: center; }
.fth-pro-save-name { flex: 1; }
.fth-pro-save-val { font-weight: 700; min-width: 24px; text-align: right; }
.fth-pro-save-features {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed #ddd;
  font-size: 7.5pt;
  color: #555;
}
.fth-pro-save-feature { margin-bottom: 2px; }

/* ─── Passive Senses Card ──────────────────────────────────────────────── */
.fth-pro-passives-row {
  display: flex;
  justify-content: space-around;
  gap: 8px;
}
.fth-pro-passive {
  text-align: center;
}
.fth-pro-passive-val {
  font-size: 14pt;
  font-weight: 700;
  color: #2c1810;
  display: block;
}
.fth-pro-passive-lbl {
  font-size: 6pt;
  text-transform: uppercase;
  color: #666;
}
.fth-pro-senses-extra {
  text-align: center;
  font-size: 7.5pt;
  color: #555;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #ddd;
}

/* ─── Skills Card ──────────────────────────────────────────────────────── */
.fth-pro-skills-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px 8px;
  font-size: 7.5pt;
}
.fth-pro-skill {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 0;
}
.fth-pro-skill-prof { width: 10px; text-align: center; font-size: 8pt; }
.fth-pro-skill-mod { font-weight: 700; min-width: 20px; }
.fth-pro-skill-name { color: #444; }
.fth-pro-skill.fth-skill-prof .fth-pro-skill-name { font-weight: 600; color: #1a1a1a; }
.fth-pro-skill.fth-skill-expert .fth-pro-skill-name { font-weight: 700; color: #7a200d; }

/* ─── Defenses Card ────────────────────────────────────────────────────── */
.fth-pro-defenses-content {
  font-size: 8pt;
  line-height: 1.4;
}

/* ─── Death Saves Card ─────────────────────────────────────────────────── */
.fth-pro-death-grid { }
.fth-pro-death-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}
.fth-pro-death-label { font-size: 8pt; }
.fth-pro-death-boxes { font-size: 12pt; letter-spacing: 4px; }
.fth-pro-death-success .fth-pro-death-label { color: #2d6a2d; }
.fth-pro-death-fail .fth-pro-death-label { color: #a02020; }

/* ─── Rest Tracking Card ───────────────────────────────────────────────── */
.fth-pro-rest-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  font-size: 8pt;
}
.fth-pro-rest-label { color: #444; }
.fth-pro-rest-checks { font-size: 11pt; letter-spacing: 2px; }

/* ─── Proficiencies Card ───────────────────────────────────────────────── */
.fth-pro-prof-content { font-size: 8pt; line-height: 1.4; }
.fth-pro-prof-line { margin-bottom: 3px; }
.fth-pro-prof-line strong { color: #555; }
.fth-pro-mastery { color: #2d6a2d; }

/* ─── Section Styling ──────────────────────────────────────────────────── */
.fth-pro-section {
  background: #fff;
  border: 1.5px solid #c9b896;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  break-inside: avoid;
}
.fth-pro-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid #7a200d;
  padding-bottom: 6px;
  margin-bottom: 10px;
}
.fth-pro-section-header h2 {
  font-size: 12pt;
  font-weight: 700;
  color: #7a200d;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  flex: 1;
}
.fth-pro-section-icon { font-size: 14pt; }

/* ─── Pro Attack Table ─────────────────────────────────────────────────── */
.fth-pro-attack-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-bottom: 8px;
}
.fth-pro-attack-table thead th {
  text-align: left;
  font-size: 7pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #666;
  border-bottom: 1.5px solid #999;
  padding: 4px 6px;
}
.fth-pro-attack-table tbody td {
  padding: 5px 6px;
  border-bottom: 1px solid #e8e0d0;
  vertical-align: top;
}
.fth-pro-attack-table tbody tr:last-child td { border-bottom: none; }
.fth-pro-atk-name { min-width: 100px; }
.fth-pro-atk-name strong { font-size: 9pt; color: #2c1810; }
.fth-pro-atk-type { font-size: 7pt; color: #888; margin-top: 1px; }
.fth-pro-mastery-badge {
  display: inline-block;
  background: linear-gradient(135deg, #2d6a2d 0%, #1e4d1e 100%);
  color: #fff;
  font-size: 5.5pt;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 4px;
  vertical-align: middle;
}
.fth-pro-atk-range { text-align: center; min-width: 50px; }
.fth-pro-range-type { font-size: 6.5pt; color: #888; }
.fth-pro-atk-hit { text-align: center; min-width: 40px; }
.fth-pro-hit-val { font-weight: 700; font-size: 11pt; color: #2c1810; }
.fth-pro-atk-dmg { min-width: 65px; }
.fth-pro-dmg-type { font-size: 6.5pt; color: #888; }
.fth-pro-atk-notes { font-size: 7pt; color: #666; max-width: 150px; }

/* ─── Combat Reference ─────────────────────────────────────────────────── */
.fth-pro-combat-ref {
  font-size: 7.5pt;
  color: #555;
  background: #f8f5f0;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.fth-pro-combat-ref strong { color: #444; }

/* ─── Action Groups Grid ───────────────────────────────────────────────── */
.fth-pro-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.fth-pro-action-group { margin-bottom: 6px; }
.fth-pro-action-group h3 {
  font-size: 8pt;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}
.fth-pro-action-item {
  font-size: 8pt;
  margin-bottom: 3px;
  line-height: 1.3;
}
.fth-pro-action-item strong { color: #2c1810; }
.fth-pro-uses {
  font-size: 7pt;
  color: #666;
  margin-left: 2px;
}
.fth-pro-bonus h3 { color: #856404; }
.fth-pro-reaction h3 { color: #155724; }
.fth-pro-masteries h3 { color: #2d6a2d; }

/* ─── Spellcasting ─────────────────────────────────────────────────────── */
.fth-pro-spell-stats {
  display: flex;
  gap: 12px;
  font-size: 8pt;
  margin-left: auto;
}
.fth-pro-spell-stat strong { color: #666; }
.fth-pro-spell-level { margin-bottom: 10px; }
.fth-pro-spell-level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1.5px solid #7a200d;
  padding-bottom: 2px;
  margin-bottom: 4px;
}
.fth-pro-level-name {
  font-size: 9pt;
  font-weight: 700;
  color: #7a200d;
  text-transform: uppercase;
}
.fth-pro-slots { font-size: 8pt; color: #555; }
.fth-pro-spell-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
}
.fth-pro-spell-table th {
  text-align: left;
  font-size: 6.5pt;
  font-weight: 600;
  text-transform: uppercase;
  color: #888;
  padding: 2px 4px;
  border-bottom: 1px solid #ddd;
}
.fth-pro-spell-table td {
  padding: 3px 4px;
  border-bottom: 1px solid #f0ebe0;
  vertical-align: top;
}
.fth-pro-spell-table tbody tr:last-child td { border-bottom: none; }
.fth-pro-spell-name { font-weight: 500; min-width: 90px; }
.fth-pro-spell-notes { font-size: 7pt; color: #888; }

/* ─── Spell Cards Page ─────────────────────────────────────────────────── */
.fth-pro-spell-cards-page { page-break-before: always; }
.fth-pro-spell-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.fth-pro-spell-card {
  border: 1.5px solid #7a200d;
  border-radius: 6px;
  padding: 8px 10px;
  background: linear-gradient(180deg, #fefcfb 0%, #f8f4ef 100%);
  font-size: 7.5pt;
  break-inside: avoid;
}
.fth-pro-sc-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.fth-pro-sc-title { flex: 1; }
.fth-pro-sc-name {
  font-size: 10pt;
  font-weight: 700;
  color: #7a200d;
  display: block;
}
.fth-pro-sc-level {
  font-size: 7pt;
  font-style: italic;
  color: #666;
}
.fth-pro-sc-img {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid #ddd;
  margin-left: 8px;
}
.fth-pro-sc-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px 8px;
  margin-bottom: 6px;
  font-size: 7pt;
}
.fth-pro-sc-stats strong { color: #555; }
.fth-pro-sc-atk {
  font-size: 7pt;
  padding: 3px 0;
  border-top: 1px solid #e8e0d0;
  border-bottom: 1px solid #e8e0d0;
  margin-bottom: 4px;
}
.fth-pro-sc-desc {
  font-size: 7pt;
  color: #444;
  line-height: 1.35;
}
.fth-pro-sc-higher {
  font-size: 6.5pt;
  color: #666;
  font-style: italic;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #ddd;
}
.fth-pro-sc-source {
  font-size: 6pt;
  color: #aaa;
  text-align: right;
  margin-top: 4px;
}

/* ─── Features Section ─────────────────────────────────────────────────── */
.fth-pro-features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.fth-pro-feat-group { margin-bottom: 6px; }
.fth-pro-feat-group h3 {
  font-size: 9pt;
  font-weight: 700;
  color: #7a200d;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.fth-pro-feat {
  font-size: 8pt;
  margin-bottom: 3px;
  line-height: 1.35;
}
.fth-pro-feat strong { color: #2c1810; }
.fth-pro-feat-desc { color: #555; }

/* ─── Currency Widget (in card) ────────────────────────────────────────── */
.fth-pro-currency-card .fth-pro-currency-row {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  flex-wrap: wrap;
}
.fth-pro-currency-card .fth-pro-currency-current { margin-bottom: 6px; }
.fth-pro-coin {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}
.fth-pro-coin-icon { font-size: 14pt; }
.fth-pro-coin-val {
  font-size: 11pt;
  font-weight: 700;
  color: #2c1810;
}
.fth-pro-coin-label {
  font-size: 6pt;
  text-transform: uppercase;
  color: #888;
  letter-spacing: 0.5px;
}
.fth-pro-currency-input {
  padding-top: 6px;
  border-top: 1px dashed #c9b896;
}
.fth-pro-coin-input {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fth-pro-coin-input-box {
  width: 36px;
  height: 20px;
  border: 1px solid #c9b896;
  border-radius: 3px;
  background: #fff;
  text-align: center;
  font-size: 9pt;
  font-family: inherit;
  color: #2c1810;
}

/* ─── Inventory Section ────────────────────────────────────────────────── */
.fth-pro-inv-weight {
  font-size: 9pt;
  color: #666;
  margin-left: auto;
}
.fth-pro-inv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 16px;
}
.fth-pro-inv-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 8pt;
  padding: 2px 0;
}
.fth-pro-inv-icon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  object-fit: cover;
}
.fth-pro-inv-eq { font-size: 8pt; color: #666; width: 12px; }
.fth-pro-inv-name { flex: 1; }
.fth-pro-inv-qty { font-size: 7pt; color: #666; margin-left: 4px; }
.fth-pro-inv-wt { font-size: 7pt; color: #888; margin-left: 4px; }
.fth-pro-inv-cost { font-size: 7pt; color: #888; margin-left: 4px; }
.fth-pro-inv-meta { font-size: 7pt; color: #888; }
.fth-pro-inv-container { margin-bottom: 4px; }
.fth-pro-inv-container-head { font-weight: 600; }
.fth-pro-inv-contained { padding-left: 16px; font-size: 7.5pt; color: #555; }

/* ─── Backstory Section ────────────────────────────────────────────────── */
.fth-pro-backstory-content {
  font-size: 9pt;
  line-height: 1.5;
  color: #333;
  column-count: 2;
  column-gap: 20px;
}
`;
}

