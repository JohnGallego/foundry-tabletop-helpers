import type { FastifyInstance } from "fastify";
import { resolve, normalize, dirname } from "node:path";
import { stat, mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const THUMB_DIR = ".fth-thumbs";
const THUMB_MAX = 256;
const THUMB_QUALITY = 50;
const IMAGE_EXTS = new Set([
  "webp", "png", "jpg", "jpeg", "gif", "bmp", "avif", "tiff", "tif",
]);

/** In-flight generation promises — coalesces concurrent requests for the same file. */
const generating = new Map<string, Promise<boolean>>();

/**
 * GET /thumb?path=<relative-path>
 *
 * Serves a cached 256×256 max WebP thumbnail for images in the Foundry data directory.
 * Generates and caches on first request. Returns 304 on conditional requests.
 * Requires auth via query param `token` (since <img src> can't set headers).
 */
export async function registerThumbCacheRoute(
  app: FastifyInstance,
  foundryDataPath: string | undefined,
): Promise<void> {
  // Ensure the thumbnail root directory exists at startup
  if (foundryDataPath) {
    const thumbRoot = resolve(foundryDataPath, THUMB_DIR);
    await mkdir(thumbRoot, { recursive: true }).catch(() => {
      app.log.warn(`Could not create thumbnail cache directory: ${thumbRoot}`);
    });
  }

  app.get<{ Querystring: { path: string } }>("/thumb", async (request, reply) => {
    if (!foundryDataPath) {
      reply.code(501).send({ error: "Thumbnails not configured (FTH_FOUNDRY_DATA_PATH not set)" });
      return;
    }

    const filePath = (request.query as Record<string, string>)?.path;
    if (!filePath || typeof filePath !== "string") {
      reply.code(400).send({ error: "Missing 'path' query parameter" });
      return;
    }

    // Validate extension
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTS.has(ext)) {
      reply.code(415).send({ error: `Unsupported image type: .${ext}` });
      return;
    }

    // Resolve and validate — must be inside the data directory
    const dataRoot = resolve(foundryDataPath);
    const originalPath = resolve(dataRoot, normalize(filePath));
    if (!originalPath.startsWith(dataRoot + "/")) {
      reply.code(403).send({ error: "Path is outside the data directory" });
      return;
    }

    // Check original exists
    let originalStat;
    try {
      originalStat = await stat(originalPath);
    } catch {
      reply.code(404).send({ error: "Original file not found" });
      return;
    }

    // Thumbnail path: .fth-thumbs/<original-path>.webp
    const thumbPath = resolve(dataRoot, THUMB_DIR, normalize(filePath) + ".webp");

    // Check if cached thumbnail exists and is fresh
    let needsGeneration = true;
    try {
      const thumbStat = await stat(thumbPath);
      if (thumbStat.mtimeMs >= originalStat.mtimeMs) {
        needsGeneration = false;
      }
    } catch {
      // Thumbnail doesn't exist — needs generation
    }

    if (needsGeneration) {
      // Coalesce concurrent requests — returns true on success, false on failure
      let genPromise = generating.get(originalPath);
      if (!genPromise) {
        genPromise = generateThumb(originalPath, thumbPath, app)
          .then(() => true)
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            app.log.error(`Thumbnail generation failed for ${filePath}: ${msg}`);
            return false;
          })
          .finally(() => generating.delete(originalPath));
        generating.set(originalPath, genPromise);
      }

      const success = await genPromise;
      if (!success) {
        reply.code(500).send({ error: "Thumbnail generation failed" });
        return;
      }
    }

    // Build ETag from thumbnail file stats
    let thumbStat;
    try {
      thumbStat = await stat(thumbPath);
    } catch {
      reply.code(500).send({ error: "Thumbnail file missing after generation" });
      return;
    }

    const etag = `"${thumbStat.mtimeMs}-${thumbStat.size}"`;

    // Handle conditional request
    const ifNoneMatch = request.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      reply.code(304).send();
      return;
    }

    // Serve the thumbnail as a buffer (Fastify handles content-length correctly)
    const thumbBuffer = await readFile(thumbPath);
    reply
      .header("Content-Type", "image/webp")
      .header("Cache-Control", "public, max-age=86400")
      .header("ETag", etag)
      .send(thumbBuffer);
  });

  // GET /thumb/stats — return cached thumbnail count and total size
  app.get("/thumb/stats", async (_request, reply) => {
    if (!foundryDataPath) {
      reply.send({ count: 0, totalBytes: 0 });
      return;
    }
    const thumbRoot = resolve(foundryDataPath, THUMB_DIR);
    try {
      const stats = await walkDir(thumbRoot);
      reply
        .header("Cache-Control", "no-cache")
        .send(stats);
    } catch {
      reply.send({ count: 0, totalBytes: 0 });
    }
  });
}

/** Recursively walk a directory and count files + total size. */
async function walkDir(dir: string): Promise<{ count: number; totalBytes: number }> {
  const { readdir } = await import("node:fs/promises");
  let count = 0;
  let totalBytes = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkDir(full);
        count += sub.count;
        totalBytes += sub.totalBytes;
      } else {
        count++;
        try {
          const s = await stat(full);
          totalBytes += s.size;
        } catch { /* skip */ }
      }
    }
  } catch { /* dir may not exist */ }
  return { count, totalBytes };
}

/** Generate a WebP thumbnail and write it to disk. */
async function generateThumb(
  originalPath: string,
  thumbPath: string,
  app: FastifyInstance,
): Promise<void> {
  const input = await readFile(originalPath);

  const result = await sharp(input)
    .rotate() // auto-rotate from EXIF
    .resize(THUMB_MAX, THUMB_MAX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();

  // Ensure directory exists
  await mkdir(dirname(thumbPath), { recursive: true });
  await writeFile(thumbPath, result);

  app.log.info(`Generated thumbnail: ${thumbPath} (${result.length} bytes)`);
}
