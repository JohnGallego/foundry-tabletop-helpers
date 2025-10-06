import "./styles.css";

function safe(fn: () => void, where: string) {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
}

// Module namespace id
const MOD = "foundry-tabletop-helpers" as const;

// Track open-window rotation per app instance
const rotationByAppId = new Map<number, 0 | 90 | 180 | 270>();

// Cycle helper
function nextRotation(current: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  switch (current) {
    case 0:
      return 90;
    case 90:
      return 180;
    case 180:
      return 270;
    default:
      return 0;
  }
}

// Apply/remove CSS classes on the root element
function applyRotation(el: HTMLElement, degrees: 0 | 90 | 180 | 270) {
  el.classList.remove("fth-rot-90", "fth-rot-180", "fth-rot-270");
  if (degrees === 90) el.classList.add("fth-rot-90");
  if (degrees === 180) el.classList.add("fth-rot-180");
  if (degrees === 270) el.classList.add("fth-rot-270");
  el.dataset.fthRotation = String(degrees);
}

// Toggle rotation for a given app
function toggleRotation(app: any) {
  const appId: number | undefined = app?.appId ?? app?.id;
  const el: HTMLElement | undefined =
    app?.element ?? app?._element ?? app?.element?.[0];
  if (!appId || !el) return;

  const current = rotationByAppId.get(appId) ?? 0;
  const next = nextRotation(current);
  rotationByAppId.set(appId, next);
  applyRotation(el, next);
}

// When windows close, forget their rotation
function clearOnClose(app: any) {
  const appId: number | undefined = app?.appId ?? app?.id;
  if (appId) rotationByAppId.delete(appId);
}

/* ---------------------------
   HOOKS
---------------------------- */

// Once hooks: init/setup/ready pipeline is standard for all packages. :contentReference[oaicite:4]{index=4}
Hooks.on("init", () => {
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
  Log.setLevel(game.settings.get(MOD, "logLevel") as any);

  game.settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows (legacy)",
    hint: "Enable only if you need the rotate button on V1 applications. V1 is deprecated as of Core V13.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  Log.info("init");
});

Hooks.on("ready", () => {
  Log.info("ready", {
    coreVersion: game.version,
    system: game.system?.id,
    user: game.user?.id,
  });
});

/* ---- Application V2 (v13 UI) ---- */
// Add a dropdown header control (dots menu) entry for every V2 application. :contentReference[oaicite:5]{index=5}
Hooks.on("getHeaderControlsApplicationV2", (app: any, controls: any[]) =>
  safe(() => {
    controls.push({
      id: "fth-rotate",
      label: "Rotate 90°",
      icon: "fas fa-undo",
      onclick: () => {
        Log.debug("rotate click", { appId: app?.appId, app });
        toggleRotation(app);
      },
    });
    Log.debug("added V2 header control", {
      app: app?.constructor?.name,
      id: app?.appId,
    });
  }, "getHeaderControlsApplicationV2")
);

// Keep V2 rotation applied after re-render
Hooks.on("renderApplicationV2", (app: any) =>
  safe(() => {
    const deg = rotationByAppId.get(app?.appId);
    if (deg !== undefined) {
      applyRotation(app.element, deg);
      Log.debug("reapplied rotation", { appId: app?.appId, deg });
    }
  }, "renderApplicationV2")
);

// Clear state on close
Hooks.on("closeApplicationV2", (app: any) =>
  safe(() => {
    rotationByAppId.delete(app?.appId);
    Log.debug("cleared rotation state", { appId: app?.appId });
  }, "closeApplicationV2")
);

/* ---- Legacy Application V1 ---- */

const supportV1 = () => game.settings.get(MOD, "supportV1") as boolean;

// Add a classic inline header button for V1 windows. :contentReference[oaicite:6]{index=6}
if (supportV1()) {
  Hooks.on("getApplicationV1HeaderButtons", (app: any, buttons: any[]) =>
    safe(() => {
      buttons.unshift({
        label: "Rotate 90°",
        class: "fth-rotate",
        icon: "fas fa-undo",
        onclick: () => {
          Log.debug("rotate click (V1)", { appId: app?.appId, app });
          toggleRotation(app);
        },
      });
      Log.debug("added V1 header button", {
        app: app?.constructor?.name,
        id: app?.appId,
      });
    }, "getApplicationV1HeaderButtons")
  );

  Hooks.on("renderApplicationV1", (app: any, html: any) =>
    safe(() => {
      const deg = rotationByAppId.get(app?.appId);
      if (deg !== undefined) applyRotation(html?.[0] as HTMLElement, deg);
    }, "renderApplicationV1")
  );

  Hooks.on("closeApplicationV1", (app: any) =>
    safe(() => {
      rotationByAppId.delete(app?.appId);
    }, "closeApplicationV1")
  );
}
