/**
 * Smoke tests for dnd5e-extract-helpers.ts.
 *
 * These tests exercise the core data-transformation functions against synthetic
 * actor objects, verifying that the extractor pipeline produces the correct
 * shape even when optional dnd5e system data is absent.
 *
 * Foundry globals required:
 *   - globalThis.CONFIG  — used by abilityLabel/skillLabel for system-localised
 *                          labels; stubbed to undefined so built-in fallbacks are exercised.
 *   - globalThis.foundry.utils.getProperty — used by resolveRollDataPath inside
 *                          stripEnrichedText; not called by the functions under
 *                          test here, but stubbed for completeness.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  ABILITY_KEYS,
  resolveTraitSet,
  buildFavoritesSet,
  extractAbilities,
  extractSkills,
} from "./dnd5e-extract-helpers";

/* ── Foundry global stubs ─────────────────────────────────── */

beforeAll(() => {
  // CONFIG is absent — label functions fall back to built-in ABILITY_LABELS / SKILL_LABELS
  (globalThis as Record<string, unknown>).CONFIG = undefined;

  // Provide a minimal foundry.utils stub so any indirect calls to getProperty don't throw
  (globalThis as Record<string, unknown>).foundry = {
    utils: {
      getProperty(obj: Record<string, unknown>, key: string): unknown {
        return key.split(".").reduce((cur: unknown, seg: string) => {
          if (cur == null || typeof cur !== "object") return undefined;
          return (cur as Record<string, unknown>)[seg];
        }, obj as unknown);
      },
    },
  };
});

/* ── ABILITY_KEYS constant ────────────────────────────────── */

describe("ABILITY_KEYS", () => {
  it("contains all 6 standard D&D ability score keys in order", () => {
    expect(ABILITY_KEYS).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });
});

/* ── resolveTraitSet ──────────────────────────────────────── */

describe("resolveTraitSet", () => {
  it("returns an empty array for null", () => {
    expect(resolveTraitSet(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(resolveTraitSet(undefined)).toEqual([]);
  });

  it("extracts values from a Set<string>", () => {
    expect(resolveTraitSet({ value: new Set(["bludgeoning", "piercing"]), custom: "" }))
      .toEqual(["bludgeoning", "piercing"]);
  });

  it("extracts values from a string[]", () => {
    expect(resolveTraitSet({ value: ["fire", "cold"], custom: "" }))
      .toEqual(["fire", "cold"]);
  });

  it("parses semicolon-separated custom entries and trims whitespace", () => {
    expect(resolveTraitSet({ value: new Set<string>(), custom: "Silver; Cold iron" }))
      .toEqual(["Silver", "Cold iron"]);
  });

  it("places custom entries before standard values", () => {
    expect(resolveTraitSet({ value: new Set(["fire"]), custom: "Custom" }))
      .toEqual(["Custom", "fire"]);
  });
});

/* ── buildFavoritesSet ────────────────────────────────────── */

describe("buildFavoritesSet", () => {
  it("returns an empty Set when actor has no favorites property", () => {
    expect(buildFavoritesSet({}).size).toBe(0);
  });

  it("collects favourite IDs from the id field", () => {
    const favs = buildFavoritesSet({ favorites: [{ id: "abc" }, { id: "def" }] });
    expect(favs.has("abc")).toBe(true);
    expect(favs.has("def")).toBe(true);
  });

  it("falls back to the source field when id is absent", () => {
    const favs = buildFavoritesSet({ favorites: [{ source: "xyz" }] });
    expect(favs.has("xyz")).toBe(true);
  });
});

/* ── extractAbilities ─────────────────────────────────────── */

describe("extractAbilities", () => {
  it("returns exactly 6 entries regardless of input", () => {
    expect(extractAbilities({ system: {} })).toHaveLength(6);
  });

  it("defaults to value 10 and mod 0 when ability data is absent", () => {
    const result = extractAbilities({ system: { abilities: {} } });
    for (const ab of result) {
      expect(ab.value).toBe(10);
      expect(ab.mod).toBe(0);
    }
  });

  it("calculates the ability modifier from value correctly", () => {
    const result = extractAbilities({ system: { abilities: { str: { value: 18 } } } });
    expect(result.find(a => a.key === "str")?.mod).toBe(4); // (18-10)/2 = 4
  });

  it("adds proficiency bonus to save when proficient", () => {
    const actor = {
      system: {
        attributes: { prof: 3 },
        abilities: { wis: { value: 14, proficient: 1 } },
      },
    };
    const wis = extractAbilities(actor).find(a => a.key === "wis");
    expect(wis?.save).toBe(5); // mod 2 + prof 3
  });

  it("uses an explicit numeric save value when provided", () => {
    const actor = { system: { abilities: { con: { value: 16, save: 7 } } } };
    expect(extractAbilities(actor).find(a => a.key === "con")?.save).toBe(7);
  });
});

/* ── extractSkills ────────────────────────────────────────── */

describe("extractSkills", () => {
  it("returns an empty array when the actor has no skills", () => {
    expect(extractSkills({ system: { skills: {} } })).toEqual([]);
  });

  it("maps skill keys to built-in labels when CONFIG is absent", () => {
    const actor = { system: { skills: { prc: { total: 5, value: 1, ability: "wis" } } } };
    const prc = extractSkills(actor).find(s => s.key === "prc");
    expect(prc?.label).toBe("Perception");
  });

  it("returns skills sorted alphabetically by label", () => {
    const actor = {
      system: {
        skills: {
          ste: { total: 3, value: 1, ability: "dex" },
          acr: { total: 5, value: 2, ability: "dex" },
        },
      },
    };
    const result = extractSkills(actor);
    expect(result[0].key).toBe("acr"); // Acrobatics < Stealth
    expect(result[1].key).toBe("ste");
  });

  it("calculates passive score as 10 + total when not explicitly provided", () => {
    const actor = { system: { skills: { prc: { total: 4, ability: "wis" } } } };
    expect(extractSkills(actor)[0].passive).toBe(14);
  });
});

