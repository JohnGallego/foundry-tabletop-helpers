import type { FastifyInstance } from "fastify";
import { resolve, normalize } from "node:path";
import { unlink, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * POST /delete — Remove a file or folder from the Foundry data directory.
 *
 * Requires FTH_FOUNDRY_DATA_PATH to be set. Validates that the resolved
 * path is inside the data directory (prevents directory traversal).
 *
 * Body (JSON): { "path": "assets/shared/icons/sword.png" }
 * For folders: { "path": "assets/shared/icons", "recursive": true }
 */
export async function registerDeleteRoute(
  app: FastifyInstance,
  foundryDataPath: string | undefined,
): Promise<void> {
  app.post<{ Body: { path: string; recursive?: boolean } }>("/delete", async (request, reply) => {
    if (!foundryDataPath) {
      reply.code(501).send({ error: "File deletion not configured (FTH_FOUNDRY_DATA_PATH not set)" });
      return;
    }

    const { path: filePath, recursive } = request.body ?? {};
    if (!filePath || typeof filePath !== "string") {
      reply.code(400).send({ error: "Missing 'path' in request body" });
      return;
    }

    // Resolve and validate — must be inside the data directory
    const dataRoot = resolve(foundryDataPath);
    const resolved = resolve(dataRoot, normalize(filePath));

    if (!resolved.startsWith(dataRoot + "/")) {
      reply.code(403).send({ error: "Path is outside the data directory" });
      return;
    }

    if (!existsSync(resolved)) {
      reply.code(404).send({ error: "File or folder not found" });
      return;
    }

    try {
      const s = await stat(resolved);

      if (s.isDirectory()) {
        if (!recursive) {
          reply.code(400).send({ error: "Path is a directory. Set recursive: true to delete." });
          return;
        }
        await rm(resolved, { recursive: true, force: true });
        app.log.info(`Deleted folder: ${resolved}`);

        // Also delete matching thumbnail cache subtree
        const thumbDir = resolve(dataRoot, ".fth-thumbs", normalize(filePath));
        rm(thumbDir, { recursive: true, force: true }).catch(() => { /* may not exist */ });
      } else {
        await unlink(resolved);
        app.log.info(`Deleted file: ${resolved}`);

        // Also delete cached thumbnail if it exists
        const thumbPath = resolve(dataRoot, ".fth-thumbs", normalize(filePath) + ".webp");
        unlink(thumbPath).catch(() => { /* thumbnail may not exist */ });
      }

      reply.send({ ok: true, path: filePath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error(`Failed to delete ${resolved}: ${msg}`);
      reply.code(500).send({ error: `Deletion failed: ${msg}` });
    }
  });
}
