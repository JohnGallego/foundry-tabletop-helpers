import "./styles.css";
import { Log, MOD, Level } from "./logger";
import { registerSettings, rotationMode, rotationLabel, animationsEnabled, supportV1, targetUserIds, type RotMode } from "./settings";
import { registerPrintSheetHooks } from "./print-sheet/print-sheet";
import {
  getGame,
  getHooks,
  getCompendiumCollectionClass,
  getSetting,
  isGM,
} from "./types";

/* ── Foundry App Type Aliases ──────────────────────────────── */
// Using unknown with inline guards avoids tight coupling to Foundry types
// while being safer than `any`. The hooks provide loosely-typed app objects.

/** Foundry Application V2 instance (loosely typed) */
interface AppV2Like {
  appId?: number;
  id?: string | number;
  window?: {
    element?: HTMLElement;
    header?: HTMLElement;
    controls?: HTMLButtonElement;   // the "..." toggle button
    controlsDropdown?: HTMLDivElement;
    close?: HTMLButtonElement;      // the X close button
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

/** Foundry Application V1 instance (loosely typed) */
type AppV1Like = AppV2Like;

/** V1 header button definition */
interface V1Button {
  label?: string;
  class?: string;
  icon?: string;
  onclick?: (e: MouseEvent) => void;
}

/* ── Hook Registration Helpers ─────────────────────────────── */

const onGetApplicationV1HeaderButtons = (
  fn: (app: AppV1Like, buttons: V1Button[]) => void
) => getHooks()?.on?.("getApplicationHeaderButtons", fn as (...args: unknown[]) => void);

const onRenderApplicationV1 = (
  fn: (app: AppV1Like, html: unknown) => void
) => getHooks()?.on?.("renderApplication", fn as (...args: unknown[]) => void);

const onCloseApplicationV1 = (
  fn: (app: AppV1Like) => void
) => getHooks()?.on?.("closeApplication", fn as (...args: unknown[]) => void);

// Small helper so we never break other modules if something throws
function safe(fn: () => void, where: string) {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
}

// Detect apps that should never receive rotation controls or DOM injection.
// This covers HUDs (TokenHUD, TileHUD, DrawingHUD …), toolbars, and other
// non-windowed overlay apps that happen to fire ApplicationV2 hooks.
function isExcludedApp(app: AppV2Like): boolean {
  // Check constructor name – all core HUDs end with "HUD" or "Hud"
  const name: string = app?.constructor?.name ?? "";
  if (/HUD$/i.test(name)) return true;

  // V2 apps that are not framed windows (hasFrame === false) should be skipped
  if (app?.hasFrame === false) return true;

  // Also check for known non-window overlay class names
  const excluded = ["SceneNavigation", "Hotbar", "PlayerList", "CombatCarousel"];
  if (excluded.includes(name)) return true;

  return false;
}

// Try to resolve the actual window root element for both V1 and V2 apps
function resolveAppRoot(app: AppV2Like): HTMLElement | undefined {
  // Prefer V2 window.element when available
  const winEl = app?.window?.element;
  if (winEl instanceof HTMLElement) return winEl;

  // Try explicit id lookup (V2 appId is usually the element id)
  const byId = (app?.appId && document.getElementById(String(app.appId)))
    || (app?.id && document.getElementById(String(app.id)));
  if (byId) return byId.closest?.(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement ?? byId;

  // Fallback to app.element / _element (could be jQuery)
  let el: HTMLElement | undefined;
  const rawEl = app?.element ?? app?._element;
  // Handle jQuery-like objects (has [0] property)
  if (rawEl && typeof rawEl === "object" && "0" in rawEl) {
    el = (rawEl as unknown as { 0: HTMLElement })[0];
  } else if (rawEl instanceof HTMLElement) {
    el = rawEl;
  }
  if (el?.closest) {
    const root = el.closest(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement | null;
    if (root) el = root;
  }

  // Last resort: climb from header to the window root
  if (!el && app?.window?.header) {
    const header = app.window.header as Element;
    const root2 = header.closest?.(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement | null;
    if (root2) el = root2;
  }
  return el;
}

// Decide if an element/app should be rotated. Excludes core UI (sidebar, hotbar, players, controls, nav, combat carousels, HUDs).
function isRotatableRoot(el: HTMLElement | undefined): boolean {
  if (!el) return false;
  const cls = el.classList;
  const isWindow = cls?.contains("app") || cls?.contains("window-app") || cls?.contains("application") || cls?.contains("document-sheet") || cls?.contains("sheet");
  if (!isWindow) return false;
  // Exclude HUD elements (token-hud, tile-hud, drawing-hud, etc.)
  if (el.id && /hud$/i.test(el.id)) return false;
  if (cls?.contains("placeable-hud")) return false;
  const id = el.id;
  const disallowedIds = new Set(["sidebar", "hotbar", "players", "controls", "navigation"]);
  if (id && disallowedIds.has(id)) return false;
  const forbidden = el.closest?.("#sidebar, #hotbar, #players, #controls, #navigation, .combat-carousel, #combat-carousel");
  if (forbidden) return false;
  return true;
}

// Resolve a stable per-window ID for both V1 (numeric appId) and V2 (string id) apps.
// V1 apps expose appId as a numeric instance property.
// V2 apps expose id as a string getter (no numeric appId on the instance).
function resolveAppId(app: AppV2Like): string | number | undefined {
  // V1: appId is a numeric instance property
  if (typeof app?.appId === "number") return app.appId;
  // V2: id is a string accessor; accept string or number
  if (typeof app?.id === "string" && app.id) return app.id;
  if (typeof app?.id === "number") return app.id;
  // Fallback: options.id
  const oid = app?.options?.id;
  if (typeof oid === "string" && oid) return oid;
  if (typeof oid === "number") return oid;
  return undefined;
}

// Build a per-window persistent key so we can remember rotation across closes/re-opens
function getPersistKey(app: AppV2Like): string | undefined {
  try {
    const cls = app?.constructor?.name ?? "Application";
    const doc = app?.document ?? app?.object ?? app?.actor ?? app?.item ?? app?.journal ?? app?.scene;
    const uuid: string | undefined = doc?.uuid ?? doc?._id;
    if (uuid) return `doc:${uuid}`;
    const pack: string | undefined = app?.collection?.metadata?.id ?? app?.collection?.collection ?? app?.pack ?? app?.metadata?.id;
    if (pack) return `pack:${pack}`;
    const id: string | number | undefined = app?.id ?? app?.appId ?? app?.options?.id ?? resolveAppRoot(app)?.id;
    if (id !== undefined) return `app:${cls}:${id}`;
    return `app:${cls}`;
  } catch {
    return undefined;
  }
}

/** Valid rotation degrees */
type RotDeg = 0 | 90 | 180 | 270;

function readPersistedRotation(app: AppV2Like): RotDeg | undefined {
  const key = getPersistKey(app);
  if (!key) return undefined;
  const raw = localStorage.getItem(`${MOD}:rot:${key}`);
  const n = Number(raw);
  if (n === 0 || n === 90 || n === 180 || n === 270) return n;
  return undefined;
}

// Normalize a persisted angle for the current mode
function normalizeForMode(deg: number | undefined): RotDeg | undefined {
  if (deg === undefined) return undefined;
  const mode = rotationMode();
  if (mode === 180) return deg === 0 ? 0 : 180;
  // 90-mode: snap to the closest quarter-turn among 0/90/180/270
  const allowed: readonly RotDeg[] = [0, 90, 180, 270];
  return allowed.reduce((a, b) => (Math.abs((deg ?? 0) - a) <= Math.abs((deg ?? 0) - b) ? a : b));
}


/* ── Macro Pack Setup ──────────────────────────────────────── */

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

/** Setup world compendium with prebuilt macros (GM only) */
async function setupMacroPack(game: ReturnType<typeof getGame>): Promise<void> {
  try {
    const CC = getCompendiumCollectionClass();
    const desired = { name: "fth-macros", label: "FTH Macros", type: "Macro", package: "world" };
    const collectionId = `${desired.package}.${desired.name}`;

    // Loosely typed packs collection
    const packs = game?.packs as Map<string, unknown> | undefined;

    // Helper to find pack by predicate
    const findPack = (pred: (p: PackLike) => boolean): PackLike | undefined => {
      if (!packs) return undefined;
      for (const p of packs.values()) {
        const pack = p as PackLike & { metadata?: { package?: string; name?: string; label?: string }; documentName?: string };
        if (pred(pack)) return pack;
      }
      return undefined;
    };

    // Try by collection id first, then by metadata
    let pack: PackLike | undefined = (packs?.get?.(collectionId) as PackLike | undefined)
      ?? findPack((p) => {
        const pm = (p as PackLike & { metadata?: { package?: string; name?: string; label?: string }; documentName?: string });
        return pm.metadata?.package === "world"
          && (pm.metadata?.name === desired.name || pm.metadata?.label === desired.label)
          && (pm.documentName === "Macro" || pm.documentName === "macro");
      });

    if (!pack && CC?.createCompendium) {
      try {
        pack = await CC.createCompendium(desired) as PackLike | undefined;
      } catch (err) {
        // If it already exists, fetch it
        Log.info("createCompendium skipped; pack exists, fetching", err);
        pack = (packs?.get?.(collectionId) as PackLike | undefined)
          ?? findPack((p) => (p as PackLike & { metadata?: { name?: string } }).metadata?.name === desired.name);
      }
    }

    if (!pack) {
      Log.warn("Could not create or find world macro pack");
      return;
    }

    const img = "icons/tools/navigation/compass-plain-blue.webp";
    const needed = [
      { newName: "Rotate Players 90° (CW)", legacy: ["Rotate All 90° (CW)"], command: "window.fth.rotateTargets90CW();" },
      { newName: "Rotate Players 90° (CCW)", legacy: ["Rotate All 90° (CCW)"], command: "window.fth.rotateTargets90CCW();" },
      { newName: "Rotate Players 180°", legacy: ["Rotate All 180°"], command: "window.fth.rotateTargets180();" },
      { newName: "Rotate Local 90° (CW)", legacy: [] as string[], command: "window.fth.rotateAll90CW();" },
      { newName: "Rotate Local 90° (CCW)", legacy: [] as string[], command: "window.fth.rotateAll90CCW();" },
      { newName: "Rotate Local 180°", legacy: [] as string[], command: "window.fth.rotateAll180();" },
    ];

    const docs = await pack.getDocuments();
    for (const entry of needed) {
      const existing = docs.find((d) => d.name === entry.newName)
        ?? docs.find((d) => d.name && entry.legacy.includes(d.name));
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

/* ── Hook Registration ─────────────────────────────────────── */

getHooks()?.on?.("init", () => {
  registerSettings();
  registerPrintSheetHooks();
  const logLevel = getSetting<string>(MOD, "logLevel");
  if (logLevel) Log.setLevel(logLevel as Level);
  Log.info("init");
});

getHooks()?.on?.("ready", () => {
  const game = getGame();
  Log.info("ready", {
    core: game?.version,
    system: game?.system?.id,
    user: game?.user?.id,
  });

  // Socket listener: only targeted players act; GMs ignore to avoid affecting DM screen
  interface RotatePayload {
    action: string;
    userIds?: string[];
    mode?: RotMode;
    dir?: RotDir;
  }

  try {
    game?.socket?.on?.(`module.${MOD}`, (payload: unknown) => {
      try {
        const p = payload as RotatePayload | undefined;
        if (!p || p.action !== "rotate") return;
        const myId = game?.user?.id;
        if (isGM()) return; // never affect GM screen
        const targets: string[] = Array.isArray(p.userIds) ? p.userIds : [];
        if (myId && targets.includes(myId)) {
          Log.info("socket: rotate for this client", { mode: p.mode, dir: p.dir });
          rotateAll(p.mode as RotMode, p.dir as RotDir);
        }
      } catch (e) {
        Log.warn("socket handler error", e);
      }
    });
  } catch { /* socket not available */ }

  // API exposed to macros and console
  const rotateAll = (mode: RotMode, dir: RotDir = "cw") => {
    try {
      const count = activeApps.size;
      Log.info("rotateAll", { mode, dir, count });
      activeApps.forEach((app) => {
        const el = resolveAppRoot(app);
        if (!isRotatableRoot(el)) return;
        toggleRotation(app, { mode, dir });
      });
    } catch (e) {
      Log.warn("rotateAll error", e);
    }
  };

  const rotateTargets = (mode: RotMode, dir: RotDir = "cw") => {
    try {
      const ids = targetUserIds();
      if (!ids.length) {
        Log.warn("rotateTargets: no target users configured");
        return;
      }
      Log.info("rotateTargets emit", { mode, dir, ids });
      game?.socket?.emit?.(`module.${MOD}`, {
        action: "rotate",
        userIds: ids,
        mode,
        dir,
      });
    } catch (e) {
      Log.warn("rotateTargets error", e);
    }
  };

  // Expose API to window for macro use
  const fthApi = {
    setLevel: (lvl: Level) => Log.setLevel(lvl),
    version: game?.modules?.get(MOD)?.version,
    // Local rotation (current client only)
    rotateAll,
    rotateAll90CW: () => rotateAll(90, "cw"),
    rotateAll90CCW: () => rotateAll(90, "ccw"),
    rotateAll180: () => rotateAll(180, "cw"),
    // Targeted rotation (via socket to selected players only)
    rotateTargets: (mode: RotMode, dir: RotDir = "cw") => rotateTargets(mode, dir),
    rotateTargets90CW: () => rotateTargets(90, "cw"),
    rotateTargets90CCW: () => rotateTargets(90, "ccw"),
    rotateTargets180: () => rotateTargets(180, "cw"),
  };

  // Attach to window for macro access
  (globalThis as unknown as Record<string, unknown>).fth = fthApi;

  // Ensure world compendium with prebuilt macros (GM only)
  if (isGM()) {
    setupMacroPack(game);
  }

  Log.debug("debug API attached to window.fth and macros registered (if GM)");
});

/* ---------- Rotation State & Helpers ---------- */
const rotationByAppId = new Map<string | number, RotDeg>();

// Re-entrancy guard to prevent double toggles from duplicate handlers
const lastToggleByAppId = new Map<string | number, number>();

// Track currently active apps to support macro-driven rotations across all windows
const activeApps = new Set<AppV2Like>();

type RotDir = "cw" | "ccw";
const prevRotation = (d: RotDeg): RotDeg => (d === 0 ? 270 : d === 90 ? 0 : d === 180 ? 90 : 180);

function applyRotation(el: HTMLElement | undefined, deg: RotDeg): void {
  if (!el) {
    Log.warn("applyRotation: element missing");
    return;
  }
  const before = { className: el.className, rotation: el.dataset?.fthRotation };
  // Toggle animation class based on setting
  if (animationsEnabled()) el.classList.add("fth-anim"); else el.classList.remove("fth-anim");
  // Apply rotation classes
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (deg === 90) el.classList.add("fth-rot-90");
  if (deg === 180) el.classList.add("fth-rot-180");
  if (deg === 270) el.classList.add("fth-rot-270");
  el.dataset.fthRotation = String(deg);
  Log.debug("applyRotation", { deg, before, after: { className: el.className, rotation: el.dataset?.fthRotation } });
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
    next = dir === "cw" ? (curr === 0 ? 90 : curr === 90 ? 180 : curr === 180 ? 270 : 0) : prevRotation(curr);
  }

  rotationByAppId.set(appId, next);
  const key = getPersistKey(app);
  if (key) {
    try {
      localStorage.setItem(`${MOD}:rot:${key}`, String(next));
    } catch { /* localStorage not available */ }
  }
  Log.group("fth: toggleRotation");
  Log.debug("app", { ctor: app?.constructor?.name, appId });
  Log.debug("element", { className: rootEl.className, dataset: rootEl.dataset });
  applyRotation(rootEl, next);
  Log.debug("applied", { next, mode, dir });
  Log.groupEnd();
}

getHooks()?.on?.("renderApplicationV2", ((app: AppV2Like) =>
  safe(() => {
    if (isExcludedApp(app)) return;
    const el = resolveAppRoot(app);

    // Inject a standalone rotate button directly into the V2 header bar.
    // V2 ApplicationV2.window.header is the header element; we insert our button
    // before the close button so it sits as a native-looking header icon — NOT
    // inside the controlsDropdown ("..." popup menu).
    const header = app?.window?.header;
    if (header && !header.querySelector('[data-action="fth-rotate"]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'header-control icon fth-rotate-btn';
      btn.dataset.action = 'fth-rotate';
      btn.setAttribute('aria-label', rotationLabel());
      btn.title = rotationLabel();
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-arrows-rotate';
      btn.appendChild(icon);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRotation(app);
      });
      // Insert before the close button if present; otherwise append to the header
      const closeBtn = app?.window?.close ?? header.querySelector<HTMLElement>('[data-action="close"]');
      if (closeBtn) {
        header.insertBefore(btn, closeBtn);
      } else {
        header.appendChild(btn);
      }
      Log.debug('injected rotate button into V2 header', { app: app?.constructor?.name, id: app?.id });
    }

    const appId = resolveAppId(app);
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
      if (deg !== undefined) applyRotation(el, deg);
    }
  }, "renderApplicationV2")
) as (...args: unknown[]) => void);

getHooks()?.on?.("closeApplicationV2", ((app: AppV2Like) =>
  safe(() => {
    const id = resolveAppId(app);
    if (id !== undefined) {
      rotationByAppId.delete(id);
      lastToggleByAppId.delete(id);
    }
    activeApps.delete(app);
  }, "closeApplicationV2")
) as (...args: unknown[]) => void);

/* ---------- optional legacy (V1) behind a toggle ---------- */

onGetApplicationV1HeaderButtons((app, buttons) =>
  safe(() => {
    if (!supportV1()) return;
    const appLike = app as AppV2Like;
    buttons.unshift({
      label: rotationLabel(),
      class: "fth-rotate",
      icon: "fa-solid fa-arrows-rotate",
      onclick: () => toggleRotation(appLike),
    });
    Log.debug("added V1 header button", {
      app: appLike?.constructor?.name,
      appId: appLike?.appId,
    });
  }, "getApplicationV1HeaderButtons")
);

onRenderApplicationV1((app) =>
  safe(() => {
    if (!supportV1()) return;
    const appLike = app as AppV2Like;
    const appId = resolveAppId(appLike);
    const el = resolveAppRoot(appLike);
    if (isRotatableRoot(el)) activeApps.add(appLike);

    if (appId !== undefined) {
      let deg = rotationByAppId.get(appId);
      if (deg === undefined) {
        const p = readPersistedRotation(appLike);
        if (p !== undefined) {
          const norm = normalizeForMode(p);
          deg = norm;
          if (norm !== undefined) rotationByAppId.set(appId, norm);
        }
      }
      if (deg !== undefined) applyRotation(resolveAppRoot(appLike), deg);
    }
  }, "renderApplicationV1")
);

onCloseApplicationV1((app) =>
  safe(() => {
    if (!supportV1()) return;
    const appLike = app as AppV2Like;
    const id = resolveAppId(appLike);
    if (id !== undefined) {
      rotationByAppId.delete(id);
      lastToggleByAppId.delete(id);
    }
    activeApps.delete(appLike);
  }, "closeApplicationV1")
);
