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
export const IMAGE_PRESETS: Record<ImagePreset, ImagePresetConfig> = {
  token:    { maxWidth: 400,  maxHeight: 400,  quality: 85, format: "webp" },
  portrait: { maxWidth: null, maxHeight: 800,  quality: 85, format: "webp" },
  map:      { maxWidth: null, maxHeight: null, quality: 90, format: "webp" },
  icon:     { maxWidth: 128,  maxHeight: 128,  quality: 85, format: "webp" },
  custom:   { maxWidth: null, maxHeight: null, quality: 85, format: "webp" },
};
