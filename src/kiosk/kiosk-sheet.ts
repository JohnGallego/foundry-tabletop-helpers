/**
 * Kiosk LPCS Sheet — frameless, full-viewport subclass of LPCSSheet.
 *
 * Uses ApplicationV2's native `window: { frame: false, positioned: false }`
 * to eliminate all window chrome and JS-based positioning. CSS handles layout
 * via `#fth-kiosk-container` (position: fixed; inset: 0). Resize is automatic.
 *
 * NOT registered with DocumentSheetConfig — never appears in the sheet picker.
 * Instantiated directly via `buildKioskSheet(actor)`.
 */

import { Log } from "../logger";
import { getLPCSSheetClass } from "../lpcs/lpcs-sheet";

const KIOSK_CONTAINER_ID = "fth-kiosk-container";

/** Ensure the fixed-position container exists on <body>. */
function ensureContainer(): HTMLElement {
  let el = document.getElementById(KIOSK_CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = KIOSK_CONTAINER_ID;
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Build a KioskLPCSSheet class that extends the runtime LPCSSheet.
 * Returns null if LPCSSheet hasn't been registered yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildKioskSheetClass(): (new (...args: any[]) => any) | null {
  const LPCSSheet = getLPCSSheetClass();
  if (!LPCSSheet) {
    Log.warn("Kiosk: LPCSSheet class not available");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Base = LPCSSheet as any;

  class KioskLPCSSheet extends Base {
    static DEFAULT_OPTIONS = {
      ...Base.DEFAULT_OPTIONS,
      id: "lpcs-kiosk-{id}",
      classes: [...(Base.DEFAULT_OPTIONS.classes ?? []), "fth-kiosk-sheet"],
      window: {
        ...Base.DEFAULT_OPTIONS.window,
        frame: false,
        positioned: false,
      },
    };

    /** Insert into our own container instead of Foundry's #ui-windows. */
    _insertElement(element: HTMLElement): void {
      const container = ensureContainer();
      container.appendChild(element);
    }

    /** Kiosk sheet can never be dismissed. */
    async close(): Promise<void> {
      return;
    }
  }

  return KioskLPCSSheet;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _KioskSheetClass: (new (...args: any[]) => any) | null = null;

/**
 * Build and render a kiosk sheet for the given actor.
 * Returns the sheet instance, or null if the class can't be built.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildKioskSheet(actor: any): any | null {
  if (!_KioskSheetClass) {
    _KioskSheetClass = buildKioskSheetClass();
  }
  if (!_KioskSheetClass) return null;
  return new _KioskSheetClass({ document: actor });
}
