/**
 * Opens a new browser window with the rendered print-ready HTML.
 * Uses window.open() to create a clean DOM free of Foundry chrome,
 * then optionally calls window.print() for the native print dialog.
 */

import { Log } from "../logger";

/**
 * Build the full HTML document for the print/preview window.
 */
function buildDocument(bodyHtml: string, css: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Foundry Tabletop Helpers</title>
  <style>${css}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Open a new browser window containing the rendered HTML and CSS.
 * Returns the window reference or null if blocked.
 */
function openWindow(bodyHtml: string, css: string, title: string): Window | null {
  const html = buildDocument(bodyHtml, css, title);

  const win = window.open("", "_blank");
  if (!win) {
    Log.warn("window blocked by browser popup blocker");
    (globalThis as any).ui?.notifications?.warn?.(
      "Window was blocked. Please allow popups for this site.",
    );
    return null;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  return win;
}

/**
 * Open a new browser window containing the rendered HTML and CSS,
 * then trigger the browser's print dialog.
 */
export function openPrintWindow(bodyHtml: string, css: string): void {
  const win = openWindow(bodyHtml, css, "Print Sheet");
  if (!win) return;

  // Small delay to let the browser render before triggering print
  win.setTimeout(() => {
    win.focus();
    win.print();
  }, 400);

  Log.info("print window opened");
}

/**
 * Open a new browser window containing the rendered HTML and CSS
 * for preview only (no print dialog).
 */
export function openPreviewWindow(bodyHtml: string, css: string): void {
  const win = openWindow(bodyHtml, css, "Preview Sheet");
  if (!win) return;

  win.setTimeout(() => {
    win.focus();
  }, 100);

  Log.info("preview window opened");
}
