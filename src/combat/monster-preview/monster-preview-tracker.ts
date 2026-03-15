import { buildMonsterPreviewInlineHTML } from "./monster-preview-rendering";

export function findMonsterPreviewTrackerElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>("#combat")
    ?? doc.querySelector<HTMLElement>("[data-tab='combat']");
}

interface InjectMonsterPreviewOptions {
  cachedContentHTML: string;
  dismissed: boolean;
  attachInlineListeners: (el: HTMLElement) => void;
}

export function injectMonsterPreviewIntoTracker(
  trackerEl: HTMLElement,
  options: InjectMonsterPreviewOptions,
): void {
  trackerEl.querySelector("#fth-mp-inline")?.remove();

  if (!options.cachedContentHTML || options.dismissed) return;

  const combatantList = trackerEl.querySelector<HTMLElement>(".combat-tracker")
    ?? trackerEl.querySelector<HTMLElement>("[class*='combatant']")?.parentElement
    ?? trackerEl.querySelector<HTMLElement>("ol, ul");

  const inlineEl = document.createElement("div");
  inlineEl.id = "fth-mp-inline";
  inlineEl.className = "fth-monster-preview fth-mp-inline";
  inlineEl.innerHTML = buildMonsterPreviewInlineHTML(options.cachedContentHTML);

  if (combatantList) {
    combatantList.parentNode?.insertBefore(inlineEl, combatantList.nextSibling);
  } else {
    trackerEl.appendChild(inlineEl);
  }

  options.attachInlineListeners(inlineEl);
}
