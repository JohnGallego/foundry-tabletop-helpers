import { describe, expect, it } from "vitest";

import type { SpellData, SpellcastingData } from "../../extractors/dnd5e-types";
import { buildSpellCards, buildSpellcasting } from "./character-transformer-spells";

function makeSpell(overrides: Partial<SpellData> = {}): SpellData {
  return {
    name: "Magic Missile",
    level: 1,
    school: "evo",
    components: "V, S",
    materials: "",
    concentration: false,
    ritual: false,
    prepared: true,
    description: "<p>Three glowing darts of magical force.</p>",
    isFavorite: false,
    castingTime: "1A",
    range: "120 ft.",
    duration: "Instant",
    attackSave: "",
    effect: "3d4+3 force",
    source: "Wizard",
    img: "magic-missile.png",
    higherLevel: "",
    ...overrides,
  };
}

function makeSpellcasting(overrides: Partial<SpellcastingData> = {}): SpellcastingData {
  return {
    ability: "int",
    attackMod: 7,
    dc: 15,
    slots: [
      { level: 1, max: 4, value: 4, label: "1st" },
      { level: 2, max: 3, value: 3, label: "2nd" },
    ],
    spellsByLevel: new Map<number, SpellData[]>([
      [0, [makeSpell({ name: "Light", level: 0, school: "evo", prepared: true, effect: "Light", img: "" })]],
      [1, [makeSpell({
        concentration: true,
        ritual: true,
        materials: "a bit of fleece",
        attackSave: "DC 15 WIS",
      })]],
      [2, [makeSpell({ name: "Invisibility", level: 2, school: "ill", prepared: false, img: "invisibility.png" })]],
    ]),
    ...overrides,
  };
}

describe("character transformer spell helpers", () => {
  it("builds spellcasting rows with slot checkboxes and formatted tags", () => {
    const vm = buildSpellcasting(makeSpellcasting());

    expect(vm).toMatchObject({
      modifier: "+5",
      attackMod: "+7",
      saveDC: 15,
    });
    expect(vm.spellLevels[0]).toMatchObject({
      levelLabel: "CANTRIPS",
      slotCheckboxes: "",
      hasSlots: false,
    });
    expect(vm.spellLevels[1]).toMatchObject({
      levelLabel: "1ST LEVEL",
      slotCheckboxes: "☐☐☐☐",
      hasSlots: true,
    });
    expect(vm.spellLevels[1].spells[0]).toMatchObject({
      name: "Magic Missile",
      tags: "(C) (R)",
      notes: "V, S",
      hitDc: "DC 15 WIS",
    });
  });

  it("builds spell cards and only includes prepared leveled spells", () => {
    const cards = buildSpellCards(makeSpellcasting());

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: "Light",
      levelSchool: "Cantrip Evocation",
      hasImg: false,
    });
    expect(cards[1]).toMatchObject({
      name: "Magic Missile",
      concTag: '<span class="fth-spell-tag fth-tag-conc">C</span>',
      ritualTag: '<span class="fth-spell-tag fth-tag-ritual">Ritual</span>',
      levelSchool: "1st Level Evocation",
      components: "V, S (a bit of fleece)",
      hasAttackSave: true,
      attackSave: "DC 15 WIS",
    });
  });

  it("escapes and truncates spell card description content", () => {
    const longDescription = `<p>${"<tag>Arcane</tag> ".repeat(60)}</p>`;
    const cards = buildSpellCards(makeSpellcasting({
      spellsByLevel: new Map<number, SpellData[]>([
        [1, [makeSpell({ description: longDescription })]],
      ]),
    }));

    expect(cards[0].description).not.toContain("<tag>");
    expect(cards[0].description.length).toBeLessThanOrEqual(400);
  });
});
