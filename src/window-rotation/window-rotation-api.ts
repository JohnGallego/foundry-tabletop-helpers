import { Log, MOD } from "../logger";
import { targetUserIds, type RotMode } from "../settings";
import type { AppV2Like } from "./index";
import { isRotatableRoot, resolveAppRoot, type RotDir } from "./window-rotation-helpers";

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

interface BuildWindowRotationApiOptions {
  activeApps: Set<AppV2Like>;
  onToggle: (app: AppV2Like, options: { mode: RotMode; dir: RotDir }) => void;
  emitSocket: (eventName: string, payload: Record<string, unknown>) => void;
}

export function rotateAllWindows(
  activeApps: Set<AppV2Like>,
  onToggle: (app: AppV2Like, options: { mode: RotMode; dir: RotDir }) => void,
  mode: RotMode,
  dir: RotDir = "cw",
): void {
  try {
    Log.info("rotateAll", { mode, dir, count: activeApps.size });
    activeApps.forEach((app) => {
      if (!isRotatableRoot(resolveAppRoot(app))) return;
      onToggle(app, { mode, dir });
    });
  } catch (error) {
    Log.warn("rotateAll error", error);
  }
}

export function rotateTargetWindows(
  emitSocket: (eventName: string, payload: Record<string, unknown>) => void,
  mode: RotMode,
  dir: RotDir = "cw",
): void {
  try {
    const ids = targetUserIds();
    if (!ids.length) {
      Log.warn("rotateTargets: no target users configured");
      return;
    }
    Log.info("rotateTargets emit", { mode, dir, ids });
    emitSocket(`module.${MOD}`, { action: "rotate", userIds: ids, mode, dir });
  } catch (error) {
    Log.warn("rotateTargets error", error);
  }
}

export function buildRotationApi(options: BuildWindowRotationApiOptions): FthRotationApi {
  return {
    rotateAll: (mode, dir = "cw") => rotateAllWindows(options.activeApps, options.onToggle, mode, dir),
    rotateAll90CW: () => rotateAllWindows(options.activeApps, options.onToggle, 90, "cw"),
    rotateAll90CCW: () => rotateAllWindows(options.activeApps, options.onToggle, 90, "ccw"),
    rotateAll180: () => rotateAllWindows(options.activeApps, options.onToggle, 180, "cw"),
    rotateTargets: (mode, dir = "cw") => rotateTargetWindows(options.emitSocket, mode, dir),
    rotateTargets90CW: () => rotateTargetWindows(options.emitSocket, 90, "cw"),
    rotateTargets90CCW: () => rotateTargetWindows(options.emitSocket, 90, "ccw"),
    rotateTargets180: () => rotateTargetWindows(options.emitSocket, 180, "cw"),
  };
}
