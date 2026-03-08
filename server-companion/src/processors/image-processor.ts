import sharp from "sharp";
import type { ImagePresetConfig, OptimizeResult } from "../types.js";

/**
 * Optimize an image using Sharp.
 * Returns the optimized buffer, or the original if optimization made it larger.
 */
export async function optimizeImage(
  input: Buffer,
  config: ImagePresetConfig,
): Promise<OptimizeResult> {
  const originalSize = input.length;

  let pipeline = sharp(input, { failOn: "none" }).rotate(); // auto-rotate from EXIF

  // Resize if dimensions are specified
  if (config.maxWidth || config.maxHeight) {
    pipeline = pipeline.resize({
      width: config.maxWidth ?? undefined,
      height: config.maxHeight ?? undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Convert to target format
  switch (config.format) {
    case "webp":
      pipeline = pipeline.webp({ quality: config.quality });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: config.quality });
      break;
    case "png":
      pipeline = pipeline.png({ quality: config.quality });
      break;
  }

  const { data: buffer, info } = await pipeline.toBuffer({ resolveWithObject: true });

  // If optimized is larger, return original
  if (buffer.length >= originalSize) {
    return {
      buffer: input,
      originalSize,
      optimizedSize: originalSize,
      format: config.format,
      width: info.width,
      height: info.height,
      skipped: true,
    };
  }

  return {
    buffer,
    originalSize,
    optimizedSize: buffer.length,
    format: config.format,
    width: info.width,
    height: info.height,
  };
}

/**
 * Generate a thumbnail at exact dimensions.
 */
export async function generateThumbnail(
  input: Buffer,
  width: number,
  height: number,
  fit: "cover" | "contain" | "fill" = "cover",
): Promise<OptimizeResult> {
  const originalSize = input.length;

  const { data: buffer, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width, height, fit })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer,
    originalSize,
    optimizedSize: buffer.length,
    format: "webp",
    width: info.width,
    height: info.height,
  };
}
