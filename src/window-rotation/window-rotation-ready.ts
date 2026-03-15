import { Log, MOD } from "../logger";
import { getCompendiumCollectionClass, isGM } from "../types";
import type { FoundryGame } from "../types/foundry";
import type { RotMode } from "../settings";
import type { RotDir } from "./window-rotation-helpers";

export interface PackLike {
  collection: string;
  documentClass: { create: (data: Record<string, unknown>, opts: Record<string, unknown>) => Promise<unknown> };
  getDocuments: () => Promise<MacroDocLike[]>;
}

export interface MacroDocLike {
  name?: string;
  command?: string;
  img?: string;
  type?: string;
  update: (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<void>;
}

interface PackCandidate extends PackLike {
  metadata?: { package?: string; name?: string; label?: string };
  documentName?: string;
}

export interface RotatePayload {
  action: string;
  userIds?: string[];
  mode?: RotMode;
  dir?: RotDir;
}

export function getWindowRotationMacroEntries() {
  return [
    { newName: "Rotate Players 90° (CW)", legacy: ["Rotate All 90° (CW)"], command: "window.fth.rotateTargets90CW();" },
    { newName: "Rotate Players 90° (CCW)", legacy: ["Rotate All 90° (CCW)"], command: "window.fth.rotateTargets90CCW();" },
    { newName: "Rotate Players 180°", legacy: ["Rotate All 180°"], command: "window.fth.rotateTargets180();" },
    { newName: "Rotate Local 90° (CW)", legacy: [] as string[], command: "window.fth.rotateAll90CW();" },
    { newName: "Rotate Local 90° (CCW)", legacy: [] as string[], command: "window.fth.rotateAll90CCW();" },
    { newName: "Rotate Local 180°", legacy: [] as string[], command: "window.fth.rotateAll180();" },
  ];
}

export async function syncWindowRotationMacros(pack: PackLike, img: string): Promise<void> {
  const docs = await pack.getDocuments();
  for (const entry of getWindowRotationMacroEntries()) {
    const existing =
      docs.find((d) => d.name === entry.newName) ??
      docs.find((d) => d.name && entry.legacy.includes(d.name));
    if (!existing) {
      await pack.documentClass.create(
        { name: entry.newName, type: "script", img, command: entry.command },
        { pack: pack.collection },
      );
      continue;
    }

    const patch: Record<string, unknown> = { img, type: "script", command: entry.command };
    if (existing.name !== entry.newName) patch.name = entry.newName;
    const needsUpdate = existing.command !== entry.command || existing.img !== img || existing.type !== "script" || patch.name;
    if (needsUpdate) await existing.update(patch, { pack: pack.collection });
  }
}

function findPack(
  packs: Map<string, unknown> | undefined,
  predicate: (pack: PackCandidate) => boolean,
): PackLike | undefined {
  if (!packs) return undefined;
  for (const entry of packs.values()) {
    const pack = entry as PackCandidate;
    if (predicate(pack)) return pack;
  }
  return undefined;
}

export async function setupWindowRotationMacroPack(game: FoundryGame | undefined): Promise<void> {
  try {
    const collectionClass = getCompendiumCollectionClass();
    const desired = { name: "fth-macros", label: "FTH Macros", type: "Macro", package: "world" };
    const collectionId = `${desired.package}.${desired.name}`;
    const packs = game?.packs as Map<string, unknown> | undefined;

    let pack: PackLike | undefined =
      (packs?.get?.(collectionId) as PackLike | undefined) ??
      findPack(packs, (candidate) =>
        candidate.metadata?.package === "world" &&
        (candidate.metadata?.name === desired.name || candidate.metadata?.label === desired.label) &&
        (candidate.documentName === "Macro" || candidate.documentName === "macro"),
      );

    if (!pack && collectionClass?.createCompendium) {
      try {
        pack = (await collectionClass.createCompendium(desired)) as PackLike | undefined;
      } catch (err) {
        Log.info("createCompendium skipped; pack exists, fetching", err);
        pack =
          (packs?.get?.(collectionId) as PackLike | undefined) ??
          findPack(packs, (candidate) => candidate.metadata?.name === desired.name);
      }
    }

    if (!pack) {
      Log.warn("Could not create or find world macro pack");
      return;
    }

    await syncWindowRotationMacros(pack, "icons/tools/navigation/compass-plain-blue.webp");
    Log.info("FTH macros pack ready (migrated if needed)", { collection: pack.collection });
  } catch (error) {
    Log.warn("macro pack setup failed", error);
  }
}

export function registerWindowRotationSocket(
  game: FoundryGame | undefined,
  onRotate: (mode: RotMode, dir: RotDir) => void,
): void {
  try {
    game?.socket?.on?.(`module.${MOD}`, (payload: unknown) => {
      try {
        const parsed = payload as RotatePayload | undefined;
        if (!parsed || parsed.action !== "rotate") return;
        if (isGM()) return;
        const myId = game?.user?.id;
        const targets = Array.isArray(parsed.userIds) ? parsed.userIds : [];
        if (myId && targets.includes(myId)) {
          Log.info("socket: rotate for this client", { mode: parsed.mode, dir: parsed.dir });
          onRotate(parsed.mode as RotMode, (parsed.dir as RotDir | undefined) ?? "cw");
        }
      } catch (error) {
        Log.warn("socket handler error", error);
      }
    });
  } catch {
    /* socket not available in this context */
  }
}
