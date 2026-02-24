/**
 * D&D 5e (2024) HTML renderer.
 * Generates print-optimized HTML for character sheets, NPC stat blocks,
 * encounter groups, and party summaries.
 */

import { BaseRenderer, registerRenderer } from "./base-renderer";
import { getDnd5eStyles } from "./dnd5e-styles";
import type { PrintOptions } from "../types";
import type {
  CharacterData, NPCData, EncounterGroupData, PartySummaryData,
  AbilityData, SkillData, SpellcastingData, FeatureGroup, FeatureData, InventoryItem,
  CharacterActions,
} from "../extractors/dnd5e-types";

/* ── Helpers ─────────────────────────────────────────────── */

/** HTML-escape a string */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Format signed modifier like "+3" or "-1" */
function signStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Proficiency indicator */
function profIcon(level: number): string {
  if (level >= 2) return "◉";
  if (level >= 1) return "●";
  if (level > 0) return "◐";
  return "○";
}

/**
 * Parse Foundry VTT reference strings like "&amp;Reference[Charmed apply=false]" to just "Charmed"
 * Also handles encoded versions like "&amp;Reference[...]"
 */
function parseConditionReferences(text: string): string {
  // Handle both &Reference[...] and &amp;Reference[...] formats
  // Pattern: &(amp;)?Reference[ConditionName ...] -> ConditionName
  return text.replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/gi, "$1");
}

/** Strip HTML tags for plain text description snippets */
function stripHtml(html: string, maxLength?: number): string {
  // First parse any condition references
  let stripped = parseConditionReferences(html);
  // Then strip HTML tags
  stripped = stripped.replace(/<[^>]*>/g, "").trim();
  // Only truncate if maxLength is specified
  return maxLength ? stripped.slice(0, maxLength) : stripped;
}

/* ── Renderer ────────────────────────────────────────────── */

export class Dnd5eRenderer extends BaseRenderer {
  readonly systemId = "dnd5e";

  /* ── Character Sheet ───────────────────────────────────── */

  renderCharacter(data: CharacterData, options: PrintOptions): string {
    const sec = options.sections;
    const parts: string[] = [];

    // Header with portrait
    parts.push(this.charHeader(data, options));

    // Abilities and Saves (side by side)
    if (sec.abilities !== false) {
      const abilitiesHtml = this.charAbilities(data.abilities);
      const savesHtml = this.charSaves(data.abilities, data.features);
      parts.push(`<div class="fth-abilities-saves-row">${abilitiesHtml}${savesHtml}</div>`);
    }

    // Combat stats
    if (sec.combat !== false) {
      parts.push(this.charCombat(data));
    }

    // Skills
    if (sec.skills !== false) {
      parts.push(this.charSkills(data.skills));
    }

    // Actions (new section)
    if (sec.actions !== false && this.hasActions(data.actions)) {
      parts.push(this.charActions(data.actions));
    }

    // Spellcasting
    if (sec.spells !== false && data.spellcasting) {
      parts.push(this.charSpellcasting(data.spellcasting, data.favorites));
    }

    // Features & Traits
    if (sec.features !== false && data.features.length > 0) {
      parts.push(this.charFeatures(data.features, data.proficiencies, data.traits.languages));
    }

    // Inventory
    if (sec.inventory !== false && data.inventory.length > 0) {
      parts.push(this.charInventory(data.inventory));
    }

    // Backstory
    if (sec.backstory !== false && data.backstory) {
      parts.push(this.charBackstory(data.backstory));
    }

    return `<div class="fth-character fth-paper-${options.paperSize}">${parts.join("")}</div>`;
  }

  private charHeader(data: CharacterData, options: PrintOptions): string {
    let imgHtml = "";
    if (options.portrait === "portrait" && data.img) {
      imgHtml = `<img class="fth-portrait" src="${esc(data.img)}" alt="">`;
    } else if (options.portrait === "token" && data.tokenImg) {
      imgHtml = `<img class="fth-portrait" src="${esc(data.tokenImg)}" alt="">`;
    }

    const classStr = data.details.classes
      .map(c => `${esc(c.name)} ${c.level}${c.subclass ? ` (${esc(c.subclass)})` : ""}`)
      .join(" / ") || "Adventurer";

    const subtitle = [
      `Level ${data.details.level} ${classStr}`,
      data.details.race,
      data.details.background,
      data.details.alignment,
    ].filter(Boolean).join(" • ");

    // Build senses string for header
    const sensesStr = data.combat.senses
      .map(s => `${s.key} ${s.value}${typeof s.value === "number" ? " ft" : ""}`)
      .join(", ");

    // Build resistances/immunities/vulnerabilities line
    const t = data.traits;
    const defensesParts: string[] = [];
    if (t.resistances.length) defensesParts.push(`<strong>Resist:</strong> ${t.resistances.map(esc).join(", ")}`);
    if (t.immunities.length) defensesParts.push(`<strong>Immune:</strong> ${t.immunities.map(esc).join(", ")}`);
    if (t.vulnerabilities.length) defensesParts.push(`<strong>Vuln:</strong> ${t.vulnerabilities.map(esc).join(", ")}`);
    if (t.conditionImmunities.length) defensesParts.push(`<strong>Cond. Immune:</strong> ${t.conditionImmunities.map(esc).join(", ")}`);
    const defensesStr = defensesParts.join(" | ");

    // Get passive scores from skills
    const perceptionSkill = data.skills.find(s => s.key === "prc");
    const insightSkill = data.skills.find(s => s.key === "ins");
    const investigationSkill = data.skills.find(s => s.key === "inv");
    const passivePerception = perceptionSkill?.passive ?? 10;
    const passiveInsight = insightSkill?.passive ?? 10;
    const passiveInvestigation = investigationSkill?.passive ?? 10;

    // Passive scores widget (goes under subtitle)
    const passivesHtml = `
      <div class="fth-passive-scores">
        <div class="fth-passive-item"><span class="fth-passive-value">${passivePerception}</span><span class="fth-passive-label">Passive Perception</span></div>
        <div class="fth-passive-item"><span class="fth-passive-value">${passiveInsight}</span><span class="fth-passive-label">Passive Insight</span></div>
        <div class="fth-passive-item"><span class="fth-passive-value">${passiveInvestigation}</span><span class="fth-passive-label">Passive Investigation</span></div>
      </div>`;

    // Short rest tracker widget (with sun symbol ☀)
    const shortRestHtml = `
      <div class="fth-short-rest-tracking">
        <span class="fth-rest-icon">☀</span>
        <span class="fth-track-label">Short Rests</span>
        <span class="fth-rest-checkboxes">☐ ☐</span>
      </div>`;

    // HP tracking area for pen and paper tracking
    const trackingHtml = `
      <div class="fth-hp-tracking">
        <div class="fth-track-row">
          <span class="fth-track-label">Current HP</span>
          <span class="fth-track-box"></span>
        </div>
        <div class="fth-track-row">
          <span class="fth-track-label">Temp HP</span>
          <span class="fth-track-box fth-track-box-sm"></span>
        </div>
        <div class="fth-track-row fth-death-saves">
          <span class="fth-track-label">Death Saves</span>
          <span class="fth-save-row">
            <span class="fth-save-label">✓</span>
            <span class="fth-save-circles">☐ ☐ ☐</span>
          </span>
          <span class="fth-save-row">
            <span class="fth-save-label">✗</span>
            <span class="fth-save-circles">☐ ☐ ☐</span>
          </span>
        </div>
      </div>`;

    return `
      <div class="fth-header">
        ${imgHtml}
        <div class="fth-header-info">
          <h1>${esc(data.name)}</h1>
          <div class="fth-subtitle">${esc(subtitle)}</div>
          <div class="fth-header-row-widgets">
            ${passivesHtml}
            ${shortRestHtml}
          </div>
          <div class="fth-senses-defenses">
            ${sensesStr ? `<div class="fth-header-senses"><strong>Senses:</strong> ${esc(sensesStr)}</div>` : ""}
            ${defensesStr ? `<div class="fth-header-defenses">${defensesStr}</div>` : ""}
          </div>
        </div>
        ${trackingHtml}
      </div>`;
  }

  private charAbilities(abilities: AbilityData[]): string {
    // Show only ability scores and modifiers (saves moved to separate widget)
    const boxes = abilities.map(a => `
      <div class="fth-ability">
        <span class="fth-ability-label">${esc(a.label)}</span>
        <span class="fth-ability-mod">${signStr(a.mod)}</span>
        <span class="fth-ability-score">${a.value}</span>
      </div>`).join("");
    return `<div class="fth-abilities">${boxes}</div>`;
  }

  /** Symbols for advantage/disadvantage - triangles with letters inside */
  private readonly ADV_SYMBOL = '<span class="fth-adv-symbol">▲<span>A</span></span>';
  private readonly DIS_SYMBOL = '<span class="fth-dis-symbol">▼<span>D</span></span>';

  /**
   * Replace "advantage" and "disadvantage" text with symbols
   * Note: Returns HTML, so caller should NOT escape the result
   */
  private replaceAdvDisText(text: string): string {
    return text
      .replace(/\badvantage\b/gi, this.ADV_SYMBOL)
      .replace(/\bdisadvantage\b/gi, this.DIS_SYMBOL);
  }

  /**
   * Extract save-related features from feature descriptions
   * Looking for patterns like "advantage on saving throws" or "advantage on ... saves"
   */
  private extractSaveFeatures(features: FeatureGroup[]): string[] {
    const saveFeatures: string[] = [];
    const savePatterns = [
      /saving throws?/i,
      /\bsaves?\b/i,
      /save against/i,
      /avoid or end/i,
    ];

    for (const group of features) {
      for (const feat of group.features) {
        const desc = feat.description || "";
        // Check if feature mentions saves AND advantage/disadvantage
        const mentionsSaves = savePatterns.some(p => p.test(desc));
        const mentionsAdvDis = /\b(advantage|disadvantage)\b/i.test(desc);

        if (mentionsSaves && mentionsAdvDis) {
          // Extract a brief summary - use the feature name and a shortened description
          const shortDesc = this.extractSaveContext(desc);
          if (shortDesc) {
            // Escape the feature name, shortDesc already has HTML symbols
            saveFeatures.push(`${esc(feat.name)}: ${shortDesc}`);
          }
        }
      }
    }
    return saveFeatures;
  }

  /**
   * Extract the save-related context from a feature description
   */
  private extractSaveContext(desc: string): string {
    // Look for sentences containing "advantage" or "disadvantage" with "save"
    const sentences = desc.split(/[.!?]+/).filter(s => s.trim());
    for (const sentence of sentences) {
      if (/\b(advantage|disadvantage)\b/i.test(sentence) &&
          /\b(sav|frightened|charmed|poisoned|condition)\b/i.test(sentence)) {
        // Clean up and shorten the sentence
        let clean = sentence.trim();
        // Limit length before adding symbols (they contain HTML which inflates length)
        if (clean.length > 80) {
          clean = clean.substring(0, 77) + "...";
        }
        // Escape first, then replace advantage/disadvantage with symbols (symbols are HTML)
        clean = this.replaceAdvDisText(esc(clean));
        return clean;
      }
    }
    return "";
  }

  private charSaves(abilities: AbilityData[], features: FeatureGroup[]): string {
    // Split abilities into two columns (STR, DEX, CON | INT, WIS, CHA)
    const leftSaves = abilities.slice(0, 3);  // STR, DEX, CON
    const rightSaves = abilities.slice(3, 6); // INT, WIS, CHA

    const renderSave = (a: AbilityData): string => {
      const profIcon = a.proficient ? "●" : "○";
      return `<div class="fth-save-item">
        <span class="fth-save-prof">${profIcon}</span>
        <span class="fth-save-label">${esc(a.label)}</span>
        <span class="fth-save-value">${signStr(a.save)}</span>
      </div>`;
    };

    const leftCol = leftSaves.map(renderSave).join("");
    const rightCol = rightSaves.map(renderSave).join("");

    // Extract save-related features (already contains HTML symbols, don't escape)
    const saveFeatures = this.extractSaveFeatures(features);
    let featuresHtml = "";
    if (saveFeatures.length > 0) {
      const featItems = saveFeatures.map(f => `<div class="fth-save-feature">${f}</div>`).join("");
      featuresHtml = `<div class="fth-save-features">${featItems}</div>`;
    }

    return `
      <div class="fth-saves-widget">
        <div class="fth-saves-title">Saving Throws</div>
        <div class="fth-saves-grid">
          <div class="fth-saves-column">${leftCol}</div>
          <div class="fth-saves-column">${rightCol}</div>
        </div>
        ${featuresHtml}
      </div>`;
  }

  private charCombat(data: CharacterData): string {
    const c = data.combat;
    const speedStr = c.speed.map(s => `${s.value} ft ${s.key}`).join(", ");

    // Format hit dice (e.g., "1d10" or "2d10, 1d8" for multiclass)
    const hitDiceStr = Object.entries(c.hitDice)
      .filter(([_, hd]) => hd.max > 0)
      .sort((a, b) => parseInt(b[0].slice(1)) - parseInt(a[0].slice(1))) // Sort by die size descending
      .map(([denom, hd]) => `${hd.max}${denom}`)
      .join(", ") || "—";

    // Inspiration is always shown as empty checkbox for manual tracking
    // HP shows only max since users track current on paper
    // Resistances/immunities moved to header
    return `
      <div class="fth-combat">
        <div class="fth-stat-box"><span class="fth-stat-label">AC</span><span class="fth-stat-value">${c.ac}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">HP</span><span class="fth-stat-value">${c.hp.max}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">Hit Dice</span><span class="fth-stat-value">${esc(hitDiceStr)}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">Initiative</span><span class="fth-stat-value">${signStr(c.initiative)}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">Speed</span><span class="fth-stat-value">${esc(speedStr)}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">Proficiency</span><span class="fth-stat-value">${signStr(c.proficiency)}</span></div>
        <div class="fth-stat-box"><span class="fth-stat-label">Inspiration</span><span class="fth-stat-value fth-checkbox">☐</span></div>
      </div>`;
  }


  private charSkills(skills: SkillData[]): string {
    const rows = skills.map(s => {
      const cls = s.proficiency >= 2 ? "fth-skill fth-skill-expert" : s.proficiency >= 1 ? "fth-skill fth-skill-prof" : "fth-skill";
      return `<div class="${cls}">${profIcon(s.proficiency)} ${esc(s.label)} ${signStr(s.total)}</div>`;
    }).join("");
    return `
      <div class="fth-skills">
        <div class="fth-section-title">Skills</div>
        <div class="fth-skills-grid">${rows}</div>
      </div>`;
  }

  /** Check if there are any actions to display */
  private hasActions(actions: CharacterActions): boolean {
    return actions.weapons.length > 0 || actions.actions.length > 0 ||
           actions.bonusActions.length > 0 || actions.reactions.length > 0 || actions.other.length > 0;
  }

  /** Render character actions section with table format */
  private charActions(actions: CharacterActions): string {
    const sections: string[] = [];

    // Render weapon attacks table
    if (actions.weapons.length > 0) {
      const weaponRows = actions.weapons.map(w => {
        const fav = w.isFavorite ? '<span class="fth-fav">★</span>' : "";
        const masteryBadge = w.mastery ? `<span class="fth-mastery">${esc(w.mastery)}</span>` : "";
        return `<tr>
          <td class="fth-atk-name">
            ${fav}<strong>${esc(w.name)}</strong>
            <div class="fth-atk-type">${esc(w.weaponType)}${masteryBadge}</div>
          </td>
          <td class="fth-atk-range">
            <div class="fth-atk-range-val">${esc(w.range)}</div>
            ${w.rangeType ? `<div class="fth-atk-range-type">${esc(w.rangeType)}</div>` : ""}
          </td>
          <td class="fth-atk-hit"><span class="fth-hit-val">${esc(w.toHit)}</span></td>
          <td class="fth-atk-dmg">
            <span class="fth-dmg-formula">${esc(w.damage)}</span>
            ${w.damageType ? `<span class="fth-dmg-type">${esc(w.damageType)}</span>` : ""}
          </td>
          <td class="fth-atk-notes">${esc(w.properties)}</td>
        </tr>`;
      }).join("");

      sections.push(`
        <div class="fth-action-group">
          <h3>Actions</h3>
          <table class="fth-attack-table">
            <thead><tr>
              <th>Attack</th>
              <th>Range</th>
              <th>Hit</th>
              <th>Damage</th>
              <th>Notes</th>
            </tr></thead>
            <tbody>${weaponRows}</tbody>
          </table>
        </div>`);
    }

    // Combat actions reference
    const combatActions = "Attack, Dash, Disengage, Dodge, Grapple, Help, Hide, Ready, Search, Shove, Use an Object";
    sections.push(`
      <div class="fth-combat-actions">
        <strong>Actions in Combat:</strong> ${combatActions}
      </div>`);

    // Render feature-based actions with proper uses format and checkboxes
    const renderFeature = (f: FeatureData): string => {
      const fav = f.isFavorite ? '<span class="fth-fav">★</span> ' : "";
      let usesHtml = "";
      if (f.uses) {
        const recLabel = this.formatRecovery(f.uses.recovery);
        const checkboxes = Array(f.uses.max).fill("☐").join("");
        usesHtml = ` <span class="fth-action-uses">(${f.uses.max}/${recLabel})</span><span class="fth-action-checkboxes">${checkboxes}</span>`;
      }
      const desc = f.description ? ` — ${stripHtml(f.description)}` : "";
      return `<div class="fth-action-item">${fav}<strong>${esc(f.name)}${usesHtml ? "" : ""}.</strong>${usesHtml}${esc(desc)}</div>`;
    };

    if (actions.actions.length > 0) {
      const items = actions.actions.map(renderFeature).join("");
      sections.push(`<div class="fth-action-group fth-feature-actions"><h3>Other Actions</h3><div class="fth-action-list">${items}</div></div>`);
    }

    if (actions.bonusActions.length > 0) {
      const items = actions.bonusActions.map(renderFeature).join("");
      sections.push(`<div class="fth-action-group"><h3>Bonus Actions</h3><div class="fth-action-list">${items}</div></div>`);
    }

    if (actions.reactions.length > 0) {
      const items = actions.reactions.map(renderFeature).join("");
      sections.push(`<div class="fth-action-group"><h3>Reactions</h3><div class="fth-action-list">${items}</div></div>`);
    }

    // Other special features (like Sneak Attack)
    if (actions.other.length > 0) {
      const items = actions.other.map(renderFeature).join("");
      sections.push(`<div class="fth-action-group"><h3>Other</h3><div class="fth-action-list">${items}</div></div>`);
    }

    return `
      <div class="fth-actions">
        <div class="fth-section-title">Actions</div>
        <div class="fth-actions-content">
          ${sections.join("")}
        </div>
      </div>`;
  }

  private charSpellcasting(sc: SpellcastingData, _favorites: Set<string>): string {
    // Helper to generate checkbox widgets for spell slots
    const slotCheckboxes = (max: number): string => {
      return Array(max).fill("☐").join("");
    };

    const levelsHtml: string[] = [];
    const sortedLevels = Array.from(sc.spellsByLevel.keys()).sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const spells = sc.spellsByLevel.get(level) ?? [];
      const levelLabel = level === 0 ? "CANTRIPS" : this.ordinalLevel(level).toUpperCase();

      // Find matching slot for this level
      const slot = sc.slots.find(s => s.level === level);
      const slotDisplay = slot ? `<span class="fth-spell-slot-checkboxes">${slotCheckboxes(slot.max)}</span> SLOTS` : "";

      // Build spell table rows
      const spellRows = spells.map(sp => {
        const fav = sp.isFavorite ? '<span class="fth-fav">★</span>' : "";
        const conc = sp.concentration ? " (C)" : "";
        const ritual = sp.ritual ? " (R)" : "";
        const name = `${fav}${esc(sp.name)}${conc}${ritual}`;
        const time = esc(sp.castingTime || "—");
        const range = esc(sp.range || "—");
        const hitDc = esc(sp.attackSave || "—");
        const effect = esc(sp.effect || "—");
        const notes = esc(sp.components || "—");

        return `<tr>
          <td class="fth-spell-name">${name}</td>
          <td class="fth-spell-time">${time}</td>
          <td class="fth-spell-range">${range}</td>
          <td class="fth-spell-hit">${hitDc}</td>
          <td class="fth-spell-effect">${effect}</td>
          <td class="fth-spell-notes">${notes}</td>
        </tr>`;
      }).join("");

      levelsHtml.push(`
        <div class="fth-spell-level-group">
          <div class="fth-spell-level-header">
            <span class="fth-level-label">${levelLabel}</span>
            ${slotDisplay ? `<span class="fth-slot-display">${slotDisplay}</span>` : ""}
          </div>
          <table class="fth-spell-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Time</th>
                <th>Range</th>
                <th>Hit/DC</th>
                <th>Effect</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${spellRows}
            </tbody>
          </table>
        </div>`);
    }

    // Determine modifier (ability mod portion of attack mod)
    const abilityMod = sc.attackMod - 2; // Approximate: attackMod - proficiency (usually +2 at level 1)

    return `
      <div class="fth-spellcasting">
        <div class="fth-section-title">Spellcasting</div>
        <div class="fth-spell-stats">
          <div class="fth-spell-stat">
            <span class="fth-spell-stat-value">${signStr(abilityMod)}</span>
            <span class="fth-spell-stat-label">Modifier</span>
          </div>
          <div class="fth-spell-stat">
            <span class="fth-spell-stat-value">${signStr(sc.attackMod)}</span>
            <span class="fth-spell-stat-label">Spell Attack</span>
          </div>
          <div class="fth-spell-stat">
            <span class="fth-spell-stat-value">${sc.dc}</span>
            <span class="fth-spell-stat-label">Save DC</span>
          </div>
        </div>
        ${levelsHtml.join("")}
      </div>`;
  }

  /** Convert spell level to ordinal string */
  private ordinalLevel(level: number): string {
    const suffixes: { [key: number]: string } = { 1: "st", 2: "nd", 3: "rd" };
    const suffix = suffixes[level] || "th";
    return `${level}${suffix} Level`;
  }

  /** Format recovery period for display */
  private formatRecovery(recovery: unknown): string {
    // Handle non-string recovery values (could be array, object, undefined)
    if (!recovery) return "";

    // If it's an array, take the first element's period
    if (Array.isArray(recovery)) {
      const first = recovery[0];
      if (first?.period) return this.formatRecovery(first.period);
      return "";
    }

    // If it's an object with a period property
    if (typeof recovery === "object" && recovery !== null) {
      const rec = recovery as { period?: string };
      if (rec.period) return this.formatRecovery(rec.period);
      return "";
    }

    // If it's a string, map it
    if (typeof recovery === "string") {
      const map: Record<string, string> = {
        "day": "Day",
        "lr": "Long Rest",
        "sr": "Short Rest",
        "dawn": "Dawn",
        "dusk": "Dusk",
      };
      return map[recovery.toLowerCase()] || recovery;
    }

    return String(recovery);
  }

  private charFeatures(
    groups: FeatureGroup[],
    proficiencies: { armor: string[]; weapons: string[]; tools: string[]; weaponMasteries: string[] },
    languages: string[],
  ): string {
    const groupsHtml = groups.map(g => {
      const featsHtml = g.features.map(f => {
        const fav = f.isFavorite ? '<span class="fth-fav">★</span> ' : "";
        // Format uses: show "X/Day" or "X/Short Rest" with checkboxes
        let usesHtml = "";
        if (f.uses) {
          const recLabel = this.formatRecovery(f.uses.recovery);
          const checkboxes = Array(f.uses.max).fill("☐").join("");
          usesHtml = ` <span class="fth-feat-uses">(${f.uses.max}/${recLabel})</span><span class="fth-feat-checkboxes">${checkboxes}</span>`;
        }
        // Replace advantage/disadvantage with symbols in description
        // Escape first, then replace symbols (symbols contain HTML)
        const descText = f.description ? this.replaceAdvDisText(esc(stripHtml(f.description))) : "";
        const desc = descText ? ` <span class="fth-feat-desc">— ${descText}</span>` : "";
        return `<div class="fth-feat">${fav}<span class="fth-feat-name">${esc(f.name)}</span>${usesHtml}${desc}</div>`;
      }).join("");
      return `<div class="fth-feat-group"><h3>${esc(g.category)}</h3><div class="fth-feat-list">${featsHtml}</div></div>`;
    }).join("");

    // Build proficiencies and languages as its own section
    const profParts: string[] = [];
    if (proficiencies.armor.length > 0) {
      profParts.push(`<div class="fth-prof-line"><strong>Armor:</strong> ${proficiencies.armor.join(", ")}</div>`);
    }
    if (proficiencies.weapons.length > 0) {
      profParts.push(`<div class="fth-prof-line"><strong>Weapons:</strong> ${proficiencies.weapons.join(", ")}</div>`);
    }
    // Show weapon masteries with a symbol (⚔) to indicate mastery
    if (proficiencies.weaponMasteries.length > 0) {
      const masteryList = proficiencies.weaponMasteries.map(w => `<span class="fth-mastery-item">⚔ ${esc(w)}</span>`).join(", ");
      profParts.push(`<div class="fth-prof-line"><strong>Weapon Mastery:</strong> ${masteryList}</div>`);
    }
    if (proficiencies.tools.length > 0) {
      profParts.push(`<div class="fth-prof-line"><strong>Tools:</strong> ${proficiencies.tools.join(", ")}</div>`);
    }
    if (languages.length > 0) {
      profParts.push(`<div class="fth-prof-line"><strong>Languages:</strong> ${languages.map(esc).join(", ")}</div>`);
    }

    const profHtml = profParts.length > 0
      ? `<div class="fth-proficiencies">
          <div class="fth-section-title">Proficiencies and Languages</div>
          <div class="fth-prof-content">${profParts.join("")}</div>
        </div>`
      : "";

    return `
      <div class="fth-features">
        <div class="fth-section-title">Features & Traits</div>
        <div class="fth-features-content">${groupsHtml}</div>
      </div>
      ${profHtml}`;
  }

  private charInventory(items: InventoryItem[]): string {
    // Calculate total weight (quantity * weight for each item, including container contents)
    const calcWeight = (itemList: InventoryItem[]): number => {
      return itemList.reduce((sum, i) => {
        const itemWeight = i.quantity * (i.weight ?? 0);
        const contentsWeight = i.contents ? calcWeight(i.contents) : 0;
        return sum + itemWeight + contentsWeight;
      }, 0);
    };
    const totalWeight = calcWeight(items);
    const totalWeightStr = totalWeight > 0 ? `${Math.round(totalWeight * 100) / 100} lb` : "—";

    // Helper to render a single item row
    const renderItemRow = (i: InventoryItem, isContained: boolean = false): string => {
      const fav = i.isFavorite ? '<span class="fth-fav">★</span> ' : "";
      const uses = i.uses ? ` (${i.uses.value}/${i.uses.max})` : "";
      const iconHtml = i.img ? `<img class="fth-inv-icon" src="${esc(i.img)}" alt="">` : '<span class="fth-inv-icon-placeholder"></span>';

      // Equipped indicator - filled square for equipped, dash for not
      const eqIndicator = i.equipped ? '<span class="fth-eq-active">■</span>' : '<span class="fth-eq-inactive">—</span>';

      // Format item type (capitalize first letter)
      const itemType = i.type ? i.type.charAt(0).toUpperCase() + i.type.slice(1) : "";

      // Add indentation class for items inside containers
      const rowClass = isContained ? 'class="fth-inv-contained"' : "";
      const indentClass = isContained ? ' fth-inv-indented' : "";

      return `<tr ${rowClass}>
        <td class="fth-inv-active">${eqIndicator}</td>
        <td class="fth-inv-name-cell${indentClass}">
          <div class="fth-inv-name-row">${iconHtml}${fav}<span class="fth-inv-item-name">${esc(i.name)}</span>${uses}</div>
          ${itemType ? `<div class="fth-inv-item-type">${esc(itemType)}</div>` : ""}
        </td>
        <td class="fth-inv-weight">${i.weight ? i.weight + " lb" : "—"}</td>
        <td class="fth-inv-qty">${i.quantity}</td>
      </tr>`;
    };

    // Build rows - containers show their contents indented below them
    const rows: string[] = [];
    for (const item of items) {
      rows.push(renderItemRow(item, false));
      // If this is a container with contents, render the contents indented
      if (item.type === "container" && item.contents && item.contents.length > 0) {
        for (const contained of item.contents) {
          rows.push(renderItemRow(contained, true));
        }
      }
    }

    return `
      <div class="fth-inventory">
        <div class="fth-section-title">Inventory</div>
        <table class="fth-inv-table">
          <thead><tr><th class="fth-inv-col-active">Active</th><th class="fth-inv-col-name">Name</th><th class="fth-inv-col-weight">Weight</th><th class="fth-inv-col-qty">Qty</th></tr></thead>
          <tbody>${rows.join("")}</tbody>
          <tfoot><tr class="fth-inv-total"><td></td><td><strong>Total Weight</strong></td><td><strong>${totalWeightStr}</strong></td><td></td></tr></tfoot>
        </table>
      </div>`;
  }

  private charBackstory(backstory: string): string {
    return `
      <div class="fth-backstory">
        <div class="fth-section-title">Backstory</div>
        <div class="fth-backstory-content">${backstory}</div>
      </div>`;
  }

  /* ── NPC Stat Block ────────────────────────────────────── */

  renderNPC(data: NPCData, options: PrintOptions): string {
    return this.npcStatBlock(data, options, false);
  }

  private npcStatBlock(data: NPCData, options: PrintOptions, inEncounter: boolean): string {
    const sec = options.sections;
    const parts: string[] = [];

    // Portrait (float right)
    let imgHtml = "";
    if (options.portrait === "portrait" && data.img) {
      imgHtml = `<img class="fth-sb-portrait" src="${esc(data.img)}" alt="">`;
    } else if (options.portrait === "token" && data.tokenImg) {
      imgHtml = `<img class="fth-sb-portrait" src="${esc(data.tokenImg)}" alt="">`;
    }

    // Header
    parts.push(`
      <div class="fth-sb-header">
        ${imgHtml}
        <h1>${esc(data.name)}</h1>
        <div class="fth-sb-meta">${esc(data.size)} ${esc(data.type)}${data.alignment ? `, ${esc(data.alignment)}` : ""}</div>
      </div>
      <hr class="fth-sb-divider">`);

    // Core stats
    if (sec.stats !== false) {
      const speedStr = data.speed.map(s => `${s.value} ft${s.key !== "walk" ? ` ${s.key}` : ""}`).join(", ");
      const initStr = data.initiative >= 0 ? `+${data.initiative}` : `${data.initiative}`;
      parts.push(`
        <div class="fth-sb-stats">
          <p><strong>AC</strong> ${data.ac}${data.acFormula ? ` (${esc(data.acFormula)})` : ""} &nbsp; <strong>Initiative</strong> ${initStr}</p>
          <p><strong>HP</strong> ${data.hp.max}${data.hp.formula ? ` (${esc(data.hp.formula)})` : ""}</p>
          <p><strong>Speed</strong> ${esc(speedStr)}</p>
        </div>
        <hr class="fth-sb-divider">`);
    }

    // Abilities table
    if (sec.abilities !== false) {
      parts.push(this.npcAbilitiesTable(data.abilities));
      parts.push('<hr class="fth-sb-divider">');
    }

    // Traits (senses, languages, resistances, CR)
    parts.push(this.npcTraits(data));

    // Get spellcasting DC for formatting Spellcasting features
    const spellDC = data.spellcasting?.dc;

    // Features
    if (sec.features !== false && data.features.length > 0) {
      parts.push(this.npcFeatureSection("Traits", data.features, spellDC));
    }

    // Actions
    if (sec.actions !== false && data.actions.length > 0) {
      parts.push(this.npcFeatureSection("Actions", data.actions, spellDC));
    }

    // Bonus Actions
    if (data.bonusActions.length > 0) {
      parts.push(this.npcFeatureSection("Bonus Actions", data.bonusActions, spellDC));
    }

    // Reactions
    if (data.reactions.length > 0) {
      parts.push(this.npcFeatureSection("Reactions", data.reactions, spellDC));
    }

    // Legendary Actions
    if (data.legendaryActions.actions.length > 0) {
      let legHtml = `<div class="fth-sb-section"><div class="fth-sb-section-title">Legendary Actions</div>`;
      if (data.legendaryActions.description) {
        legHtml += `<p class="fth-sb-trait"><em>${esc(stripHtml(data.legendaryActions.description, 500))}</em></p>`;
      }
      legHtml += data.legendaryActions.actions.map(a => this.npcTraitEntry(a)).join("");
      legHtml += `</div>`;
      parts.push(legHtml);
    }

    // Lair Actions
    if (data.lairActions.actions.length > 0) {
      let lairHtml = `<div class="fth-sb-section"><div class="fth-sb-section-title">Lair Actions</div>`;
      if (data.lairActions.description) {
        lairHtml += `<p class="fth-sb-trait"><em>${esc(stripHtml(data.lairActions.description, 500))}</em></p>`;
      }
      lairHtml += data.lairActions.actions.map(a => this.npcTraitEntry(a)).join("");
      lairHtml += `</div>`;
      parts.push(lairHtml);
    }

    const blockClass = inEncounter ? "fth-statblock fth-encounter-block" : "fth-statblock";
    return `<div class="${blockClass} fth-paper-${options.paperSize}">${parts.join("")}</div>`;
  }


  private npcAbilitiesTable(abilities: AbilityData[]): string {
    // 2024 style: 2x3 grid with Mod and Save columns
    // STR/INT, DEX/WIS, CON/CHA
    const pairs = [
      [abilities.find(a => a.key === "str"), abilities.find(a => a.key === "int")],
      [abilities.find(a => a.key === "dex"), abilities.find(a => a.key === "wis")],
      [abilities.find(a => a.key === "con"), abilities.find(a => a.key === "cha")],
    ];

    const rows = pairs.map(([a1, a2]) => {
      const cell1 = a1 ? this.abilityCell(a1) : "<td></td><td></td><td></td><td></td>";
      const cell2 = a2 ? this.abilityCell(a2) : "<td></td><td></td><td></td><td></td>";
      return `<tr>${cell1}${cell2}</tr>`;
    }).join("");

    return `
      <table class="fth-sb-abilities fth-sb-abilities-2024">
        <thead>
          <tr>
            <th></th><th></th><th>Mod</th><th>Save</th>
            <th></th><th></th><th>Mod</th><th>Save</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  private abilityCell(a: AbilityData): string {
    const saveStr = a.saveProficient ? signStr(a.save) : signStr(a.mod);
    return `<th>${a.key.toUpperCase()}</th><td>${a.value}</td><td>${signStr(a.mod)}</td><td>${saveStr}</td>`;
  }

  private npcTraits(data: NPCData): string {
    const lines: string[] = [];
    const t = data.traits;

    // Skills
    if (data.skills && data.skills.length > 0) {
      const skillsStr = data.skills.map(s => `${s.name} ${signStr(s.mod)}`).join(", ");
      lines.push(`<p><strong>Skills</strong> ${esc(skillsStr)}</p>`);
    }

    // Gear (weapons/equipment)
    if (data.gear && data.gear.length > 0) {
      lines.push(`<p><strong>Gear</strong> ${data.gear.map(esc).join(", ")}</p>`);
    }

    // Resistances, immunities, vulnerabilities (right after skills)
    if (t.resistances.length > 0) {
      lines.push(`<p><strong>Resistances</strong> ${t.resistances.map(esc).join(", ")}</p>`);
    }
    if (t.immunities.length > 0) {
      lines.push(`<p><strong>Immunities</strong> ${t.immunities.map(esc).join(", ")}</p>`);
    }
    if (t.vulnerabilities.length > 0) {
      lines.push(`<p><strong>Vulnerabilities</strong> ${t.vulnerabilities.map(esc).join(", ")}</p>`);
    }
    if (t.conditionImmunities.length > 0) {
      lines.push(`<p><strong>Condition Immunities</strong> ${t.conditionImmunities.map(esc).join(", ")}</p>`);
    }

    // Senses - sorted by power (blindsight > tremorsense > truesight > darkvision)
    const sensePriority: Record<string, number> = {
      blindsight: 1, tremorsense: 2, truesight: 3, darkvision: 4, special: 5,
    };
    const sortedSenses = [...data.senses].sort((a, b) =>
      (sensePriority[a.key] ?? 99) - (sensePriority[b.key] ?? 99)
    );
    const sensesParts: string[] = [];
    for (const s of sortedSenses) {
      const val = typeof s.value === "number" ? `${s.value} ft` : s.value;
      sensesParts.push(`${this.capitalize(s.key)} ${val}`);
    }
    sensesParts.push(`Passive Perception ${data.passivePerception}`);
    lines.push(`<p><strong>Senses</strong> ${esc(sensesParts.join(", "))}</p>`);

    // Languages
    if (data.languages.length > 0) {
      lines.push(`<p><strong>Languages</strong> ${data.languages.map(esc).join(", ")}</p>`);
    }

    // CR with XP and Proficiency Bonus
    if (data.cr) {
      const xpStr = data.xp ? ` (XP ${data.xp.toLocaleString()}; PB +${data.proficiencyBonus})` : "";
      lines.push(`<p><strong>CR</strong> ${esc(data.cr)}${xpStr}</p>`);
    }

    return lines.length > 0 ? `<div class="fth-sb-traits">${lines.join("")}</div>` : "";
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  private npcFeatureSection(title: string, features: FeatureData[], spellDC?: number): string {
    const entries = features.map(f => this.npcTraitEntry(f, spellDC)).join("");
    return `<div class="fth-sb-section"><div class="fth-sb-section-title">${esc(title)}</div>${entries}</div>`;
  }

  private npcTraitEntry(f: FeatureData, spellDC?: number): string {
    // Format uses - show recharge if available, otherwise show value/max with recovery period
    let uses = "";
    if (f.uses) {
      if (f.uses.recovery && f.uses.recovery.startsWith("Recharge")) {
        uses = ` (${f.uses.recovery})`;
      } else if (f.uses.max > 0) {
        // Format recovery period: "day" -> "/Day", "sr" -> "/Short Rest", etc.
        const recoveryLabel = this.formatRecoveryPeriod(f.uses.recovery);
        uses = recoveryLabel ? ` (${f.uses.max}${recoveryLabel})` : ` (${f.uses.value}/${f.uses.max})`;
      }
    }

    // Check if this is a Spellcasting feature - add DC and format description
    const isSpellcasting = f.name.toLowerCase() === "spellcasting" ||
                           f.name.toLowerCase().includes("innate spellcasting");
    if (isSpellcasting && spellDC) {
      const dcStr = ` (DC ${spellDC})`;
      // formatSpellcastingDescription returns pre-escaped HTML with <br> tags
      const formattedDesc = this.formatSpellcastingDescription(f.description);
      return `<p class="fth-sb-trait"><strong>${esc(f.name)}${dcStr}.</strong> ${formattedDesc}</p>`;
    }

    // If this is a save-type ability (like breath weapons), render with description
    if (f.attack && f.attack.type === "save") {
      return this.renderSaveEntry(f, uses);
    }

    // If this is an attack with parsed data, render proper attack text
    if (f.attack && f.attack.damage.length > 0) {
      return this.renderAttackEntry(f);
    }

    // Otherwise use description (bold name for clarity)
    const desc = f.description ? ` ${esc(stripHtml(f.description))}` : "";
    return `<p class="fth-sb-trait"><strong>${esc(f.name)}${uses}.</strong>${desc}</p>`;
  }

  /** Render a save-based ability (breath weapons, etc.) using description text */
  private renderSaveEntry(f: FeatureData, uses: string): string {
    const atk = f.attack!;
    let desc = f.description ? stripHtml(f.description) : "";

    // Replace damage placeholders in description with actual values
    // The description may have "22 ()" or similar - replace with actual damage
    if (atk.damage.length > 0) {
      const d = atk.damage[0];
      const damageStr = `${d.avg} (${d.formula})`;
      // Replace patterns like "22 ()" or "22()" with actual damage
      desc = desc.replace(/\d+\s*\(\s*\)/g, damageStr);
    }

    return `<p class="fth-sb-trait"><strong>${esc(f.name)}${uses}.</strong> ${esc(desc)}</p>`;
  }

  private renderAttackEntry(f: FeatureData): string {
    const atk = f.attack!;
    const isRanged = atk.type === "rwak" || atk.type === "rsak";
    const isMelee = atk.type === "mwak" || atk.type === "msak";
    const isSpell = atk.type === "msak" || atk.type === "rsak";

    // Determine attack type text
    let attackType = "";
    if (atk.thrown) {
      attackType = "Melee or Ranged Weapon Attack";
    } else if (isMelee && isSpell) {
      attackType = "Melee Spell Attack";
    } else if (isRanged && isSpell) {
      attackType = "Ranged Spell Attack";
    } else if (isMelee) {
      attackType = "Melee Weapon Attack";
    } else if (isRanged) {
      attackType = "Ranged Weapon Attack";
    } else {
      attackType = "Attack";
    }

    // Build damage string: "7 (1d8 + 3) Slashing plus 1 Necrotic"
    const damageStr = atk.damage.map(d => {
      // For dice formulas, show average and formula
      // For flat numbers, just show the number
      const hasDice = /\d+d\d+/i.test(d.formula);
      if (hasDice) {
        return `${d.avg} (${d.formula})${d.type ? ` ${d.type}` : ""}`;
      } else {
        // Just a flat number like "1" for bonus damage
        return `${d.avg}${d.type ? ` ${d.type}` : ""}`;
      }
    }).join(" plus ");

    // Build the full attack description
    const parts: string[] = [];
    parts.push(`<em>${attackType}:</em> ${atk.toHit} to hit`);
    if (atk.reach) parts.push(atk.reach);
    parts.push("one target");

    const hitStr = damageStr ? `<em>Hit:</em> ${esc(damageStr)} damage.` : "";

    return `<p class="fth-sb-trait"><strong>${esc(f.name)}.</strong> ${parts.join(", ")}. ${hitStr}</p>`;
  }

  /* ── Encounter Group ───────────────────────────────────── */

  renderEncounterGroup(data: EncounterGroupData, options: PrintOptions): string {
    const blocks = data.actors.map(npc => this.npcStatBlock(npc, options, true)).join("");
    return `
      <div class="fth-encounter fth-paper-${options.paperSize}">
        <h1>${esc(data.name)}</h1>
        <div class="fth-encounter-grid">${blocks}</div>
      </div>`;
  }

  /* ── Party Summary ─────────────────────────────────────── */

  renderPartySummary(data: PartySummaryData, options: PrintOptions): string {
    const rows = data.members.map(m => {
      const skillsStr = m.topSkills.map(s => `${esc(s.name)} ${signStr(s.total)}`).join(", ");
      return `<tr>
        <td>${esc(m.name)}</td>
        <td>${esc(m.classes)}</td>
        <td>${esc(m.species)}</td>
        <td>${m.ac}</td>
        <td>${m.hp.value}/${m.hp.max}</td>
        <td>${m.spellDC ?? "—"}</td>
        <td>${signStr(m.initiative)}</td>
        <td>${m.passivePerception}</td>
        <td>${signStr(m.proficiency)}</td>
        <td class="fth-party-skills">${skillsStr}</td>
      </tr>`;
    }).join("");

    return `
      <div class="fth-party fth-paper-${options.paperSize}">
        <h1>${esc(data.name)}</h1>
        <table class="fth-party-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Species</th>
              <th>AC</th>
              <th>HP</th>
              <th>Spell DC</th>
              <th>Init</th>
              <th>Pass. Perc</th>
              <th>Prof</th>
              <th>Top Skills</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ── Helpers ───────────────────────────────────────────── */

  /** Format recovery period to display string: "day" -> "/Day", "sr" -> "/Short Rest", etc. */
  private formatRecoveryPeriod(period: string | undefined): string {
    if (!period) return "";
    const periodMap: Record<string, string> = {
      "day": "/Day",
      "lr": "/Long Rest",
      "sr": "/Short Rest",
      "dawn": "/Dawn",
      "dusk": "/Dusk",
      "round": "/Round",
      "turn": "/Turn",
      "charges": " Charges",
    };
    return periodMap[period.toLowerCase()] ?? "";
  }

  /** Format spellcasting description: add line breaks before "At Will:", "1/Day:", etc. Returns HTML */
  private formatSpellcastingDescription(desc: string | undefined): string {
    if (!desc) return "";
    // Strip HTML and escape for safety
    let text = esc(stripHtml(desc));

    // Add double <br> (empty line) before "At Will:", "X/Day:", etc.
    // Match patterns like "At Will:", "1/Day:", "2/Day:", "3/Day each:", etc.
    text = text.replace(/\s*(At Will:|[123]\/Day( each)?:)/gi, "<br><br>$1");

    // Trim leading/trailing whitespace and collapse multiple spaces
    return text.trim().replace(/\s+/g, " ");
  }

  /* ── Styles ────────────────────────────────────────────── */

  getStyles(): string {
    return getDnd5eStyles();
  }
}

// Auto-register when this module is imported
registerRenderer(new Dnd5eRenderer());
