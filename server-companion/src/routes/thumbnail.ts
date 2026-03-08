import type { FastifyInstance } from "fastify";
import { generateThumbnail } from "../processors/image-processor.js";

export async function registerThumbnailRoute(app: FastifyInstance): Promise<void> {
  app.post("/thumbnail", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const fields = data.fields;

    const width = parseInt(getFieldValue(fields, "width") ?? "120", 10);
    const height = parseInt(getFieldValue(fields, "height") ?? "120", 10);
    const fitField = getFieldValue(fields, "fit");
    const fit = (fitField === "contain" || fitField === "fill" ? fitField : "cover") as "cover" | "contain" | "fill";

    const result = await generateThumbnail(buffer, width, height, fit);

    reply
      .header("Content-Type", "image/webp")
      .header("X-Dimensions", `${result.width}x${result.height}`)
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
