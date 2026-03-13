import "./styles.css";
import "./lpcs/lpcs-styles.css";
import "./initiative/initiative-dialog.css";
import "./combat/styles/combat-batch-initiative.css";
import "./combat/styles/combat-damage-workflow.css";
import "./combat/styles/combat-monster-preview.css";
import "./combat/styles/combat-party-summary.css";
import "./combat/styles/combat-rules-reference.css";
import "./asset-manager/styles/asset-manager.css";
import "./character-creator/styles/character-creator-styles.css";
import { Log, MOD, type Level } from "./logger";
import { registerSettings } from "./settings";
import { registerPrintSheetHooks } from "./print-sheet/print-sheet";
import { registerWindowRotationHooks, initWindowRotationReady, buildRotationApi } from "./window-rotation/index";
import { getGame, getHooks, getSetting, isGM } from "./types";
import { registerLPCSSettings } from "./lpcs/lpcs-settings";
import { registerLPCSSheet, preloadLPCSTemplates } from "./lpcs/lpcs-sheet";
import { autoOpenLPCS } from "./lpcs/lpcs-auto-open";
import { registerInitiativeSettings, registerInitiativeHooks } from "./initiative/initiative-dialog";
import { initKioskSetup, initKioskReady } from "./kiosk/kiosk-init";
import { registerCombatSettings } from "./combat/combat-settings";
import { registerCombatHooks, initCombatReady, buildCombatApi } from "./combat/combat-init";
import { registerAssetManagerSettings, isAssetManagerEnabled } from "./asset-manager/asset-manager-settings";
import { registerAssetManagerPicker, openAssetManager } from "./asset-manager/asset-manager-picker";
import {
  registerCharacterCreatorSettings,
  registerCharacterCreatorHooks,
  initCharacterCreatorReady,
  openGMConfigApp,
  openCharacterCreatorWizard,
  openLevelUpWizard,
} from "./character-creator/character-creator-init";

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

  // Asset Manager — settings registered at init, picker override deferred to setup
  if (settings) registerAssetManagerSettings(settings);

  // Character Creator & Level-Up Manager
  if (settings) registerCharacterCreatorSettings(settings);
  registerCharacterCreatorHooks();

  // Asset Manager — Scene Control button (token controls layer)
  // V13: controls is an object keyed by name, tools is also an object
  getHooks()?.on?.("getSceneControlButtons", (controls: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!isAssetManagerEnabled() || !isGM()) return;
    if (!controls.tokens?.tools) return;
    controls.tokens.tools["fth-asset-manager"] = {
      name: "fth-asset-manager",
      title: "Asset Manager",
      icon: "fa-solid fa-folder-open",
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      visible: true,
      onChange: () => openAssetManager(),
    };
  });

  const logLevel = getSetting<string>(MOD, "logLevel");
  if (logLevel) Log.setLevel(logLevel as Level);
  Log.info("init");
});

getHooks()?.on?.("setup", () => {
  // Asset Manager — FilePicker override (needs game.user + settings, available at setup)
  registerAssetManagerPicker();

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

  // Character Creator — ready-phase initialization
  initCharacterCreatorReady();

  // Expose unified API to window for macro and console use
  (globalThis as unknown as Record<string, unknown>).fth = {
    setLevel: (lvl: Level) => Log.setLevel(lvl),
    version: game?.modules?.get(MOD)?.version,
    ...buildRotationApi(),
    ...buildCombatApi(),
    assetManager: () => openAssetManager(),
    characterCreator: () => openCharacterCreatorWizard(),
    characterCreatorConfig: () => openGMConfigApp(),
    levelUp: (actorId: string) => openLevelUpWizard(actorId),
  };

  Log.debug("window.fth API attached");
});
