/**
 * Asset Manager — Preview Panel & Metadata Extraction
 *
 * Slide-in panel showing file preview, metadata table, and
 * optimization suggestions. Extracts dimensions, file size,
 * and duration from images, audio, and video files.
 */

import { type AssetEntry, type AssetType } from "./asset-manager-types";
import { getServerThumbUrl, isOptimizerConfigured } from "./asset-manager-optimizer-client";

/* ── Types ────────────────────────────────────────────────── */

export interface FileMetadata {
  /** File size in bytes (from HEAD request). */
  size: number;
  /** Image width in pixels. */
  width?: number;
  /** Image height in pixels. */
  height?: number;
  /** Audio/video duration in seconds. */
  duration?: number;
  /** Original file format (extension). */
  format: string;
}

export interface OptimizationSuggestion {
  /** Short label for the suggestion. */
  label: string;
  /** Estimated savings percentage. */
  savingsPct: number;
  /** Recommended format. */
  targetFormat: string;
  /** Recommended max dimension (if resize suggested). */
  targetSize?: number;
}

/* ── Metadata Extraction ──────────────────────────────────── */

/** Cache extracted metadata to avoid re-fetching. */
const metadataCache = new Map<string, FileMetadata>();

/**
 * Extract metadata for a file. Results are cached in memory.
 */
export async function extractMetadata(path: string, type: AssetType, ext: string): Promise<FileMetadata> {
  const cached = metadataCache.get(path);
  if (cached) return cached;

  const meta: FileMetadata = { size: 0, format: ext.toUpperCase() || "?" };

  // File size via HEAD request
  try {
    const res = await fetch(path, { method: "HEAD" });
    if (res.ok) {
      const cl = res.headers.get("content-length");
      if (cl) meta.size = parseInt(cl, 10);
    }
  } catch { /* ignore */ }

  // Type-specific extraction
  if (type === "image") {
    try {
      const dims = await extractImageDimensions(path);
      if (dims) {
        meta.width = dims.width;
        meta.height = dims.height;
      }
    } catch { /* ignore */ }
  } else if (type === "audio") {
    try {
      meta.duration = await extractMediaDuration(path, "audio");
    } catch { /* ignore */ }
  } else if (type === "video") {
    try {
      const info = await extractVideoDimensions(path);
      if (info) {
        meta.width = info.width;
        meta.height = info.height;
        meta.duration = info.duration;
      }
    } catch { /* ignore */ }
  }

  metadataCache.set(path, meta);
  return meta;
}

function extractImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function extractMediaDuration(url: string, tag: "audio" | "video"): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement(tag);
    el.preload = "metadata";
    const cleanup = () => {
      el.removeAttribute("src");
      el.load();
    };
    el.onloadedmetadata = () => {
      const dur = isFinite(el.duration) ? el.duration : undefined;
      cleanup();
      resolve(dur);
    };
    el.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    el.src = url;
  });
}

function extractVideoDimensions(url: string): Promise<{ width: number; height: number; duration?: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: isFinite(video.duration) ? video.duration : undefined,
      });
      cleanup();
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

/* ── Optimization Suggestions ─────────────────────────────── */

/** WebP-convertible source formats. */
const CONVERTIBLE_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "bmp", "tiff", "tif", "gif"]);

/**
 * Returns an optimization suggestion if the file could benefit
 * from conversion or resizing. Returns null if already optimal.
 */
export function getOptimizationSuggestion(
  entry: AssetEntry,
  meta: FileMetadata,
): OptimizationSuggestion | null {
  if (entry.isDir) return null;

  // Image: suggest WebP conversion for non-WebP/AVIF formats
  if (entry.type === "image" && CONVERTIBLE_IMAGE_EXTS.has(entry.ext)) {
    // Estimate savings based on format
    const isPng = entry.ext === "png";
    const savingsPct = isPng ? 80 : 50; // PNG→WebP saves ~80%, JPEG→WebP ~50%

    const suggestion: OptimizationSuggestion = {
      label: `Convert to WebP`,
      savingsPct,
      targetFormat: "WebP",
    };

    // Also suggest resize if dimensions are excessive for likely use
    if (meta.width && meta.height) {
      const maxDim = Math.max(meta.width, meta.height);
      if (maxDim > 2048 && meta.size > 2 * 1024 * 1024) {
        suggestion.targetSize = 2048;
        suggestion.label = `Resize & convert to WebP`;
        suggestion.savingsPct = Math.min(95, savingsPct + 15);
      }
    }

    return suggestion;
  }

  // Audio: suggest OGG for WAV/FLAC
  if (entry.type === "audio" && (entry.ext === "wav" || entry.ext === "flac")) {
    return {
      label: `Convert to OGG`,
      savingsPct: entry.ext === "wav" ? 90 : 70,
      targetFormat: "OGG",
    };
  }

  // Video: suggest WebM for non-WebM/MP4
  if (entry.type === "video" && entry.ext !== "webm" && entry.ext !== "mp4") {
    return {
      label: `Convert to WebM`,
      savingsPct: 60,
      targetFormat: "WebM",
    };
  }

  return null;
}

/**
 * Quick check: is this file type convertible?
 * Used for badge rendering without full metadata extraction.
 */
export function isConvertible(ext: string, type: AssetType): boolean {
  if (type === "image") return CONVERTIBLE_IMAGE_EXTS.has(ext);
  if (type === "audio") return ext === "wav" || ext === "flac";
  if (type === "video") return ext !== "webm" && ext !== "mp4";
  return false;
}

/* ── Formatting Utilities ─────────────────────────────────── */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDimensions(w?: number, h?: number): string {
  if (!w || !h) return "—";
  return `${w} × ${h}`;
}

/* ── Preview Panel HTML ───────────────────────────────────── */

/**
 * Build the preview panel HTML for a given entry and metadata.
 * The panel slides in from the right side of the content area.
 */
export function buildPreviewHTML(entry: AssetEntry, meta: FileMetadata | null, esc: (s: string) => string): string {
  const previewContent = buildPreviewContent(entry, esc);
  const metaRows = buildMetaTable(entry, meta, esc);
  const suggestion = meta ? getOptimizationSuggestion(entry, meta) : null;

  const suggestionHTML = suggestion
    ? `<div class="am-preview-suggestion">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>${esc(suggestion.label)}</span>
        <span class="am-preview-savings">~${suggestion.savingsPct}% smaller</span>
      </div>`
    : "";

  return `
    <div class="am-preview-header">
      <span class="am-preview-title" title="${esc(entry.name)}">${esc(entry.name)}</span>
      <button class="am-preview-close" type="button" title="Close preview">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="am-preview-body">
      <div class="am-preview-media">
        ${previewContent}
      </div>
      <div class="am-preview-meta">
        ${metaRows}
      </div>
      ${suggestionHTML}
    </div>
    <div class="am-preview-actions">
      <button class="am-preview-action" data-am-action="copy-path" type="button" title="Copy path">
        <i class="fa-solid fa-copy"></i> Copy Path
      </button>
      <button class="am-preview-action am-preview-select" data-am-action="select-file" type="button" title="Select this file">
        <i class="fa-solid fa-check"></i> Select
      </button>
    </div>
  `;
}

function buildPreviewContent(entry: AssetEntry, esc: (s: string) => string): string {
  switch (entry.type) {
    case "image": {
      // Use server thumbnail for preview if available, otherwise full image
      const thumbUrl = isOptimizerConfigured() ? getServerThumbUrl(entry.path) : null;
      const src = thumbUrl ?? entry.path;
      return `<img src="${esc(src)}" alt="${esc(entry.name)}" class="am-preview-img" decoding="async" />`;
    }
    case "audio":
      return `
        <div class="am-preview-audio-wrap">
          <i class="fa-solid fa-music am-preview-audio-icon"></i>
          <audio controls preload="metadata" class="am-preview-audio">
            <source src="${esc(entry.path)}" />
          </audio>
        </div>
      `;
    case "video":
      return `
        <video controls preload="metadata" class="am-preview-video">
          <source src="${esc(entry.path)}" />
        </video>
      `;
    default:
      return `<i class="fa-solid fa-file am-preview-file-icon"></i>`;
  }
}

function buildMetaTable(entry: AssetEntry, meta: FileMetadata | null, esc: (s: string) => string): string {
  const rows: string[] = [];

  rows.push(metaRow("Format", esc(meta?.format ?? entry.ext.toUpperCase())));

  if (meta?.size) {
    rows.push(metaRow("Size", formatBytes(meta.size)));
  }

  if (meta?.width && meta?.height) {
    rows.push(metaRow("Dimensions", formatDimensions(meta.width, meta.height)));
  }

  if (meta?.duration !== undefined) {
    rows.push(metaRow("Duration", formatDuration(meta.duration)));
  }

  // Optimization status
  if (meta && entry.type === "image") {
    const isOptimal = !CONVERTIBLE_IMAGE_EXTS.has(entry.ext);
    rows.push(metaRow(
      "Status",
      isOptimal
        ? `<span class="am-meta-status am-meta-optimal"><i class="fa-solid fa-circle-check"></i> Optimal</span>`
        : `<span class="am-meta-status am-meta-convertible"><i class="fa-solid fa-triangle-exclamation"></i> Convertible</span>`,
    ));
  }

  return `<table class="am-meta-table">${rows.join("")}</table>`;
}

function metaRow(label: string, value: string): string {
  return `<tr><td class="am-meta-label">${label}</td><td class="am-meta-value">${value}</td></tr>`;
}
