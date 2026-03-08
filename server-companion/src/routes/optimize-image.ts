import type { FastifyInstance } from "fastify";
import { optimizeImage } from "../processors/image-processor.js";
import { IMAGE_PRESETS, type ImagePreset, type ImagePresetConfig } from "../types.js";

export async function registerImageRoute(app: FastifyInstance): Promise<void> {
  app.post("/optimize/image", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const fields = data.fields;

    // Parse preset or custom options
    const presetName = getFieldValue(fields, "preset") as ImagePreset | undefined;
    let config: ImagePresetConfig;

    if (presetName && presetName in IMAGE_PRESETS) {
      config = { ...IMAGE_PRESETS[presetName] };
    } else {
      config = { ...IMAGE_PRESETS.custom };
    }

    // Override with explicit values if provided
    const maxWidth = getFieldValue(fields, "maxWidth");
    const maxHeight = getFieldValue(fields, "maxHeight");
    const quality = getFieldValue(fields, "quality");
    const format = getFieldValue(fields, "format");

    if (maxWidth) config.maxWidth = parseInt(maxWidth, 10);
    if (maxHeight) config.maxHeight = parseInt(maxHeight, 10);
    if (quality) config.quality = parseInt(quality, 10);
    if (format === "webp" || format === "avif" || format === "png") config.format = format;

    const result = await optimizeImage(buffer, config);

    const mimeTypes: Record<string, string> = {
      webp: "image/webp",
      avif: "image/avif",
      png: "image/png",
    };

    reply
      .header("Content-Type", mimeTypes[result.format] ?? "application/octet-stream")
      .header("X-Original-Size", result.originalSize)
      .header("X-Optimized-Size", result.optimizedSize)
      .header("X-Dimensions", `${result.width}x${result.height}`)
      .header("X-Skipped", result.skipped ? "larger" : "false")
      .send(result.buffer);
  });
}

/** Extract a string value from multipart fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFieldValue(fields: Record<string, any>, name: string): string | undefined {
  const field = fields[name];
  if (!field) return undefined;
  if (typeof field === "object" && "value" in field) return field.value as string;
  return undefined;
}
