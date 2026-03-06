/**
 * Kiosk Mode — auto-setup for GM-designated players.
 *
 * When a kiosk player logs in, the module:
 *   1. (setup hook) Optionally disables the canvas entirely
 *   2. (ready hook) Closes stray windows, hides UI chrome, sets the LPCS sheet
 *      as active, maximizes it, hides its window header, and shows a fullscreen
 *      button (since mobile/iPad requires a user gesture for fullscreen)
 */

import { MOD, Log } from "../logger";
import { getConfig, getGame, getUI } from "../types";
import { isKioskPlayer, getKioskCanvasMode } from "../settings";
import { buildKioskSheet } from "./kiosk-sheet";

/** Sheet class ID as registered by registerLPCSSheet() in lpcs-sheet.ts */
const LPCS_SHEET_CLASS = `${MOD}.LPCSSheet`;

/**
 * Called at the `setup` hook — before canvas initializes.
 * This is the only point where CONFIG.Canvas.enabled = false takes effect.
 */
export function initKioskSetup(): void {
  if (!isKioskPlayer()) return;

  if (getKioskCanvasMode() === "disable") {
    const cfg = getConfig();
    if (cfg?.Canvas && typeof cfg.Canvas === "object") {
      (cfg.Canvas as Record<string, unknown>).enabled = false;
      Log.info("Kiosk: canvas disabled for player");
    }
  }
}

/**
 * Called at the `ready` hook — after game is fully loaded.
 * Closes windows, hides chrome, sets performance mode, switches to the LPCS
 * sheet, maximizes it, and shows the fullscreen button.
 */
export function initKioskReady(): void {
  if (!isKioskPlayer()) return;

  Log.info("Kiosk: activating kiosk mode");

  // Mark body so CSS can remove constraints (e.g. max-width on .lpcs-sheet)
  document.body.classList.add("fth-kiosk");

  // Close any open windows (welcome dialogs, tour prompts, etc.)
  const ui = getUI();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windows = (ui as any)?.windows as Record<number, { close?: () => Promise<void> }> | undefined;
  if (windows) {
    for (const [, win] of Object.entries(windows)) {
      try { win.close?.(); } catch { /* best-effort */ }
    }
  }

  // Canvas low-performance mode
  const canvasMode = getKioskCanvasMode();
  if (canvasMode === "low") {
    try {
      getGame()?.settings?.set("core", "performanceMode", 0);
      Log.info("Kiosk: set performance mode to Low");
    } catch (e) {
      Log.warn("Kiosk: failed to set performance mode", e);
    }
  }

  // Hide Foundry UI chrome
  hideUiChrome();

  // Switch all owned characters to LPCS sheet, then open the assigned
  // character maximized. Must be sequential — setFlag is async and
  // concurrent actor updates conflict in Foundry.
  void switchAllCharacterSheets()
    .then(() => openKioskSheet())
    .catch((e) => Log.warn("Kiosk: sheet switch/open failed", e));

  // Show fullscreen button — can't auto-fullscreen on mobile without user gesture
  injectFullscreenButton();
}

function hideUiChrome(): void {
  const ids = ["navigation", "controls", "players", "hotbar"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  // Collapse or hide sidebar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sidebar = (getUI() as any)?.sidebar;
  if (sidebar?.collapse) {
    try { sidebar.collapse(); } catch { /* best-effort */ }
  } else {
    const sidebarEl = document.getElementById("sidebar");
    if (sidebarEl) sidebarEl.style.display = "none";
  }
}

/**
 * Set the LPCS sheet as active for every character actor the player owns.
 * Persists via core.sheetClass flag so it only writes once per actor.
 * Awaits each setFlag sequentially — concurrent actor updates conflict in Foundry.
 */
async function switchAllCharacterSheets(): Promise<void> {
  const game = getGame();
  if (!game?.actors) return;

  // Collect owned character actors that need their sheet switched.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toSwitch: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actors = game.actors as any;

  actors.forEach((actor: Record<string, unknown>) => {
    if (actor.type !== "character") return;
    if (!actor.isOwner) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentSheet = (actor as any).getFlag?.("core", "sheetClass");
    if (currentSheet === LPCS_SHEET_CLASS) return;
    toSwitch.push(actor);
  });

  Log.info("Kiosk: switching sheets for", toSwitch.length, "owned characters");

  for (const actor of toSwitch) {
    try {
      await actor.setFlag("core", "sheetClass", LPCS_SHEET_CLASS);
      Log.info("Kiosk: set sheet class to LPCS for", actor.name);
    } catch (e) {
      Log.warn("Kiosk: failed to set sheet class for", actor.name, e);
    }
  }
}

function openKioskSheet(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const character = (getGame()?.user as any)?.character;
  if (!character) {
    Log.warn("Kiosk: no assigned character — cannot open sheet");
    return;
  }

  const sheet = buildKioskSheet(character);
  if (!sheet) {
    Log.warn("Kiosk: failed to build kiosk sheet");
    return;
  }

  sheet.render({ force: true });
  Log.info("Kiosk: opened kiosk sheet for", character.name);
}

let fullscreenBtnInjected = false;

/**
 * Creates a small floating button at the top-center of the viewport.
 * Starts visible so the player can tap it to enter fullscreen (required by
 * mobile/iPad which need a user gesture). Hides itself while in fullscreen
 * and reappears if the user exits (e.g. pressing Escape).
 */
function injectFullscreenButton(): void {
  if (fullscreenBtnInjected) return;
  fullscreenBtnInjected = true;

  const btn = document.createElement("button");
  btn.className = "fth-kiosk-fullscreen-btn";
  btn.setAttribute("aria-label", "Enter fullscreen");
  btn.setAttribute("title", "Enter fullscreen");
  btn.innerHTML = '<i class="fas fa-expand" aria-hidden="true"></i>';

  btn.addEventListener("click", () => {
    document.documentElement.requestFullscreen?.().catch(() => {
      Log.warn("Kiosk: fullscreen request denied");
    });
  });

  document.body.appendChild(btn);

  // Hide while in fullscreen, show when not
  document.addEventListener("fullscreenchange", () => {
    btn.style.display = document.fullscreenElement ? "none" : "";
  });
}
