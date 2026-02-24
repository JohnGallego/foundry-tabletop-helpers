/**
 * Shared type definitions for the print-sheet feature.
 */

/** The kind of print sheet being generated */
export type SheetType = "character" | "npc" | "encounter" | "party";

/** Image mode for the print sheet */
export type PortraitMode = "none" | "portrait" | "token";

/** Paper size for print layout */
export type PaperSize = "letter" | "a4";

/** A toggleable section in the pre-print options dialog */
export interface SectionDef {
  key: string;
  label: string;
  default: boolean;
}

/** User-selected print options gathered from the pre-print dialog */
export interface PrintOptions {
  paperSize: PaperSize;
  portrait: PortraitMode;
  sections: Record<string, boolean>;
}

