/**
 * Portrait Generation Route
 *
 * POST /generate/portrait — generates character portraits via the Gemini API.
 * Requires FTH_GEMINI_API_KEY to be configured.
 */

import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import sharp from "sharp";

/* ── Types ────────────────────────────────────────────────── */

interface PortraitRequestBody {
  prompt: string;
  style?: "fantasy" | "realistic" | "painterly";
  aspectRatio?: "square" | "portrait";
  count?: number;
}

interface GeminiImagePart {
  inlineData?: { mimeType: string; data: string };
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiImagePart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

interface PortraitResult {
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

/* ── Route ────────────────────────────────────────────────── */

export async function registerPortraitRoute(
  app: FastifyInstance,
  config: Config,
): Promise<void> {
  app.post<{ Body: PortraitRequestBody }>("/generate/portrait", async (request, reply) => {
    if (!config.geminiApiKey) {
      return reply.code(503).send({
        error: "Portrait generation not configured — FTH_GEMINI_API_KEY not set",
      });
    }

    const { prompt, style = "fantasy", aspectRatio = "portrait", count = 2 } = request.body ?? {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return reply.code(400).send({ error: "prompt is required" });
    }

    const imageCount = Math.min(Math.max(1, count), 4);
    const fullPrompt = buildFullPrompt(prompt.trim(), style, aspectRatio);

    app.log.info(`Portrait generation: "${prompt.substring(0, 80)}..." (${imageCount} images, ${style})`);

    try {
      const images = await generateWithGemini(
        config.geminiApiKey,
        config.geminiModel,
        fullPrompt,
        imageCount,
        app,
      );

      if (images.length === 0) {
        return reply.code(500).send({ error: "No images generated — model returned no image data" });
      }

      return { images };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      app.log.error(`Portrait generation failed: ${message}`);
      return reply.code(500).send({ error: `Portrait generation failed: ${message}` });
    }
  });

  // Longer timeout for portrait generation
  app.addHook("onRequest", async (request) => {
    if (request.url === "/generate/portrait") {
      request.socket.setTimeout(120_000); // 2 minutes
    }
  });
}

/* ── Helpers ──────────────────────────────────────────────── */

function buildFullPrompt(userPrompt: string, style: string, aspectRatio: string): string {
  const styleGuide: Record<string, string> = {
    fantasy: "Dark fantasy digital painting style, dramatic lighting, detailed, rich colors, suitable for a D&D character portrait",
    realistic: "Photorealistic fantasy portrait, cinematic lighting, high detail, studio quality",
    painterly: "Oil painting style fantasy portrait, classical Renaissance influenced, warm tones, painterly brushstrokes",
  };

  const aspectGuide = aspectRatio === "square"
    ? "Square composition, centered subject, head and shoulders"
    : "Portrait orientation, upper body visible, slight off-center composition";

  return [
    userPrompt,
    styleGuide[style] ?? styleGuide.fantasy,
    aspectGuide,
    "Single character only, no text, no watermarks, no borders, clean background",
  ].join(". ");
}

async function generateWithGemini(
  apiKey: string,
  model: string,
  prompt: string,
  count: number,
  app: FastifyInstance,
): Promise<PortraitResult[]> {
  const results: PortraitResult[] = [];

  // Generate images in parallel (each request = 1 image)
  const promises = Array.from({ length: count }, () =>
    callGeminiApi(apiKey, model, prompt, app),
  );

  const settled = await Promise.allSettled(promises);

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    } else if (result.status === "rejected") {
      app.log.warn(`Portrait generation request failed: ${result.reason}`);
    }
  }

  return results;
}

async function callGeminiApi(
  apiKey: string,
  model: string,
  prompt: string,
  app: FastifyInstance,
): Promise<PortraitResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1.0,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${errorText.substring(0, 200)}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  // Extract image from response
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
      const imageBuffer = Buffer.from(part.inlineData.data, "base64");

      // Optimize through Sharp → WebP
      const optimized = await sharp(imageBuffer)
        .webp({ quality: 90 })
        .toBuffer();

      const metadata = await sharp(optimized).metadata();

      app.log.info(`Portrait generated: ${metadata.width}x${metadata.height}, ${Math.round(optimized.length / 1024)}KB`);

      return {
        base64: optimized.toString("base64"),
        width: metadata.width ?? 512,
        height: metadata.height ?? 768,
        mimeType: "image/webp",
      };
    }
  }

  return null;
}
