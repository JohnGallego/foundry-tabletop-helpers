import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HealthResponse } from "../types.js";

const execFileAsync = promisify(execFile);

// Cache ffmpeg version so we only probe once
let ffmpegVersion: string | null | undefined;

async function detectFfmpeg(ffmpegPath?: string): Promise<string | null> {
  if (ffmpegVersion !== undefined) return ffmpegVersion;

  try {
    const { stdout } = await execFileAsync(ffmpegPath ?? "ffmpeg", ["-version"]);
    const match = stdout.match(/ffmpeg version (\S+)/);
    ffmpegVersion = match?.[1] ?? "unknown";
  } catch {
    ffmpegVersion = null;
  }
  return ffmpegVersion;
}

export async function registerHealthRoute(
  app: FastifyInstance,
  ffmpegPath?: string,
): Promise<void> {
  const startTime = Date.now();

  // Pre-warm the ffmpeg detection
  await detectFfmpeg(ffmpegPath);

  app.get("/health", async () => {
    const ffmpeg = await detectFfmpeg(ffmpegPath);
    const response: HealthResponse = {
      status: "ok",
      version: "1.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      capabilities: {
        image: true,        // Sharp is always available (it's a dep)
        audio: ffmpeg !== null,
        video: ffmpeg !== null,
        thumbnail: true,
      },
      ffmpeg,
    };
    return response;
  });
}
