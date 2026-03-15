import type { SpellData, SpellcastingData } from "../../extractors/dnd5e-types";
import type {
  SpellCardViewModel,
  SpellLevelViewModel,
  SpellRowViewModel,
  SpellcastingViewModel,
} from "./character-viewmodel";
import { esc, signStr, stripHtml } from "./character-transformer-common";

export function buildSpellcasting(sc: SpellcastingData): SpellcastingViewModel {
  const abilityMod = sc.attackMod - 2;

  const sortedLevels = Array.from(sc.spellsByLevel.keys()).sort((a, b) => a - b);
  const spellLevels: SpellLevelViewModel[] = sortedLevels.map((level) => {
    const spells = sc.spellsByLevel.get(level) ?? [];
    const levelLabel = level === 0 ? "CANTRIPS" : ordinalLevel(level).toUpperCase();
    const slot = sc.slots.find((entry) => entry.level === level);
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

export function buildSpellCards(sc: SpellcastingData): SpellCardViewModel[] {
  const cards: SpellCardViewModel[] = [];
  const sortedLevels = Array.from(sc.spellsByLevel.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const spells = sc.spellsByLevel.get(level) ?? [];
    const levelLabel = level === 0 ? "Cantrip" : ordinalLevel(level);

    for (const spell of spells) {
      if (level === 0 || spell.prepared) {
        cards.push(buildSpellCard(spell, levelLabel));
      }
    }
  }

  return cards;
}

function buildSpellRow(spell: SpellData): SpellRowViewModel {
  const tags = [
    spell.concentration ? "(C)" : "",
    spell.ritual ? "(R)" : "",
  ].filter(Boolean).join(" ");

  return {
    favStar: spell.isFavorite ? "★" : "",
    name: esc(spell.name),
    tags,
    time: esc(spell.castingTime || "—"),
    range: esc(spell.range || "—"),
    hitDc: esc(spell.attackSave || "—"),
    effect: esc(spell.effect || "—"),
    notes: esc(spell.components || "—"),
  };
}

function buildSpellCard(spell: SpellData, levelLabel: string): SpellCardViewModel {
  let components = esc(spell.components || "—");
  if (spell.materials) {
    components += ` (${esc(spell.materials)})`;
  }

  return {
    name: esc(spell.name),
    concTag: spell.concentration ? '<span class="fth-spell-tag fth-tag-conc">C</span>' : "",
    ritualTag: spell.ritual ? '<span class="fth-spell-tag fth-tag-ritual">Ritual</span>' : "",
    levelSchool: `${esc(levelLabel)} ${esc(schoolName(spell.school))}`,
    imgUrl: spell.img || "",
    hasImg: !!spell.img,
    castingTime: esc(spell.castingTime || "—"),
    range: esc(spell.range || "—"),
    duration: esc(spell.duration || "—"),
    components,
    hasAttackSave: !!spell.attackSave,
    attackSave: esc(spell.attackSave || ""),
    effect: esc(spell.effect || ""),
    description: esc(stripHtml(spell.description, 400)),
    higherLevel: esc(spell.higherLevel || ""),
    hasHigherLevel: !!spell.higherLevel,
    source: esc(spell.source || ""),
    hasSource: !!spell.source,
  };
}

function ordinalLevel(level: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = suffixes[level] || "th";
  return `${level}${suffix} Level`;
}

function schoolName(abbr: string): string {
  const schools: Record<string, string> = {
    abj: "Abjuration",
    con: "Conjuration",
    div: "Divination",
    enc: "Enchantment",
    evo: "Evocation",
    ill: "Illusion",
    nec: "Necromancy",
    trs: "Transmutation",
  };
  return schools[abbr.toLowerCase()] ?? abbr;
}
