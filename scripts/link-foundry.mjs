#!/usr/bin/env node

/**
 * Cross-platform symlink of dist/ into the local Foundry VTT modules directory.
 *
 * Usage:  node scripts/link-foundry.mjs [/custom/foundry/data/path]
 *
 * Platform detection:
 *   macOS   → ~/Library/Application Support/FoundryVTT/Data/modules
 *   Windows → %LOCALAPPDATA%/FoundryVTT/Data/modules
 *   Linux   → ~/.local/share/FoundryVTT/Data/modules
 *
 * Pass a custom path as the first argument to override auto-detection
 * (useful for non-standard installs or Docker volumes).
 */

import { existsSync, mkdirSync, rmSync, symlinkSync, readlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir, platform } from "node:os";

const MODULE_ID = "foundry-tabletop-helpers";
const distDir = resolve("dist");

// Resolve Foundry data path
function getFoundryDataPath() {
  // Allow explicit override via argument or env var
  const explicit = process.argv[2] || process.env.FOUNDRY_DATA_PATH;
  if (explicit) return explicit;

  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "FoundryVTT", "Data");
    case "win32":
      return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "FoundryVTT", "Data");
    case "linux":
      return join(home, ".local", "share", "FoundryVTT", "Data");
    default:
      console.error(`Unknown platform: ${platform()}. Pass the Foundry data path as an argument.`);
      process.exit(1);
  }
}

const dataPath = getFoundryDataPath();
const modulesDir = join(dataPath, "modules");
const linkPath = join(modulesDir, MODULE_ID);

// Verify dist/ exists
if (!existsSync(distDir)) {
  console.error(`dist/ not found. Run 'npm run build' first.`);
  process.exit(1);
}

// Create modules directory if needed
if (!existsSync(modulesDir)) {
  mkdirSync(modulesDir, { recursive: true });
  console.log(`Created: ${modulesDir}`);
}

// Remove existing link/directory
if (existsSync(linkPath)) {
  try {
    const existing = readlinkSync(linkPath);
    if (existing === distDir) {
      console.log(`Already linked: ${linkPath} → ${distDir}`);
      process.exit(0);
    }
  } catch { /* not a symlink, remove it */ }
  rmSync(linkPath, { recursive: true, force: true });
}

// Create symlink (junction on Windows for non-admin support)
const type = platform() === "win32" ? "junction" : "dir";
symlinkSync(distDir, linkPath, type);

console.log(`Linked: ${linkPath} → ${distDir}`);
