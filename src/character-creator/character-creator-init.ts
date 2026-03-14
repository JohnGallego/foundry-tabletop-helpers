/**
 * Character Creator & Level-Up Manager — Init Orchestrator
 *
 * Exports lifecycle functions called from src/index.ts:
 * - registerCharacterCreatorSettings() — called during `init`
 * - registerCharacterCreatorHooks() — called during `init`
 * - initCharacterCreatorReady() — called during `ready`
 */

import { Log, MOD } from "../logger";
import { getGame, getHooks, isDnd5eWorld, isGM, loadTemplates } from "../types";
import {
  registerCharacterCreatorSettings as registerSettings,
  ccEnabled,
  ccAutoOpen,
} from "./character-creator-settings";
import { buildGMConfigAppClass } from "./gm-config/gm-config-app";
import { buildCharacterCreatorAppClass, openCharacterCreatorWizard } from "./wizard/character-creator-app";
import { registerAllSteps } from "./wizard/step-registry";
import { registerLevelUpHooks } from "./level-up/level-up-init";

export { openGMConfigApp } from "./gm-config/gm-config-app";
export { openCharacterCreatorWizard } from "./wizard/character-creator-app";
export { openLevelUpWizard } from "./level-up/level-up-init";
export { shouldShowLevelUp } from "./level-up/level-up-detection";

/* ── Settings Registration ───────────────────────────────── */

export function registerCharacterCreatorSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMenu(module: string, key: string, data: any): void;
}): void {
  registerSettings(settings);
}

/* ── Hook Registration ───────────────────────────────────── */

export function registerCharacterCreatorHooks(): void {
  // Build ApplicationV2 classes
  buildGMConfigAppClass();
  buildCharacterCreatorAppClass();

  // Register wizard steps
  registerAllSteps();

  // Register level-up hooks (button injection, context menu, LevelUpApp class)
  registerLevelUpHooks();

  // Preload templates
  loadTemplates([
    `modules/${MOD}/templates/character-creator/cc-gm-tabs.hbs`,
    `modules/${MOD}/templates/character-creator/cc-gm-sources.hbs`,
    `modules/${MOD}/templates/character-creator/cc-gm-curation.hbs`,
    `modules/${MOD}/templates/character-creator/cc-gm-rules.hbs`,
    `modules/${MOD}/templates/character-creator/cc-shell.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-abilities.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-background.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-origin-feat.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-skills.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-feats.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-spells.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-equipment.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-review.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-portrait.hbs`,
    `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
  ]);

  // Scene control button — Character Creator (GM only, dnd5e only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getHooks()?.on?.("getSceneControlButtons", (controls: Record<string, any>) => {
    if (!ccEnabled() || !isGM() || !isDnd5eWorld()) return;
    if (!controls.tokens?.tools) return;

    controls.tokens.tools["fth-character-creator"] = {
      name: "fth-character-creator",
      title: "Character Creator",
      icon: "fa-solid fa-hat-wizard",
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      visible: true,
      onChange: () => openCharacterCreatorWizard(),
    };
  });
}

/* ── Ready Phase ─────────────────────────────────────────── */

export function initCharacterCreatorReady(): void {
  autoOpenCharacterCreator();
  registerCharacterCreatorSocket();
}

/**
 * Listen for character creation socket messages (GM sees notifications).
 */
function registerCharacterCreatorSocket(): void {
  if (!isGM()) return;

  const game = getGame();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socket = (game as any)?.socket;
  if (!socket) return;

  socket.on(`module.${MOD}`, (payload: Record<string, unknown>) => {
    if (payload.action !== "characterCreated") return;

    const name = payload.characterName as string;
    const user = payload.userName as string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = (globalThis as any).ui;
    ui?.notifications?.info?.(`${user} created a new character: ${name}`);
    Log.info(`Character Creator: ${user} created "${name}"`);
  });
}

/* ── Auto-Open ──────────────────────────────────────────── */

/**
 * Automatically open the character creator for players without an assigned character.
 * Runs at `ready` after LPCS auto-open (so kiosk takes priority).
 * Only opens for non-GM players in dnd5e worlds when the setting is enabled.
 */
function autoOpenCharacterCreator(): void {
  if (!ccEnabled() || !ccAutoOpen()) return;
  if (!isDnd5eWorld() || isGM()) return;

  const game = getGame();
  const user = game?.user;
  const character = user?.character;

  // Player already has a character — nothing to do
  if (character) return;

  Log.info("Character Creator: auto-opening for characterless player");
  openCharacterCreatorWizard();
}
