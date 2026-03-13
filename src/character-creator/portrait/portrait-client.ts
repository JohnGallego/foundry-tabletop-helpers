/**
 * Character Creator — Portrait Client
 *
 * HTTP client for the companion server's portrait generation endpoint.
 * Follows the same pattern as asset-manager-optimizer-client.ts.
 * Falls back gracefully when server is unavailable.
 */

import { Log, MOD } from "../../logger";
import { getGame } from "../../types";
import { AM_SETTINGS } from "../../asset-manager/asset-manager-settings";

/* ── Types ────────────────────────────────────────────────── */

export interface PortraitGenerateOptions {
  prompt: string;
  style?: "fantasy" | "realistic" | "painterly";
  aspectRatio?: "square" | "portrait";
  count?: number;
}

export interface GeneratedPortrait {
  /** Base64-encoded image data (WebP). */
  base64: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** MIME type (always image/webp from server). */
  mimeType: string;
  /** Data URL ready for <img src>. */
  dataUrl: string;
}

/* ── Config ───────────────────────────────────────────────── */

function getConfig(): { url: string; token: string } | null {
  try {
    const game = getGame();
    const url = (game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_URL) as string) ?? "";
    const token = (game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_TOKEN) as string) ?? "";
    if (!url || !token) return null;
    return { url: url.replace(/\/+$/, ""), token };
  } catch {
    return null;
  }
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Check whether the server supports portrait generation.
 * Reads from the cached health check capabilities.
 */
export async function isPortraitAvailable(): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  try {
    const res = await fetch(`${config.url}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.capabilities?.portrait === true;
  } catch {
    return false;
  }
}

/**
 * Generate character portraits via the companion server.
 * Returns an array of generated images, or empty array on failure.
 */
export async function generatePortraits(
  options: PortraitGenerateOptions,
): Promise<GeneratedPortrait[]> {
  const config = getConfig();
  if (!config) {
    Log.warn("Portrait generation: server not configured");
    return [];
  }

  try {
    const res = await fetch(`${config.url}/generate/portrait`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        style: options.style ?? "fantasy",
        aspectRatio: options.aspectRatio ?? "portrait",
        count: options.count ?? 2,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min timeout
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Log.warn(`Portrait generation server error: ${res.status}`, body);
      return [];
    }

    const data = await res.json();
    const images = data.images as Array<{
      base64: string;
      width: number;
      height: number;
      mimeType: string;
    }>;

    if (!Array.isArray(images) || images.length === 0) {
      Log.warn("Portrait generation: no images returned");
      return [];
    }

    return images.map((img) => ({
      ...img,
      dataUrl: `data:${img.mimeType};base64,${img.base64}`,
    }));
  } catch (err) {
    Log.warn("Portrait generation request failed", err);
    return [];
  }
}
