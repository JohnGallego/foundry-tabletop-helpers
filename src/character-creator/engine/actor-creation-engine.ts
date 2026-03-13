/**
 * Character Creator — Actor Creation Engine
 *
 * Assembles all wizard selections into a real dnd5e Actor via
 * Actor.create() + createEmbeddedDocuments(). Assigns player ownership.
 */

import { Log, MOD } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryDocument } from "../../types";
import type { WizardState, PortraitSelection } from "../character-creator-types";
import { ABILITY_KEYS, abilityModifier } from "../data/dnd5e-constants";

/* ── Types ───────────────────────────────────────────────── */

interface ActorCreateData {
  name: string;
  type: "character";
  img?: string;
  system: Record<string, unknown>;
  items?: Record<string, unknown>[];
  ownership?: Record<string, number>;
}

/* ── Public API ──────────────────────────────────────────── */

/**
 * Create a dnd5e Actor from completed wizard state.
 * Returns the created Actor document, or null on failure.
 */
export async function createCharacterFromWizard(
  state: WizardState,
): Promise<FoundryDocument | null> {
  const sel = state.selections;
  const reviewData = sel.review as { characterName?: string } | undefined;
  const characterName = reviewData?.characterName?.trim();

  if (!characterName) {
    Log.error("ActorCreationEngine: No character name provided");
    return null;
  }

  try {
    // 1. Build base actor data
    const actorData = buildActorData(state, characterName);

    // 2. Create the actor
    const ActorClass = getActorClass();
    if (!ActorClass) {
      Log.error("ActorCreationEngine: Actor class not available");
      return null;
    }

    const actor = await ActorClass.create(actorData);
    if (!actor) {
      Log.error("ActorCreationEngine: Actor.create() returned null");
      return null;
    }

    Log.info(`ActorCreationEngine: Created actor "${characterName}" (${actor.id})`);

    // 3. Add embedded items (class, subclass, background, race, feats, spells)
    const items = await collectItems(state);
    if (items.length > 0) {
      await actor.createEmbeddedDocuments("Item", items);
      Log.debug(`ActorCreationEngine: Added ${items.length} items`);
    }

    // 4. Upload and apply portrait if generated
    await applyPortrait(actor, sel.portrait, characterName);

    // 5. Assign ownership to current user's character
    await assignOwnership(actor);

    // 6. Notify GM via socket
    notifyGMCharacterCreated(characterName, actor.id);

    return actor;
  } catch (err) {
    Log.error("ActorCreationEngine: Failed to create character", err);
    return null;
  }
}

/* ── Internal Helpers ────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActorClass(): { create(data: ActorCreateData): Promise<FoundryDocument | null> } | null {
  const g = globalThis as Record<string, unknown>;
  const cfg = g.CONFIG as Record<string, unknown> | undefined;
  const ActorCls = (cfg?.Actor as Record<string, unknown> | undefined)?.documentClass;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ActorCls as any ?? null;
}

function buildActorData(state: WizardState, name: string): ActorCreateData {
  const sel = state.selections;
  const scores = sel.abilities?.scores;

  // Build ability scores object
  const abilities: Record<string, { value: number }> = {};
  for (const key of ABILITY_KEYS) {
    const baseScore = scores?.[key] ?? 10;

    // Apply ASI bonuses
    let bonus = 0;
    if (sel.feats?.choice === "asi" && sel.feats.asiAbilities?.includes(key)) {
      bonus = sel.feats.asiAbilities.length === 1 ? 2 : 1;
    }

    abilities[key] = { value: Math.min(baseScore + bonus, 20) };
  }

  // Build skills object
  const skills: Record<string, { value: number }> = {};
  for (const skillKey of sel.skills?.chosen ?? []) {
    skills[skillKey] = { value: 1 }; // 1 = proficient
  }

  // Build HP
  const conMod = abilityModifier(scores?.con ?? 10);
  // HP will be set more accurately after class item is added, but set a baseline
  const baseHp = 10 + conMod; // Default; real value comes from class hit die

  // Build currency
  const currency: Record<string, number> = {};
  if (sel.equipment?.method === "gold") {
    currency.gp = sel.equipment.goldAmount ?? 0;
  }

  const data: ActorCreateData = {
    name,
    type: "character",
    img: getPortraitPath(sel.portrait) ?? sel.race?.img ?? sel.class?.img ?? "icons/svg/mystery-man.svg",
    system: {
      abilities,
      attributes: {
        hp: { value: baseHp, max: baseHp },
      },
      details: {
        level: state.config.startingLevel,
        xp: { value: 0 },
      },
      skills,
      currency,
    },
  };

  // Set ownership for the current user
  const game = getGame();
  const userId = game?.userId as string | undefined;
  if (userId) {
    data.ownership = { [userId]: 3, default: 0 }; // 3 = OWNER
  }

  return data;
}

/**
 * Collect all compendium items to add to the actor.
 * Fetches full documents from UUIDs selected during the wizard.
 */
async function collectItems(state: WizardState): Promise<Record<string, unknown>[]> {
  const sel = state.selections;
  const uuids: string[] = [];

  // Class
  if (sel.class?.uuid) uuids.push(sel.class.uuid);

  // Subclass
  if (sel.subclass?.uuid) uuids.push(sel.subclass.uuid);

  // Race
  if (sel.race?.uuid) uuids.push(sel.race.uuid);

  // Background
  if (sel.background?.uuid) uuids.push(sel.background.uuid);

  // Feat
  if (sel.feats?.choice === "feat" && sel.feats.featUuid) {
    uuids.push(sel.feats.featUuid);
  }

  // Spells (cantrips + leveled)
  if (sel.spells) {
    uuids.push(...sel.spells.cantrips);
    uuids.push(...sel.spells.spells);
  }

  // Fetch full documents and convert to plain data
  const items: Record<string, unknown>[] = [];
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (doc) {
      // toObject() gives a plain data copy suitable for createEmbeddedDocuments
      const obj = doc.toObject();
      // Remove _id so Foundry generates a new one
      delete obj._id;
      items.push(obj);
    }
  }

  return items;
}

/**
 * Assign OWNER permission to the current user on the created actor.
 * Also sets the user's character to this actor if they don't have one.
 */
async function assignOwnership(actor: FoundryDocument): Promise<void> {
  const game = getGame();
  if (!game) return;

  const userId = game.userId as string | undefined;
  if (!userId) return;

  // Ensure OWNER permission
  if (!actor.ownership || actor.ownership[userId] !== 3) {
    await actor.update({ [`ownership.${userId}`]: 3 });
  }

  // If the user doesn't have a character assigned, assign this one
  const user = game.user;
  const currentCharacter = user?.character;
  if (!currentCharacter) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (user as any)?.update?.({ character: actor.id });
      Log.info(`ActorCreationEngine: Assigned character to user ${userId}`);
    } catch {
      // Not critical — user can assign manually
      Log.debug("ActorCreationEngine: Could not auto-assign character to user");
    }
  }
}

/**
 * Get the portrait path if it's an uploaded file (not a data URL).
 * Data URLs are handled separately via upload.
 */
function getPortraitPath(portrait?: PortraitSelection): string | null {
  if (!portrait?.portraitDataUrl) return null;
  // If it's a regular file path (uploaded via FilePicker), use directly
  if (!portrait.portraitDataUrl.startsWith("data:")) {
    return portrait.portraitDataUrl;
  }
  return null; // Data URLs handled by applyPortrait after actor creation
}

/**
 * Upload a generated portrait (data URL) to Foundry and update the actor's img.
 */
async function applyPortrait(
  actor: FoundryDocument,
  portrait: PortraitSelection | undefined,
  characterName: string,
): Promise<void> {
  if (!portrait?.portraitDataUrl) return;

  // If it's already a file path (uploaded via FilePicker), update the actor img
  if (!portrait.portraitDataUrl.startsWith("data:")) {
    await actor.update({ img: portrait.portraitDataUrl });
    if (portrait.tokenDataUrl && !portrait.tokenDataUrl.startsWith("data:")) {
      await actor.update({ "prototypeToken.texture.src": portrait.tokenDataUrl });
    }
    return;
  }

  // Convert data URL to a File for upload
  try {
    const blob = dataUrlToBlob(portrait.portraitDataUrl);
    if (!blob) return;

    const safeName = characterName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const fileName = `${safeName}-portrait.webp`;
    const file = new File([blob], fileName, { type: "image/webp" });

    // Upload via Foundry's FilePicker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FP = (globalThis as any).FilePicker;
    if (!FP?.upload) {
      Log.warn("ActorCreationEngine: FilePicker.upload not available");
      return;
    }

    const result = await FP.upload("data", "portraits", file, {});
    const uploadedPath = result?.path;
    if (uploadedPath) {
      await actor.update({
        img: uploadedPath,
        "prototypeToken.texture.src": uploadedPath,
      });
      Log.info(`ActorCreationEngine: Portrait uploaded to ${uploadedPath}`);
    }
  } catch (err) {
    // Not critical — portrait can be set manually later
    Log.warn("ActorCreationEngine: Failed to upload portrait", err);
  }
}

/**
 * Emit a socket message + UI notification when a player creates a character.
 * GM sees a notification; other clients can react if needed.
 */
function notifyGMCharacterCreated(characterName: string, actorId: string): void {
  try {
    const game = getGame();
    if (!game) return;

    const userName = game.user?.name ?? "A player";

    // Socket emit for GM notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socket = (game as any).socket;
    socket?.emit?.(`module.${MOD}`, {
      action: "characterCreated",
      characterName,
      actorId,
      userName,
    });

    // Also show a local notification (for the creating player)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = (globalThis as any).ui;
    ui?.notifications?.info?.(`${characterName} has been created!`);
  } catch {
    // Non-critical — don't let notification failure block creation
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(",");
    if (!header || !base64) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] ?? "image/webp";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}
