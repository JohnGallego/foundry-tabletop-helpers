/** Optimization presets matching the Foundry module's definitions. */
export type ImagePreset = "token" | "portrait" | "map" | "icon" | "custom";

/** Preset configuration for image optimization. */
export interface ImagePresetConfig {
  maxWidth: number | null;
  maxHeight: number | null;
  quality: number;
  format: "webp" | "avif" | "png";
}

/** Result of an optimization operation. */
export interface OptimizeResult {
  buffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  format: string;
  width?: number;
  height?: number;
  skipped?: boolean;
}

/** Health check response. */
export interface HealthResponse {
  status: "ok";
  version: string;
  uptime: number;
  capabilities: {
    image: boolean;
    audio: boolean;
    video: boolean;
    thumbnail: boolean;
    portrait: boolean;
  };
  ffmpeg: string | null;
}

/** Image preset definitions. */
/** Server-side fallback presets. The client always sends explicit values,
 *  but these serve as defaults if no explicit dimensions are provided. */
export const IMAGE_PRESETS: Record<ImagePreset, ImagePresetConfig> = {
  token:    { maxWidth: 400,   maxHeight: 400,   quality: 50, format: "webp" },
  portrait: { maxWidth: 600,   maxHeight: 600,   quality: 50, format: "webp" },
  map:      { maxWidth: null,  maxHeight: null,  quality: 50, format: "webp" },
  icon:     { maxWidth: 512,   maxHeight: 512,   quality: 50, format: "webp" },
  custom:   { maxWidth: null,  maxHeight: null,  quality: 50, format: "webp" },
};
