/**
 * Smoke tests for dnd5e-system-types.ts utility functions.
 *
 * These functions are pure (no Foundry globals required) so no stubs are needed.
 * They normalise the three runtime shapes that dnd5e 5.x uses for collections
 * (Map, Map-like/Collection, plain Record) into simple arrays.
 */

import { describe, it, expect } from "vitest";
import {
  toArray,
  getFirstFromSetOrArray,
  getActivityValues,
} from "./dnd5e-system-types";

/* ── toArray ──────────────────────────────────────────────── */

describe("toArray", () => {
  it("converts a Set to an array preserving insertion order", () => {
    expect(toArray(new Set(["fire", "cold", "lightning"]))).toEqual(["fire", "cold", "lightning"]);
  });

  it("returns the same Array reference unchanged", () => {
    const arr = ["bludgeoning", "piercing"];
    expect(toArray(arr)).toBe(arr);
  });

  it("returns an empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty Set", () => {
    expect(toArray(new Set<string>())).toEqual([]);
  });

  it("returns an empty array for an empty Array", () => {
    expect(toArray([])).toEqual([]);
  });
});

/* ── getFirstFromSetOrArray ───────────────────────────────── */

describe("getFirstFromSetOrArray", () => {
  it("returns the first element of a Set", () => {
    expect(getFirstFromSetOrArray(new Set(["acid", "fire"]))).toBe("acid");
  });

  it("returns the first element of an Array", () => {
    expect(getFirstFromSetOrArray(["necrotic", "radiant"])).toBe("necrotic");
  });

  it("passes a scalar value through unchanged", () => {
    expect(getFirstFromSetOrArray("thunder")).toBe("thunder");
  });

  it("returns undefined for an empty Set", () => {
    expect(getFirstFromSetOrArray(new Set<string>())).toBeUndefined();
  });

  it("returns undefined for an empty Array", () => {
    expect(getFirstFromSetOrArray([])).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(getFirstFromSetOrArray(undefined)).toBeUndefined();
  });
});

/* ── getActivityValues ────────────────────────────────────── */

describe("getActivityValues", () => {
  it("returns an empty array for null", () => {
    expect(getActivityValues(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(getActivityValues(undefined)).toEqual([]);
  });

  it("handles a native Map (dnd5e internal runtime format)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = new Map<string, any>([
      ["id1", { type: "attack" }],
      ["id2", { type: "save" }],
    ]);
    const result = getActivityValues(m);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("attack");
    expect(result[1].type).toBe("save");
  });

  it("handles a Map-like object (Foundry Collection) via .values()", () => {
    // Simulate a Foundry Collection: has .values() but is not instanceof Map
    const entries = [{ type: "attack" }, { type: "heal" }];
    const collection = { values: () => entries[Symbol.iterator]() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getActivityValues(collection as any);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("attack");
    expect(result[1].type).toBe("heal");
  });

  it("handles a plain Record (serialised/legacy format)", () => {
    const record = {
      id1: { type: "attack" },
      id2: { type: "utility" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as Record<string, any>;
    const result = getActivityValues(record);
    expect(result).toHaveLength(2);
    const types = result.map(a => a.type).sort();
    expect(types).toEqual(["attack", "utility"]);
  });

  it("handles a Map with a single entry", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = new Map<string, any>([["only", { type: "save" }]]);
    expect(getActivityValues(m)).toHaveLength(1);
  });
});

