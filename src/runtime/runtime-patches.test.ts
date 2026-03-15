import { beforeEach, describe, expect, it } from "vitest";

import {
  applyRuntimePatchOnce,
  getRuntimePatchState,
  isRuntimePatchApplied,
  resetRuntimePatches,
} from "./runtime-patches";

describe("runtime patch registry", () => {
  beforeEach(() => {
    resetRuntimePatches();
  });

  it("applies a patch only once for a given key", () => {
    let applyCount = 0;

    const first = applyRuntimePatchOnce("test-key", () => ({ hits: 0 }), (state) => {
      applyCount += 1;
      state.hits += 1;
    });

    const second = applyRuntimePatchOnce("test-key", () => ({ hits: 999 }), (state) => {
      applyCount += 1;
      state.hits += 1;
    });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(applyCount).toBe(1);
    expect(second.state).toBe(first.state);
    expect(second.state.hits).toBe(1);
    expect(isRuntimePatchApplied("test-key")).toBe(true);
  });

  it("shares mutable state across lookups", () => {
    const state = getRuntimePatchState("shared-key", () => ({ value: 1 }));
    state.value = 42;

    expect(getRuntimePatchState("shared-key", () => ({ value: 0 })).value).toBe(42);
  });
});
