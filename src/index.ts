import "./styles.css";
import "./lpcs/lpcs-styles.css";
import "./initiative/initiative-dialog.css";
import { Log, MOD, type Level } from "./logger";
import { registerSettings } from "./settings";
import { registerPrintSheetHooks } from "./print-sheet/print-sheet";
import { registerWindowRotationHooks, initWindowRotationReady, buildRotationApi } from "./window-rotation/index";
import { getGame, getHooks, getSetting } from "./types";
import { registerLPCSSettings } from "./lpcs/lpcs-settings";
import { registerLPCSSheet, preloadLPCSTemplates } from "./lpcs/lpcs-sheet";
import { autoOpenLPCS } from "./lpcs/lpcs-auto-open";
import { registerInitiativeSettings, registerInitiativeHooks } from "./initiative/initiative-dialog";
import { initKioskSetup, initKioskReady } from "./kiosk/kiosk-init";

/* ── Hook Registration ─────────────────────────────────────── */

getHooks()?.on?.("init", () => {
  registerSettings();
  registerWindowRotationHooks();
  registerPrintSheetHooks();

  // LPCS — Live Play Character Sheet
  const settings = getGame()?.settings;
  if (settings) registerLPCSSettings(settings);
  registerLPCSSheet();
  void preloadLPCSTemplates();

  // Initiative — Quick Initiative Roll Dialog
  if (settings) registerInitiativeSettings(settings);
  registerInitiativeHooks();

  const logLevel = getSetting<string>(MOD, "logLevel");
  if (logLevel) Log.setLevel(logLevel as Level);
  Log.info("init");
});

getHooks()?.on?.("setup", () => {
  initKioskSetup();
});

getHooks()?.on?.("ready", () => {
  const game = getGame();
  Log.info("ready", {
    core: game?.version,
    system: game?.system?.id,
    user: game?.user?.id,
  });

  // Socket listener + macro pack provisioning
  initWindowRotationReady();

  // Kiosk — full-screen sheet mode for designated players (before auto-open
  // so kiosk handles its own sheet opening with maximize/fullscreen)
  initKioskReady();

  // LPCS — auto-open sheet for assigned player characters
  autoOpenLPCS();

  // Expose unified API to window for macro and console use
  (globalThis as unknown as Record<string, unknown>).fth = {
    setLevel: (lvl: Level) => Log.setLevel(lvl),
    version: game?.modules?.get(MOD)?.version,
    ...buildRotationApi(),
  };

  Log.debug("window.fth API attached");
});
