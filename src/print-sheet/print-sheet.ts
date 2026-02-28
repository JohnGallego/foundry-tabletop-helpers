/**
 * Print-sheet orchestrator.
 * Registers header button hooks on Actor (character/NPC) and Group sheets,
 * coordinates extraction → options dialog → rendering → print/preview window.
 */

import { Log } from "../logger";
import { getGame, getUI, getHooks } from "../types";
import { safe } from "../utils";
import {
  getPrintDefaults,
  canUsePrintFeature,
  showPrintOptionsDialog as showPrintOptionsDialogSetting,
} from "../settings";
import { getExtractor } from "./extractors/base-extractor";
import { getRenderer } from "./renderers/base-renderer";
import { showPrintOptionsDialog } from "./print-options-dialog";
import { openPrintWindow, openPreviewWindow } from "./print-window";
import { preloadPrintTemplates, registerPrintHelpers } from "./renderers/template-engine";
import type { PrintOptions, SheetType } from "./types";

// Import system extractors & renderers so they self-register
import "./extractors/dnd5e-extractor";
import "./renderers/dnd5e-renderer";

/* ── Typed interfaces ──────────────────────────────────────── */

/**
 * Minimal shape of an actor document as accessed through a sheet application.
 * Properties are optional because the object comes from a loosely-typed hook.
 */
interface DocumentLike {
  readonly name?: string | null;
  readonly type?: string;
  readonly documentName?: string;
  readonly constructor: { readonly documentName?: string };
  readonly system?: {
    readonly type?: { readonly value?: string };
    readonly members?: ReadonlyArray<{ readonly actor?: unknown }>;
  };
}

/**
 * Minimal shape of an ApplicationV2 sheet that the print pipeline interacts with.
 */
interface SheetAppLike {
  readonly document?: DocumentLike;
  readonly constructor: { readonly name: string };
  readonly appId?: number;
  readonly id?: string;
}

/* ── Sheet type detection ──────────────────────────────────── */

/**
 * Determine the print SheetType from an ApplicationV2 instance.
 * Returns null if the app isn't a printable sheet.
 */
function getSheetType(app: SheetAppLike): SheetType | null {
  const doc = app.document;
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
    const members: ReadonlyArray<{ readonly actor?: unknown }> = doc.system?.members ?? [];
    const hasPlayerCharacters = members.some((m) => {
      const actor = m.actor;
      if (!actor) return false;
      // If it's already resolved to an Actor document, check its type
      if (typeof actor === "object" && actor !== null && "type" in actor) {
        return (actor as { type?: unknown }).type === "character";
      }
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
 * Derive a human-readable window title from the document and sheet type.
 * Format: the document name, with a fallback when the name is absent.
 * The caller prefixes "Foundry Tabletop Helpers - " via buildDocument().
 */
function getWindowTitle(doc: DocumentLike, sheetType: SheetType): string {
  const name: string | undefined = (doc.name?.trim()) || undefined;
  switch (sheetType) {
    case "character":
    case "npc":
      return name ?? "Sheet";
    case "encounter":
      return name ?? "Encounter Sheet";
    case "party":
      return name ?? "Party Sheet";
  }
}

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
 * Returns the rendered HTML string.
 */
async function extractAndRender(
  doc: DocumentLike,
  sheetType: SheetType,
  options: PrintOptions,
  extractor: NonNullable<ReturnType<typeof getExtractor>>,
  renderer: NonNullable<ReturnType<typeof getRenderer>>,
): Promise<string> {
  Log.info("extracting data", { sheetType, name: doc.name });

  // Extract — the concrete extractor knows the real actor shape; unknown is safe here
  let data: unknown;
  switch (sheetType) {
    case "character":  data = await extractor.extractCharacter(doc, options);  break;
    case "npc":        data = await extractor.extractNPC(doc, options);        break;
    case "encounter":  data = await extractor.extractEncounterGroup(doc, options); break;
    case "party":      data = await extractor.extractPartySummary(doc, options);   break;
  }
  Log.info("data extracted", { sheetType });

  // Render — the concrete renderer knows the ViewModel shape; the cast is safe
  // because the matching extractor/renderer pair always produces compatible data.
  Log.info("rendering HTML", { sheetType });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  let html: string;
  switch (sheetType) {
    case "character":  html = await renderer.renderCharacter(d, options);      break;
    case "npc":        html = await renderer.renderNPC(d, options);            break;
    case "encounter":  html = await renderer.renderEncounterGroup(d, options); break;
    case "party":      html = await renderer.renderPartySummary(d, options);   break;
  }
  Log.info("HTML rendered", { sheetType, htmlLength: html?.length });

  return html;
}

/** Output mode — print opens the browser print dialog; preview is display-only. */
type OutputMode = "print" | "preview";

/**
 * Shared handler for both Print and Preview button clicks.
 * Resolves the extractor/renderer pair, gathers options, extracts + renders data,
 * then opens the appropriate output window.
 */
async function handleOutput(app: SheetAppLike, sheetType: SheetType, mode: OutputMode): Promise<void> {
  const doc = app.document;
  if (!doc) return;

  const systemId: string = getGame()?.system?.id ?? "unknown";

  const extractor = getExtractor(systemId);
  if (!extractor) {
    getUI()?.notifications?.warn?.(`Print sheets not yet supported for system: ${systemId}`);
    return;
  }

  const renderer = getRenderer(systemId);
  if (!renderer) {
    getUI()?.notifications?.warn?.(`Print renderer not available for system: ${systemId}`);
    return;
  }

  const options = await getOptions(sheetType, extractor);
  if (!options) return; // user cancelled

  try {
    const html = await extractAndRender(doc, sheetType, options, extractor, renderer);
    const title = getWindowTitle(doc, sheetType);
    const styles = renderer.getStyles();

    if (mode === "print") {
      openPrintWindow(html, styles, title);
    } else {
      openPreviewWindow(html, styles, title);
    }

    Log.info(`${mode} flow complete`, { sheetType, name: doc.name });
  } catch (err) {
    const label = mode === "print" ? "Print" : "Preview";
    Log.error(`${mode} flow failed`, { sheetType, name: doc.name, err });
    getUI()?.notifications?.error?.(
      `${label} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/* ── Hook registration ─────────────────────────────────────── */

export function registerPrintSheetHooks(): void {
  // Register Handlebars helpers for print templates
  registerPrintHelpers();

  // Preload print templates (async, but we don't await - templates will be ready by the time user prints)
  preloadPrintTemplates().catch(err => {
    Log.error("Failed to preload print templates", err);
  });

  // Add print and preview buttons to V2 application headers.
  // The hook provides loosely-typed app objects; we cast to SheetAppLike and
  // validate the shape inside getSheetType() before any property access.
  getHooks()?.on?.(
    "getHeaderControlsApplicationV2",
    (app: unknown, controls: Record<string, unknown>[]) =>
      safe(() => {
        const typedApp = app as SheetAppLike;
        const sheetType = getSheetType(typedApp);
        if (!sheetType) return;

        // Only show buttons if the current user has print access
        if (!canUsePrintFeature()) return;

        // Add Preview button (unshift so it appears before Print in the header)
        controls.unshift({
          icon: "fa-solid fa-eye",
          label: "FTTH - Preview",
          action: "fth-preview-sheet",
          visible: true,
          onClick: () => handleOutput(typedApp, sheetType, "preview"),
        });

        // Add Print button
        controls.unshift({
          icon: "fa-solid fa-print",
          label: "FTTH - Print",
          action: "fth-print-sheet",
          visible: true,
          onClick: () => handleOutput(typedApp, sheetType, "print"),
        });

        Log.debug("added print/preview buttons", {
          app: typedApp.constructor?.name,
          appId: typedApp.appId,
          sheetType,
        });
      }, "print-sheet:getHeaderControlsApplicationV2"),
  );
}
