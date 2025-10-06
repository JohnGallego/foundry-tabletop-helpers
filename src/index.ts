import "./styles.css";
import { Log, MOD } from "./logger"; // ⬅️ THIS IMPORT IS REQUIRED

// Small helper so we never break other modules if something throws
function safe(fn: () => void, where: string) {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
}

Hooks.on("init", () => {
  // settings for log level + optional legacy support toggle
  game.settings.register(MOD, "logLevel", {
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

  game.settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows (legacy)",
    hint: "Enable only if you need the rotate button on V1 applications (deprecated since V13).",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  Log.setLevel(game.settings.get(MOD, "logLevel") as any);
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
    version: game.modules.get(MOD)?.version,
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
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (deg === 90) el.classList.add("fth-rot-90");
  if (deg === 180) el.classList.add("fth-rot-180");
  if (deg === 270) el.classList.add("fth-rot-270");
  (el as any).dataset.fthRotation = String(deg);
}

function toggleRotation(app: any) {
  const appId: number | undefined = app?.appId ?? app?.id;
  const el: HTMLElement | undefined =
    app?.element ?? app?._element ?? app?.element?.[0];
  if (!appId || !el) {
    Log.warn("toggleRotation: missing appId or element");
    return;
  }
  const curr = rotationByAppId.get(appId) ?? 0;
  const next = nextRotation(curr);
  rotationByAppId.set(appId, next);
  applyRotation(el, next);
  Log.debug("toggled rotation", { appId, next });
}

Hooks.on("getHeaderControlsApplicationV2", (app: any, controls: any[]) =>
  safe(() => {
    controls.push({
      id: "fth-rotate",
      label: "Rotate 90°",
      icon: "fas fa-undo",
      onclick: () => toggleRotation(app),
    });
    Log.debug("added V2 header control", {
      app: app?.constructor?.name,
      appId: app?.appId,
    });
  }, "getHeaderControlsApplicationV2")
);

Hooks.on("renderApplicationV2", (app: any) =>
  safe(() => {
    const deg = rotationByAppId.get(app?.appId);
    if (deg !== undefined) applyRotation(app?.element, deg);
  }, "renderApplicationV2")
);

Hooks.on("closeApplicationV2", (app: any) =>
  safe(() => {
    rotationByAppId.delete(app?.appId);
  }, "closeApplicationV2")
);

/* ---------- optional legacy (V1) behind a toggle ---------- */
const supportV1 = () => game.settings.get(MOD, "supportV1") as boolean;

Hooks.on("getApplicationV1HeaderButtons", (app: any, buttons: any[]) =>
  safe(() => {
    if (!supportV1()) return;
    buttons.unshift({
      label: "Rotate 90°",
      class: "fth-rotate",
      icon: "fas fa-undo",
      onclick: () => toggleRotation(app),
    });
    Log.debug("added V1 header button", {
      app: app?.constructor?.name,
      appId: app?.appId,
    });
  }, "getApplicationV1HeaderButtons")
);

Hooks.on("renderApplicationV1", (app: any, html: any) =>
  safe(() => {
    if (!supportV1()) return;
    const deg = rotationByAppId.get(app?.appId);
    if (deg !== undefined) applyRotation(html?.[0] as HTMLElement, deg);
  }, "renderApplicationV1")
);

Hooks.on("closeApplicationV1", (app: any) =>
  safe(() => {
    if (!supportV1()) return;
    rotationByAppId.delete(app?.appId);
  }, "closeApplicationV1")
);
