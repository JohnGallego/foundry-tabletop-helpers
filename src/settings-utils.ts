import type { PortraitMode, SheetType } from "./print-sheet/types";

import type { DefaultPrintOptions } from "./settings";

export function parseCsvSetting(raw: string | null | undefined): string[] {
  return (raw ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function parsePrintDefaults(
  raw: string | null | undefined,
  fallback: DefaultPrintOptions,
): DefaultPrintOptions {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<DefaultPrintOptions> | null;
    if (!parsed || typeof parsed !== "object") return fallback;

    return {
      paperSize: (parsed.paperSize as DefaultPrintOptions["paperSize"] | undefined) ?? fallback.paperSize,
      portrait: (parsed.portrait as PortraitMode | undefined) ?? fallback.portrait,
      sections: parsed.sections && typeof parsed.sections === "object"
        ? { ...fallback.sections, ...parsed.sections }
        : fallback.sections,
    };
  } catch {
    return fallback;
  }
}

export function printDefaultsSettingKey(sheetType: SheetType): string {
  return `printDefaults_${sheetType}`;
}
