import "./styles.css";

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
  console.log(`${MOD} | init`);
});

Hooks.on("ready", () => {
  console.log(`${MOD} | ready`);
});

/* ---- Application V2 (v13 UI) ---- */
// Add a dropdown header control (dots menu) entry for every V2 application. :contentReference[oaicite:5]{index=5}
Hooks.on(
  "getHeaderControlsApplicationV2",
  (application: any, controls: any[]) => {
    controls.push({
      id: "fth-rotate",
      label: "Rotate 90°",
      icon: "fas fa-undo", // pick any FA icon available in Foundry
      onclick: () => toggleRotation(application),
    });
  }
);

// Keep V2 rotation applied after re-render
Hooks.on("renderApplicationV2", (application: any) => {
  const appId: number | undefined = application?.appId ?? application?.id;
  const el: HTMLElement | undefined = application?.element;
  if (!appId || !el) return;
  const deg = rotationByAppId.get(appId);
  if (deg !== undefined) applyRotation(el, deg);
});

// Clear state on close
Hooks.on("closeApplicationV2", clearOnClose);

/* ---- Legacy Application V1 ---- */
// Add a classic inline header button for V1 windows. :contentReference[oaicite:6]{index=6}
Hooks.on("getApplicationV1HeaderButtons", (app: any, buttons: any[]) => {
  buttons.unshift({
    label: "Rotate 90°",
    class: "fth-rotate",
    icon: "fas fa-undo",
    onclick: () => toggleRotation(app),
  });
});

// Re-apply rotation after V1 render (jQuery -> HTMLElement)
Hooks.on("renderApplicationV1", (app: any, html: any) => {
  const appId: number | undefined = app?.appId ?? app?.id;
  const el: HTMLElement | undefined =
    (html?.[0] as HTMLElement) ?? app?.element?.[0];
  if (!appId || !el) return;
  const deg = rotationByAppId.get(appId);
  if (deg !== undefined) applyRotation(el, deg);
});

// Clear state on V1 close
Hooks.on("closeApplicationV1", clearOnClose);
