import { Log, MOD } from "./logger";

export type RotMode = 90 | 180;

export function registerSettings(): void {
  const G: any = (globalThis as any).game;
  if (!G?.settings) return;

  // Log level
  G.settings.register(MOD, "logLevel", {
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

  // Rotation mode (90/180)
  G.settings.register(MOD, "rotationMode", {
    name: "Rotation",
    hint: "How much each press rotates: 90° steps or 180° flip.",
    scope: "client",
    config: true,
    type: String,
    choices: { "90": "Rotate 90°", "180": "Flip 180°" },
    default: "90",
  });

  // Animations toggle
  G.settings.register(MOD, "enableAnimations", {
    name: "Animations",
    hint: "Enable snappy rotation animations with a polished easing curve.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  // Optional legacy V1 support
  G.settings.register(MOD, "supportV1", {
    name: "Add header button to V1 windows (legacy)",
    hint: "Enable only if you need the Flip 180° button on V1 applications (deprecated since V13).",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
}

export const rotationMode = (): RotMode => {
  try {
    const v = (globalThis as any).game?.settings?.get(MOD, "rotationMode");
    return Number(v) === 180 ? 180 : 90;
  } catch {
    return 90;
  }
};

export const rotationLabel = () => (rotationMode() === 180 ? "Flip 180°" : "Rotate 90°");

export const animationsEnabled = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "enableAnimations"));
  } catch {
    return true;
  }
};

export const supportV1 = (): boolean => {
  try {
    return Boolean((globalThis as any).game?.settings?.get(MOD, "supportV1"));
  } catch {
    return false;
  }
};

