/**
 * Window Rotation feature.
 *
 * Adds a rotate button to every Foundry application window (V1 and V2) and
 * exposes a macro-friendly API on `window.fth`.  Rotation state is persisted
 * in localStorage so windows remember their orientation across open/close cycles.
 *
 * Entry point: call `registerWindowRotationHooks()` from the module init hook.
 */

import { Log, MOD } from "../logger";
import { rotationMode, type RotMode } from "../settings";
import {
  getGame,
} from "../types";
import {
  applyRotation,
  getNextRotation,
  getPersistKey,
  isRotatableRoot,
  normalizeForMode,
  readPersistedRotation,
  resolveAppId,
  resolveAppRoot,
  type RotDeg,
  type RotDir,
} from "./window-rotation-helpers";
import { buildRotationApi as buildWindowRotationApi, type FthRotationApi } from "./window-rotation-api";
import { registerWindowRotationUiHooks } from "./window-rotation-hook-helpers";
import { registerWindowRotationSocket, setupWindowRotationMacroPack } from "./window-rotation-ready";
export type { FthRotationApi } from "./window-rotation-api";

/* ── Foundry App Type Shims ────────────────────────────────── */

/**
 * Minimal shape of a Foundry Application V2 instance.
 * Only properties we actually access are listed; everything else is unknown.
 */
export interface AppV2Like {
  appId?: number;
  id?: string | number;
  window?: {
    element?: HTMLElement;
    header?: HTMLElement;
    controls?: HTMLButtonElement;
    controlsDropdown?: HTMLDivElement;
    close?: HTMLButtonElement;
  };
  element?: HTMLElement | JQuery;
  hasFrame?: boolean;
  constructor: { name: string };
  document?: { uuid?: string; _id?: string };
  object?: { uuid?: string; _id?: string };
  actor?: { uuid?: string; _id?: string };
  item?: { uuid?: string; _id?: string };
  journal?: { uuid?: string; _id?: string };
  scene?: { uuid?: string; _id?: string };
  collection?: { metadata?: { id?: string }; collection?: string };
  pack?: string;
  metadata?: { id?: string };
  options?: { id?: string | number };
  _element?: HTMLElement | JQuery;
}

/** V1 application type is structurally the same for our purposes. */
export type AppV1Like = AppV2Like;

/** V1 header button definition */
export interface V1Button {
  label?: string;
  class?: string;
  icon?: string;
  onclick?: (e: MouseEvent) => void;
}

/* ── Rotation State ────────────────────────────────────────── */

/** Tracks the current rotation per app id. */
const rotationByAppId = new Map<string | number, RotDeg>();
/** Re-entrancy guard to prevent double toggles from duplicate hook firings. */
const lastToggleByAppId = new Map<string | number, number>();
/** All currently-open apps, used for batch macro rotations. */
const activeApps = new Set<AppV2Like>();

/* ── Helpers ───────────────────────────────────────────────── */

function toggleRotation(app: AppV2Like, opts?: { mode?: RotMode; dir?: RotDir }): void {
  const appId = resolveAppId(app);
  const rootEl = resolveAppRoot(app);
  if (appId === undefined || !rootEl) {
    Log.warn("toggleRotation: missing appId or element", { appId, hasEl: !!rootEl });
    return;
  }
  const now = performance.now();
  const last = lastToggleByAppId.get(appId);
  if (last && now - last < 50) {
    Log.debug("toggleRotation: ignored duplicate within 50ms", { appId });
    return;
  }
  lastToggleByAppId.set(appId, now);

  const curr = rotationByAppId.get(appId) ?? 0;
  const mode = opts?.mode ?? rotationMode();
  const dir = opts?.dir ?? "cw";
  const next = getNextRotation(curr, mode, dir);

  rotationByAppId.set(appId, next);
  const key = getPersistKey(app);
  if (key) {
    try {
      localStorage.setItem(`${MOD}:rot:${key}`, String(next));
    } catch {
      /* localStorage unavailable */
    }
  }
  Log.group("fth: toggleRotation");
  Log.debug("app", { ctor: app?.constructor?.name, appId });
  applyRotation(rootEl, next);
  Log.debug("applied", { next, mode, dir });
  Log.groupEnd();
}

/* ── Rotation restoration helper (shared by V1 and V2 render hooks) ── */

function restoreRotation(app: AppV2Like): void {
  const appId = resolveAppId(app);
  const el = resolveAppRoot(app);
  if (isRotatableRoot(el)) activeApps.add(app);
  if (appId !== undefined) {
    let deg = rotationByAppId.get(appId);
    if (deg === undefined) {
      const p = readPersistedRotation(app);
      if (p !== undefined) {
        const norm = normalizeForMode(p);
        deg = norm;
        if (norm !== undefined) rotationByAppId.set(appId, norm);
      }
    }
    if (deg !== undefined) applyRotation(resolveAppRoot(app), deg);
  }
}

function createRotationApi(): FthRotationApi {
  return buildWindowRotationApi({
    activeApps,
    onToggle: (app, options) => toggleRotation(app, options),
    emitSocket: (eventName, payload) => {
      getGame()?.socket?.emit?.(eventName, payload);
    },
  });
}

/** Build the rotation API object for attachment to `window.fth`. */
export function buildRotationApi(): FthRotationApi {
  return createRotationApi();
}

/* ── Hook Registration ───────────────────────────────────────────────── */

/**
 * Register all Foundry hooks for the Window Rotation feature.
 * Call this from the module `init` hook.
 */
export function registerWindowRotationHooks(): void {
  registerWindowRotationUiHooks({
    onToggle: (app) => toggleRotation(app),
    onRestore: restoreRotation,
    onCleanup: (app) => {
      const id = resolveAppId(app);
      if (id !== undefined) {
        rotationByAppId.delete(id);
        lastToggleByAppId.delete(id);
      }
      activeApps.delete(app);
    },
  });
}

/**
 * Perform ready-time setup for the Window Rotation feature:
 * - registers the socket listener for targeted rotations
 * - provisions the world macro compendium (GM only)
 */
export function initWindowRotationReady(): void {
  const game = getGame();
  registerWindowRotationSocket(game, (mode, dir) => createRotationApi().rotateAll(mode, dir));
  if (game?.user?.isGM) void setupWindowRotationMacroPack(game);
}
