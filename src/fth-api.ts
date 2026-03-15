import { Log, MOD, type Level } from "./logger";
import { openAssetManager } from "./asset-manager/asset-manager-picker";
import { buildCombatApi, type FthCombatApi } from "./combat/combat-init";
import {
  openCharacterCreatorWizard,
  openGMConfigApp,
  openLevelUpWizard,
} from "./character-creator/character-creator-init";
import { getGame } from "./types";
import { buildRotationApi, type FthRotationApi } from "./window-rotation/index";

export interface FthApi extends FthRotationApi, FthCombatApi {
  setLevel: (level: Level) => void;
  version?: string;
  assetManager: () => void;
  characterCreator: () => void;
  characterCreatorConfig: () => void;
  levelUp: (actorId: string) => void;
}

export function buildFthApi(): FthApi {
  const game = getGame();

  return {
    setLevel: (level: Level) => Log.setLevel(level),
    version: game?.modules?.get(MOD)?.version,
    ...buildRotationApi(),
    ...buildCombatApi(),
    assetManager: () => openAssetManager(),
    characterCreator: () => openCharacterCreatorWizard(),
    characterCreatorConfig: () => openGMConfigApp(),
    levelUp: (actorId: string) => openLevelUpWizard(actorId),
  };
}

export function attachFthApi(): FthApi {
  const api = buildFthApi();
  globalThis.window.fth = api;
  return api;
}
