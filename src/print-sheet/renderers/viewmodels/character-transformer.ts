/**
 * Transforms CharacterData (raw extracted data) into CharacterViewModel (render-ready).
 * All formatting, escaping, and conditional logic happens here.
 */

import type {
  CharacterData,
  AbilityData,
  SkillData,
  CharacterActions,
  WeaponActionData,
  FeatureData,
  FeatureGroup,
  SpellcastingData,
  SpellData,
  InventoryItem,
} from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import type {
  CharacterViewModel,
  PassiveScoreViewModel,
  CombatStatsViewModel,
  AbilityViewModel,
  SavesWidgetViewModel,
  SaveItemViewModel,
  SkillViewModel,
  ActionsViewModel,
  WeaponRowViewModel,
  ActionItemViewModel,
  MasteryDescViewModel,
  SpellcastingViewModel,
  SpellLevelViewModel,
  SpellRowViewModel,
  SpellCardViewModel,
  FeatureGroupViewModel,
  FeatureItemViewModel,
  ProficiencyViewModel,
  InventoryViewModel,
  InventoryItemViewModel,
} from "./character-viewmodel";

/* ── HTML Helpers ──────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string, maxLength?: number): string {
  let stripped = html.replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/gi, "$1");
  stripped = stripped.replace(/<[^>]*>/g, "").trim();
  return maxLength ? stripped.slice(0, maxLength) : stripped;
}

function signStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Proficiency icons */
function profIcon(level: number): string {
  if (level >= 2) return "◆";  // Expertise
  if (level >= 1) return "●";  // Proficient
  if (level >= 0.5) return "◐"; // Half-proficiency (Jack of All Trades)
  return "○";                   // Not proficient
}

/** Symbols for advantage/disadvantage */
const ADV_SYMBOL = '<span class="fth-adv-symbol">▲<span>A</span></span>';
const DIS_SYMBOL = '<span class="fth-dis-symbol">▼<span>D</span></span>';

function replaceAdvDisText(text: string): string {
  return text
    .replace(/\badvantage\b/gi, ADV_SYMBOL)
    .replace(/\bdisadvantage\b/gi, DIS_SYMBOL);
}

/** Weapon mastery descriptions from 2024 PHB */
const MASTERY_DESCRIPTIONS: Record<string, string> = {
  cleave: "If you hit a creature, you can make an attack roll against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier unless it's negative.",
  graze: "If your attack roll misses a creature, that creature takes damage equal to your ability modifier. This damage is the same type as the weapon's damage, and can't be increased in any way other than increasing the ability modifier.",
  nick: "When you make the extra attack of the Light weapon property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.",
  push: "If you hit a creature, you can push that creature up to 10 feet straight away from yourself if it is Large or smaller.",
  sap: "If you hit a creature, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  slow: "If you hit a creature, that creature's Speed is reduced by 10 feet until the start of your next turn. This can't reduce the creature's speed below 0.",
  topple: "If you hit a creature, you can force that creature to make a Constitution saving throw (DC 8 + your Proficiency Bonus + the ability modifier used to make the attack roll). On a failed save, the creature has the Prone condition.",
  vex: "If you hit a creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
};

/* ── Main Transformer ───────────────────────────────────────── */

export function transformCharacterToViewModel(
  data: CharacterData,
  options: PrintOptions,
): CharacterViewModel {
  const sec = options.sections;

  // Select portrait
  let portraitUrl = "";
  if (options.portrait === "portrait" && data.img) {
    portraitUrl = data.img;
  } else if (options.portrait === "token" && data.tokenImg) {
    portraitUrl = data.tokenImg;
  }

  // Build subtitle
  const classStr = data.details.classes
    .map(c => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`)
    .join(" / ") || "Adventurer";
  const subtitleParts = [
    `Level ${data.details.level} ${classStr}`,
    data.details.race,
    data.details.background,
    data.details.alignment,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" • ");

  // Build passives
  const passives = buildPassives(data.skills);

  // Build senses and defenses
  const sensesLine = buildSensesLine(data.combat.senses);
  const defensesLine = buildDefensesLine(data.traits);

  // Build combat stats
  const combat = buildCombatStats(data);

  // Build abilities
  const abilities = buildAbilities(data.abilities);

  // Build saves widget
  const saves = buildSavesWidget(data.abilities, data.features);

  // Build skills
  const skills = buildSkills(data.skills);

  // Action names for filtering features
  const actionNames = new Set(
    [...data.actions.actions, ...data.actions.bonusActions, ...data.actions.reactions, ...data.actions.other]
      .map(f => f.name.toLowerCase())
  );

  // Build actions
  const actions = buildActions(data.actions);
  const hasActions = actions.hasWeapons || actions.otherActions.length > 0 ||
    actions.bonusActions.length > 0 || actions.reactions.length > 0;

  // Build spellcasting
  const spellcasting = data.spellcasting ? buildSpellcasting(data.spellcasting) : null;
  const spellCards = data.spellcasting ? buildSpellCards(data.spellcasting) : [];

  // Build features
  const featureGroups = buildFeatureGroups(data.features, data.proficiencies, data.traits.languages, actionNames);

  // Build proficiencies
  const proficiencies = buildProficiencies(data.proficiencies, data.traits.languages);

  // Build inventory
  const inventory = buildInventory(data.inventory);

  return {
    name: esc(data.name),
    portraitUrl,
    hasPortrait: !!portraitUrl,
    subtitle: esc(subtitle),
    passives,
    shortRestCheckboxes: "☐ ☐",
    sensesLine: esc(sensesLine),
    defensesLine,
    hasDefenses: defensesLine.length > 0,
    combat,
    abilities,
    saves,
    skills,
    actions,
    hasActions,
    spellcasting,
    hasSpellcasting: !!spellcasting,
    featureGroups,
    hasFeatures: featureGroups.length > 0,
    proficiencies,
    hasProficiencies: proficiencies.hasArmor || proficiencies.hasWeapons ||
      proficiencies.hasTools || proficiencies.hasLanguages || proficiencies.hasWeaponMasteries,
    inventory,
    hasInventory: inventory.items.length > 0,
    spellCards,
    hasSpellCards: spellCards.length > 0,
    backstory: data.backstory,
    hasBackstory: !!data.backstory,
    paperClass: `fth-paper-${options.paperSize}`,
    showAbilities: sec.abilities !== false,
    showSkills: sec.skills !== false,
    showActions: sec.actions !== false,
    showSpells: sec.spells !== false,
    showFeatures: sec.features !== false,
    showInventory: sec.inventory !== false,
    showBackstory: sec.backstory !== false,
  };
}

/* ── Passives ───────────────────────────────────────────────── */

function buildPassives(skills: SkillData[]): PassiveScoreViewModel[] {
  const perceptionSkill = skills.find(s => s.key === "prc");
  const insightSkill = skills.find(s => s.key === "ins");
  const investigationSkill = skills.find(s => s.key === "inv");

  return [
    { value: perceptionSkill?.passive ?? 10, label: "Passive Perception" },
    { value: insightSkill?.passive ?? 10, label: "Passive Insight" },
    { value: investigationSkill?.passive ?? 10, label: "Passive Investigation" },
  ];
}

/* ── Senses & Defenses ──────────────────────────────────────── */

function buildSensesLine(senses: { key: string; value: number | string }[]): string {
  return senses
    .map(s => `${s.key} ${s.value}${typeof s.value === "number" ? " ft" : ""}`)
    .join(", ");
}

function buildDefensesLine(traits: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; conditionImmunities: string[] }): string {
  const parts: string[] = [];
  if (traits.resistances.length) parts.push(`<strong>Resist:</strong> ${traits.resistances.map(esc).join(", ")}`);
  if (traits.immunities.length) parts.push(`<strong>Immune:</strong> ${traits.immunities.map(esc).join(", ")}`);
  if (traits.vulnerabilities.length) parts.push(`<strong>Vuln:</strong> ${traits.vulnerabilities.map(esc).join(", ")}`);
  if (traits.conditionImmunities.length) parts.push(`<strong>Cond. Immune:</strong> ${traits.conditionImmunities.map(esc).join(", ")}`);
  return parts.join(" | ");
}

/* ── Combat Stats ───────────────────────────────────────────── */

function buildCombatStats(data: CharacterData): CombatStatsViewModel {
  const c = data.combat;
  const speedStr = c.speed.map(s => `${s.value} ft ${s.key}`).join(", ");

  const hitDiceStr = Object.entries(c.hitDice)
    .filter(([, hd]) => hd.max > 0)
    .sort((a, b) => parseInt(b[0].slice(1)) - parseInt(a[0].slice(1)))
    .map(([denom, hd]) => `${hd.max}${denom}`)
    .join(", ") || "—";

  return {
    ac: c.ac,
    hpMax: c.hp.max,
    hitDice: hitDiceStr,
    initiative: signStr(c.initiative),
    speed: speedStr,
    proficiency: signStr(c.proficiency),
  };
}

/* ── Abilities ──────────────────────────────────────────────── */

function buildAbilities(abilities: AbilityData[]): AbilityViewModel[] {
  return abilities.map(a => ({
    label: esc(a.label),
    mod: signStr(a.mod),
    score: a.value,
  }));
}

/* ── Saves Widget ───────────────────────────────────────────── */

function buildSavesWidget(abilities: AbilityData[], features: FeatureGroup[]): SavesWidgetViewModel {
  const abbrev: Record<string, string> = {
    Strength: "STR", Dexterity: "DEX", Constitution: "CON",
    Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA",
  };

  const toSaveItem = (a: AbilityData): SaveItemViewModel => ({
    profIcon: a.proficient ? "●" : "○",
    label: abbrev[a.label] ?? a.label.slice(0, 3).toUpperCase(),
    value: signStr(a.save),
  });

  const leftColumn = abilities.slice(0, 3).map(toSaveItem);
  const rightColumn = abilities.slice(3, 6).map(toSaveItem);
  const saveFeatures = extractSaveFeatures(features);

  return { leftColumn, rightColumn, saveFeatures };
}

function extractSaveFeatures(features: FeatureGroup[]): string[] {
  const saveFeatures: string[] = [];
  const savePatterns = [/saving throws?/i, /\bsaves?\b/i, /save against/i, /avoid or end/i];

  for (const group of features) {
    for (const feat of group.features) {
      const desc = feat.description || "";
      const mentionsSaves = savePatterns.some(p => p.test(desc));
      const mentionsAdvDis = /\b(advantage|disadvantage)\b/i.test(desc);

      if (mentionsSaves && mentionsAdvDis) {
        const shortDesc = extractSaveContext(desc);
        if (shortDesc) {
          saveFeatures.push(`${esc(feat.name)}: ${shortDesc}`);
        }
      }
    }
  }
  return saveFeatures;
}

function extractSaveContext(desc: string): string {
  const sentences = desc.split(/[.!?]+/).filter(s => s.trim());
  for (const sentence of sentences) {
    if (/\b(advantage|disadvantage)\b/i.test(sentence) &&
        /\b(sav|frightened|charmed|poisoned|condition)\b/i.test(sentence)) {
      let clean = sentence.trim();
      if (clean.length > 80) clean = clean.substring(0, 77) + "...";
      return replaceAdvDisText(esc(clean));
    }
  }
  return "";
}

/* ── Skills ─────────────────────────────────────────────────── */

function buildSkills(skills: SkillData[]): SkillViewModel[] {
  const abbrev: Record<string, string> = {
    str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
  };

  return skills.map(s => {
    let cssClass = "fth-skill";
    if (s.proficiency >= 2) cssClass = "fth-skill fth-skill-expert";
    else if (s.proficiency >= 1) cssClass = "fth-skill fth-skill-prof";

    return {
      profIcon: profIcon(s.proficiency),
      mod: signStr(s.total),
      name: esc(s.label),
      ability: abbrev[s.ability] ?? s.ability.toUpperCase().slice(0, 3),
      cssClass,
    };
  });
}

/* ── Actions ────────────────────────────────────────────────── */

function buildActions(actions: CharacterActions): ActionsViewModel {
  const usedMasteries = new Set<string>();

  // Weapons
  const weapons: WeaponRowViewModel[] = actions.weapons.map(w => {
    if (w.mastery && w.hasMastery) {
      usedMasteries.add(w.mastery.toLowerCase());
    }
    return buildWeaponRow(w);
  });

  // Mastery descriptions
  const masteryDescriptions: MasteryDescViewModel[] = [];
  for (const mastery of usedMasteries) {
    const desc = MASTERY_DESCRIPTIONS[mastery];
    if (desc) {
      const name = mastery.charAt(0).toUpperCase() + mastery.slice(1);
      masteryDescriptions.push({
        name: `Mastery: ${name}`,
        description: replaceAdvDisText(esc(desc)),
      });
    }
  }

  return {
    weapons,
    hasWeapons: weapons.length > 0,
    combatActionsRef: "Attack, Dash, Disengage, Dodge, Grapple, Help, Hide, Ready, Search, Shove, Use an Object",
    otherActions: actions.actions.length > 0 ? [{ title: "Other Actions", items: actions.actions.map(buildActionItem), hasItems: true }] : [],
    bonusActions: actions.bonusActions.length > 0 ? [{ title: "Bonus Actions", items: actions.bonusActions.map(buildActionItem), hasItems: true }] : [],
    reactions: actions.reactions.length > 0 ? [{ title: "Reactions", items: actions.reactions.map(buildActionItem), hasItems: true }] : [],
    other: actions.other.length > 0 ? [{ title: "Other", items: actions.other.map(buildActionItem), hasItems: true }] : [],
    masteryDescriptions,
    hasMasteryDescriptions: masteryDescriptions.length > 0,
  };
}

function buildWeaponRow(w: WeaponActionData): WeaponRowViewModel {
  return {
    favStar: w.isFavorite ? "★" : "",
    name: esc(w.name),
    masteryBadge: (w.mastery && w.hasMastery) ? esc(w.mastery) : "",
    hasMastery: !!(w.mastery && w.hasMastery),
    weaponType: esc(w.weaponType),
    range: esc(w.range),
    rangeType: w.rangeType ? esc(w.rangeType) : "",
    toHit: esc(w.toHit),
    damage: esc(w.damage),
    damageType: w.damageType ? esc(w.damageType) : "",
    properties: esc(w.properties),
  };
}

function buildActionItem(f: FeatureData): ActionItemViewModel {
  const fav = f.isFavorite ? "★ " : "";
  let usesDisplay = "";
  let checkboxes = "";

  if (f.uses) {
    const recLabel = formatRecoveryPeriod(f.uses.recovery);
    usesDisplay = `(${f.uses.max}/${recLabel})`;
    checkboxes = "☐".repeat(f.uses.max);
  }

  const desc = f.description ? stripHtml(f.description) : "";

  return {
    favStar: fav,
    name: esc(f.name),
    usesDisplay,
    checkboxes,
    description: esc(desc),
  };
}

function formatRecoveryPeriod(recovery: string | undefined): string {
  if (!recovery) return "";
  const map: Record<string, string> = {
    day: "Day", lr: "Long Rest", sr: "Short Rest",
    dawn: "Dawn", dusk: "Dusk", round: "Round", turn: "Turn",
  };
  return map[recovery.toLowerCase()] || recovery;
}

/* ── Spellcasting ───────────────────────────────────────────── */

function buildSpellcasting(sc: SpellcastingData): SpellcastingViewModel {
  const abilityMod = sc.attackMod - 2; // Approximate: attackMod - proficiency

  const sortedLevels = Array.from(sc.spellsByLevel.keys()).sort((a, b) => a - b);
  const spellLevels: SpellLevelViewModel[] = sortedLevels.map(level => {
    const spells = sc.spellsByLevel.get(level) ?? [];
    const levelLabel = level === 0 ? "CANTRIPS" : ordinalLevel(level).toUpperCase();
    const slot = sc.slots.find(s => s.level === level);
    const slotCheckboxes = slot ? "☐".repeat(slot.max) : "";

    return {
      levelLabel,
      slotCheckboxes,
      hasSlots: !!slot,
      spells: spells.map(buildSpellRow),
    };
  });

  return {
    modifier: signStr(abilityMod),
    attackMod: signStr(sc.attackMod),
    saveDC: sc.dc,
    spellLevels,
  };
}

function buildSpellRow(sp: SpellData): SpellRowViewModel {
  const tags = [
    sp.concentration ? "(C)" : "",
    sp.ritual ? "(R)" : "",
  ].filter(Boolean).join(" ");

  return {
    favStar: sp.isFavorite ? "★" : "",
    name: esc(sp.name),
    tags,
    time: esc(sp.castingTime || "—"),
    range: esc(sp.range || "—"),
    hitDc: esc(sp.attackSave || "—"),
    effect: esc(sp.effect || "—"),
    notes: esc(sp.components || "—"),
  };
}

function ordinalLevel(level: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = suffixes[level] || "th";
  return `${level}${suffix} Level`;
}

function schoolName(abbr: string): string {
  const schools: Record<string, string> = {
    abj: "Abjuration", con: "Conjuration", div: "Divination", enc: "Enchantment",
    evo: "Evocation", ill: "Illusion", nec: "Necromancy", trs: "Transmutation",
  };
  return schools[abbr.toLowerCase()] ?? abbr;
}

/* ── Spell Cards ────────────────────────────────────────────── */

function buildSpellCards(sc: SpellcastingData): SpellCardViewModel[] {
  const cards: SpellCardViewModel[] = [];
  const sortedLevels = Array.from(sc.spellsByLevel.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const spells = sc.spellsByLevel.get(level) ?? [];
    const levelLabel = level === 0 ? "Cantrip" : ordinalLevel(level);

    for (const sp of spells) {
      // Cantrips always, leveled only if prepared
      if (level === 0 || sp.prepared) {
        cards.push(buildSpellCard(sp, levelLabel));
      }
    }
  }

  return cards;
}

function buildSpellCard(sp: SpellData, levelLabel: string): SpellCardViewModel {
  let componentsLine = esc(sp.components || "—");
  if (sp.materials) {
    componentsLine += ` (${esc(sp.materials)})`;
  }

  return {
    name: esc(sp.name),
    concTag: sp.concentration ? '<span class="fth-spell-tag fth-tag-conc">C</span>' : "",
    ritualTag: sp.ritual ? '<span class="fth-spell-tag fth-tag-ritual">Ritual</span>' : "",
    levelSchool: `${esc(levelLabel)} ${esc(schoolName(sp.school))}`,
    imgUrl: sp.img || "",
    hasImg: !!sp.img,
    castingTime: esc(sp.castingTime || "—"),
    range: esc(sp.range || "—"),
    duration: esc(sp.duration || "—"),
    components: componentsLine,
    hasAttackSave: !!sp.attackSave,
    attackSave: esc(sp.attackSave || ""),
    effect: esc(sp.effect || ""),
    description: esc(stripHtml(sp.description, 400)),
    higherLevel: esc(sp.higherLevel || ""),
    hasHigherLevel: !!sp.higherLevel,
    source: esc(sp.source || ""),
    hasSource: !!sp.source,
  };
}

/* ── Features ───────────────────────────────────────────────── */

function buildFeatureGroups(
  groups: FeatureGroup[],
  _proficiencies: { armor: string[]; weapons: string[]; tools: string[]; weaponMasteries: string[] },
  _languages: string[],
  actionNames: Set<string>,
): FeatureGroupViewModel[] {
  return groups
    .map(g => {
      const filteredFeatures = g.features.filter(f => !actionNames.has(f.name.toLowerCase()));
      if (filteredFeatures.length === 0) return null;

      return {
        category: esc(g.category),
        features: filteredFeatures.map(buildFeatureItem),
      };
    })
    .filter((g): g is FeatureGroupViewModel => g !== null);
}

function buildFeatureItem(f: FeatureData): FeatureItemViewModel {
  let usesDisplay = "";
  let checkboxes = "";

  if (f.uses) {
    const recLabel = formatRecoveryPeriod(f.uses.recovery);
    usesDisplay = `(${f.uses.max}/${recLabel})`;
    checkboxes = "☐".repeat(f.uses.max);
  }

  const descText = f.description ? replaceAdvDisText(esc(stripHtml(f.description))) : "";

  return {
    favStar: f.isFavorite ? "★ " : "",
    name: esc(f.name),
    usesDisplay,
    checkboxes,
    description: descText,
  };
}

/* ── Proficiencies ───────────────────────────────────────────── */

function buildProficiencies(
  profs: { armor: string[]; weapons: string[]; tools: string[]; weaponMasteries: string[] },
  languages: string[],
): ProficiencyViewModel {
  const masteryList = profs.weaponMasteries.map(w => `⚔ ${esc(w)}`).join(", ");

  return {
    armor: profs.armor.join(", "),
    hasArmor: profs.armor.length > 0,
    weapons: profs.weapons.join(", "),
    hasWeapons: profs.weapons.length > 0,
    weaponMasteries: masteryList,
    hasWeaponMasteries: profs.weaponMasteries.length > 0,
    tools: profs.tools.join(", "),
    hasTools: profs.tools.length > 0,
    languages: languages.map(esc).join(", "),
    hasLanguages: languages.length > 0,
  };
}

/* ── Inventory ───────────────────────────────────────────────── */

function buildInventory(items: InventoryItem[]): InventoryViewModel {
  const calcWeight = (itemList: InventoryItem[]): number => {
    return itemList.reduce((sum, i) => {
      const itemWeight = i.quantity * (i.weight ?? 0);
      const contentsWeight = i.contents ? calcWeight(i.contents) : 0;
      return sum + itemWeight + contentsWeight;
    }, 0);
  };

  const totalWeight = calcWeight(items);
  const totalWeightStr = totalWeight > 0 ? `${Math.round(totalWeight * 100) / 100} lb` : "—";

  const viewItems: InventoryItemViewModel[] = [];
  for (const item of items) {
    if (item.type === "container" && item.contents && item.contents.length > 0) {
      // Container group
      viewItems.push({
        ...buildInventoryItem(item, false),
        isContainerGroup: true,
        containerItems: item.contents.map(c => buildInventoryItem(c, true)),
      });
    } else {
      viewItems.push({
        ...buildInventoryItem(item, false),
        isContainerGroup: false,
        containerItems: [],
      });
    }
  }

  return { totalWeight: totalWeightStr, items: viewItems };
}

function buildInventoryItem(i: InventoryItem, isIndented: boolean): InventoryItemViewModel {
  const usesDisplay = i.uses ? `(${i.uses.value}/${i.uses.max})` : "";
  const qty = i.quantity > 1 ? `×${i.quantity}` : "";
  const wt = i.weight ? `${i.weight}lb` : "";
  const meta = [qty, wt].filter(Boolean).join(" ");

  return {
    eqIndicator: i.equipped ? "■" : "—",
    imgUrl: i.img || "",
    hasImg: !!i.img,
    favStar: i.isFavorite ? "★ " : "",
    name: esc(i.name),
    usesDisplay,
    meta,
    isIndented,
    cssClass: isIndented ? "fth-inv-item fth-inv-indented" : "fth-inv-item",
    isContainerGroup: false,
    containerItems: [],
  };
}

