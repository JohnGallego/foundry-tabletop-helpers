import type { FastifyInstance } from "fastify";
import { optimizeVideo } from "../processors/video-processor.js";
import type { Config } from "../config.js";

export async function registerVideoRoute(app: FastifyInstance, config: Config): Promise<void> {
  app.post("/optimize/video", {
    config: {
      // Video encoding can be slow — allow 5 minutes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const fields = data.fields;

    const crfField = getFieldValue(fields, "crf");
    const crf = crfField ? parseInt(crfField, 10) : 30;

    const formatField = getFieldValue(fields, "format");
    const format = (formatField === "mp4" ? "mp4" : "webm") as "webm" | "mp4";

    const bitrateField = getFieldValue(fields, "audioBitrate");
    const audioBitrate = bitrateField ? parseInt(bitrateField, 10) : 128;

    const result = await optimizeVideo(buffer, crf, config.tempDir, {
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
      audioBitrate,
      format,
    });

    const mimeTypes: Record<string, string> = {
      webm: "video/webm",
      mp4: "video/mp4",
    };

    reply
      .header("Content-Type", mimeTypes[result.format] ?? "application/octet-stream")
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
