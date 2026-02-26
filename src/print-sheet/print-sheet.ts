/**
 * Print-sheet orchestrator.
 * Registers header button hooks on Actor (character/NPC) and Group sheets,
 * coordinates extraction → options dialog → rendering → print/preview window.
 */

import { Log } from "../logger";
import {
  getPrintDefaults,
  showPrintButton,
  showPreviewButton,
  showPrintOptionsDialog as showPrintOptionsDialogSetting,
} from "../settings";
import { getExtractor } from "./extractors/base-extractor";
import { getRenderer } from "./renderers/base-renderer";
import { showPrintOptionsDialog } from "./print-options-dialog";
import { openPrintWindow, openPreviewWindow } from "./print-window";
import type { PrintOptions, SheetType } from "./types";

// Import system extractors & renderers so they self-register
import "./extractors/dnd5e-extractor";
import "./renderers/dnd5e-renderer";

function safe(fn: () => void, where: string) {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
}

/* ── Sheet type detection ──────────────────────────────────── */

/**
 * Determine the print SheetType from an ApplicationV2 instance.
 * Returns null if the app isn't a printable sheet.
 */
function getSheetType(app: any): SheetType | null {
  const doc = app?.document;
  if (!doc) return null;

  const docName: string | undefined =
    doc.documentName ?? doc.constructor?.documentName;
  if (docName !== "Actor") return null;

  const actorType: string = doc.type ?? "";
  if (actorType === "character") return "character";
  if (actorType === "npc") return "npc";

  // dnd5e 5.x has TWO separate actor types for groups:
  // - "group" actor type: Used for parties (system.type.value can be "party" or "encounter")
  // - "encounter" actor type: A dedicated actor type for encounter groups
  if (actorType === "encounter") {
    Log.debug("encounter actor type detected", { name: doc.name });
    return "encounter";
  }

  if (actorType === "group") {
    // Group actors use system.type.value to distinguish party vs encounter
    const groupType: string = doc.system?.type?.value ?? "";

    // Check if any members are player characters (m.actor is a ForeignDocumentField)
    const members = doc.system?.members ?? [];
    const hasPlayerCharacters = members.some((m: any) => {
      // m.actor might be an Actor document or an ID string depending on resolution
      const actor = m.actor;
      if (!actor) return false;
      // If it's already resolved to an Actor document
      if (typeof actor === "object" && actor.type === "character") return true;
      // If it's just an ID, we can't determine the type here
      return false;
    });

    Log.debug("group type detection", {
      name: doc.name,
      groupType,
      memberCount: members.length,
      hasPlayerCharacters,
    });

    // If explicitly set to party, or contains player characters, treat as party
    if (groupType === "party" || hasPlayerCharacters) {
      return "party";
    }

    // All other groups (encounter, empty groupType, etc.) are encounters
    return "encounter";
  }
  return null;
}

/* ── Print/Preview flow ───────────────────────────────────── */

/**
 * Get print options: show dialog or use saved defaults based on settings.
 * Returns null if cancelled (only possible when dialog is shown).
 */
async function getOptions(
  sheetType: SheetType,
  extractor: ReturnType<typeof getExtractor>,
): Promise<PrintOptions | null> {
  const sections = extractor!.getSections(sheetType);
  const defaults = getPrintDefaults(sheetType);

  if (showPrintOptionsDialogSetting()) {
    // Show dialog pre-populated with saved defaults
    return showPrintOptionsDialog(sheetType, sections, defaults);
  } else {
    // Use saved defaults directly
    return {
      paperSize: defaults.paperSize,
      portrait: defaults.portrait,
      sections: { ...defaults.sections },
    };
  }
}

/**
 * Extract data and render HTML for a sheet.
 */
async function extractAndRender(
  doc: any,
  sheetType: SheetType,
  options: PrintOptions,
  extractor: NonNullable<ReturnType<typeof getExtractor>>,
  renderer: NonNullable<ReturnType<typeof getRenderer>>,
): Promise<string> {
  // Extract data
  Log.info("extracting data", { sheetType, name: doc.name });
  let data: any;
  switch (sheetType) {
    case "character":
      data = await extractor.extractCharacter(doc, options);
      break;
    case "npc":
      data = await extractor.extractNPC(doc, options);
      break;
    case "encounter":
      data = await extractor.extractEncounterGroup(doc, options);
      break;
    case "party":
      data = await extractor.extractPartySummary(doc, options);
      break;
  }
  Log.info("data extracted", { sheetType, data });

  // Render HTML
  Log.info("rendering HTML", { sheetType });
  let html: string;
  switch (sheetType) {
    case "character":
      html = renderer.renderCharacter(data, options);
      break;
    case "npc":
      html = renderer.renderNPC(data, options);
      break;
    case "encounter":
      html = renderer.renderEncounterGroup(data, options);
      break;
    case "party":
      html = renderer.renderPartySummary(data, options);
      break;
  }
  Log.info("HTML rendered", { sheetType, htmlLength: html?.length });

  return html;
}

/**
 * Handle the print button click.
 */
async function handlePrint(app: any, sheetType: SheetType): Promise<void> {
  const doc = app.document;
  const systemId: string = (globalThis as any).game?.system?.id ?? "unknown";

  const extractor = getExtractor(systemId);
  if (!extractor) {
    (globalThis as any).ui?.notifications?.warn?.(
      `Print sheets not yet supported for system: ${systemId}`,
    );
    return;
  }

  const renderer = getRenderer(systemId);
  if (!renderer) {
    (globalThis as any).ui?.notifications?.warn?.(
      `Print renderer not available for system: ${systemId}`,
    );
    return;
  }

  const options = await getOptions(sheetType, extractor);
  if (!options) return; // cancelled

  try {
    const html = await extractAndRender(doc, sheetType, options, extractor, renderer);
    openPrintWindow(html, renderer.getStyles());
    Log.info("print flow complete", { sheetType, name: doc.name });
  } catch (err) {
    Log.error("print flow failed", { sheetType, name: doc.name, err });
    console.error("FTH Print Error:", err);
    (globalThis as any).ui?.notifications?.error?.(
      `Print failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Handle the preview button click.
 * Opens the sheet in a new window without triggering print.
 */
async function handlePreview(app: any, sheetType: SheetType): Promise<void> {
  const doc = app.document;
  const systemId: string = (globalThis as any).game?.system?.id ?? "unknown";

  const extractor = getExtractor(systemId);
  if (!extractor) {
    (globalThis as any).ui?.notifications?.warn?.(
      `Print sheets not yet supported for system: ${systemId}`,
    );
    return;
  }

  const renderer = getRenderer(systemId);
  if (!renderer) {
    (globalThis as any).ui?.notifications?.warn?.(
      `Print renderer not available for system: ${systemId}`,
    );
    return;
  }

  const options = await getOptions(sheetType, extractor);
  if (!options) return; // cancelled

  try {
    const html = await extractAndRender(doc, sheetType, options, extractor, renderer);
    openPreviewWindow(html, renderer.getStyles());
    Log.info("preview flow complete", { sheetType, name: doc.name });
  } catch (err) {
    Log.error("preview flow failed", { sheetType, name: doc.name, err });
    console.error("FTH Preview Error:", err);
    (globalThis as any).ui?.notifications?.error?.(
      `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/* ── Hook registration ─────────────────────────────────────── */

export function registerPrintSheetHooks(): void {
  // Add print and preview buttons to V2 application headers
  (globalThis as any).Hooks?.on?.(
    "getHeaderControlsApplicationV2",
    (app: any, controls: any[]) =>
      safe(() => {
        const sheetType = getSheetType(app);
        if (!sheetType) return;

        // Add Preview button (if enabled)
        if (showPreviewButton()) {
          controls.unshift({
            icon: "fa-solid fa-eye",
            label: "Preview",
            action: "fth-preview-sheet",
            visible: true,
            onClick: () => handlePreview(app, sheetType),
          });
        }

        // Add Print button (if enabled)
        if (showPrintButton()) {
          controls.unshift({
            icon: "fa-solid fa-print",
            label: "Print",
            action: "fth-print-sheet",
            visible: true,
            onClick: () => handlePrint(app, sheetType),
          });
        }

        Log.debug("added print/preview buttons", {
          app: app?.constructor?.name,
          appId: app?.appId,
          sheetType,
          printButton: showPrintButton(),
          previewButton: showPreviewButton(),
        });
      }, "print-sheet:getHeaderControlsApplicationV2"),
  );
}
