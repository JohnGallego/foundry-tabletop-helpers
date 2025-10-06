import "./styles.css";
import { Log, MOD } from "./logger"; // ⬅️ THIS IMPORT IS REQUIRED

type AppV2 = foundry.applications.api.ApplicationV2.Any;
// Legacy ApplicationV1 API
type AppV1 = foundry.appv1.api.Application;

type V1Button = { label?: string; class?: string; icon?: string; onclick?: (e: MouseEvent) => void };

// Strongly-typed wrapper helpers to hook specific events without casting at call sites
const onGetHeaderControlsApplicationV2 = (
  fn: (app: AppV2, controls: any[]) => void
) => (Hooks as any).on("getHeaderControlsApplicationV2", fn);
const onGetApplicationV1HeaderButtons = (
  fn: (app: AppV1, buttons: V1Button[]) => void
) => (Hooks as any).on("getApplicationV1HeaderButtons", fn);
const onRenderApplicationV1 = (
  fn: (app: AppV1, html: JQuery<HTMLElement>) => void
) => (Hooks as any).on("renderApplicationV1", fn);
const onCloseApplicationV1 = (
  fn: (app: AppV1) => void
) => (Hooks as any).on("closeApplicationV1", fn);

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
  let el: any = app?.element ?? app?._element;
  if (el && el[0]) el = el[0];
  if (el?.closest) {
    const root = el.closest?.(".app, .window-app");
    if (root) el = root;
  }
  if (!el && app?.window?.header?.closest) {
    const root2 = app.window.header.closest(".app, .window-app");
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


Hooks.on("init", () => {
  // settings for log level + optional legacy support toggle
  (game!.settings as any).register(MOD, "logLevel", {
    name: "Log Level",
    hint: "Controls verbosity of console logs for Foundry Tabletop Helpers.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      silent: "silent",
      error: "error",
      warn: "warn",
      info: "info",
      debug: "debug",
    },
    default: "info",
    onChange: (v: string) => Log.setLevel(v as any),
  });

  (game!.settings as any).register(MOD, "supportV1", {
    name: "Add header button to V1 windows (legacy)",
    hint: "Enable only if you need the rotate button on V1 applications (deprecated since V13).",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  Log.setLevel((game!.settings as any).get(MOD, "logLevel") as any);
  Log.info("init");
});

Hooks.on("ready", () => {
  Log.info("ready", {
    core: game.version,
    system: game.system?.id,
    user: game.user?.id,
  });

  // Optional: simple debug API in console -> fth.setLevel('debug')
  (globalThis as any).fth = {
    setLevel: (lvl: any) => Log.setLevel(lvl),
    version: game!.modules!.get(MOD)?.version,
  };
  Log.debug("debug API attached to window.fth");
});

/* ---------- your rotation hooks (V2) ---------- */
const rotationByAppId = new Map<number, 0 | 90 | 180 | 270>();
const nextRotation = (d: 0 | 90 | 180 | 270) =>
  d === 0 ? 90 : d === 90 ? 180 : d === 180 ? 270 : 0;

function applyRotation(el: HTMLElement | undefined, deg: 0 | 90 | 180 | 270) {
  if (!el) {
    Log.warn("applyRotation: element missing");
    return;
  }
  const before = { className: el.className, rotation: (el as any).dataset?.fthRotation };
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (deg === 90) el.classList.add("fth-rot-90");
  if (deg === 180) el.classList.add("fth-rot-180");
  if (deg === 270) el.classList.add("fth-rot-270");
  (el as any).dataset.fthRotation = String(deg);
  Log.debug("applyRotation", { deg, before, after: { className: el.className, rotation: (el as any).dataset?.fthRotation } });
}

function toggleRotation(app: any) {
  const appId: number | undefined = app?.appId ?? app?.id;
  const rootEl = resolveAppRoot(app);
  if (!appId || !rootEl) {
    Log.warn("toggleRotation: missing appId or element", { appId, hasEl: !!rootEl });
    return;
  }
  const curr = rotationByAppId.get(appId) ?? 0;
  const next = nextRotation(curr);
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
  Log.debug("applied", { next });
  Log.groupEnd();
}

onGetHeaderControlsApplicationV2((app, controls) =>
  safe(() => {
    (controls as any).unshift?.({
      icon: "fa-solid fa-arrows-rotate",
      label: "Rotate 90°",
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

Hooks.on("renderApplicationV2", (app: AppV2) =>
  safe(() => {
    const el = resolveAppRoot(app as any);
    // Wire our V2 header control action to the toggle handler
    const btn: HTMLElement | null = el?.querySelector?.('[data-action="fth-rotate"]') ?? null;
    if (btn && !(btn as any).dataset?.fthRotateBound) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        toggleRotation(app as any);
      }, { passive: true });
      (btn as any).dataset.fthRotateBound = "1";
    }
    const appId = (app as any)?.appId;
    let deg = rotationByAppId.get(appId);
    if (deg === undefined) {
      const p = readPersistedRotation(app as any);
      if (p !== undefined) {
        deg = p;
        rotationByAppId.set(appId as any, p);
      }
    }
    if (deg !== undefined) applyRotation(el ?? undefined, deg);
  }, "renderApplicationV2")
);

Hooks.on("closeApplicationV2", (app: AppV2) =>
  safe(() => {
    rotationByAppId.delete((app as any)?.appId);
  }, "closeApplicationV2")
);

/* ---------- optional legacy (V1) behind a toggle ---------- */
const supportV1 = () => (game!.settings as any).get(MOD, "supportV1") as boolean;

onGetApplicationV1HeaderButtons((app, buttons) =>
  safe(() => {
    if (!supportV1()) return;
    buttons.unshift({
      label: "Rotate 90°",
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
    let deg = rotationByAppId.get(appId);
    if (deg === undefined) {
      const p = readPersistedRotation(app as any);
      if (p !== undefined) {
        deg = p;
        rotationByAppId.set(appId as any, p);
      }
    }
    if (deg !== undefined) applyRotation(resolveAppRoot(app as any), deg);
  }, "renderApplicationV1")
);

onCloseApplicationV1((app) =>
  safe(() => {
    if (!supportV1()) return;
    rotationByAppId.delete((app as any)?.appId);
  }, "closeApplicationV1")
);
