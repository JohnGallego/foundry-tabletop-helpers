import type { FastifyInstance } from "fastify";
import { resolve, normalize } from "node:path";
import { mkdir, stat, chmod } from "node:fs/promises";

/**
 * POST /mkdir — Create a folder inside the Foundry data directory.
 *
 * Requires FTH_FOUNDRY_DATA_PATH to be set. Validates that the resolved
 * path is inside the data directory (prevents directory traversal).
 *
 * Body (JSON): { "path": "assets/shared/icons/new-folder" }
 */
export async function registerMkdirRoute(
  app: FastifyInstance,
  foundryDataPath: string | undefined,
): Promise<void> {
  app.post<{ Body: { path: string } }>("/mkdir", async (request, reply) => {
    if (!foundryDataPath) {
      reply.code(501).send({ error: "Folder creation not configured (FTH_FOUNDRY_DATA_PATH not set)" });
      return;
    }

    const { path: folderPath } = request.body ?? {};
    if (!folderPath || typeof folderPath !== "string") {
      reply.code(400).send({ error: "Missing 'path' in request body" });
      return;
    }

    // Validate folder name — no path traversal, no hidden/system dirs
    const segments = folderPath.split("/").filter(Boolean);
    for (const seg of segments) {
      if (seg === "." || seg === ".." || seg.startsWith(".fth-")) {
        reply.code(400).send({ error: `Invalid path segment: "${seg}"` });
        return;
      }
    }

    // Resolve and validate — must be inside the data directory
    const dataRoot = resolve(foundryDataPath);
    const resolved = resolve(dataRoot, normalize(folderPath));

    if (!resolved.startsWith(dataRoot + "/")) {
      reply.code(403).send({ error: "Path is outside the data directory" });
      return;
    }

    // Check if it already exists
    try {
      const s = await stat(resolved);
      if (s.isDirectory()) {
        reply.code(409).send({ error: "Folder already exists" });
        return;
      }
      // Exists but is a file
      reply.code(409).send({ error: "A file already exists at that path" });
      return;
    } catch {
      // Does not exist — expected, continue
    }

    try {
      await mkdir(resolved, { recursive: true, mode: 0o2775 });
      // Ensure group-writable so Foundry (running as a different user in the same group) can write
      await chmod(resolved, 0o2775);
      app.log.info(`Created folder: ${resolved} (mode 2775)`);
      reply.send({ ok: true, path: folderPath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error(`Failed to create folder ${resolved}: ${msg}`);
      reply.code(500).send({ error: `Folder creation failed: ${msg}` });
    }
  });
}
