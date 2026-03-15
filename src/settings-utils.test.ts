import { describe, expect, it } from "vitest";

import { parseCsvSetting, parsePrintDefaults, printDefaultsSettingKey } from "./settings-utils";

describe("settings utils", () => {
  it("parses csv settings into trimmed ids", () => {
    expect(parseCsvSetting(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(parseCsvSetting("")).toEqual([]);
    expect(parseCsvSetting(undefined)).toEqual([]);
  });

  it("parses print defaults and merges missing sections from fallback", () => {
    const fallback = {
      paperSize: "letter" as const,
      portrait: "portrait" as const,
      sections: { summary: true, equipment: false },
    };

    expect(parsePrintDefaults(JSON.stringify({
      paperSize: "a4",
      sections: { summary: false },
    }), fallback)).toEqual({
      paperSize: "a4",
      portrait: "portrait",
      sections: { summary: false, equipment: false },
    });

    expect(parsePrintDefaults("not json", fallback)).toEqual(fallback);
  });

  it("builds print default setting keys", () => {
    expect(printDefaultsSettingKey("character")).toBe("printDefaults_character");
    expect(printDefaultsSettingKey("party")).toBe("printDefaults_party");
  });
});
