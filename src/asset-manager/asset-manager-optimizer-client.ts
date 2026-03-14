/**
 * Asset Manager — Server Companion Client
 *
 * Communicates with the FTH Optimizer server for high-quality
 * asset optimization via Sharp (images) and FFmpeg (audio/video).
 *
 * Falls back gracefully — if the server is unreachable or returns
 * an error, the caller should fall back to client-side optimization.
 */

import { Log, MOD } from "../logger";
import { getGame } from "../types";
import { AM_SETTINGS } from "./asset-manager-settings";

/* ── Types ────────────────────────────────────────────────── */

export interface ServerCapabilities {
  image: boolean;
  audio: boolean;
  video: boolean;
  thumbnail: boolean;
  portrait: boolean;
}

export interface OptimizeImageOptions {
  preset?: "token" | "portrait" | "map" | "icon" | "custom";
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "avif" | "png";
}

export interface OptimizeAudioOptions {
  bitrate?: number;
}

export interface OptimizeVideoOptions {
  crf?: number;
  format?: "webm" | "mp4";
  audioBitrate?: number;
}

export interface OptimizeResult {
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  skipped: boolean;
  dimensions?: string;
}

/* ── Cached state ─────────────────────────────────────────── */

let cachedUrl: string | null = null;
let cachedToken: string | null = null;
let cachedCapabilities: ServerCapabilities | null = null;
let lastHealthCheck = 0;
const HEALTH_CACHE_MS = 60_000; // Re-check health every 60s

/* ── Config helpers ───────────────────────────────────────── */

function getConfig(): { url: string; token: string } | null {
  try {
    const game = getGame();
    const url = (game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_URL) as string) ?? "";
    const token = (game?.settings?.get?.(MOD, AM_SETTINGS.OPTIMIZER_TOKEN) as string) ?? "";
    if (!url || !token) return null;
    // Normalize: strip trailing slash
    cachedUrl = url.replace(/\/+$/, "");
    cachedToken = token;
    return { url: cachedUrl, token: cachedToken };
  } catch {
    return null;
  }
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Check if the server companion is configured and reachable.
 * Returns capabilities, or null if unavailable.
 * Caches the result for 60s.
 */
export async function checkOptimizerServer(): Promise<ServerCapabilities | null> {
  // Return cached if recent
  if (cachedCapabilities && Date.now() - lastHealthCheck < HEALTH_CACHE_MS) {
    return cachedCapabilities;
  }

  const config = getConfig();
  if (!config) {
    cachedCapabilities = null;
    return null;
  }

  try {
    const res = await fetch(`${config.url}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      cachedCapabilities = null;
      return null;
    }
    const data = await res.json();
    cachedCapabilities = data.capabilities as ServerCapabilities;
    lastHealthCheck = Date.now();
    Log.debug("Optimizer server reachable:", cachedCapabilities);
    return cachedCapabilities;
  } catch {
    cachedCapabilities = null;
    return null;
  }
}

/**
 * Optimize an image via the server companion.
 * Returns null if the server is unavailable (caller should fall back).
 */
export async function serverOptimizeImage(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<OptimizeResult | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const form = new FormData();
    form.append("file", file);
    if (options.preset) form.append("preset", options.preset);
    if (options.maxWidth) form.append("maxWidth", String(options.maxWidth));
    if (options.maxHeight) form.append("maxHeight", String(options.maxHeight));
    if (options.quality) form.append("quality", String(options.quality));
    if (options.format) form.append("format", options.format);

    const fetchStart = performance.now();
    const res = await fetch(`${config.url}/optimize/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const fetchMs = Math.round(performance.now() - fetchStart);

    if (!res.ok) {
      Log.warn(`Optimizer server image error: ${res.status} (${fetchMs}ms)`);
      return null;
    }

    const blobStart = performance.now();
    const blob = await res.blob();
    const blobMs = Math.round(performance.now() - blobStart);
    Log.info(`Optimizer: image response received — fetch ${fetchMs}ms, blob read ${blobMs}ms, size ${blob.size}`);

    return {
      blob,
      originalSize: parseInt(res.headers.get("X-Original-Size") ?? "0", 10),
      optimizedSize: parseInt(res.headers.get("X-Optimized-Size") ?? "0", 10),
      skipped: res.headers.get("X-Skipped") === "larger",
      dimensions: res.headers.get("X-Dimensions") ?? undefined,
    };
  } catch (err) {
    Log.debug("Optimizer server image request failed, falling back to client-side", err);
    return null;
  }
}

/**
 * Optimize audio via the server companion (produces OGG Vorbis).
 * Returns null if unavailable.
 */
export async function serverOptimizeAudio(
  file: File,
  options: OptimizeAudioOptions = {},
): Promise<OptimizeResult | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const form = new FormData();
    form.append("file", file);
    if (options.bitrate) form.append("bitrate", String(options.bitrate));

    const res = await fetch(`${config.url}/optimize/audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      Log.warn(`Optimizer server audio error: ${res.status}`);
      return null;
    }

    const blob = await res.blob();
    return {
      blob,
      originalSize: parseInt(res.headers.get("X-Original-Size") ?? "0", 10),
      optimizedSize: parseInt(res.headers.get("X-Optimized-Size") ?? "0", 10),
      skipped: res.headers.get("X-Skipped") === "larger",
    };
  } catch (err) {
    Log.debug("Optimizer server audio request failed, falling back to client-side", err);
    return null;
  }
}

/**
 * Optimize video via the server companion.
 * Returns null if unavailable. This is server-only — no client-side fallback exists.
 */
export async function serverOptimizeVideo(
  file: File,
  options: OptimizeVideoOptions = {},
): Promise<OptimizeResult | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const form = new FormData();
    form.append("file", file);
    if (options.crf) form.append("crf", String(options.crf));
    if (options.format) form.append("format", options.format);
    if (options.audioBitrate) form.append("audioBitrate", String(options.audioBitrate));

    const res = await fetch(`${config.url}/optimize/video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      body: form,
      // Video encoding can take a long time
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      Log.warn(`Optimizer server video error: ${res.status}`);
      return null;
    }

    const blob = await res.blob();
    return {
      blob,
      originalSize: parseInt(res.headers.get("X-Original-Size") ?? "0", 10),
      optimizedSize: parseInt(res.headers.get("X-Optimized-Size") ?? "0", 10),
      skipped: res.headers.get("X-Skipped") === "larger",
    };
  } catch (err) {
    Log.debug("Optimizer server video request failed", err);
    return null;
  }
}

/**
 * Delete a file via the server companion.
 * Used after batch optimization to remove the original (e.g., icon.png after icon.webp is uploaded).
 * Returns true if deleted, false if failed or server unavailable.
 */
export async function serverDeleteFile(filePath: string): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  try {
    const res = await fetch(`${config.url}/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: filePath }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Log.warn(`Optimizer server delete error: ${res.status}`, body);
      return false;
    }

    return true;
  } catch (err) {
    Log.debug("Optimizer server delete request failed", err);
    return false;
  }
}

/**
 * Delete a folder recursively via the server companion.
 * Returns true if deleted, false if failed or server unavailable.
 */
export async function serverDeleteFolder(folderPath: string): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  try {
    const res = await fetch(`${config.url}/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: folderPath, recursive: true }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Log.warn(`Optimizer server folder delete error: ${res.status}`, body);
      return false;
    }

    return true;
  } catch (err) {
    Log.debug("Optimizer server folder delete request failed", err);
    return false;
  }
}

/**
 * Create a folder via the optimizer server.
 * Returns true on success, false on failure (caller should show error).
 */
export async function serverCreateFolder(folderPath: string): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  try {
    const res = await fetch(`${config.url}/mkdir`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: folderPath }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      Log.warn(`Optimizer server mkdir error: ${res.status}`, body);
      return false;
    }

    return true;
  } catch (err) {
    Log.debug("Optimizer server mkdir request failed", err);
    return false;
  }
}

export interface ThumbCacheStats {
  count: number;
  totalBytes: number;
}

/** Fetch thumbnail cache stats from the server. Cached in memory. */
let cachedThumbStats: ThumbCacheStats | null = null;
let thumbStatsTime = 0;
const THUMB_STATS_CACHE_MS = 300_000; // 5 min cache

export async function getThumbCacheStats(force = false): Promise<ThumbCacheStats | null> {
  if (!force && cachedThumbStats && Date.now() - thumbStatsTime < THUMB_STATS_CACHE_MS) {
    return cachedThumbStats;
  }
  const config = getConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/thumb/stats`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return cachedThumbStats;
    const data = await res.json();
    cachedThumbStats = { count: data.count ?? 0, totalBytes: data.totalBytes ?? 0 };
    thumbStatsTime = Date.now();
    return cachedThumbStats;
  } catch {
    return cachedThumbStats;
  }
}

/** Invalidate the cached thumb stats (call after deletion or batch operations). */
export function invalidateThumbStats(): void {
  thumbStatsTime = 0;
}

/** Returns true if the optimizer server is configured (URL + token present). */
export function isOptimizerConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Build a direct URL for a server-cached thumbnail.
 * Used as `img.src` — browser HTTP cache handles the rest.
 * Returns null if the server is not configured.
 */
export function getServerThumbUrl(assetPath: string): string | null {
  const config = getConfig();
  if (!config) return null;
  return `${config.url}/thumb?path=${encodeURIComponent(assetPath)}&token=${encodeURIComponent(config.token)}&v=2`;
}

/** Reset cached state (e.g., when settings change). */
export function resetOptimizerCache(): void {
  cachedUrl = null;
  cachedToken = null;
  cachedCapabilities = null;
  lastHealthCheck = 0;
}
