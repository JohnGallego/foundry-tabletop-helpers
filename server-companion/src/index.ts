import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const app = await createServer(config);

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`FTH Optimizer listening on http://${config.host}:${config.port}`);
    console.log(`Image optimization: enabled`);
    console.log(`Thumbnail generation: enabled`);

    // Check capabilities from health
    const response = await app.inject({ method: "GET", url: "/health" });
    const health = JSON.parse(response.body);
    console.log(`Audio optimization: ${health.capabilities.audio ? "enabled" : "disabled (ffmpeg not found)"}`);
    console.log(`Video optimization: ${health.capabilities.video ? "enabled" : "disabled (ffmpeg not found)"}`);
    if (health.ffmpeg) console.log(`FFmpeg version: ${health.ffmpeg}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
