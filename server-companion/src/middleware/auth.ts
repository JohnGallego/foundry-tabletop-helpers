import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config.js";

/** Bearer token authentication hook. */
export function createAuthHook(config: Config) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    // Check Authorization header first
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      if (header.slice(7) === config.authToken) return;
      reply.code(401).send({ error: "Invalid token" });
      return;
    }

    // Fallback: query param token (for <img src> which can't set headers)
    const queryToken = (request.query as Record<string, string>)?.token;
    if (queryToken && queryToken === config.authToken) return;

    reply.code(401).send({ error: "Missing or invalid authorization" });
  };
}
