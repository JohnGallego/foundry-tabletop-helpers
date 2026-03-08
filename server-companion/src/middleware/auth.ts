import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config.js";

/** Bearer token authentication hook. */
export function createAuthHook(config: Config) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      reply.code(401).send({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = header.slice(7);
    if (token !== config.authToken) {
      reply.code(401).send({ error: "Invalid token" });
      return;
    }
  };
}
