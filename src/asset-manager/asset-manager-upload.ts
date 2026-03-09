/**
 * Asset Manager — Upload & Client-Side Optimization
 *
 * Drag-and-drop upload with optimization presets.
 * Uses OffscreenCanvas in an inline Web Worker for resize + WebP
 * conversion before uploading to the Foundry server.
 *
 * Audio optimization uses AudioContext + MediaRecorder to re-encode
 * WAV/FLAC/AIFF to Opus (OGG or WebM container depending on browser).
 * This runs at real-time playback speed — a 60s WAV takes ~60s to convert.
 *
 * Optimization presets:
 *   Token:    400×400px,  WebP q85
 *   Portrait: 800px tall, WebP q85
 *   Map:      original,   WebP q90
 *   Icon:     128×128px,  WebP q85
 *   None:     upload as-is
 *   Audio:    Opus 128kbps (ambient 96kbps, music 160kbps)
 */

import { Log } from "../logger";
import { formatBytes } from "./asset-manager-preview";
import { classifyExt, extname } from "./asset-manager-types";
import {
  checkOptimizerServer,
  serverOptimizeImage,
  serverOptimizeAudio,
  serverOptimizeVideo,
  serverDeleteFile,
  type OptimizeImageOptions,
} from "./asset-manager-optimizer-client";

/* ── Types ────────────────────────────────────────────────── */

export type OptPreset = "auto" | "token" | "portrait" | "map" | "icon" | "none";

export interface OptPresetConfig {
  label: string;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  /** Whether to convert to WebP. */
  toWebP: boolean;
}

export interface UploadQueueItem {
  id: number;
  file: File;
  /** Original filename. */
  originalName: string;
  /** Output filename (may differ after WebP conversion). */
  outputName: string;
  /** Preset applied. */
  preset: OptPreset;
  /** Current status. */
  status: "pending" | "optimizing" | "uploading" | "done" | "error";
  /** Progress 0-100. */
  progress: number;
  /** Original size in bytes. */
  originalSize: number;
  /** Optimized size in bytes (0 until optimization completes). */
  optimizedSize: number;
  /** Error message if failed. */
  error?: string;
}

/** Callback for queue state changes. */
export type QueueUpdateFn = (queue: UploadQueueItem[]) => void;

/* ── Preset Definitions ───────────────────────────────────── */

export const PRESETS: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig> = {
  token:    { label: "Token (400px)",    maxWidth: 400,  maxHeight: 400,  quality: 0.85, toWebP: true },
  portrait: { label: "Portrait (800px)", maxWidth: 800,  maxHeight: 800,  quality: 0.85, toWebP: true },
  map:      { label: "Map (original)",   maxWidth: 8192, maxHeight: 8192, quality: 0.90, toWebP: true },
  icon:     { label: "Icon (128px)",     maxWidth: 128,  maxHeight: 128,  quality: 0.85, toWebP: true },
};

/** Image extensions we can optimize client-side. */
const OPTIMIZABLE_EXTS = new Set(["png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp"]);

/** Audio extensions we can re-encode to Opus. */
const OPTIMIZABLE_AUDIO_EXTS = new Set(["wav", "flac", "aiff", "aif"]);

/** Audio bitrate presets (bits per second). */
const AUDIO_BITRATES: Record<string, number> = {
  ambient: 96_000,
  sfx: 128_000,
  music: 160_000,
  default: 128_000,
};

/* ── Audio Optimization ──────────────────────────────────── */

/**
 * Detect the best supported audio mime type for MediaRecorder.
 * Prefer OGG (Foundry's native format), fall back to WebM.
 */
function getSupportedAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const types = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/** Get file extension for an audio mime type. */
function audioMimeToExt(mime: string): string {
  return mime.startsWith("audio/ogg") ? "ogg" : "webm";
}

/** Detect audio bitrate from filename heuristics. */
function detectAudioBitrate(name: string): number {
  const lower = name.toLowerCase();
  if (/ambient|background|loop|rain|wind|fire|forest|tavern/i.test(lower)) return AUDIO_BITRATES.ambient!;
  if (/music|theme|battle|boss|town|tavern.*music/i.test(lower)) return AUDIO_BITRATES.music!;
  if (/sfx|effect|hit|slash|spell|explosion|footstep/i.test(lower)) return AUDIO_BITRATES.sfx!;
  return AUDIO_BITRATES.default!;
}

/**
 * Re-encode an audio file to Opus via AudioContext + MediaRecorder.
 * Runs at real-time playback speed (browser limitation).
 * Returns null if MediaRecorder doesn't support Opus encoding.
 */
async function optimizeAudio(file: File, bitrate: number): Promise<{ blob: Blob; mime: string } | null> {
  const mime = getSupportedAudioMime();
  if (!mime) return null;

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 48000 });

  try {
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    const dest = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);

    const recorder = new MediaRecorder(dest.stream, {
      mimeType: mime,
      audioBitsPerSecond: bitrate,
    });

    const chunks: Blob[] = [];

    return new Promise<{ blob: Blob; mime: string }>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        audioCtx.close();
        resolve({ blob: new Blob(chunks, { type: mime }), mime });
      };
      recorder.onerror = () => {
        audioCtx.close();
        reject(new Error("MediaRecorder error"));
      };
      source.onended = () => {
        // Small delay to ensure final samples are captured
        setTimeout(() => recorder.stop(), 100);
      };
      recorder.start(1000); // Collect data every second
      source.start();
    });
  } catch (err) {
    audioCtx.close();
    throw err;
  }
}

/* ── Inline Optimizer Worker ──────────────────────────────── */

const OPTIMIZER_WORKER_SOURCE = /* js */ `
"use strict";
self.onmessage = async (e) => {
  const { id, imageData, maxWidth, maxHeight, quality, toWebP } = e.data;
  try {
    const bitmap = await createImageBitmap(imageData);

    // Calculate resize dimensions (fit inside maxWidth × maxHeight)
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > maxWidth || h > maxHeight) {
      const scale = Math.min(maxWidth / w, maxHeight / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const mimeType = toWebP ? "image/webp" : "image/png";
    const blob = await canvas.convertToBlob({ type: mimeType, quality: quality });

    self.postMessage({ id, blob, width: w, height: h });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
`;

/* ── UploadManager Class ──────────────────────────────────── */

export class UploadManager {
  #worker: Worker | null = null;
  #queue: UploadQueueItem[] = [];
  #nextId = 0;
  #processing = false;
  #onUpdate: QueueUpdateFn;
  #uploadFn: (file: File, name: string) => Promise<string>;
  #onComplete: () => void;

  constructor(
    onUpdate: QueueUpdateFn,
    uploadFn: (file: File, name: string) => Promise<string>,
    onComplete: () => void,
  ) {
    this.#onUpdate = onUpdate;
    this.#uploadFn = uploadFn;
    this.#onComplete = onComplete;
    this.#createWorker();
  }

  get queue(): UploadQueueItem[] {
    return this.#queue;
  }

  get isProcessing(): boolean {
    return this.#processing;
  }

  /** Add files to the upload queue. */
  enqueue(files: File[], preset: OptPreset): void {
    for (const file of files) {
      const ext = extname(file.name);
      const type = classifyExt(ext);
      const resolvedPreset = preset === "auto" ? autoDetectPreset(file, type) : preset;
      const shouldOptimizeImage = resolvedPreset !== "none" && type === "image" && OPTIMIZABLE_EXTS.has(ext);
      const shouldOptimizeAudio = resolvedPreset !== "none" && type === "audio" && OPTIMIZABLE_AUDIO_EXTS.has(ext);

      // Determine output filename (may be updated at processing time
      // if server companion handles it differently)
      let outputName = file.name;
      if (shouldOptimizeImage) {
        const config = PRESETS[resolvedPreset as keyof typeof PRESETS];
        if (config?.toWebP && ext !== "webp") {
          outputName = file.name.replace(/\.[^.]+$/, ".webp");
        }
      } else if (shouldOptimizeAudio) {
        // Best guess at output ext — server always produces .ogg,
        // client-side depends on browser (ogg or webm)
        const mime = getSupportedAudioMime();
        if (mime) {
          const outExt = audioMimeToExt(mime);
          outputName = file.name.replace(/\.[^.]+$/, `.${outExt}`);
        }
      } else if (type === "video" && resolvedPreset !== "none") {
        // Video optimization is server-only, but queue it optimistically
        outputName = file.name.replace(/\.[^.]+$/, ".webm");
      }

      this.#queue.push({
        id: this.#nextId++,
        file,
        originalName: file.name,
        outputName,
        preset: resolvedPreset,
        status: "pending",
        progress: 0,
        originalSize: file.size,
        optimizedSize: 0,
      });
    }

    this.#notify();
    if (!this.#processing) this.#processNext();
  }

  /** Cancel all pending items and clear the queue. */
  clear(): void {
    this.#queue = this.#queue.filter((item) => item.status === "optimizing" || item.status === "uploading");
    this.#notify();
  }

  /** Destroy the manager and terminate the worker. */
  destroy(): void {
    if (this.#worker) {
      this.#worker.terminate();
      this.#worker = null;
    }
    this.#queue = [];
  }

  /* ── Internal ─────────────────────────────────────────── */

  #createWorker(): void {
    try {
      const blob = new Blob([OPTIMIZER_WORKER_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      this.#worker = new Worker(url);
      URL.revokeObjectURL(url);
    } catch (err) {
      Log.warn("UploadManager: failed to create optimizer worker", err);
    }
  }

  async #processNext(): Promise<void> {
    const item = this.#queue.find((i) => i.status === "pending");
    if (!item) {
      this.#processing = false;
      // Check if all done
      if (this.#queue.every((i) => i.status === "done" || i.status === "error")) {
        this.#onComplete();
      }
      return;
    }

    this.#processing = true;
    const ext = extname(item.file.name);
    const type = classifyExt(ext);
    const shouldOptimize = item.preset !== "none";
    const isOptimizableImage = type === "image" && OPTIMIZABLE_EXTS.has(ext);
    const isOptimizableAudio = type === "audio" && OPTIMIZABLE_AUDIO_EXTS.has(ext);
    const isVideo = type === "video";

    let fileToUpload: File = item.file;
    let serverHandled = false;

    // ── Try server companion first ──────────────────────────
    if (shouldOptimize && (isOptimizableImage || isOptimizableAudio || isVideo)) {
      const caps = await checkOptimizerServer();

      if (caps) {
        item.status = "optimizing";
        item.progress = 10;
        this.#notify();

        if (isOptimizableImage && caps.image) {
          const serverOpts: OptimizeImageOptions = {};
          const preset = item.preset as keyof typeof PRESETS;
          if (preset in PRESETS) serverOpts.preset = preset;
          const result = await serverOptimizeImage(item.file, serverOpts);
          if (result && !result.skipped) {
            item.optimizedSize = result.optimizedSize;
            item.progress = 50;
            item.outputName = item.file.name.replace(/\.[^.]+$/, ".webp");
            fileToUpload = new File([result.blob], item.outputName, { type: "image/webp" });
            serverHandled = true;
          } else if (result?.skipped) {
            serverHandled = true; // Server says original is smaller — upload as-is
          }
        } else if (isOptimizableAudio && caps.audio) {
          const bitrate = detectAudioBitrate(item.file.name);
          const result = await serverOptimizeAudio(item.file, { bitrate });
          if (result && !result.skipped) {
            item.optimizedSize = result.optimizedSize;
            item.progress = 50;
            item.outputName = item.file.name.replace(/\.[^.]+$/, ".ogg");
            fileToUpload = new File([result.blob], item.outputName, { type: "audio/ogg" });
            serverHandled = true;
          } else if (result?.skipped) {
            serverHandled = true;
          }
        } else if (isVideo && caps.video) {
          const result = await serverOptimizeVideo(item.file);
          if (result && !result.skipped) {
            item.optimizedSize = result.optimizedSize;
            item.progress = 50;
            item.outputName = item.file.name.replace(/\.[^.]+$/, ".webm");
            fileToUpload = new File([result.blob], item.outputName, { type: "video/webm" });
            serverHandled = true;
          } else if (result?.skipped) {
            serverHandled = true;
          }
        }
      }
    }

    // ── Client-side fallback: image optimization ────────────
    if (!serverHandled && shouldOptimize && isOptimizableImage && this.#worker) {
      item.status = "optimizing";
      item.progress = 10;
      this.#notify();

      try {
        const config = PRESETS[item.preset as keyof typeof PRESETS];
        if (config) {
          const optimized = await this.#optimizeImage(item.file, config);
          item.optimizedSize = optimized.size;
          item.progress = 50;
          fileToUpload = new File([optimized], item.outputName, { type: optimized.type });
        }
      } catch (err) {
        Log.debug("UploadManager: image optimization failed, uploading original", err);
        fileToUpload = item.file;
        item.outputName = item.originalName;
      }
    }

    // ── Client-side fallback: audio optimization ────────────
    if (!serverHandled && shouldOptimize && isOptimizableAudio) {
      item.status = "optimizing";
      item.progress = 5;
      this.#notify();

      try {
        const bitrate = detectAudioBitrate(item.file.name);
        const result = await optimizeAudio(item.file, bitrate);
        if (result && result.blob.size < item.file.size) {
          item.optimizedSize = result.blob.size;
          item.progress = 50;
          const outExt = audioMimeToExt(result.mime);
          item.outputName = item.file.name.replace(/\.[^.]+$/, `.${outExt}`);
          fileToUpload = new File([result.blob], item.outputName, { type: result.mime });
        } else {
          Log.debug("UploadManager: audio encoding didn't reduce size, uploading original");
          fileToUpload = item.file;
          item.outputName = item.originalName;
        }
      } catch (err) {
        Log.debug("UploadManager: audio optimization failed, uploading original", err);
        fileToUpload = item.file;
        item.outputName = item.originalName;
      }
    }

    // Upload
    item.status = "uploading";
    item.progress = 60;
    this.#notify();

    try {
      await this.#uploadFn(fileToUpload, item.outputName);
      item.status = "done";
      item.progress = 100;
      if (!item.optimizedSize) item.optimizedSize = fileToUpload.size;
    } catch (err) {
      item.status = "error";
      item.error = err instanceof Error ? err.message : String(err);
      Log.warn(`UploadManager: upload failed for ${item.originalName}`, err);
    }

    this.#notify();

    // Process next item
    await this.#processNext();
  }

  #optimizeImage(file: File, config: OptPresetConfig): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.#worker) {
        reject(new Error("No worker"));
        return;
      }

      const id = this.#nextId++;

      const handler = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        this.#worker?.removeEventListener("message", handler);

        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.blob as Blob);
        }
      };

      this.#worker.addEventListener("message", handler);
      this.#worker.postMessage({
        id,
        imageData: file,
        maxWidth: config.maxWidth,
        maxHeight: config.maxHeight,
        quality: config.quality,
        toWebP: config.toWebP,
      });
    });
  }

  #notify(): void {
    this.#onUpdate([...this.#queue]);
  }
}

/* ── Batch Optimization ───────────────────────────────────── */

export interface BatchOptResult {
  processed: number;
  skipped: number;
  totalSaved: number;
}

/**
 * Optimize existing files in a directory.
 * Tries server companion first (Sharp/FFmpeg), falls back to client-side.
 * Images: OffscreenCanvas resize + WebP via Web Worker (fast).
 * Audio: AudioContext + MediaRecorder re-encode to Opus (real-time speed).
 */
export async function batchOptimize(
  files: string[],
  preset: OptPreset,
  uploadFn: (file: File, name: string, targetDir: string) => Promise<string>,
  onProgress: (current: number, total: number, fileName: string) => void,
): Promise<BatchOptResult> {
  const result: BatchOptResult = { processed: 0, skipped: 0, totalSaved: 0 };

  // Separate by type
  const optimizableImages = files.filter((f) => {
    const ext = extname(f);
    return OPTIMIZABLE_EXTS.has(ext) && ext !== "webp";
  });
  const optimizableAudio = files.filter((f) => {
    const ext = extname(f);
    return OPTIMIZABLE_AUDIO_EXTS.has(ext);
  });
  const optimizableVideo = files.filter((f) => {
    const ext = extname(f);
    const t = classifyExt(ext);
    return t === "video";
  });

  const allOptimizable = [...optimizableImages, ...optimizableAudio, ...optimizableVideo];
  if (allOptimizable.length === 0) return result;

  // Check server companion availability
  const serverCaps = await checkOptimizerServer();

  // Image preset
  const resolvedPreset = preset === "auto" ? "map" : preset;
  const config = resolvedPreset !== "none" ? PRESETS[resolvedPreset as keyof typeof PRESETS] : null;

  // Create a temporary worker for client-side image batch processing (fallback)
  let worker: Worker | null = null;
  if (optimizableImages.length > 0 && config && !serverCaps?.image) {
    try {
      const blob = new Blob([OPTIMIZER_WORKER_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
      URL.revokeObjectURL(url);
    } catch { /* proceed without worker */ }
  }

  let taskId = 0;

  for (let i = 0; i < allOptimizable.length; i++) {
    const filePath = allOptimizable[i]!;
    const fileName = filePath.split("/").pop() ?? filePath;
    // Derive the target directory from the file's own path
    const parts = filePath.split("/");
    const targetDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const ext = extname(filePath);
    const fileType = classifyExt(ext);
    const isAudio = OPTIMIZABLE_AUDIO_EXTS.has(ext);
    const isVideo = fileType === "video";
    const label = isAudio ? `${fileName} (encoding audio...)` : isVideo ? `${fileName} (encoding video...)` : fileName;
    onProgress(i + 1, allOptimizable.length, label);

    try {
      const res = await fetch(filePath);
      if (!res.ok) { result.skipped++; continue; }
      const originalBlob = await res.blob();
      const originalSize = originalBlob.size;
      const inputFile = new File([originalBlob], fileName, { type: originalBlob.type });
      let optimized = false;
      let newName = fileName;

      // ── Try server companion ────────────────────────────
      if (serverCaps) {
        let serverResult = null;

        if (!isAudio && !isVideo && serverCaps.image) {
          const serverOpts: OptimizeImageOptions = {};
          const p = resolvedPreset as keyof typeof PRESETS;
          if (p in PRESETS) serverOpts.preset = p;
          serverResult = await serverOptimizeImage(inputFile, serverOpts);
          if (serverResult && !serverResult.skipped) {
            newName = fileName.replace(/\.[^.]+$/, ".webp");
            await uploadFn(new File([serverResult.blob], newName, { type: "image/webp" }), newName, targetDir);
            result.processed++;
            result.totalSaved += originalSize - serverResult.optimizedSize;
            optimized = true;
          }
        } else if (isAudio && serverCaps.audio) {
          const bitrate = detectAudioBitrate(fileName);
          serverResult = await serverOptimizeAudio(inputFile, { bitrate });
          if (serverResult && !serverResult.skipped) {
            newName = fileName.replace(/\.[^.]+$/, ".ogg");
            await uploadFn(new File([serverResult.blob], newName, { type: "audio/ogg" }), newName, targetDir);
            result.processed++;
            result.totalSaved += originalSize - serverResult.optimizedSize;
            optimized = true;
          }
        } else if (isVideo && serverCaps.video) {
          serverResult = await serverOptimizeVideo(inputFile);
          if (serverResult && !serverResult.skipped) {
            newName = fileName.replace(/\.[^.]+$/, ".webm");
            await uploadFn(new File([serverResult.blob], newName, { type: "video/webm" }), newName, targetDir);
            result.processed++;
            result.totalSaved += originalSize - serverResult.optimizedSize;
            optimized = true;
          }
        }

        if (!optimized && serverResult?.skipped) { result.skipped++; continue; }
        if (optimized) {
          // Delete original if extension changed (e.g., .png → .webp)
          if (newName !== fileName) {
            serverDeleteFile(filePath).catch(() => { /* best effort */ });
          }
          continue;
        }
      }

      // ── Client-side fallback ────────────────────────────
      if (isVideo) {
        // No client-side video optimization available
        result.skipped++;
      } else if (isAudio) {
        const bitrate = detectAudioBitrate(fileName);
        const audioResult = await optimizeAudio(inputFile, bitrate);
        if (audioResult && audioResult.blob.size < originalSize) {
          const outExt = audioMimeToExt(audioResult.mime);
          newName = fileName.replace(/\.[^.]+$/, `.${outExt}`);
          const file = new File([audioResult.blob], newName, { type: audioResult.mime });
          await uploadFn(file, newName, targetDir);
          result.processed++;
          result.totalSaved += originalSize - audioResult.blob.size;
          if (newName !== fileName) {
            serverDeleteFile(filePath).catch(() => { /* best effort */ });
          }
        } else {
          result.skipped++;
        }
      } else if (worker && config) {
        const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
          const id = ++taskId;
          const handler = (e: MessageEvent) => {
            if (e.data.id !== id) return;
            worker?.removeEventListener("message", handler);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.blob as Blob);
          };
          worker!.addEventListener("message", handler);
          worker!.postMessage({
            id,
            imageData: originalBlob,
            maxWidth: config.maxWidth,
            maxHeight: config.maxHeight,
            quality: config.quality,
            toWebP: config.toWebP,
          });
        });

        if (optimizedBlob.size < originalSize) {
          newName = fileName.replace(/\.[^.]+$/, ".webp");
          const file = new File([optimizedBlob], newName, { type: "image/webp" });
          await uploadFn(file, newName, targetDir);
          result.processed++;
          result.totalSaved += originalSize - optimizedBlob.size;
          if (newName !== fileName) {
            serverDeleteFile(filePath).catch(() => { /* best effort */ });
          }
        } else {
          result.skipped++;
        }
      } else {
        result.skipped++;
      }
    } catch {
      result.skipped++;
    }
  }

  if (worker) worker.terminate();
  return result;
}

/* ── Helpers ──────────────────────────────────────────────── */

/** Auto-detect the best preset from file properties. */
function autoDetectPreset(file: File, type: string): OptPreset {
  // Audio files: use "auto" to trigger audio optimization path
  if (type === "audio") {
    const ext = extname(file.name);
    return OPTIMIZABLE_AUDIO_EXTS.has(ext) ? "auto" : "none";
  }

  if (type !== "image") return "none";

  const name = file.name.toLowerCase();
  const ext = extname(file.name);

  // Already WebP and small — skip
  if (ext === "webp" && file.size < 500 * 1024) return "none";

  // Path/name heuristics
  if (/token/i.test(name)) return "token";
  if (/portrait|avatar/i.test(name)) return "portrait";
  if (/icon/i.test(name)) return "icon";
  if (/map|scene|battlemap/i.test(name)) return "map";

  // Size heuristic: small files are likely tokens/icons
  if (file.size < 100 * 1024) return "icon";
  if (file.size < 500 * 1024) return "token";
  if (file.size > 2 * 1024 * 1024) return "map";

  return "portrait"; // Default for medium images
}

/* ── Upload Queue HTML Builder ────────────────────────────── */

export function buildUploadQueueHTML(queue: UploadQueueItem[]): string {
  if (queue.length === 0) return "";

  const items = queue.map((item) => {
    const statusIcon = item.status === "done"
      ? `<i class="fa-solid fa-circle-check am-uq-icon-done"></i>`
      : item.status === "error"
        ? `<i class="fa-solid fa-circle-xmark am-uq-icon-error"></i>`
        : item.status === "optimizing"
          ? `<i class="fa-solid fa-wand-magic-sparkles am-uq-icon-opt"></i>`
          : item.status === "uploading"
            ? `<i class="fa-solid fa-cloud-arrow-up am-uq-icon-upload"></i>`
            : `<i class="fa-solid fa-clock am-uq-icon-pending"></i>`;

    const savings = item.status === "done" && item.optimizedSize > 0 && item.optimizedSize < item.originalSize
      ? `<span class="am-uq-savings">${formatBytes(item.originalSize)} → ${formatBytes(item.optimizedSize)}</span>`
      : "";

    const errorMsg = item.error
      ? `<span class="am-uq-error">${item.error}</span>`
      : "";

    return `
      <div class="am-uq-item" data-status="${item.status}">
        ${statusIcon}
        <span class="am-uq-name" title="${item.originalName}">${item.outputName}</span>
        ${savings}
        ${errorMsg}
        <div class="am-uq-bar"><div class="am-uq-fill" style="width: ${item.progress}%"></div></div>
      </div>
    `;
  }).join("");

  const doneCount = queue.filter((i) => i.status === "done").length;
  const totalCount = queue.length;

  return `
    <div class="am-uq-header">
      <span class="am-uq-title">Uploads ${doneCount}/${totalCount}</span>
      <button class="am-uq-close" type="button" title="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="am-uq-list">${items}</div>
  `;
}

/* ── Preset Selector HTML ─────────────────────────────────── */

export function buildPresetSelectorHTML(current: OptPreset): string {
  const options: { value: OptPreset; label: string }[] = [
    { value: "auto", label: "Auto-detect" },
    { value: "token", label: "Token (400px)" },
    { value: "portrait", label: "Portrait (800px)" },
    { value: "map", label: "Map (original)" },
    { value: "icon", label: "Icon (128px)" },
    { value: "none", label: "No optimization" },
  ];

  return options.map((opt) =>
    `<button class="am-preset-btn${opt.value === current ? " am-active" : ""}" data-am-preset="${opt.value}" type="button">${opt.label}</button>`,
  ).join("");
}
