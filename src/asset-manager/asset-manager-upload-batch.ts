import { audioMimeToExt, detectAudioBitrate } from "./asset-manager-upload-helpers";
import type { ServerCapabilities, OptimizeImageOptions, OptimizeResult } from "./asset-manager-optimizer-client";
import type { OptPreset, OptPresetConfig } from "./asset-manager-upload";
import type { AudioOptimizationResult } from "./asset-manager-upload-processing";

export interface BatchOptimizationDeps {
  serverCaps: ServerCapabilities | null;
  resolvedPreset: OptPreset;
  config: OptPresetConfig | null;
  uploadFn: (file: File, name: string, targetDir: string) => Promise<string>;
  optimizeAudio: (file: File, bitrate: number) => Promise<AudioOptimizationResult | null>;
  optimizeImageWithWorker: ((blob: Blob, config: OptPresetConfig) => Promise<Blob>) | null;
  serverOptimizeImage: (file: File, options: OptimizeImageOptions) => Promise<OptimizeResult | null>;
  serverOptimizeAudio: (file: File, options: { bitrate: number }) => Promise<OptimizeResult | null>;
  serverOptimizeVideo: (file: File) => Promise<OptimizeResult | null>;
  deleteOriginal: (filePath: string) => Promise<unknown>;
}

export interface BatchOptimizationOutcome {
  processed: boolean;
  savedBytes: number;
}

export async function processBatchOptimizationEntry(
  filePath: string,
  targetDir: string,
  fileName: string,
  inputFile: File,
  fileType: "image" | "audio" | "video",
  deps: BatchOptimizationDeps,
): Promise<BatchOptimizationOutcome> {
  const originalSize = inputFile.size;
  let newName = fileName;

  if (deps.serverCaps) {
    let serverResult: OptimizeResult | null = null;

    if (fileType === "image" && deps.serverCaps.image) {
      const serverOpts: OptimizeImageOptions = {};
      if (deps.resolvedPreset !== "none" && deps.resolvedPreset !== "auto") {
        serverOpts.preset = deps.resolvedPreset;
      }
      serverResult = await deps.serverOptimizeImage(inputFile, serverOpts);
      if (serverResult && !serverResult.skipped) {
        newName = fileName.replace(/\.[^.]+$/, ".webp");
        await deps.uploadFn(new File([serverResult.blob], newName, { type: "image/webp" }), newName, targetDir);
        await deleteIfRenamed(filePath, fileName, newName, deps.deleteOriginal);
        return { processed: true, savedBytes: originalSize - serverResult.optimizedSize };
      }
    } else if (fileType === "audio" && deps.serverCaps.audio) {
      const bitrate = detectAudioBitrate(fileName);
      serverResult = await deps.serverOptimizeAudio(inputFile, { bitrate });
      if (serverResult && !serverResult.skipped) {
        newName = fileName.replace(/\.[^.]+$/, ".ogg");
        await deps.uploadFn(new File([serverResult.blob], newName, { type: "audio/ogg" }), newName, targetDir);
        await deleteIfRenamed(filePath, fileName, newName, deps.deleteOriginal);
        return { processed: true, savedBytes: originalSize - serverResult.optimizedSize };
      }
    } else if (fileType === "video" && deps.serverCaps.video) {
      serverResult = await deps.serverOptimizeVideo(inputFile);
      if (serverResult && !serverResult.skipped) {
        newName = fileName.replace(/\.[^.]+$/, ".webm");
        await deps.uploadFn(new File([serverResult.blob], newName, { type: "video/webm" }), newName, targetDir);
        await deleteIfRenamed(filePath, fileName, newName, deps.deleteOriginal);
        return { processed: true, savedBytes: originalSize - serverResult.optimizedSize };
      }
    }

    if (serverResult?.skipped) {
      return { processed: false, savedBytes: 0 };
    }
  }

  if (fileType === "video") {
    return { processed: false, savedBytes: 0 };
  }

  if (fileType === "audio") {
    const bitrate = detectAudioBitrate(fileName);
    const audioResult = await deps.optimizeAudio(inputFile, bitrate);
    if (audioResult && audioResult.blob.size < originalSize) {
      const outExt = audioMimeToExt(audioResult.mime);
      newName = fileName.replace(/\.[^.]+$/, `.${outExt}`);
      const file = new File([audioResult.blob], newName, { type: audioResult.mime });
      await deps.uploadFn(file, newName, targetDir);
      await deleteIfRenamed(filePath, fileName, newName, deps.deleteOriginal);
      return { processed: true, savedBytes: originalSize - audioResult.blob.size };
    }
    return { processed: false, savedBytes: 0 };
  }

  if (deps.optimizeImageWithWorker && deps.config) {
    const optimizedBlob = await deps.optimizeImageWithWorker(inputFile, deps.config);
    if (optimizedBlob.size < originalSize) {
      newName = fileName.replace(/\.[^.]+$/, ".webp");
      const file = new File([optimizedBlob], newName, { type: "image/webp" });
      await deps.uploadFn(file, newName, targetDir);
      await deleteIfRenamed(filePath, fileName, newName, deps.deleteOriginal);
      return { processed: true, savedBytes: originalSize - optimizedBlob.size };
    }
  }

  return { processed: false, savedBytes: 0 };
}

async function deleteIfRenamed(
  filePath: string,
  originalName: string,
  newName: string,
  deleteOriginal: (filePath: string) => Promise<unknown>,
): Promise<void> {
  if (newName !== originalName) {
    await deleteOriginal(filePath).catch(() => undefined);
  }
}
