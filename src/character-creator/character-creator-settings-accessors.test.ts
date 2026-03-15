import { afterEach, describe, expect, it } from "vitest";

import {
  allowCustomBackgrounds,
  allowMulticlass,
  ccAutoOpen,
  ccEnabled,
  ccLevelUpEnabled,
  getAllowedAbilityMethods,
  getDisabledContentUUIDs,
  getEquipmentMethod,
  getLevel1HpMethod,
  getMaxRerolls,
  getPackSources,
  getStartingLevel,
} from "./character-creator-settings-accessors";
import { MOD } from "../logger";
import { CC_SETTINGS } from "./character-creator-settings-shared";

describe("character creator settings accessors", () => {
  const originalGame = (globalThis as Record<string, unknown>).game;

  afterEach(() => {
    (globalThis as Record<string, unknown>).game = originalGame;
  });

  it("returns defaults for booleans and numeric settings", () => {
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get: () => undefined,
      },
    };

    expect(ccEnabled()).toBe(true);
    expect(ccAutoOpen()).toBe(true);
    expect(ccLevelUpEnabled()).toBe(true);
    expect(getStartingLevel()).toBe(1);
    expect(allowMulticlass()).toBe(false);
    expect(getEquipmentMethod()).toBe("both");
    expect(getLevel1HpMethod()).toBe("max");
    expect(getMaxRerolls()).toBe(0);
    expect(allowCustomBackgrounds()).toBe(false);
  });

  it("parses pack sources, disabled content, and allowed methods safely", () => {
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          if (module !== MOD) return undefined;
          if (key === CC_SETTINGS.PACK_SOURCES) return '{"classes":["world.classes"],"feats":["world.feats"]}';
          if (key === CC_SETTINGS.DISABLED_CONTENT) return '["Item.A","Item.B"]';
          if (key === CC_SETTINGS.ALLOWED_ABILITY_METHODS) return '["pointBuy"]';
          return undefined;
        },
      },
    };

    expect(getPackSources()).toMatchObject({
      classes: ["world.classes"],
      feats: ["world.feats"],
    });
    expect(getDisabledContentUUIDs()).toEqual(["Item.A", "Item.B"]);
    expect(getAllowedAbilityMethods()).toEqual(["pointBuy"]);
  });

  it("falls back cleanly for invalid serialized values", () => {
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          if (module !== MOD) return undefined;
          if (key === CC_SETTINGS.PACK_SOURCES) return "{bad json";
          if (key === CC_SETTINGS.DISABLED_CONTENT) return "{}";
          if (key === CC_SETTINGS.ALLOWED_ABILITY_METHODS) return "{}";
          if (key === CC_SETTINGS.STARTING_LEVEL) return 99;
          if (key === CC_SETTINGS.EQUIPMENT_METHOD) return "weird";
          if (key === CC_SETTINGS.LEVEL1_HP_METHOD) return "weird";
          if (key === CC_SETTINGS.MAX_REROLLS) return -10;
          return undefined;
        },
      },
    };

    expect(getPackSources().classes.length).toBeGreaterThan(0);
    expect(getDisabledContentUUIDs()).toEqual([]);
    expect(getAllowedAbilityMethods()).toEqual(["4d6", "pointBuy", "standardArray"]);
    expect(getStartingLevel()).toBe(1);
    expect(getEquipmentMethod()).toBe("both");
    expect(getLevel1HpMethod()).toBe("max");
    expect(getMaxRerolls()).toBe(0);
  });
});
