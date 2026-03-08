import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile, readFile, unlink } from "node:fs/promises";
import type { OptimizeResult } from "../types.js";

/**
 * Optimize audio to OGG Vorbis using FFmpeg.
 */
export async function optimizeAudio(
  input: Buffer,
  bitrate: number,
  tempDir: string,
  options?: { ffmpegPath?: string; ffprobePath?: string },
): Promise<OptimizeResult> {
  if (options?.ffmpegPath) ffmpeg.setFfmpegPath(options.ffmpegPath);
  if (options?.ffprobePath) ffmpeg.setFfprobePath(options.ffprobePath);

  const originalSize = input.length;
  const id = randomUUID();
  const inputPath = join(tempDir, `${id}-input`);
  const outputPath = join(tempDir, `${id}-output.ogg`);

  try {
    await writeFile(inputPath, input);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec("libvorbis")
        .audioBitrate(bitrate)
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const buffer = await readFile(outputPath);

    // If optimized is larger, return original
    if (buffer.length >= originalSize) {
      return {
        buffer: input,
        originalSize,
        optimizedSize: originalSize,
        format: "ogg",
        skipped: true,
      };
    }

    return {
      buffer,
      originalSize,
      optimizedSize: buffer.length,
      format: "ogg",
    };
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Detect audio bitrate heuristic from filename.
 * Matches the client-side logic in asset-manager-upload.ts.
 */
export function detectAudioBitrate(filename: string): number {
  const lower = filename.toLowerCase();
  if (/ambient|atmos|background|rain|wind|fire|water|forest|cave|tavern|camp/.test(lower)) return 96;
  if (/music|theme|battle|boss|exploration|town|dungeon|menu|title|credits/.test(lower)) return 160;
  if (/sfx|effect|spell|hit|slash|impact|explosion|arrow|door|chest|coin/.test(lower)) return 128;
  return 128;
}
