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
  createUploadQueueItems,
  createUploadQueueItemsWithOptions,
  OPTIMIZABLE_AUDIO_EXTS,
  splitOptimizableBatchFiles,
} from "./asset-manager-upload-helpers";
import { processUploadQueueItemOptimization } from "./asset-manager-upload-processing";
import { processBatchOptimizationEntry } from "./asset-manager-upload-batch";
import {
  checkOptimizerServer,
  serverOptimizeImage,
  serverOptimizeAudio,
  serverOptimizeVideo,
  serverDeleteFile,
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
  /** Custom optimization settings from the upload dialog. */
  custom?: CustomOptSettings;
}

/** Custom optimization parameters set via the upload dialog. */
export interface CustomOptSettings {
  /** Quality 1-100. Normalized to 0-1 for client-side worker, sent as-is to server. */
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

/** Result from the upload confirmation dialog — one entry per file. */
export interface UploadDialogResult {
  file: File;
  outputName: string;
  preset: OptPreset;
  custom?: CustomOptSettings;
}

/** Callback for queue state changes. */
export type QueueUpdateFn = (queue: UploadQueueItem[]) => void;

/* ── Preset Definitions ───────────────────────────────────── */

/** Default preset values. Overridden at runtime by vault settings if configured. */
export const DEFAULT_PRESETS: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig> = {
  icon:     { label: "Icon (512px)",     maxWidth: 512,  maxHeight: 512,  quality: 0.50, toWebP: true },
  token:    { label: "Token (400px)",    maxWidth: 400,  maxHeight: 400,  quality: 0.50, toWebP: true },
  portrait: { label: "Portrait (600px)", maxWidth: 600,  maxHeight: 600,  quality: 0.50, toWebP: true },
  map:      { label: "Map (original)",   maxWidth: 16384, maxHeight: 16384, quality: 0.50, toWebP: true },
};

/** Active presets — initialized from defaults, overridden by user settings at ready time. */
export let PRESETS: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig> = { ...DEFAULT_PRESETS };

/** Update presets from saved settings. Called during module ready hook. */
export function loadPresetsFromSettings(saved: Record<string, OptPresetConfig>): void {
  for (const key of Object.keys(DEFAULT_PRESETS) as Array<Exclude<OptPreset, "auto" | "none">>) {
    if (saved[key]) {
      PRESETS[key] = { ...DEFAULT_PRESETS[key], ...saved[key] };
    }
  }
}

/** Reset presets to defaults. */
export function resetPresets(): void {
  PRESETS = { ...DEFAULT_PRESETS };
}

export {
  autoDetectPreset,
  sanitizeFilename,
} from "./asset-manager-upload-helpers";

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
    const items = createUploadQueueItems(files, preset, this.#nextId, getSupportedAudioMime(), PRESETS);
    this.#nextId += items.length;
    this.#queue.push(...items);

    this.#notify();
    if (!this.#processing) this.#processNext();
  }

  /** Enqueue files with pre-configured per-file presets from the upload dialog. */
  enqueueWithOptions(items: UploadDialogResult[]): void {
    const queueItems = createUploadQueueItemsWithOptions(items, this.#nextId);
    this.#nextId += queueItems.length;
    this.#queue.push(...queueItems);

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
    const totalStart = performance.now();
    const ext = extname(item.file.name);
    const type = classifyExt(ext);

    Log.info(`Upload: START "${item.originalName}" (${formatBytes(item.originalSize)}, type=${type}, preset=${item.preset})`);

    const fileToUpload = await processUploadQueueItemOptimization(item, {
      presets: PRESETS,
      notify: () => this.#notify(),
      workerAvailable: !!this.#worker,
      optimizeImage: (file, config) => this.#optimizeImage(file, config),
      optimizeAudio,
      checkOptimizerServer,
      serverOptimizeImage,
      serverOptimizeAudio,
      serverOptimizeVideo,
    });

    // Upload to Foundry
    item.status = "uploading";
    item.progress = 60;
    this.#notify();

    const uploadStart = performance.now();
    try {
      await this.#uploadFn(fileToUpload, item.outputName);
      const uploadMs = Math.round(performance.now() - uploadStart);
      item.status = "done";
      item.progress = 100;
      if (!item.optimizedSize) item.optimizedSize = fileToUpload.size;
      const totalMs = Math.round(performance.now() - totalStart);
      Log.info(`Upload: DONE "${item.outputName}" (${formatBytes(fileToUpload.size)}) — upload ${uploadMs}ms, total ${totalMs}ms`);
    } catch (err) {
      item.status = "error";
      item.error = err instanceof Error ? err.message : String(err);
      const totalMs = Math.round(performance.now() - totalStart);
      Log.warn(`Upload: FAILED "${item.originalName}" after ${totalMs}ms`, err);
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
  const splitFiles = splitOptimizableBatchFiles(files);
  const optimizableImages = splitFiles.images;
  const allOptimizable = splitFiles.all;
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
      const inputFile = new File([originalBlob], fileName, { type: originalBlob.type });
      const outcome = await processBatchOptimizationEntry(
        filePath,
        targetDir,
        fileName,
        inputFile,
        isAudio ? "audio" : isVideo ? "video" : "image",
        {
          serverCaps,
          resolvedPreset,
          config,
          uploadFn,
          optimizeAudio,
          optimizeImageWithWorker: worker && config
            ? (blob, imageConfig) => new Promise<Blob>((resolve, reject) => {
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
                imageData: blob,
                maxWidth: imageConfig.maxWidth,
                maxHeight: imageConfig.maxHeight,
                quality: imageConfig.quality,
                toWebP: imageConfig.toWebP,
              });
            })
            : null,
          serverOptimizeImage,
          serverOptimizeAudio,
          serverOptimizeVideo,
          deleteOriginal: (path) => serverDeleteFile(path),
        },
      );

      if (outcome.processed) {
        result.processed++;
        result.totalSaved += outcome.savedBytes;
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
