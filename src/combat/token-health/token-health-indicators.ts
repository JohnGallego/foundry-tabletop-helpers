/**
 * Token Health Indicators — Phase 2 of Combat Command Center
 *
 * Adds PIXI overlays to NPC tokens on the canvas:
 * - AC shield badge (bottom-right, above health): shield shape with AC value
 * - Health tier icon (bottom-right, below AC): heart icon colored by HP tier,
 *   skull icon when defeated
 *
 * Uses `drawToken` and `refreshToken` hooks to manage PIXI display objects.
 * No external dependencies (no libWrapper).
 *
 * Visibility is configurable: everyone (default), gm-only, or off.
 */

import { Log } from "../../logger";
import { getHooks, isGM } from "../../types";
import { getHealthTier, type HealthTier } from "../combat-types";
import { getTokenHealthVisibility } from "./token-health-settings";

/* ── Constants ────────────────────────────────────────────── */

const CONTAINER_NAME = "fth-health-indicators";
const BADGE_FONT_FAMILY = "Roboto Condensed, Roboto, sans-serif";

/* ── Hook Registration ────────────────────────────────────── */

/**
 * Register token health indicator hooks.
 * Called from registerCombatHooks() during init.
 */
export function registerTokenHealthHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  hooks.on("drawToken", onDrawToken);
  hooks.on("refreshToken", onRefreshToken);
  hooks.on("deleteToken", onDeleteToken);

  Log.debug("Token health indicator hooks registered");
}

/* ── Visibility Check ─────────────────────────────────────── */

function shouldShowIndicators(): boolean {
  const visibility = getTokenHealthVisibility();
  if (visibility === "off") return false;
  if (visibility === "gm" && !isGM()) return false;
  return true;
}

/* ── Token Data Extraction ────────────────────────────────── */

interface TokenData {
  isNPC: boolean;
  ac: number | null;
  hpPercent: number;
  hpValue: number;
  hpMax: number;
}

function extractTokenData(token: Record<string, unknown>): TokenData | null {
  const actor = token.actor as Record<string, unknown> | undefined;
  if (!actor) return null;

  const system = actor.system as Record<string, unknown> | undefined;
  if (!system) return null;

  // Only show on NPCs (non-player-owned actors)
  const hasPlayerOwner = actor.hasPlayerOwner === true;
  if (hasPlayerOwner) return null;

  // Extract AC
  const attributes = system.attributes as Record<string, unknown> | undefined;
  const acObj = attributes?.ac as Record<string, unknown> | undefined;
  const ac = typeof acObj?.value === "number" ? acObj.value : null;

  // Extract HP
  const hpObj = attributes?.hp as Record<string, unknown> | undefined;
  const hpValue = typeof hpObj?.value === "number" ? hpObj.value : 0;
  const hpMax = typeof hpObj?.max === "number" ? hpObj.max : 1;
  const hpPercent = hpMax > 0 ? (hpValue / hpMax) * 100 : 0;

  return { isNPC: true, ac, hpPercent, hpValue, hpMax };
}

/* ── PIXI Drawing ─────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPixi(): any {
  return (globalThis as Record<string, unknown>).PIXI;
}

/**
 * Draw or update health indicators on a token.
 * Both badges are stacked in the bottom-right corner:
 *   AC shield (above) + health heart/skull (below).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawIndicators(token: any): void {
  if (!shouldShowIndicators()) {
    removeIndicators(token);
    return;
  }

  const data = extractTokenData(token);
  if (!data) {
    removeIndicators(token);
    return;
  }

  const PIXI = getPixi();
  if (!PIXI) return;

  // Get or create the indicator container
  let container = token.getChildByName?.(CONTAINER_NAME);
  if (!container) {
    container = new PIXI.Container();
    container.name = CONTAINER_NAME;
    container.eventMode = "none";
    container.interactiveChildren = false;
    token.addChild(container);
  }

  // Clear previous drawings
  container.removeChildren();

  // Token dimensions (in local coordinates)
  const w = typeof token.w === "number" ? token.w : 0;
  const h = typeof token.h === "number" ? token.h : 0;
  if (w === 0 || h === 0) return;

  // Scale badge size relative to token size
  const scale = Math.min(w, h) / 100;
  const badgeRadius = Math.max(12, 14 * scale);

  // Health badge sits at the very bottom-right
  const tier = getHealthTier(data.hpPercent);
  const healthCenterX = w - badgeRadius - 2;
  const healthCenterY = h - badgeRadius - 2;

  drawHealthBadge(container, PIXI, tier, healthCenterX, healthCenterY, badgeRadius, scale);

  // AC shield sits directly above the health badge
  if (data.ac !== null) {
    const shieldW = badgeRadius * 1.6;
    const shieldH = badgeRadius * 2.0;
    // Position shield so its bottom aligns just above the health circle
    const shieldBottomY = healthCenterY - badgeRadius - 3; // 3px gap
    const shieldTopY = shieldBottomY - shieldH;
    const shieldCx = healthCenterX; // centered on same x as health badge
    drawACBadge(container, PIXI, data.ac, shieldCx, shieldTopY, shieldW, shieldH, scale);
  }
}

/**
 * Draw the AC shield badge.
 * Shape: classic heater shield — flat top, curved sides tapering to a point.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawACBadge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  container: any, PIXI: any,
  ac: number,
  cx: number, topY: number,
  shieldW: number, shieldH: number,
  scale: number
): void {
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1d24, 0.92);
  bg.lineStyle(1.5, 0xc8a75d, 0.8);

  // Draw shield path: flat top, curved sides, pointed bottom
  bg.moveTo(cx - shieldW / 2, topY);                              // top-left
  bg.lineTo(cx + shieldW / 2, topY);                              // top-right
  bg.lineTo(cx + shieldW / 2, topY + shieldH * 0.45);             // right side straight
  bg.quadraticCurveTo(cx + shieldW / 2, topY + shieldH * 0.75,    // right curve
                      cx, topY + shieldH);                         // bottom point
  bg.quadraticCurveTo(cx - shieldW / 2, topY + shieldH * 0.75,    // left curve
                      cx - shieldW / 2, topY + shieldH * 0.45);   // left side
  bg.lineTo(cx - shieldW / 2, topY);                              // back to top-left
  bg.endFill();
  container.addChild(bg);

  // AC text centered in the shield
  const fontSize = Math.max(10, 12 * scale);
  const text = new PIXI.Text(ac.toString(), {
    fontFamily: BADGE_FONT_FAMILY,
    fontSize,
    fontWeight: "bold",
    fill: 0xe8e4dc,
    align: "center",
  });
  text.anchor.set(0.5);
  text.position.set(cx, topY + shieldH * 0.42);
  container.addChild(text);
}

/**
 * Draw the health badge.
 * - Healthy/Wounded/Bloodied/Critical: filled heart (♥) colored by tier
 * - Defeated: white skull (☠)
 */
function drawHealthBadge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  container: any, PIXI: any,
  tier: HealthTier,
  cx: number, cy: number,
  radius: number, scale: number
): void {
  const isDefeated = tier.id === "defeated";
  const colorHex = isDefeated ? 0xffffff : parseInt(tier.color.replace("#", ""), 16);
  const borderColor = isDefeated ? 0x5a5550 : colorHex;

  // Background circle
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1d24, 0.9);
  bg.lineStyle(1.5, borderColor, 0.8);
  bg.drawCircle(cx, cy, radius);
  bg.endFill();
  container.addChild(bg);

  // Icon: skull for defeated, heart for all other tiers
  const iconChar = isDefeated ? "\u2620" : "\u2665"; // ☠ or ♥
  const fontSize = isDefeated ? Math.max(16, 20 * scale) : Math.max(12, 16 * scale);

  const icon = new PIXI.Text(iconChar, {
    fontFamily: BADGE_FONT_FAMILY,
    fontSize,
    fontWeight: "bold",
    fill: colorHex,
    align: "center",
  });
  icon.anchor.set(0.5);
  icon.position.set(cx, cy);
  container.addChild(icon);
}

/**
 * Remove health indicators from a token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeIndicators(token: any): void {
  const container = token.getChildByName?.(CONTAINER_NAME);
  if (container) {
    container.removeChildren();
    container.destroy();
    token.removeChild(container);
  }
}

/* ── Hook Handlers ────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onDrawToken(token: any): void {
  try {
    drawIndicators(token);
  } catch (err) {
    Log.error("Token health indicators: draw failed", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRefreshToken(token: any): void {
  try {
    drawIndicators(token);
  } catch (err) {
    Log.error("Token health indicators: refresh failed", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onDeleteToken(token: any): void {
  try {
    removeIndicators(token);
  } catch (err) {
    // Token is being destroyed anyway
  }
}
