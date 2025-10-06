export const MOD = "foundry-tabletop-helpers";

export type Level = "silent" | "error" | "warn" | "info" | "debug";
let currentLevel: Level = "info";

const prefix = () => [`%c${MOD}`, "color:#7c3aed;font-weight:700", "|"];

export const Log = {
  setLevel(level: Level) {
    currentLevel = level;
  },
  error(...args: any[]) {
    if (["error", "warn", "info", "debug"].includes(currentLevel))
      console.error(...prefix(), ...args);
  },
  warn(...args: any[]) {
    if (["warn", "info", "debug"].includes(currentLevel))
      console.warn(...prefix(), ...args);
  },
  info(...args: any[]) {
    if (["info", "debug"].includes(currentLevel))
      console.info(...prefix(), ...args);
  },
  debug(...args: any[]) {
    if (["debug"].includes(currentLevel)) console.debug(...prefix(), ...args);
  },
  group(label: string) {
    if (["debug"].includes(currentLevel))
      console.groupCollapsed(...prefix(), label);
  },
  groupEnd() {
    if (["debug"].includes(currentLevel)) console.groupEnd();
  },
};
