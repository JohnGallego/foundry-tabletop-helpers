import "./styles.css";
import "./lpcs/lpcs-styles.css";
import "./initiative/initiative-dialog.css";
import "./combat/styles/combat-batch-initiative.css";
import "./combat/styles/combat-damage-workflow.css";
import "./combat/styles/combat-monster-preview.css";
import "./combat/styles/combat-party-summary.css";
import "./combat/styles/combat-rules-reference.css";
import "./asset-manager/styles/asset-manager.css";
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
import { registerCombatSettings } from "./combat/combat-settings";
import { registerCombatHooks, initCombatReady, buildCombatApi } from "./combat/combat-init";
import { registerAssetManagerSettings } from "./asset-manager/asset-manager-settings";
import { registerAssetManagerPicker } from "./asset-manager/asset-manager-picker";

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

  // Combat Command Center — Batch Initiative, Token Indicators, etc.
  if (settings) registerCombatSettings(settings);
  registerCombatHooks();

  // Asset Manager — enhanced FilePicker replacement
  if (settings) registerAssetManagerSettings(settings);
  registerAssetManagerPicker();

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

  // Combat Command Center — ready-phase initialization
  initCombatReady();

  // Expose unified API to window for macro and console use
  (globalThis as unknown as Record<string, unknown>).fth = {
    setLevel: (lvl: Level) => Log.setLevel(lvl),
    version: game?.modules?.get(MOD)?.version,
    ...buildRotationApi(),
    ...buildCombatApi(),
  };

  Log.debug("window.fth API attached");
});
