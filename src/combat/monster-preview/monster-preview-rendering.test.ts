import { describe, expect, it } from "vitest";

import {
  buildMonsterPreviewContentHTML,
  buildMonsterPreviewInlineHTML,
  buildMonsterPreviewPanelHTML,
  buildMonsterPreviewStatBlockHTML,
  buildMonsterPreviewUpNextHTML,
} from "./monster-preview-rendering";
import type { NPCViewModel } from "../../print-sheet/renderers/viewmodels/npc-viewmodel";

function makeNpcViewModel(): NPCViewModel {
  return {
    name: "Adult Red Dragon",
    meta: "Huge Dragon, Chaotic Evil",
    portraitUrl: "dragon.webp",
    hasPortrait: true,
    ac: "19",
    hp: "256 (19d12 + 133)",
    speed: "40 ft., fly 80 ft.",
    initiative: "+0",
    showStats: true,
    showAbilities: true,
    abilityRows: [
      {
        left: { key: "STR", value: 27, mod: "+8", save: "+14" },
        right: { key: "DEX", value: 10, mod: "+0", save: "+6" },
      },
    ],
    showTraits: true,
    traitLines: [
      { label: "Senses", value: "blindsight 60 ft." },
      { label: "Languages", value: "Common, Draconic" },
    ],
    featureSections: [
      {
        title: "Actions",
        intro: "The dragon can take 3 legendary actions.",
        hasEntries: true,
        entries: [
          { nameWithUses: "Multiattack", description: "The dragon makes three attacks." },
        ],
      },
      {
        title: "Empty",
        intro: "",
        hasEntries: false,
        entries: [],
      },
    ],
  } as NPCViewModel;
}

describe("monster preview rendering", () => {
  it("renders the monster stat block with abilities, traits, and features", () => {
    const html = buildMonsterPreviewStatBlockHTML(makeNpcViewModel());

    expect(html).toContain("Adult Red Dragon");
    expect(html).toContain("Huge Dragon, Chaotic Evil");
    expect(html).toContain("mp-portrait");
    expect(html).toContain("Save +14");
    expect(html).toContain("Senses");
    expect(html).toContain("Multiattack.");
    expect(html).not.toContain("mp-section-title\">Empty");
  });

  it("renders up-next rows for npc and pc combatants", () => {
    const npcHtml = buildMonsterPreviewUpNextHTML({
      name: "Goblin Boss",
      isNPC: true,
      cr: "1",
      ac: 17,
      hpMax: 21,
    });
    const pcHtml = buildMonsterPreviewUpNextHTML({
      name: "Aric",
      isNPC: false,
    });

    expect(npcHtml).toContain("Goblin Boss");
    expect(npcHtml).toContain("CR 1");
    expect(npcHtml).toContain("AC 17");
    expect(npcHtml).toContain("HP 21");
    expect(npcHtml).toContain("fa-skull");
    expect(pcHtml).toContain("fa-user");
    expect(pcHtml).not.toContain("mp-upnext-stats");
  });

  it("wraps shared content for inline and floating modes", () => {
    const content = buildMonsterPreviewContentHTML(makeNpcViewModel(), { name: "Cleric", isNPC: false });
    const inlineHtml = buildMonsterPreviewInlineHTML(content);
    const panelHtml = buildMonsterPreviewPanelHTML(content);

    expect(content).toContain("mp-up-next");
    expect(inlineHtml).toContain("mp-popout");
    expect(inlineHtml).toContain("Monster Preview");
    expect(panelHtml).toContain("data-mp-drag");
    expect(panelHtml).toContain("mp-dock");
  });
});
