#!/usr/bin/env node

/**
 * Build script for fth-optimizer server companion.
 * Compiles TypeScript and creates a distributable tarball.
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STAGE = join(ROOT, ".stage");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const tarName = `fth-optimizer-v${pkg.version}.tar.gz`;

console.log(`Building fth-optimizer v${pkg.version}...`);

// Clean
rmSync(join(ROOT, "dist"), { recursive: true, force: true });
rmSync(STAGE, { recursive: true, force: true });

// Compile TypeScript
console.log("Compiling TypeScript...");
execSync("npx tsc", { cwd: ROOT, stdio: "inherit" });

// Stage files for tarball
console.log("Staging files...");
const stageDir = join(STAGE, "fth-optimizer");
mkdirSync(stageDir, { recursive: true });

// Copy built output
cpSync(join(ROOT, "dist"), join(stageDir, "dist"), { recursive: true });

// Copy runtime files
for (const file of ["package.json", "package-lock.json"]) {
  try { cpSync(join(ROOT, file), join(stageDir, file)); } catch { /* lock may not exist */ }
}

// Copy support files
cpSync(join(ROOT, "scripts"), join(stageDir, "scripts"), { recursive: true });
cpSync(join(ROOT, "systemd"), join(stageDir, "systemd"), { recursive: true });
cpSync(join(ROOT, "config"), join(stageDir, "config"), { recursive: true });

// Create tarball
console.log(`Creating ${tarName}...`);
mkdirSync(join(ROOT, "build"), { recursive: true });
execSync(`tar -czf "${join(ROOT, "build", tarName)}" -C "${STAGE}" fth-optimizer`, {
  stdio: "inherit",
});

// Clean up staging
rmSync(STAGE, { recursive: true, force: true });

console.log(`Done! → build/${tarName}`);
