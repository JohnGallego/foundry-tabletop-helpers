import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export interface Config {
  authToken: string;
  port: number;
  host: string;
  allowedOrigins: string[];
  maxFileSize: number;
  tempDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  ffmpegPath: string | undefined;
  ffprobePath: string | undefined;
  foundryDataPath: string | undefined;
}

export function loadConfig(): Config {
  // Load .env from current working directory
  loadDotenv();

  const authToken = process.env.FTH_AUTH_TOKEN;
  if (!authToken || authToken === "change-me") {
    console.error("ERROR: FTH_AUTH_TOKEN is not set or still has the default value.");
    console.error("Generate a token: openssl rand -hex 32");
    process.exit(1);
  }

  const port = parseInt(process.env.FTH_PORT ?? "7890", 10);
  const host = process.env.FTH_HOST ?? "0.0.0.0";

  const originsRaw = process.env.FTH_ALLOWED_ORIGINS ?? "";
  const allowedOrigins = originsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const maxFileSize = parseInt(process.env.FTH_MAX_FILE_SIZE ?? "104857600", 10);

  const tempDir = resolve(process.env.FTH_TEMP_DIR ?? "/tmp/fth-optimizer");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const logLevel = (process.env.FTH_LOG_LEVEL ?? "info") as Config["logLevel"];

  const ffmpegPath = process.env.FTH_FFMPEG_PATH || undefined;
  const ffprobePath = process.env.FTH_FFPROBE_PATH || undefined;
  const foundryDataPath = process.env.FTH_FOUNDRY_DATA_PATH || undefined;

  return {
    authToken,
    port,
    host,
    allowedOrigins,
    maxFileSize,
    tempDir,
    logLevel,
    ffmpegPath,
    ffprobePath,
    foundryDataPath,
  };
}
