import { Log } from "../logger";
import { formatBytes } from "./asset-manager-preview";
import { classifyExt, extname } from "./asset-manager-types";
import {
  audioMimeToExt,
  detectAudioBitrate,
  OPTIMIZABLE_AUDIO_EXTS,
  OPTIMIZABLE_EXTS,
  sanitizeFilename,
} from "./asset-manager-upload-helpers";
import type { ServerCapabilities, OptimizeImageOptions, OptimizeResult } from "./asset-manager-optimizer-client";
import type { OptPreset, OptPresetConfig, UploadQueueItem } from "./asset-manager-upload";

export interface AudioOptimizationResult {
  blob: Blob;
  mime: string;
}

export interface UploadOptimizationDeps {
  presets: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig>;
  notify: () => void;
  workerAvailable: boolean;
  optimizeImage: (file: File, config: OptPresetConfig) => Promise<Blob>;
  optimizeAudio: (file: File, bitrate: number) => Promise<AudioOptimizationResult | null>;
  checkOptimizerServer: () => Promise<ServerCapabilities | null>;
  serverOptimizeImage: (file: File, options: OptimizeImageOptions) => Promise<OptimizeResult | null>;
  serverOptimizeAudio: (file: File, options: { bitrate: number }) => Promise<OptimizeResult | null>;
  serverOptimizeVideo: (file: File) => Promise<OptimizeResult | null>;
}

export async function processUploadQueueItemOptimization(
  item: UploadQueueItem,
  deps: UploadOptimizationDeps,
): Promise<File> {
  const ext = extname(item.file.name);
  const type = classifyExt(ext);
  const shouldOptimize = item.preset !== "none";
  const isOptimizableImage = type === "image" && OPTIMIZABLE_EXTS.has(ext);
  const isOptimizableAudio = type === "audio" && OPTIMIZABLE_AUDIO_EXTS.has(ext);
  const isVideo = type === "video";

  let fileToUpload: File = item.file;
  let serverHandled = false;

  if (shouldOptimize && (isOptimizableImage || isOptimizableAudio || isVideo)) {
    const healthStart = performance.now();
    const caps = await deps.checkOptimizerServer();
    Log.info(`Upload: health check ${caps ? "OK" : "UNAVAILABLE"} (${Math.round(performance.now() - healthStart)}ms)`);

    if (caps) {
      item.status = "optimizing";
      item.progress = 10;
      deps.notify();

      const serverFile = await tryServerOptimization(item, caps, deps, {
        isOptimizableImage,
        isOptimizableAudio,
        isVideo,
      });
      if (serverFile) {
        fileToUpload = serverFile.file;
        serverHandled = serverFile.handled;
      }
    }
  }

  if (!serverHandled && shouldOptimize && isOptimizableImage && deps.workerAvailable) {
    item.status = "optimizing";
    item.progress = 10;
    deps.notify();

    try {
      const config: OptPresetConfig | undefined = item.custom
        ? {
            label: "Custom",
            maxWidth: item.custom.maxWidth,
            maxHeight: item.custom.maxHeight,
            quality: item.custom.quality / 100,
            toWebP: true,
          }
        : deps.presets[item.preset as keyof typeof deps.presets];
      if (config) {
        const clientStart = performance.now();
        const optimized = await deps.optimizeImage(item.file, config);
        Log.info(`Upload: client image optimize ${formatBytes(item.file.size)} → ${formatBytes(optimized.size)} (${Math.round(performance.now() - clientStart)}ms)`);
        item.optimizedSize = optimized.size;
        item.progress = 50;
        fileToUpload = new File([optimized], item.outputName, { type: optimized.type });
      }
    } catch (err) {
      Log.info("Upload: client image optimization failed, uploading original", err);
      fileToUpload = item.file;
      item.outputName = item.originalName;
    }
  }

  if (!serverHandled && shouldOptimize && isOptimizableAudio) {
    item.status = "optimizing";
    item.progress = 5;
    deps.notify();

    try {
      const bitrate = detectAudioBitrate(item.file.name);
      const clientStart = performance.now();
      const result = await deps.optimizeAudio(item.file, bitrate);
      const clientMs = Math.round(performance.now() - clientStart);
      if (result && result.blob.size < item.file.size) {
        Log.info(`Upload: client audio optimize ${formatBytes(item.file.size)} → ${formatBytes(result.blob.size)} (${clientMs}ms)`);
        item.optimizedSize = result.blob.size;
        item.progress = 50;
        const outExt = audioMimeToExt(result.mime);
        item.outputName = sanitizeFilename(item.file.name.replace(/\.[^.]+$/, `.${outExt}`));
        fileToUpload = new File([result.blob], item.outputName, { type: result.mime });
      } else {
        Log.info(`Upload: client audio no size reduction (${clientMs}ms), uploading original`);
        fileToUpload = item.file;
        item.outputName = item.originalName;
      }
    } catch (err) {
      Log.info("Upload: client audio optimization failed, uploading original", err);
      fileToUpload = item.file;
      item.outputName = item.originalName;
    }
  }

  return fileToUpload;
}

async function tryServerOptimization(
  item: UploadQueueItem,
  caps: ServerCapabilities,
  deps: UploadOptimizationDeps,
  kinds: {
    isOptimizableImage: boolean;
    isOptimizableAudio: boolean;
    isVideo: boolean;
  },
): Promise<{ file: File; handled: boolean } | null> {
  if (kinds.isOptimizableImage && caps.image) {
    const serverOpts: OptimizeImageOptions = {};
    if (item.custom) {
      serverOpts.maxWidth = item.custom.maxWidth;
      serverOpts.maxHeight = item.custom.maxHeight;
      serverOpts.quality = item.custom.quality;
    } else {
      const preset = item.preset as keyof typeof deps.presets;
      const presetConfig = deps.presets[preset];
      if (presetConfig) {
        serverOpts.maxWidth = presetConfig.maxWidth;
        serverOpts.maxHeight = presetConfig.maxHeight;
        serverOpts.quality = Math.round(presetConfig.quality * 100);
      }
    }
    const optStart = performance.now();
    const result = await deps.serverOptimizeImage(item.file, serverOpts);
    const optMs = Math.round(performance.now() - optStart);
    if (result && !result.skipped) {
      Log.info(`Upload: server image optimize ${formatBytes(result.originalSize)} → ${formatBytes(result.optimizedSize)} (${optMs}ms)`);
      item.optimizedSize = result.optimizedSize;
      item.progress = 50;
      item.outputName = sanitizeFilename(item.file.name.replace(/\.[^.]+$/, ".webp"));
      return { file: new File([result.blob], item.outputName, { type: "image/webp" }), handled: true };
    }
    if (result?.skipped) {
      Log.info(`Upload: server skipped (original smaller) (${optMs}ms)`);
      return { file: item.file, handled: true };
    }
    Log.info(`Upload: server image optimize FAILED (${optMs}ms), falling back`);
    return null;
  }

  if (kinds.isOptimizableAudio && caps.audio) {
    const bitrate = detectAudioBitrate(item.file.name);
    const optStart = performance.now();
    const result = await deps.serverOptimizeAudio(item.file, { bitrate });
    const optMs = Math.round(performance.now() - optStart);
    if (result && !result.skipped) {
      Log.info(`Upload: server audio optimize ${formatBytes(result.originalSize)} → ${formatBytes(result.optimizedSize)} (${optMs}ms)`);
      item.optimizedSize = result.optimizedSize;
      item.progress = 50;
      item.outputName = sanitizeFilename(item.file.name.replace(/\.[^.]+$/, ".ogg"));
      return { file: new File([result.blob], item.outputName, { type: "audio/ogg" }), handled: true };
    }
    if (result?.skipped) {
      Log.info(`Upload: server audio skipped (${optMs}ms)`);
      return { file: item.file, handled: true };
    }
    Log.info(`Upload: server audio optimize FAILED (${optMs}ms), falling back`);
    return null;
  }

  if (kinds.isVideo && caps.video) {
    const optStart = performance.now();
    const result = await deps.serverOptimizeVideo(item.file);
    const optMs = Math.round(performance.now() - optStart);
    if (result && !result.skipped) {
      Log.info(`Upload: server video optimize ${formatBytes(result.originalSize)} → ${formatBytes(result.optimizedSize)} (${optMs}ms)`);
      item.optimizedSize = result.optimizedSize;
      item.progress = 50;
      item.outputName = sanitizeFilename(item.file.name.replace(/\.[^.]+$/, ".webm"));
      return { file: new File([result.blob], item.outputName, { type: "video/webm" }), handled: true };
    }
    if (result?.skipped) {
      Log.info(`Upload: server video skipped (${optMs}ms)`);
      return { file: item.file, handled: true };
    }
    Log.info(`Upload: server video optimize FAILED (${optMs}ms), falling back`);
  }

  return null;
}
