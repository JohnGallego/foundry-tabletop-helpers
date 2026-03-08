import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile, readFile, unlink } from "node:fs/promises";
import type { OptimizeResult } from "../types.js";

/**
 * Optimize video to WebM VP9 using FFmpeg.
 * Uses single-pass CRF mode for reasonable speed.
 */
export async function optimizeVideo(
  input: Buffer,
  crf: number,
  tempDir: string,
  options?: {
    ffmpegPath?: string;
    ffprobePath?: string;
    audioBitrate?: number;
    format?: "webm" | "mp4";
  },
): Promise<OptimizeResult> {
  if (options?.ffmpegPath) ffmpeg.setFfmpegPath(options.ffmpegPath);
  if (options?.ffprobePath) ffmpeg.setFfprobePath(options.ffprobePath);

  const originalSize = input.length;
  const format = options?.format ?? "webm";
  const audioBitrate = options?.audioBitrate ?? 128;
  const id = randomUUID();
  const inputPath = join(tempDir, `${id}-input`);
  const outputPath = join(tempDir, `${id}-output.${format}`);

  try {
    await writeFile(inputPath, input);

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      if (format === "webm") {
        cmd = cmd
          .videoCodec("libvpx-vp9")
          .addOutputOptions([`-crf`, `${crf}`, `-b:v`, `0`])
          .audioCodec("libvorbis")
          .audioBitrate(audioBitrate);
      } else {
        // MP4 with H.264
        cmd = cmd
          .videoCodec("libx264")
          .addOutputOptions([`-crf`, `${crf}`, `-preset`, `medium`])
          .audioCodec("aac")
          .audioBitrate(audioBitrate);
      }

      cmd
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const buffer = await readFile(outputPath);

    if (buffer.length >= originalSize) {
      return {
        buffer: input,
        originalSize,
        optimizedSize: originalSize,
        format,
        skipped: true,
      };
    }

    return {
      buffer,
      originalSize,
      optimizedSize: buffer.length,
      format,
    };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
