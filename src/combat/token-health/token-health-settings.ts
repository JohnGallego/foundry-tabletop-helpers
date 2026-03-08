/**
 * Token Health Indicators — Settings
 *
 * Visibility setting for token health overlays:
 * - "everyone" (default): All players see AC and health indicators on NPC tokens
 * - "gm": Only the GM sees indicators
 * - "off": Indicators are disabled
 */

import { getSetting } from "../../types";
import { MOD } from "../../logger";
import { COMBAT_SETTINGS } from "../combat-settings";

export type TokenHealthVisibility = "everyone" | "gm" | "off";

/**
 * Get the current token health indicator visibility setting.
 */
export function getTokenHealthVisibility(): TokenHealthVisibility {
  const value = getSetting<string>(MOD, COMBAT_SETTINGS.TOKEN_HEALTH_VISIBILITY);
  if (value === "gm" || value === "off") return value;
  return "everyone";
}
