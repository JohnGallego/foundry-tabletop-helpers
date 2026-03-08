import type { FastifyInstance } from "fastify";
import { optimizeAudio, detectAudioBitrate } from "../processors/audio-processor.js";
import type { Config } from "../config.js";

export async function registerAudioRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.post("/optimize/audio", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const fields = data.fields;

    // Parse bitrate — auto-detect from filename if not specified
    const bitrateField = getFieldValue(fields, "bitrate");
    const bitrate = bitrateField
      ? parseInt(bitrateField, 10)
      : detectAudioBitrate(data.filename ?? "audio");

    const result = await optimizeAudio(buffer, bitrate, config.tempDir, {
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
    });

    reply
      .header("Content-Type", "audio/ogg")
      .header("X-Original-Size", result.originalSize)
      .header("X-Optimized-Size", result.optimizedSize)
      .header("X-Skipped", result.skipped ? "larger" : "false")
      .send(result.buffer);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFieldValue(fields: Record<string, any>, name: string): string | undefined {
  const field = fields[name];
  if (!field) return undefined;
  if (typeof field === "object" && "value" in field) return field.value as string;
  return undefined;
}
