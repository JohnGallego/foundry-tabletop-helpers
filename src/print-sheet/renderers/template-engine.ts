/**
 * Template Engine for print sheet rendering.
 * 
 * Wraps Foundry's Handlebars integration to provide a clean API
 * for rendering templates with view models.
 */

import { Log, MOD } from "../../logger";
import { getHandlebars } from "../../types";

/* ── Module Path ────────────────────────────────────────────── */

/** Get the full module path for a template */
function getTemplatePath(relativePath: string): string {
  return `modules/${MOD}/templates/print/${relativePath}`;
}

/**
 * Preload templates during module init.
 * Call this from the init hook.
 */
export async function preloadPrintTemplates(): Promise<void> {
  const templates = [
    // NPC stat block
    "npc/statblock.hbs",
    // Character sheet
    "character/pro-sheet.hbs",
    // Party summary (DM reference)
    "party/summary.hbs",
    // Encounter group
    "encounter/group.hbs",
  ];

  const paths = templates.map(getTemplatePath);
  
  try {
    // Use Foundry's loadTemplates if available
    const g = globalThis as Record<string, unknown>;
    const loadTemplates = g.loadTemplates as ((paths: string[]) => Promise<void>) | undefined;
    
    if (loadTemplates) {
      await loadTemplates(paths);
      Log.info("Print templates preloaded", { count: paths.length });
    } else {
      Log.warn("loadTemplates not available - templates will load on demand");
    }
  } catch (err) {
    Log.error("Failed to preload print templates", { err });
  }
}

/**
 * Register Handlebars helpers for print templates.
 * Call this from the init hook.
 */
export function registerPrintHelpers(): void {
  const Handlebars = getHandlebars();
  if (!Handlebars) {
    Log.warn("Handlebars not available - cannot register helpers");
    return;
  }

  // Equality check: {{#if (eq a b)}}
  if (!Handlebars.helpers?.eq) {
    Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  }

  // Not equal: {{#if (neq a b)}}
  if (!Handlebars.helpers?.neq) {
    Handlebars.registerHelper("neq", (a: unknown, b: unknown) => a !== b);
  }

  // Logical and: {{#if (and a b)}}
  if (!Handlebars.helpers?.and) {
    Handlebars.registerHelper("and", (a: unknown, b: unknown) => a && b);
  }

  // Logical or: {{#if (or a b)}}
  if (!Handlebars.helpers?.or) {
    Handlebars.registerHelper("or", (a: unknown, b: unknown) => a || b);
  }

  // Safe HTML output (no escaping): {{{safeHtml value}}}
  // Note: Triple braces already do this, but this is explicit
  if (!Handlebars.helpers?.safeHtml) {
    Handlebars.registerHelper("safeHtml", (value: string) => {
      return new Handlebars.SafeString(value ?? "");
    });
  }

  Log.debug("Print template helpers registered");
}

/* ── Rendering ──────────────────────────────────────────────── */

/**
 * Render a template with the given data using Foundry's renderTemplate.
 * Foundry VTT v13 guarantees renderTemplate is available after init.
 */
export async function renderPrintTemplate<T>(
  templatePath: string,
  data: T
): Promise<string> {
  const fullPath = getTemplatePath(templatePath);

  try {
    const g = globalThis as Record<string, unknown>;
    const renderTemplate = g.renderTemplate as ((path: string, data: unknown) => Promise<string>) | undefined;

    if (!renderTemplate) {
      throw new Error("renderTemplate is not available — ensure this is called after Foundry's init hook.");
    }

    return await renderTemplate(fullPath, data);
  } catch (err) {
    Log.error("Template render failed", { templatePath: fullPath, err });
    throw err;
  }
}

/**
 * Render an NPC stat block using templates.
 */
export async function renderNPCStatBlock<T>(data: T): Promise<string> {
  return renderPrintTemplate("npc/statblock.hbs", data);
}

/**
 * Render a character sheet using the pro-sheet template.
 * @param data - The CharacterViewModel data
 */
export async function renderCharacterSheet<T>(data: T): Promise<string> {
  return renderPrintTemplate("character/pro-sheet.hbs", data);
}

/**
 * Render a party summary (DM reference) using templates.
 */
export async function renderPartySummary<T>(data: T): Promise<string> {
  return renderPrintTemplate("party/summary.hbs", data);
}

/**
 * Render an encounter group using templates.
 */
export async function renderEncounterGroup<T>(data: T): Promise<string> {
  return renderPrintTemplate("encounter/group.hbs", data);
}

