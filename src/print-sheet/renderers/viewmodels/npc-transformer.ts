/**
 * Transforms NPCData (raw extracted data) into NPCViewModel (render-ready).
 * All formatting, escaping, and conditional logic happens here.
 */

import type { NPCData, FeatureData, AbilityData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import type {
  NPCViewModel,
  AbilityRowViewModel,
  AbilityCellViewModel,
  TraitLineViewModel,
  FeatureSectionViewModel,
  FeatureEntryViewModel,
} from "./npc-viewmodel";

/* ── HTML Escaping ──────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip HTML tags for plain text */
function stripHtml(html: string, maxLength?: number): string {
  // Parse condition references like &Reference[Charmed]
  let stripped = html.replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/gi, "$1");
  stripped = stripped.replace(/<[^>]*>/g, "").trim();
  return maxLength ? stripped.slice(0, maxLength) : stripped;
}

/** Format signed modifier: 3 -> "+3", -1 -> "-1" */
function signStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/* ── Main Transformer ───────────────────────────────────────── */

export function transformNPCToViewModel(
  data: NPCData,
  options: PrintOptions,
  inEncounter: boolean = false
): NPCViewModel {
  const sec = options.sections;

  // Select portrait based on option
  let portraitUrl = "";
  if (options.portrait === "portrait" && data.img) {
    portraitUrl = data.img;
  } else if (options.portrait === "token" && data.tokenImg) {
    portraitUrl = data.tokenImg;
  }

  // Build meta line
  const metaParts = [data.size, data.type];
  if (data.alignment) metaParts.push(data.alignment);
  const meta = metaParts.join(" ");

  // Core stats
  const acStr = data.acFormula
    ? `${data.ac} (${esc(data.acFormula)})`
    : `${data.ac}`;
  
  const hpStr = data.hp.formula
    ? `${data.hp.max} (${esc(data.hp.formula)})`
    : `${data.hp.max}`;
  
  const speedStr = data.speed
    .map(s => `${s.value} ft${s.key !== "walk" ? ` ${s.key}` : ""}`)
    .join(", ");

  // Get spellcasting DC for feature formatting
  const spellDC = data.spellcasting?.dc;

  return {
    name: esc(data.name),
    portraitUrl,
    hasPortrait: !!portraitUrl,
    meta: esc(meta),
    
    ac: acStr,
    initiative: signStr(data.initiative),
    hp: hpStr,
    speed: esc(speedStr),
    
    abilityRows: buildAbilityRows(data.abilities),
    traitLines: buildTraitLines(data),
    featureSections: buildFeatureSections(data, spellDC),
    
    blockClass: inEncounter ? "fth-statblock fth-encounter-block" : "fth-statblock",
    paperClass: `fth-paper-${options.paperSize}`,
    
    showStats: sec.stats !== false,
    showAbilities: sec.abilities !== false,
    showTraits: true, // Always show traits section
    showFeatures: sec.features !== false && data.features.length > 0,
    showActions: sec.actions !== false && data.actions.length > 0,
  };
}

/* ── Ability Grid ───────────────────────────────────────────── */

function buildAbilityRows(abilities: AbilityData[]): AbilityRowViewModel[] {
  // 2x3 grid: STR/INT, DEX/WIS, CON/CHA
  const findAbility = (key: string) => abilities.find(a => a.key === key);
  
  const pairs: [string, string][] = [
    ["str", "int"],
    ["dex", "wis"],
    ["con", "cha"],
  ];

  return pairs.map(([leftKey, rightKey]) => ({
    left: toAbilityCell(findAbility(leftKey)),
    right: toAbilityCell(findAbility(rightKey)),
  }));
}

function toAbilityCell(a: AbilityData | undefined): AbilityCellViewModel | null {
  if (!a) return null;
  const saveVal = a.saveProficient ? a.save : a.mod;
  return {
    key: a.key.toUpperCase(),
    value: a.value,
    mod: signStr(a.mod),
    save: signStr(saveVal),
  };
}

/* ── Trait Lines ────────────────────────────────────────────── */

function buildTraitLines(data: NPCData): TraitLineViewModel[] {
  const lines: TraitLineViewModel[] = [];
  const t = data.traits;

  // Skills
  if (data.skills?.length) {
    const skillsStr = data.skills.map(s => `${s.name} ${signStr(s.mod)}`).join(", ");
    lines.push({ label: "Skills", value: esc(skillsStr) });
  }

  // Gear
  if (data.gear?.length) {
    lines.push({ label: "Gear", value: data.gear.map(esc).join(", ") });
  }

  // Damage modifiers
  if (t.resistances.length) {
    lines.push({ label: "Resistances", value: t.resistances.map(esc).join(", ") });
  }
  if (t.immunities.length) {
    lines.push({ label: "Immunities", value: t.immunities.map(esc).join(", ") });
  }
  if (t.vulnerabilities.length) {
    lines.push({ label: "Vulnerabilities", value: t.vulnerabilities.map(esc).join(", ") });
  }
  if (t.conditionImmunities.length) {
    lines.push({ label: "Condition Immunities", value: t.conditionImmunities.map(esc).join(", ") });
  }

  // Senses
  const sensePriority: Record<string, number> = {
    blindsight: 1, tremorsense: 2, truesight: 3, darkvision: 4, special: 5,
  };
  const sortedSenses = [...data.senses].sort((a, b) =>
    (sensePriority[a.key] ?? 99) - (sensePriority[b.key] ?? 99)
  );
  const sensesParts: string[] = [];
  for (const s of sortedSenses) {
    const val = typeof s.value === "number" ? `${s.value} ft` : s.value;
    sensesParts.push(`${capitalize(s.key)} ${val}`);
  }
  sensesParts.push(`Passive Perception ${data.passivePerception}`);
  lines.push({ label: "Senses", value: esc(sensesParts.join(", ")) });

  // Languages
  if (data.languages.length) {
    lines.push({ label: "Languages", value: data.languages.map(esc).join(", ") });
  }

  // CR with XP
  if (data.cr) {
    const xpStr = data.xp
      ? ` (XP ${data.xp.toLocaleString()}; PB +${data.proficiencyBonus})`
      : "";
    lines.push({ label: "CR", value: `${esc(data.cr)}${xpStr}` });
  }

  return lines;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ── Feature Sections ───────────────────────────────────────── */

function buildFeatureSections(data: NPCData, spellDC?: number): FeatureSectionViewModel[] {
  const sections: FeatureSectionViewModel[] = [];

  // Traits
  if (data.features.length > 0) {
    sections.push({
      title: "Traits",
      intro: "",
      entries: data.features.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  // Actions
  if (data.actions.length > 0) {
    sections.push({
      title: "Actions",
      intro: "",
      entries: data.actions.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  // Bonus Actions
  if (data.bonusActions.length > 0) {
    sections.push({
      title: "Bonus Actions",
      intro: "",
      entries: data.bonusActions.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  // Reactions
  if (data.reactions.length > 0) {
    sections.push({
      title: "Reactions",
      intro: "",
      entries: data.reactions.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  // Legendary Actions
  if (data.legendaryActions.actions.length > 0) {
    sections.push({
      title: "Legendary Actions",
      intro: data.legendaryActions.description
        ? esc(stripHtml(data.legendaryActions.description, 500))
        : "",
      entries: data.legendaryActions.actions.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  // Lair Actions
  if (data.lairActions.actions.length > 0) {
    sections.push({
      title: "Lair Actions",
      intro: data.lairActions.description
        ? esc(stripHtml(data.lairActions.description, 500))
        : "",
      entries: data.lairActions.actions.map(f => toFeatureEntry(f, spellDC)),
      hasEntries: true,
    });
  }

  return sections;
}

/* ── Feature Entry Formatting ───────────────────────────────── */

function toFeatureEntry(f: FeatureData, spellDC?: number): FeatureEntryViewModel {
  // Format uses suffix
  const usesSuffix = formatUses(f);

  // Check for spellcasting feature
  const isSpellcasting = f.name.toLowerCase() === "spellcasting" ||
                         f.name.toLowerCase().includes("innate spellcasting");

  if (isSpellcasting && spellDC) {
    return {
      nameWithUses: `${esc(f.name)} (DC ${spellDC})`,
      description: formatSpellcastingDesc(f.description),
      isHtml: true,
    };
  }

  // Save-type ability (breath weapons, etc.)
  if (f.attack?.type === "save") {
    return {
      nameWithUses: esc(f.name) + usesSuffix,
      description: formatSaveEntry(f),
      isHtml: false,
    };
  }

  // Attack with damage
  if (f.attack?.damage.length) {
    return {
      nameWithUses: esc(f.name),
      description: formatAttackEntry(f),
      isHtml: true,
    };
  }

  // Default: just description
  const desc = f.description ? stripHtml(f.description) : "";
  return {
    nameWithUses: esc(f.name) + usesSuffix,
    description: esc(desc),
    isHtml: false,
  };
}

function formatUses(f: FeatureData): string {
  if (!f.uses) return "";

  if (f.uses.recovery?.startsWith("Recharge")) {
    return ` (${f.uses.recovery})`;
  }

  if (f.uses.max > 0) {
    const recoveryLabel = formatRecoveryPeriod(f.uses.recovery);
    return recoveryLabel
      ? ` (${f.uses.max}${recoveryLabel})`
      : ` (${f.uses.value}/${f.uses.max})`;
  }

  return "";
}

function formatRecoveryPeriod(period: string | undefined): string {
  if (!period) return "";
  const map: Record<string, string> = {
    day: "/Day",
    lr: "/Long Rest",
    sr: "/Short Rest",
    dawn: "/Dawn",
    dusk: "/Dusk",
    round: "/Round",
    turn: "/Turn",
    charges: " Charges",
  };
  return map[period.toLowerCase()] ?? "";
}

function formatSaveEntry(f: FeatureData): string {
  const atk = f.attack!;
  let desc = f.description ? stripHtml(f.description) : "";

  // Replace damage placeholders
  if (atk.damage.length > 0) {
    const d = atk.damage[0];
    const damageStr = `${d.avg} (${d.formula})`;
    desc = desc.replace(/\d+\s*\(\s*\)/g, damageStr);
  }

  return desc;
}

function formatAttackEntry(f: FeatureData): string {
  const atk = f.attack!;
  const isRanged = atk.type === "rwak" || atk.type === "rsak";
  const isMelee = atk.type === "mwak" || atk.type === "msak";
  const isSpell = atk.type === "msak" || atk.type === "rsak";

  // Determine attack type
  let attackType = "Attack";
  if (atk.thrown) attackType = "Melee or Ranged Weapon Attack";
  else if (isMelee && isSpell) attackType = "Melee Spell Attack";
  else if (isRanged && isSpell) attackType = "Ranged Spell Attack";
  else if (isMelee) attackType = "Melee Weapon Attack";
  else if (isRanged) attackType = "Ranged Weapon Attack";

  // Build damage string
  const damageStr = atk.damage.map(d => {
    const hasDice = /\d+d\d+/i.test(d.formula);
    if (hasDice) {
      return `${d.avg} (${d.formula})${d.type ? ` ${d.type}` : ""}`;
    }
    return `${d.avg}${d.type ? ` ${d.type}` : ""}`;
  }).join(" plus ");

  // Build parts
  const parts: string[] = [`<em>${attackType}:</em> ${atk.toHit} to hit`];
  if (atk.reach) parts.push(atk.reach);
  parts.push("one target");

  const hitStr = damageStr ? `<em>Hit:</em> ${esc(damageStr)} damage.` : "";
  return `${parts.join(", ")}. ${hitStr}`;
}

function formatSpellcastingDesc(desc: string | undefined): string {
  if (!desc) return "";
  let text = esc(stripHtml(desc));
  // Add line breaks before "At Will:", "X/Day:", etc.
  text = text.replace(/\s*(At Will:|[123]\/Day( each)?:)/gi, "<br><br>$1");
  return text.trim().replace(/\s+/g, " ");
}

