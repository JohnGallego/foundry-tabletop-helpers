import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import type { Config } from "./config.js";
import { createAuthHook } from "./middleware/auth.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerImageRoute } from "./routes/optimize-image.js";
import { registerAudioRoute } from "./routes/optimize-audio.js";
import { registerVideoRoute } from "./routes/optimize-video.js";
import { registerThumbnailRoute } from "./routes/thumbnail.js";

export async function createServer(config: Config) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    bodyLimit: config.maxFileSize,
  });

  // CORS
  await app.register(fastifyCors, {
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
    methods: ["GET", "POST"],
  });

  // Multipart file uploads
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
  });

  // Health endpoint — no auth required
  await registerHealthRoute(app, config.ffmpegPath);

  // Auth-protected routes
  const authHook = createAuthHook(config);

  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for health endpoint
    if (request.url === "/health") return;
    await authHook(request, reply);
  });

  // Optimization routes
  await registerImageRoute(app);
  await registerAudioRoute(app, config);
  await registerVideoRoute(app, config);
  await registerThumbnailRoute(app);

  // Video routes get a longer timeout
  app.addHook("onRequest", async (request) => {
    if (request.url === "/optimize/video") {
      request.socket.setTimeout(300_000); // 5 minutes
    }
  });

  return app;
}
