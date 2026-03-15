import { Log, MOD } from "../logger";
import { animationsEnabled, rotationMode, type RotMode } from "../settings";
import type { AppV2Like } from "./index";

export type RotDeg = 0 | 90 | 180 | 270;
export type RotDir = "cw" | "ccw";

export function isExcludedApp(app: AppV2Like): boolean {
  const name: string = app?.constructor?.name ?? "";
  if (/HUD$/i.test(name)) return true;
  if (app?.hasFrame === false) return true;
  const excluded = ["SceneNavigation", "Hotbar", "PlayerList", "CombatCarousel"];
  return excluded.includes(name);
}

export function resolveAppRoot(app: AppV2Like): HTMLElement | undefined {
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
    const root = header.closest?.(".app, .application, .window-app, .document-sheet, .sheet") as HTMLElement | null;
    if (root) el = root;
  }

  return el;
}

export function isRotatableRoot(el: HTMLElement | undefined): boolean {
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
  return !forbidden;
}

export function resolveAppId(app: AppV2Like): string | number | undefined {
  if (typeof app?.appId === "number") return app.appId;
  if (typeof app?.id === "string" && app.id) return app.id;
  if (typeof app?.id === "number") return app.id;
  const optionId = app?.options?.id;
  if (typeof optionId === "string" && optionId) return optionId;
  if (typeof optionId === "number") return optionId;
  return undefined;
}

export function getPersistKey(app: AppV2Like): string | undefined {
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
    const id = app?.id ?? app?.appId ?? app?.options?.id ?? resolveAppRoot(app)?.id;
    if (id !== undefined) return `app:${cls}:${id}`;
    return `app:${cls}`;
  } catch {
    return undefined;
  }
}

export function readPersistedRotation(app: AppV2Like): RotDeg | undefined {
  const key = getPersistKey(app);
  if (!key) return undefined;
  const raw = localStorage.getItem(`${MOD}:rot:${key}`);
  const n = Number(raw);
  if (n === 0 || n === 90 || n === 180 || n === 270) return n as RotDeg;
  return undefined;
}

export function prevRotation(deg: RotDeg): RotDeg {
  return deg === 0 ? 270 : deg === 90 ? 0 : deg === 180 ? 90 : 180;
}

export function normalizeForMode(deg: number | undefined): RotDeg | undefined {
  if (deg === undefined) return undefined;
  const mode = rotationMode();
  if (mode === 180) return deg === 0 ? 0 : 180;
  const allowed: readonly RotDeg[] = [0, 90, 180, 270];
  return allowed.reduce((a, b) =>
    Math.abs((deg ?? 0) - a) <= Math.abs((deg ?? 0) - b) ? a : b,
  );
}

export function getNextRotation(curr: RotDeg, mode: RotMode, dir: RotDir): RotDeg {
  if (mode === 180) return curr === 180 ? 0 : 180;
  if (dir === "cw") return curr === 0 ? 90 : curr === 90 ? 180 : curr === 180 ? 270 : 0;
  return prevRotation(curr);
}

export function applyRotation(el: HTMLElement | undefined, deg: RotDeg): void {
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
