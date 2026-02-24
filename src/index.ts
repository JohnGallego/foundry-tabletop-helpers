import "./styles.css";
import { Log, MOD } from "./logger";
import { registerSettings, rotationMode, rotationLabel, animationsEnabled, supportV1, targetUserIds, type RotMode } from "./settings";
import { registerPrintSheetHooks } from "./print-sheet/print-sheet";


type AppV2 = any; // Avoid tight coupling to Foundry TS types
// Legacy ApplicationV1 API
type AppV1 = any;

type V1Button = { label?: string; class?: string; icon?: string; onclick?: (e: MouseEvent) => void };

// Lightly-typed wrapper helpers using globalThis to avoid TS namespace issues
const onGetHeaderControlsApplicationV2 = (
  fn: (app: AppV2, controls: any[]) => void
) => (globalThis as any).Hooks?.on?.("getHeaderControlsApplicationV2", fn);
const onGetApplicationV1HeaderButtons = (
  fn: (app: AppV1, buttons: V1Button[]) => void
) => (globalThis as any).Hooks?.on?.("getApplicationHeaderButtons", fn);
const onRenderApplicationV1 = (
  fn: (app: AppV1, html: any) => void
) => (globalThis as any).Hooks?.on?.("renderApplication", fn);
const onCloseApplicationV1 = (
  fn: (app: AppV1) => void
) => (globalThis as any).Hooks?.on?.("closeApplication", fn);

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
function isExcludedApp(app: any): boolean {
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
function resolveAppRoot(app: any): HTMLElement | undefined {
  // Prefer V2 window.element when available
  const winEl: any = app?.window?.element;
  if (winEl instanceof HTMLElement) return winEl;

  // Try explicit id lookup (V2 appId is usually the element id)
  const byId = (app?.appId && document.getElementById(String(app.appId)))
    || (app?.id && document.getElementById(String(app.id)));
  if (byId) return byId.closest?.(".app, .application, .window-app, .document-sheet, .sheet") || byId;

  // Fallback to app.element / _element (could be jQuery)
  let el: any = app?.element ?? app?._element;
  if (el && el[0]) el = el[0];
  if (el?.closest) {
    const root = el.closest?.(".app, .application, .window-app, .document-sheet, .sheet");
    if (root) el = root;
  }

  // Last resort: climb from header to the window root
  if (!el && app?.window?.header?.closest) {
    const root2 = app.window.header.closest(".app, .application, .window-app, .document-sheet, .sheet");
    if (root2) el = root2;
  }
  return el as HTMLElement | undefined;
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
  const id = (el as any).id as string | undefined;
  const disallowedIds = new Set(["sidebar", "hotbar", "players", "controls", "navigation"]);
  if (id && disallowedIds.has(id)) return false;
  const forbidden = el.closest?.("#sidebar, #hotbar, #players, #controls, #navigation, .combat-carousel, #combat-carousel");
  if (forbidden) return false;
  return true;
}

// Build a per-window persistent key so we can remember rotation across closes/re-opens
function getPersistKey(app: any): string | undefined {
  try {
    const cls = app?.constructor?.name ?? "Application";
    const doc = app?.document ?? app?.object ?? app?.actor ?? app?.item ?? app?.journal ?? app?.scene;
    const uuid: string | undefined = doc?.uuid ?? doc?._id;
    if (uuid) return `doc:${uuid}`;
    const pack:
      | string
      | undefined = app?.collection?.metadata?.id ?? app?.collection?.collection ?? app?.pack ?? app?.metadata?.id;
    if (pack) return `pack:${pack}`;
    const id: string | number | undefined = app?.id ?? app?.appId ?? app?.options?.id ?? resolveAppRoot(app)?.id;
    if (id !== undefined) return `app:${cls}:${id}`;
    return `app:${cls}`;
  } catch {
    return undefined;
  }
}

function readPersistedRotation(app: any): 0 | 90 | 180 | 270 | undefined {
  const key = getPersistKey(app);
  if (!key) return undefined;
  const raw = localStorage.getItem(`${MOD}:rot:${key}`);
  const n = Number(raw);
  return n === 0 || n === 90 || n === 180 || n === 270 ? (n as any) : undefined;
}

// Normalize a persisted angle for the current mode
function normalizeForMode(deg: number | undefined): 0 | 90 | 180 | 270 | undefined {

  if (deg === undefined) return undefined;
  const mode = rotationMode();
  if (mode === 180) return deg === 0 ? 0 : 180;
  // 90-mode: snap to the closest quarter-turn among 0/90/180/270
  const allowed = [0, 90, 180, 270] as const;
  const best = allowed.reduce((a, b) => (Math.abs((deg ?? 0) - a) <= Math.abs((deg ?? 0) - b) ? a : b));
  return best as any;
}


(globalThis as any).Hooks?.on?.("init", () => {
  registerSettings();
  registerPrintSheetHooks();
  try { Log.setLevel(((globalThis as any).game?.settings?.get(MOD, "logLevel")) as any); } catch {}
  Log.info("init");
});

(globalThis as any).Hooks?.on?.("ready", () => {
  Log.info("ready", {
    core: (globalThis as any).game?.version,
    system: (globalThis as any).game?.system?.id,
    user: (globalThis as any).game?.user?.id,
  });


  // Socket listener: only targeted players act; GMs ignore to avoid affecting DM screen
  try {
    (globalThis as any).game?.socket?.on?.(`module.${MOD}`, (payload: any) => {
      try {
        if (!payload || payload.action !== "rotate") return;
        const myId = (globalThis as any).game?.user?.id;
        const isGM = !!(globalThis as any).game?.user?.isGM;
        if (isGM) return; // never affect GM screen
        const targets: any[] = Array.isArray(payload.userIds) ? payload.userIds : [];
        if (targets.includes(myId)) {
          Log.info("socket: rotate for this client", { mode: payload.mode, dir: payload.dir });
          rotateAll(payload.mode as RotMode, payload.dir as RotDir);
        }
      } catch (e) {
        Log.warn("socket handler error", e);
      }
    });
  } catch {}

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
      (globalThis as any).game?.socket?.emit?.(`module.${MOD}`, {
        action: "rotate",
        userIds: ids,
        mode,
        dir,
      });
    } catch (e) {
      Log.warn("rotateTargets error", e);
    }
  };


  (globalThis as any).fth = {
    setLevel: (lvl: any) => Log.setLevel(lvl),
    version: (globalThis as any).game?.modules?.get(MOD)?.version,
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

  // Ensure world compendium with prebuilt macros (GM only)
  if (((globalThis as any).game?.user as any)?.isGM) {
    (async () => {
      try {
        const CC: any = (globalThis as any).CompendiumCollection;
        const desired = { name: "fth-macros", label: "FTH Macros", type: "Macro", package: "world" };
        const collectionId = `${desired.package}.${desired.name}`;
        // Try by collection id first, then by metadata
        let pack: any = (globalThis as any).game?.packs?.get?.(collectionId)
          ?? (globalThis as any).game?.packs?.find?.((p: any) => p?.metadata?.package === "world"
            && (p?.metadata?.name === desired.name || p?.metadata?.label === desired.label)
            && (p?.documentName === "Macro" || p?.documentName === "macro"));
        if (!pack && CC?.createCompendium) {
          try {
            pack = await CC.createCompendium(desired);
          } catch (err) {
            // If it already exists, fetch it
            Log.info("createCompendium skipped; pack exists, fetching", err);
            pack = (globalThis as any).game?.packs?.get?.(collectionId)
              ?? (globalThis as any).game?.packs?.find?.((p: any) => p?.metadata?.package === "world"
                && p?.metadata?.name === desired.name);
          }
        }
        if (!pack) {
          Log.warn("Could not create or find world macro pack");
        } else {
          const img = "icons/tools/navigation/compass-plain-blue.webp";
          const needed = [
            {
              newName: "Rotate Players 90° (CW)",
              legacy: ["Rotate All 90° (CW)"],
              command: "window.fth.rotateTargets90CW();",
            },
            {
              newName: "Rotate Players 90° (CCW)",
              legacy: ["Rotate All 90° (CCW)"],
              command: "window.fth.rotateTargets90CCW();",
            },
            {
              newName: "Rotate Players 180°",
              legacy: ["Rotate All 180°"],
              command: "window.fth.rotateTargets180();",
            },
            {
              newName: "Rotate Local 90° (CW)",
              legacy: [],
              command: "window.fth.rotateAll90CW();",
            },
            {
              newName: "Rotate Local 90° (CCW)",
              legacy: [],
              command: "window.fth.rotateAll90CCW();",
            },
            {
              newName: "Rotate Local 180°",
              legacy: [],
              command: "window.fth.rotateAll180();",
            },
          ];
          const docs = await pack.getDocuments();
          for (const entry of needed) {
            let existing: any = docs.find((d: any) => d.name === entry.newName)
              ?? docs.find((d: any) => entry.legacy.includes(d.name));
            if (!existing) {
              await pack.documentClass.create({ name: entry.newName, type: "script", img, command: entry.command }, { pack: pack.collection });
            } else {
              const patch: any = { img, type: "script", command: entry.command };
              if (existing.name !== entry.newName) patch.name = entry.newName;
              const needsUpdate = existing?.command !== entry.command || existing?.img !== img || existing?.type !== "script" || patch.name;
              if (needsUpdate) await existing.update(patch, { pack: pack.collection });
            }
          }
          Log.info("FTH macros pack ready (migrated if needed)", { collection: pack.collection });
        }
      } catch (e) {
        Log.warn("macro pack setup failed", e);
      }
    })();
  }

  Log.debug("debug API attached to window.fth and macros registered (if GM)");
});

/* ---------- your rotation hooks (V2) ---------- */
const rotationByAppId = new Map<number, 0 | 90 | 180 | 270>();

// Re-entrancy guard to prevent double toggles from duplicate handlers
const lastToggleByAppId = new Map<number, number>();

// Track currently active apps to support macro-driven rotations across all windows
const activeApps = new Set<any>();

type RotDir = "cw" | "ccw";
const prevRotation = (d: 0 | 90 | 180 | 270) => (d === 0 ? 270 : d === 90 ? 0 : d === 180 ? 90 : 180);


function applyRotation(el: HTMLElement | undefined, deg: 0 | 90 | 180 | 270) {
  if (!el) {

    Log.warn("applyRotation: element missing");
    return;
  }
  const before = { className: el.className, rotation: (el as any).dataset?.fthRotation };
  // Toggle animation class based on setting
  if (animationsEnabled()) el.classList.add("fth-anim"); else el.classList.remove("fth-anim");
  // Apply rotation classes
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (deg === 90) el.classList.add("fth-rot-90");
  if (deg === 180) el.classList.add("fth-rot-180");
  if (deg === 270) el.classList.add("fth-rot-270");
  (el as any).dataset.fthRotation = String(deg);
  Log.debug("applyRotation", { deg, before, after: { className: el.className, rotation: (el as any).dataset?.fthRotation } });
}

function toggleRotation(app: any, opts?: { mode?: RotMode; dir?: RotDir }) {
  const appId: number | undefined = app?.appId ?? app?.id;
  const rootEl = resolveAppRoot(app);
  if (!appId || !rootEl) {
    Log.warn("toggleRotation: missing appId or element", { appId, hasEl: !!rootEl });
    return;
  }
  const now = (globalThis as any).performance?.now?.() ?? Date.now();
  const last = lastToggleByAppId.get(appId);
  if (last && now - last < 50) {
    Log.debug("toggleRotation: ignored duplicate within 50ms", { appId });
    return;
  }
  lastToggleByAppId.set(appId, now);

  const curr = rotationByAppId.get(appId) ?? 0;
  const mode = opts?.mode ?? rotationMode();
  const dir = opts?.dir ?? "cw";
  let next: 0 | 90 | 180 | 270;
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
    } catch {}
  }
  Log.group("fth: toggleRotation");
  Log.debug("app", { ctor: app?.constructor?.name, appId });
  Log.debug("element", { className: rootEl.className, dataset: (rootEl as any).dataset });
  applyRotation(rootEl, next);
  Log.debug("applied", { next, mode, dir });
  Log.groupEnd();
}

onGetHeaderControlsApplicationV2((app, controls) =>
  safe(() => {
    if (isExcludedApp(app)) return;
    (controls as any).unshift?.({
      icon: "fa-solid fa-arrows-rotate",
      label: rotationLabel(),
      action: "fth-rotate",
      visible: true,
      onClick: () => toggleRotation(app as any),
    });
    Log.debug("added V2 header control", {
      app: (app as any)?.constructor?.name,
      appId: (app as any)?.appId,
    });
  }, "getHeaderControlsApplicationV2")
);

(globalThis as any).Hooks?.on?.("renderApplicationV2", (app: AppV2) =>
  safe(() => {
    if (isExcludedApp(app)) return;
    const el = resolveAppRoot(app as any);

    // If the official V2 header control is present, do not bind a DOM handler
    const hasV2Btn = !!el?.querySelector?.('[data-action="fth-rotate"]');
    if (!hasV2Btn) {
      // Inject a fallback rotate control into the header if possible
      const headerControls = el?.querySelector?.('.window-header .controls, .titlebar .controls') ?? null;
      const headerContainer = headerControls ?? el?.querySelector?.('.window-header, .titlebar') ?? null;
      let controlsEl: HTMLElement | null = headerControls as HTMLElement | null;
      if (!controlsEl && headerContainer) {
        // Ensure a controls container exists
        controlsEl = headerContainer.querySelector?.(':scope .controls') as HTMLElement | null;
        if (!controlsEl) {
          controlsEl = document.createElement('div');
          controlsEl.className = 'controls';
          headerContainer.appendChild(controlsEl);
        }
      }
      if (controlsEl && !controlsEl.querySelector?.('[data-action="fth-rotate-dom"]')) {
        const a = document.createElement('a');
        a.className = 'header-control icon fa-solid fa-arrows-rotate';
        (a as any).dataset.action = 'fth-rotate-dom';
        (a as any).title = rotationLabel();
        a.addEventListener('click', () => toggleRotation(app as any));
        controlsEl.appendChild(a);
        Log.debug('injected fallback rotate control', { app: (app as any)?.constructor?.name, appId: (app as any)?.appId });
      }
    } else {
      Log.debug('found V2 header control; not injecting DOM handler', { app: (app as any)?.constructor?.name, appId: (app as any)?.appId });
    }

    const appId = (app as any)?.appId;
    if (isRotatableRoot(el ?? undefined)) activeApps.add(app as any);

    let deg = rotationByAppId.get(appId);
    if (deg === undefined) {
      const p = readPersistedRotation(app as any);

      if (p !== undefined) {
        const norm = normalizeForMode(p);
        deg = norm;
        rotationByAppId.set(appId as any, norm as 0 | 90 | 180 | 270);
      }
    }
    if (deg !== undefined) applyRotation(el ?? undefined, deg);
  }, "renderApplicationV2")
);

(globalThis as any).Hooks?.on?.("closeApplicationV2", (app: AppV2) =>
  safe(() => {
    const id = (app as any)?.appId;
    rotationByAppId.delete(id);
    lastToggleByAppId.delete(id);
    activeApps.delete(app as any);
  }, "closeApplicationV2")
);

/* ---------- optional legacy (V1) behind a toggle ---------- */

onGetApplicationV1HeaderButtons((app, buttons) =>
  safe(() => {
    if (!supportV1()) return;
    buttons.unshift({
      label: rotationLabel(),
      class: "fth-rotate",
      icon: "fa-solid fa-arrows-rotate",
      onclick: () => toggleRotation(app as any),
    });
    Log.debug("added V1 header button", {
      app: (app as any)?.constructor?.name,
      appId: (app as any)?.appId,
    });
  }, "getApplicationV1HeaderButtons")
);

onRenderApplicationV1((app) =>
  safe(() => {
    if (!supportV1()) return;
    const appId = (app as any)?.appId;
    const el2 = resolveAppRoot(app as any);
    if (isRotatableRoot(el2 ?? undefined)) activeApps.add(app as any);

    let deg = rotationByAppId.get(appId);
    if (deg === undefined) {
      const p = readPersistedRotation(app as any);
      if (p !== undefined) {
        const norm = normalizeForMode(p);
        deg = norm;
        rotationByAppId.set(appId as any, norm as 0 | 90 | 180 | 270);
      }
    }
    if (deg !== undefined) applyRotation(resolveAppRoot(app as any), deg);
  }, "renderApplicationV1")
);

onCloseApplicationV1((app) =>
  safe(() => {
    if (!supportV1()) return;
    const id = (app as any)?.appId;
    rotationByAppId.delete(id);
    lastToggleByAppId.delete(id);
    activeApps.delete(app as any);
  }, "closeApplicationV1")
);
