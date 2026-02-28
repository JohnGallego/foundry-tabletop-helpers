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
import { rotationMode, rotationLabel, animationsEnabled, supportV1, targetUserIds, type RotMode } from "../settings";
import {
  getHooks,
  getGame,
  getCompendiumCollectionClass,
  isGM,
} from "../types";
import { safe } from "../utils";

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

/** Valid rotation degrees */
type RotDeg = 0 | 90 | 180 | 270;
type RotDir = "cw" | "ccw";

/** Tracks the current rotation per app id. */
const rotationByAppId = new Map<string | number, RotDeg>();
/** Re-entrancy guard to prevent double toggles from duplicate hook firings. */
const lastToggleByAppId = new Map<string | number, number>();
/** All currently-open apps, used for batch macro rotations. */
const activeApps = new Set<AppV2Like>();

/* ── Helpers ───────────────────────────────────────────────── */

function isExcludedApp(app: AppV2Like): boolean {
  const name: string = app?.constructor?.name ?? "";
  if (/HUD$/i.test(name)) return true;
  if (app?.hasFrame === false) return true;
  const excluded = ["SceneNavigation", "Hotbar", "PlayerList", "CombatCarousel"];
  if (excluded.includes(name)) return true;
  return false;
}

function resolveAppRoot(app: AppV2Like): HTMLElement | undefined {
  const winEl = app?.window?.element;
  if (winEl instanceof HTMLElement) return winEl;

  const byId =
    (app?.appId && document.getElementById(String(app.appId))) ||
    (app?.id && document.getElementById(String(app.id)));
  if (byId) {
    return (
      (byId.closest?.(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement) ??
      byId
    );
  }

  let el: HTMLElement | undefined;
  const rawEl = app?.element ?? app?._element;
  if (rawEl && typeof rawEl === "object" && "0" in rawEl) {
    el = (rawEl as unknown as { 0: HTMLElement })[0];
  } else if (rawEl instanceof HTMLElement) {
    el = rawEl;
  }
  if (el?.closest) {
    const root = el.closest(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement | null;
    if (root) el = root;
  }

  if (!el && app?.window?.header) {
    const header = app.window.header as Element;
    const root2 = header.closest?.(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement | null;
    if (root2) el = root2;
  }
  return el;
}

function isRotatableRoot(el: HTMLElement | undefined): boolean {
  if (!el) return false;
  const cls = el.classList;
  const isWindow =
    cls?.contains("app") ||
    cls?.contains("window-app") ||
    cls?.contains("application") ||
    cls?.contains("document-sheet") ||
    cls?.contains("sheet");
  if (!isWindow) return false;
  if (el.id && /hud$/i.test(el.id)) return false;
  if (cls?.contains("placeable-hud")) return false;
  const disallowedIds = new Set(["sidebar", "hotbar", "players", "controls", "navigation"]);
  if (el.id && disallowedIds.has(el.id)) return false;
  const forbidden = el.closest?.("#sidebar, #hotbar, #players, #controls, #navigation, .combat-carousel, #combat-carousel");
  if (forbidden) return false;
  return true;
}

function resolveAppId(app: AppV2Like): string | number | undefined {
  if (typeof app?.appId === "number") return app.appId;
  if (typeof app?.id === "string" && app.id) return app.id;
  if (typeof app?.id === "number") return app.id;
  const oid = app?.options?.id;
  if (typeof oid === "string" && oid) return oid;
  if (typeof oid === "number") return oid;
  return undefined;
}


function getPersistKey(app: AppV2Like): string | undefined {
  try {
    const cls = app?.constructor?.name ?? "Application";
    const doc = app?.document ?? app?.object ?? app?.actor ?? app?.item ?? app?.journal ?? app?.scene;
    const uuid: string | undefined = doc?.uuid ?? doc?._id;
    if (uuid) return `doc:${uuid}`;
    const pack: string | undefined =
      app?.collection?.metadata?.id ??
      app?.collection?.collection ??
      app?.pack ??
      app?.metadata?.id;
    if (pack) return `pack:${pack}`;
    const id: string | number | undefined =
      app?.id ?? app?.appId ?? app?.options?.id ?? resolveAppRoot(app)?.id;
    if (id !== undefined) return `app:${cls}:${id}`;
    return `app:${cls}`;
  } catch {
    return undefined;
  }
}

function readPersistedRotation(app: AppV2Like): RotDeg | undefined {
  const key = getPersistKey(app);
  if (!key) return undefined;
  const raw = localStorage.getItem(`${MOD}:rot:${key}`);
  const n = Number(raw);
  if (n === 0 || n === 90 || n === 180 || n === 270) return n as RotDeg;
  return undefined;
}

const prevRotation = (d: RotDeg): RotDeg =>
  d === 0 ? 270 : d === 90 ? 0 : d === 180 ? 90 : 180;

function normalizeForMode(deg: number | undefined): RotDeg | undefined {
  if (deg === undefined) return undefined;
  const mode = rotationMode();
  if (mode === 180) return deg === 0 ? 0 : 180;
  const allowed: readonly RotDeg[] = [0, 90, 180, 270];
  return allowed.reduce((a, b) =>
    Math.abs((deg ?? 0) - a) <= Math.abs((deg ?? 0) - b) ? a : b
  );
}

function applyRotation(el: HTMLElement | undefined, deg: RotDeg): void {
  if (!el) {
    Log.warn("applyRotation: element missing");
    return;
  }
  if (animationsEnabled()) el.classList.add("fth-anim");
  else el.classList.remove("fth-anim");
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (deg === 90) el.classList.add("fth-rot-90");
  if (deg === 180) el.classList.add("fth-rot-180");
  if (deg === 270) el.classList.add("fth-rot-270");
  el.dataset.fthRotation = String(deg);
  Log.debug("applyRotation", { deg });
}

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
  let next: RotDeg;
  if (mode === 180) {
    next = curr === 180 ? 0 : 180;
  } else {
    next =
      dir === "cw"
        ? curr === 0 ? 90 : curr === 90 ? 180 : curr === 180 ? 270 : 0
        : prevRotation(curr);
  }

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


/* ── V1 Hook Registration Helpers ────────────────────────────────────── */

const onGetApplicationV1HeaderButtons = (
  fn: (app: AppV1Like, buttons: V1Button[]) => void
) => getHooks()?.on?.("getApplicationHeaderButtons", fn as (...args: unknown[]) => void);

const onRenderApplicationV1 = (
  fn: (app: AppV1Like) => void
) => getHooks()?.on?.("renderApplication", fn as (...args: unknown[]) => void);

const onCloseApplicationV1 = (
  fn: (app: AppV1Like) => void
) => getHooks()?.on?.("closeApplication", fn as (...args: unknown[]) => void);

/* ── Macro Pack Setup ────────────────────────────────────────────────── */

/** Loosely-typed pack interface for working with compendium documents */
interface PackLike {
  collection: string;
  documentClass: { create: (data: Record<string, unknown>, opts: Record<string, unknown>) => Promise<unknown> };
  getDocuments: () => Promise<MacroDocLike[]>;
}

interface MacroDocLike {
  name?: string;
  command?: string;
  img?: string;
  type?: string;
  update: (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<void>;
}

/** Ensure the world compendium with prebuilt macros exists and is up to date (GM only). */
async function setupMacroPack(game: ReturnType<typeof getGame>): Promise<void> {
  try {
    const CC = getCompendiumCollectionClass();
    const desired = { name: "fth-macros", label: "FTH Macros", type: "Macro", package: "world" };
    const collectionId = `${desired.package}.${desired.name}`;

    const packs = game?.packs as Map<string, unknown> | undefined;

    const findPack = (pred: (p: PackLike) => boolean): PackLike | undefined => {
      if (!packs) return undefined;
      for (const p of packs.values()) {
        const pack = p as PackLike & { metadata?: { package?: string; name?: string; label?: string }; documentName?: string };
        if (pred(pack)) return pack;
      }
      return undefined;
    };

    let pack: PackLike | undefined =
      (packs?.get?.(collectionId) as PackLike | undefined) ??
      findPack((p) => {
        const pm = p as PackLike & { metadata?: { package?: string; name?: string; label?: string }; documentName?: string };
        return (
          pm.metadata?.package === "world" &&
          (pm.metadata?.name === desired.name || pm.metadata?.label === desired.label) &&
          (pm.documentName === "Macro" || pm.documentName === "macro")
        );
      });

    if (!pack && CC?.createCompendium) {
      try {
        pack = (await CC.createCompendium(desired)) as PackLike | undefined;
      } catch (err) {
        Log.info("createCompendium skipped; pack exists, fetching", err);
        pack =
          (packs?.get?.(collectionId) as PackLike | undefined) ??
          findPack((p) => (p as PackLike & { metadata?: { name?: string } }).metadata?.name === desired.name);
      }
    }

    if (!pack) { Log.warn("Could not create or find world macro pack"); return; }

    const img = "icons/tools/navigation/compass-plain-blue.webp";
    const needed = [
      { newName: "Rotate Players 90° (CW)",  legacy: ["Rotate All 90° (CW)"],  command: "window.fth.rotateTargets90CW();"  },
      { newName: "Rotate Players 90° (CCW)", legacy: ["Rotate All 90° (CCW)"], command: "window.fth.rotateTargets90CCW();" },
      { newName: "Rotate Players 180°",      legacy: ["Rotate All 180°"],      command: "window.fth.rotateTargets180();"   },
      { newName: "Rotate Local 90° (CW)",   legacy: [] as string[],           command: "window.fth.rotateAll90CW();"     },
      { newName: "Rotate Local 90° (CCW)",  legacy: [] as string[],           command: "window.fth.rotateAll90CCW();"    },
      { newName: "Rotate Local 180°",       legacy: [] as string[],           command: "window.fth.rotateAll180();"      },
    ];

    const docs = await pack.getDocuments();
    for (const entry of needed) {
      const existing =
        docs.find((d) => d.name === entry.newName) ??
        docs.find((d) => d.name && entry.legacy.includes(d.name));
      if (!existing) {
        await pack.documentClass.create(
          { name: entry.newName, type: "script", img, command: entry.command },
          { pack: pack.collection }
        );
      } else {
        const patch: Record<string, unknown> = { img, type: "script", command: entry.command };
        if (existing.name !== entry.newName) patch.name = entry.newName;
        const needsUpdate = existing.command !== entry.command || existing.img !== img || existing.type !== "script" || patch.name;
        if (needsUpdate) await existing.update(patch, { pack: pack.collection });
      }
    }
    Log.info("FTH macros pack ready (migrated if needed)", { collection: pack.collection });
  } catch (e) {
    Log.warn("macro pack setup failed", e);
  }
}

/* ── Rotation API (local + targeted) ─────────────────────────────────── */

/** Rotate all currently open, rotatable windows on this client. */
function rotateAll(mode: RotMode, dir: RotDir = "cw"): void {
  try {
    Log.info("rotateAll", { mode, dir, count: activeApps.size });
    activeApps.forEach((app) => {
      if (!isRotatableRoot(resolveAppRoot(app))) return;
      toggleRotation(app, { mode, dir });
    });
  } catch (e) {
    Log.warn("rotateAll error", e);
  }
}

/** Emit a socket event to rotate windows on targeted player clients. */
function rotateTargets(mode: RotMode, dir: RotDir = "cw"): void {
  try {
    const ids = targetUserIds();
    if (!ids.length) { Log.warn("rotateTargets: no target users configured"); return; }
    Log.info("rotateTargets emit", { mode, dir, ids });
    getGame()?.socket?.emit?.(`module.${MOD}`, { action: "rotate", userIds: ids, mode, dir });
  } catch (e) {
    Log.warn("rotateTargets error", e);
  }
}

/** Public shape of the FTH rotation API exposed on `window.fth`. */
export interface FthRotationApi {
  rotateAll: (mode: RotMode, dir?: RotDir) => void;
  rotateAll90CW: () => void;
  rotateAll90CCW: () => void;
  rotateAll180: () => void;
  rotateTargets: (mode: RotMode, dir?: RotDir) => void;
  rotateTargets90CW: () => void;
  rotateTargets90CCW: () => void;
  rotateTargets180: () => void;
}

/** Build the rotation API object for attachment to `window.fth`. */
export function buildRotationApi(): FthRotationApi {
  return {
    rotateAll,
    rotateAll90CW:      () => rotateAll(90, "cw"),
    rotateAll90CCW:     () => rotateAll(90, "ccw"),
    rotateAll180:       () => rotateAll(180, "cw"),
    rotateTargets:      (mode, dir = "cw") => rotateTargets(mode, dir),
    rotateTargets90CW:  () => rotateTargets(90, "cw"),
    rotateTargets90CCW: () => rotateTargets(90, "ccw"),
    rotateTargets180:   () => rotateTargets(180, "cw"),
  };
}

/* ── Hook Registration ───────────────────────────────────────────────── */

/**
 * Register all Foundry hooks for the Window Rotation feature.
 * Call this from the module `init` hook.
 */
export function registerWindowRotationHooks(): void {
  // ── V2: inject rotate button + restore persisted rotation on render ──
  getHooks()?.on?.(
    "renderApplicationV2",
    ((app: AppV2Like) =>
      safe(() => {
        if (isExcludedApp(app)) return;

        // Inject rotate button directly into the header bar (not the "…" dropdown)
        const header = app?.window?.header;
        if (header && !header.querySelector('[data-action="fth-rotate"]')) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "header-control icon fth-rotate-btn";
          btn.dataset.action = "fth-rotate";
          btn.setAttribute("aria-label", rotationLabel());
          btn.title = rotationLabel();
          const icon = document.createElement("i");
          icon.className = "fa-solid fa-arrows-rotate";
          btn.appendChild(icon);
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleRotation(app);
          });
          // Prefer inserting before the close button for a native look
          const closeBtn = app?.window?.close ?? header.querySelector<HTMLElement>('[data-action="close"]');
          if (closeBtn) header.insertBefore(btn, closeBtn);
          else header.appendChild(btn);
          Log.debug("injected rotate button into V2 header", { app: app?.constructor?.name, id: app?.id });
        }

        restoreRotation(app);
      }, "renderApplicationV2")
    ) as (...args: unknown[]) => void
  );

  // ── V2: clean up in-memory state on close ───────────────────────────
  getHooks()?.on?.(
    "closeApplicationV2",
    ((app: AppV2Like) =>
      safe(() => {
        const id = resolveAppId(app);
        if (id !== undefined) {
          rotationByAppId.delete(id);
          lastToggleByAppId.delete(id);
        }
        activeApps.delete(app);
      }, "closeApplicationV2")
    ) as (...args: unknown[]) => void
  );

  // ── V1: inject header button (optional, behind setting toggle) ───────
  onGetApplicationV1HeaderButtons((app, buttons) =>
    safe(() => {
      if (!supportV1()) return;
      buttons.unshift({
        label: rotationLabel(),
        class: "fth-rotate",
        icon: "fa-solid fa-arrows-rotate",
        onclick: () => toggleRotation(app),
      });
      Log.debug("added V1 header button", { app: app?.constructor?.name, appId: app?.appId });
    }, "getApplicationV1HeaderButtons")
  );

  // ── V1: restore persisted rotation + track active apps ──────────────
  onRenderApplicationV1((app) =>
    safe(() => {
      if (!supportV1()) return;
      restoreRotation(app);
    }, "renderApplicationV1")
  );

  // ── V1: clean up in-memory state on close ───────────────────────────
  onCloseApplicationV1((app) =>
    safe(() => {
      if (!supportV1()) return;
      const id = resolveAppId(app);
      if (id !== undefined) {
        rotationByAppId.delete(id);
        lastToggleByAppId.delete(id);
      }
      activeApps.delete(app);
    }, "closeApplicationV1")
  );
}

/* ── Ready-hook initialisation (called from index.ts ready hook) ─────── */

interface RotatePayload {
  action: string;
  userIds?: string[];
  mode?: RotMode;
  dir?: RotDir;
}

/**
 * Perform ready-time setup for the Window Rotation feature:
 * - registers the socket listener for targeted rotations
 * - provisions the world macro compendium (GM only)
 */
export function initWindowRotationReady(): void {
  const game = getGame();

  // Socket listener: only targeted players act; GMs ignore to avoid affecting their screen
  try {
    game?.socket?.on?.(`module.${MOD}`, (payload: unknown) => {
      try {
        const p = payload as RotatePayload | undefined;
        if (!p || p.action !== "rotate") return;
        const myId = game?.user?.id;
        if (isGM()) return;
        const targets: string[] = Array.isArray(p.userIds) ? p.userIds : [];
        if (myId && targets.includes(myId)) {
          Log.info("socket: rotate for this client", { mode: p.mode, dir: p.dir });
          rotateAll(p.mode as RotMode, p.dir as RotDir);
        }
      } catch (e) {
        Log.warn("socket handler error", e);
      }
    });
  } catch { /* socket not available in this context */ }

  if (isGM()) setupMacroPack(game);
}

