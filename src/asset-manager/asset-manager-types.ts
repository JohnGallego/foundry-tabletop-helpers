/**
 * Asset Manager — Types
 *
 * Core type definitions for the asset manager feature.
 */

/* ── File Entry ──────────────────────────────────────────── */

/** A file or directory entry from a FilePicker browse result. */
export interface AssetEntry {
  /** Full path relative to the data root. */
  path: string;
  /** Filename only (e.g., "goblin.webp"). */
  name: string;
  /** File extension, lowercase, no dot (e.g., "webp"). */
  ext: string;
  /** Whether this is a directory. */
  isDir: boolean;
  /** File size in bytes (0 for directories). */
  size: number;
  /** Asset type classification. */
  type: AssetType;
  /** Thumbnail URL (set later from cache or lazy generation). */
  thumbUrl?: string;
}

/** Asset classification by type. */
export type AssetType = "image" | "audio" | "video" | "other";

/** Grid density setting. */
export type GridDensity = "small" | "medium" | "large";

/** View mode. */
export type ViewMode = "grid" | "list";

/** Sort field. */
export type SortField = "name" | "size" | "type";

/** Sort direction. */
export type SortDir = "asc" | "desc";

/* ── Browse Result ───────────────────────────────────────── */

/** Normalized result from FilePicker.browse(). */
export interface BrowseResult {
  dirs: string[];
  files: string[];
  target: string;
}

/* ── Constants ───────────────────────────────────────────── */

/** Image extensions (for type detection). */
export const IMAGE_EXTS = new Set([
  "webp", "png", "jpg", "jpeg", "gif", "bmp", "svg", "avif", "tiff", "tif",
]);

/** Audio extensions. */
export const AUDIO_EXTS = new Set([
  "ogg", "mp3", "wav", "flac", "m4a", "aac", "opus", "wma",
]);

/** Video extensions. */
export const VIDEO_EXTS = new Set([
  "webm", "mp4", "avi", "mov", "mkv", "m4v",
]);

/** Classify a file extension into an AssetType. */
export function classifyExt(ext: string): AssetType {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTS.has(lower)) return "image";
  if (AUDIO_EXTS.has(lower)) return "audio";
  if (VIDEO_EXTS.has(lower)) return "video";
  return "other";
}

/** Extract filename from a full path. */
export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/** Extract extension from a filename (lowercase, no dot). */
export function extname(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Grid density → thumbnail CSS size in px. */
export const DENSITY_SIZES: Record<GridDensity, number> = {
  small: 80,
  medium: 120,
  large: 180,
};
