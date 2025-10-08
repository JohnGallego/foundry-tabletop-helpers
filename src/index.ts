import "./styles.css";
import { Log, MOD } from "./logger"; // ⬅️ THIS IMPORT IS REQUIRED
import { registerSettings, rotationMode, rotationLabel, animationsEnabled, supportV1, type RotMode } from "./settings";


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
) => (globalThis as any).Hooks?.on?.("getApplicationV1HeaderButtons", fn);
const onRenderApplicationV1 = (
  fn: (app: AppV1, html: any) => void
) => (globalThis as any).Hooks?.on?.("renderApplicationV1", fn);
const onCloseApplicationV1 = (
  fn: (app: AppV1) => void
) => (globalThis as any).Hooks?.on?.("closeApplicationV1", fn);

// Small helper so we never break other modules if something throws
function safe(fn: () => void, where: string) {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
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
  try { Log.setLevel(((globalThis as any).game?.settings?.get(MOD, "logLevel")) as any); } catch {}
  Log.info("init");
});

(globalThis as any).Hooks?.on?.("ready", () => {
  Log.info("ready", {
    core: (globalThis as any).game?.version,
    system: (globalThis as any).game?.system?.id,
    user: (globalThis as any).game?.user?.id,
  });

  // API exposed to macros and console
  const rotateAll = (mode: RotMode, dir: RotDir = "cw") => {
    try {
      const count = activeApps.size;
      Log.info("rotateAll", { mode, dir, count });
      activeApps.forEach((app) => toggleRotation(app, { mode, dir }));
    } catch (e) {
      Log.warn("rotateAll error", e);
    }
  };

  (globalThis as any).fth = {
    setLevel: (lvl: any) => Log.setLevel(lvl),
    version: (globalThis as any).game?.modules?.get(MOD)?.version,
    rotateAll,
    rotateAll90CW: () => rotateAll(90, "cw"),
    rotateAll90CCW: () => rotateAll(90, "ccw"),
    rotateAll180: () => rotateAll(180, "cw"),
  };

  // Ensure world compendium with prebuilt macros (GM only)
  if (((globalThis as any).game?.user as any)?.isGM) {
    (async () => {
      try {
        const CC: any = (globalThis as any).CompendiumCollection;
        const desired = { name: "fth-macros", label: "FTH Macros", type: "Macro", package: "world" };
        let pack: any = (globalThis as any).game?.packs?.find((p: any) => p?.metadata?.package === "world"
          && (p?.metadata?.name === desired.name || p?.metadata?.label === desired.label)
          && p?.documentName === "Macro");
        if (!pack && CC?.createCompendium) {
          pack = await CC.createCompendium(desired);
        }
        if (!pack) {
          Log.warn("Could not create or find world macro pack");
        } else {
          const docs = await pack.getDocuments();
          const needed: Array<[string, string]> = [
            ["Rotate All 90° (CW)", "window.fth?.rotateAll90CW?.();"],
            ["Rotate All 90° (CCW)", "window.fth?.rotateAll90CCW?.();"],
            ["Rotate All 180°", "window.fth?.rotateAll180?.();"],
          ];
          for (const [name, command] of needed) {
            if (!docs.find((d: any) => d.name === name)) {
              await pack.documentClass.create({ name, type: "script", img: "icons/svg/compass.svg", command }, { pack: pack.collection });
            }
          }
          Log.info("FTH macros pack ready", { collection: pack.collection });
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
const nextRotation = (d: 0 | 90 | 180 | 270) => {
  const mode = rotationMode();
  if (mode === 180) return d === 180 ? 0 : 180;
  // 90-mode: 0->90->180->270->0
  return d === 0 ? 90 : d === 90 ? 180 : d === 180 ? 270 : 0;
};


// Re-entrancy guard to prevent double toggles from duplicate handlers
const lastToggleByAppId = new Map<number, number>();

// Track currently active apps to support macro-driven rotations across all windows
const activeApps = new Map<number, any>();

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
    if (appId != null) activeApps.set(appId as any, app as any);

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
    activeApps.delete(id as any);
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

onRenderApplicationV1((app, html) =>
  safe(() => {
    if (!supportV1()) return;
    const appId = (app as any)?.appId;
    if (appId != null) activeApps.set(appId as any, app as any);

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
    activeApps.delete(id as any);
  }, "closeApplicationV1")
);
