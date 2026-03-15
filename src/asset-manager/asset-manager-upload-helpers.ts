import { classifyExt, extname } from "./asset-manager-types";
import type {
  OptPreset,
  OptPresetConfig,
  UploadDialogResult,
  UploadQueueItem,
} from "./asset-manager-upload";

export const OPTIMIZABLE_EXTS = new Set(["png", "jpg", "jpeg", "bmp", "gif", "tiff", "tif", "webp"]);
export const OPTIMIZABLE_AUDIO_EXTS = new Set(["wav", "flac", "aiff", "aif"]);

const AUDIO_BITRATES: Record<string, number> = {
  ambient: 96_000,
  sfx: 128_000,
  music: 160_000,
  default: 128_000,
};

export function sanitizeFilename(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  const stem = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const ext = dotIdx > 0 ? name.slice(dotIdx) : "";

  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return (safe || "file") + ext.toLowerCase();
}

export function autoDetectPreset(file: File, type: string): OptPreset {
  if (type === "audio") {
    const ext = extname(file.name);
    return OPTIMIZABLE_AUDIO_EXTS.has(ext) ? "auto" : "none";
  }

  if (type !== "image") return "none";

  const name = file.name.toLowerCase();
  const ext = extname(file.name);

  if (ext === "webp" && file.size < 500 * 1024) return "none";
  if (/token/i.test(name)) return "token";
  if (/portrait|avatar/i.test(name)) return "portrait";
  if (/icon/i.test(name)) return "icon";
  if (/map|scene|battlemap/i.test(name)) return "map";
  if (file.size < 100 * 1024) return "icon";
  if (file.size < 500 * 1024) return "token";
  if (file.size > 2 * 1024 * 1024) return "map";

  return "portrait";
}

export function detectAudioBitrate(name: string): number {
  const lower = name.toLowerCase();
  if (/ambient|background|loop|rain|wind|fire|forest|tavern/i.test(lower)) return AUDIO_BITRATES.ambient!;
  if (/music|theme|battle|boss|town|tavern.*music/i.test(lower)) return AUDIO_BITRATES.music!;
  if (/sfx|effect|hit|slash|spell|explosion|footstep/i.test(lower)) return AUDIO_BITRATES.sfx!;
  return AUDIO_BITRATES.default!;
}

export function audioMimeToExt(mime: string): string {
  return mime.startsWith("audio/ogg") ? "ogg" : "webm";
}

export function resolveUploadOutputName(
  file: File,
  resolvedPreset: OptPreset,
  supportedAudioMime: string | null,
  presets: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig>,
): string {
  const ext = extname(file.name);
  const type = classifyExt(ext);
  const shouldOptimizeImage = resolvedPreset !== "none" && type === "image" && OPTIMIZABLE_EXTS.has(ext);
  const shouldOptimizeAudio = resolvedPreset !== "none" && type === "audio" && OPTIMIZABLE_AUDIO_EXTS.has(ext);

  let outputName = file.name;
  if (shouldOptimizeImage) {
    const config = presets[resolvedPreset as keyof typeof presets];
    if (config?.toWebP && ext !== "webp") {
      outputName = file.name.replace(/\.[^.]+$/, ".webp");
    }
  } else if (shouldOptimizeAudio) {
    if (supportedAudioMime) {
      outputName = file.name.replace(/\.[^.]+$/, `.${audioMimeToExt(supportedAudioMime)}`);
    }
  } else if (type === "video" && resolvedPreset !== "none") {
    outputName = file.name.replace(/\.[^.]+$/, ".webm");
  }

  return sanitizeFilename(outputName);
}

export function createUploadQueueItems(
  files: File[],
  preset: OptPreset,
  nextIdStart: number,
  supportedAudioMime: string | null,
  presets: Record<Exclude<OptPreset, "auto" | "none">, OptPresetConfig>,
): UploadQueueItem[] {
  return files.map((file, index) => {
    const ext = extname(file.name);
    const type = classifyExt(ext);
    const resolvedPreset = preset === "auto" ? autoDetectPreset(file, type) : preset;

    return {
      id: nextIdStart + index,
      file,
      originalName: file.name,
      outputName: resolveUploadOutputName(file, resolvedPreset, supportedAudioMime, presets),
      preset: resolvedPreset,
      status: "pending",
      progress: 0,
      originalSize: file.size,
      optimizedSize: 0,
    };
  });
}

export function createUploadQueueItemsWithOptions(
  items: UploadDialogResult[],
  nextIdStart: number,
): UploadQueueItem[] {
  return items.map((item, index) => ({
    id: nextIdStart + index,
    file: item.file,
    originalName: item.file.name,
    outputName: item.outputName,
    preset: item.preset,
    status: "pending",
    progress: 0,
    originalSize: item.file.size,
    optimizedSize: 0,
    custom: item.custom,
  }));
}

export function splitOptimizableBatchFiles(files: string[]): {
  images: string[];
  audio: string[];
  video: string[];
  all: string[];
} {
  const images = files.filter((file) => {
    const ext = extname(file);
    return OPTIMIZABLE_EXTS.has(ext) && ext !== "webp";
  });
  const audio = files.filter((file) => OPTIMIZABLE_AUDIO_EXTS.has(extname(file)));
  const video = files.filter((file) => classifyExt(extname(file)) === "video");

  return {
    images,
    audio,
    video,
    all: [...images, ...audio, ...video],
  };
}
