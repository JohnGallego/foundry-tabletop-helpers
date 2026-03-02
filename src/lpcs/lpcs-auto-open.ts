/**
 * LPCS Auto-Open logic.
 *
 * When the `lpcsAutoOpen` setting is enabled and the user has an assigned
 * character in a dnd5e world, automatically opens the LPCS sheet on ready.
 * GMs are excluded — they typically manage multiple actors and do not need
 * an auto-open behavior.
 *
 * Called from Hooks.once("ready") in src/index.ts.
 */

import { Log } from "../logger";
import { isDnd5eWorld, isGM, getGame } from "../types";
import { lpcsEnabled, lpcsAutoOpen } from "./lpcs-settings";

/**
 * Attempt to auto-open the LPCS sheet for the current user's assigned character.
 *
 * Guards (in order):
 *   1. Feature must be enabled (lpcsEnabled)
 *   2. Auto-open setting must be on (lpcsAutoOpen)
 *   3. World must be dnd5e
 *   4. Current user must NOT be GM
 *   5. User must have an assigned character
 */
export function autoOpenLPCS(): void {
  if (!lpcsEnabled()) {
    Log.debug("LPCS auto-open: feature disabled");
    return;
  }

  if (!lpcsAutoOpen()) {
    Log.debug("LPCS auto-open: setting disabled");
    return;
  }

  if (!isDnd5eWorld()) {
    Log.debug("LPCS auto-open: not a dnd5e world");
    return;
  }

  if (isGM()) {
    Log.debug("LPCS auto-open: skipped for GM");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const character = (getGame()?.user as any)?.character;
  if (!character) {
    Log.debug("LPCS auto-open: no assigned character");
    return;
  }

  try {
    character.sheet?.render({ force: true });
    Log.info("LPCS auto-open: opened sheet for", character.name);
  } catch (err) {
    Log.warn("LPCS auto-open: failed to open sheet", err);
  }
}

