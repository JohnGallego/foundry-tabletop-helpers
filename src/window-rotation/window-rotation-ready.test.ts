import { describe, expect, it, vi } from "vitest";

import { syncWindowRotationMacros } from "./window-rotation-ready";

describe("window rotation ready helpers", () => {
  it("creates missing macros and updates legacy entries in place", async () => {
    const create = vi.fn(async () => undefined);
    const updateLegacy = vi.fn(async () => undefined);
    const unchangedUpdate = vi.fn(async () => undefined);

    await syncWindowRotationMacros({
      collection: "world.fth-macros",
      documentClass: { create },
      getDocuments: async () => [
        {
          name: "Rotate All 90° (CW)",
          command: "old()",
          img: "old.webp",
          type: "chat",
          update: updateLegacy,
        },
        {
          name: "Rotate Local 180°",
          command: "window.fth.rotateAll180();",
          img: "icons/tools/navigation/compass-plain-blue.webp",
          type: "script",
          update: unchangedUpdate,
        },
      ],
    }, "icons/tools/navigation/compass-plain-blue.webp");

    expect(updateLegacy).toHaveBeenCalledWith({
      name: "Rotate Players 90° (CW)",
      img: "icons/tools/navigation/compass-plain-blue.webp",
      type: "script",
      command: "window.fth.rotateTargets90CW();",
    }, { pack: "world.fth-macros" });

    expect(unchangedUpdate).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenCalledWith({
      name: "Rotate Players 90° (CCW)",
      type: "script",
      img: "icons/tools/navigation/compass-plain-blue.webp",
      command: "window.fth.rotateTargets90CCW();",
    }, { pack: "world.fth-macros" });
  });
});
