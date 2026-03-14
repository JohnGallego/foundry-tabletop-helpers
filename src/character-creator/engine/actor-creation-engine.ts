/**
 * Character Creator — Actor Creation Engine
 *
 * Assembles all wizard selections into a real dnd5e Actor via
 * Actor.create() + createEmbeddedDocuments(). Assigns player ownership.
 *
 * Rewritten for 2024 PHB rules: species, background (with ASI, origin feat,
 * languages), class skill proficiencies, and separated assembly steps.
 */

import { Log, MOD } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryDocument } from "../../types";
import type { WizardState, PortraitSelection } from "../character-creator-types";
import { ABILITY_KEYS } from "../data/dnd5e-constants";
import type { AbilityKey } from "../character-creator-types";

/* ── Public API ──────────────────────────────────────────── */

/**
 * Create a dnd5e Actor from completed wizard state.
 * Returns the created Actor document, or null on failure.
 */
export async function createCharacterFromWizard(
  state: WizardState,
): Promise<FoundryDocument | null> {
  const sel = state.selections;
  const characterName =
    (sel.review as { characterName?: string } | undefined)?.characterName?.trim() ??
    "New Character";

  try {
    // 1. Create base Actor
    const actorData = {
      name: characterName,
      type: "character" as const,
      system: {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ActorClass = (getGame()?.actors as any)?.documentClass as
      | { create(data: Record<string, unknown>): Promise<FoundryDocument | null> }
      | undefined;
    if (!ActorClass) {
      Log.error("ActorCreationEngine: Actor document class not available");
      return null;
    }

    const actor = await ActorClass.create(actorData);
    if (!actor) {
      Log.error("ActorCreationEngine: Actor.create() returned null");
      return null;
    }

    Log.info(`ActorCreationEngine: Created actor "${characterName}" (${actor.id})`);

    // 2. Apply ability scores + background ASI
    await applyAbilityScores(actor, sel);

    // 3. Collect and embed items (species, background, origin feat, class, subclass, feats, spells)
    await embedItems(actor, sel);

    // 4. Apply proficiencies (background skills + class-chosen skills)
    await applyProficiencies(actor, sel);

    // 5. Apply languages
    await applyLanguages(actor, sel);

    // 6. Upload and apply portrait if generated
    await applyPortrait(actor, sel.portrait, characterName);

    // 7. Set ownership
    await setOwnership(actor);

    // 8. Notify GM via socket
    notifyGMCharacterCreated(characterName, actor.id);

    // 9. Return the created actor
    return actor;
  } catch (err) {
    Log.error("ActorCreationEngine: Failed to create character", err);
    return null;
  }
}

/* ── Step 2: Ability Scores + Background ASI ─────────────── */

async function applyAbilityScores(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const baseScores = sel.abilities?.scores ?? ({} as Partial<Record<AbilityKey, number>>);
  const asiAssignments = sel.background?.asi?.assignments ?? {};

  const abilityUpdates: Record<string, unknown> = {};
  for (const key of ABILITY_KEYS) {
    const base = baseScores[key] ?? 10;
    const bonus = asiAssignments[key] ?? 0;
    abilityUpdates[`system.abilities.${key}.value`] = base + bonus;
  }

  await actor.update(abilityUpdates);
  Log.debug("ActorCreationEngine: Applied ability scores with background ASI");
}

/* ── Step 3: Collect & Embed Items ───────────────────────── */

async function embedItems(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const uuids: string[] = [];

  // Species
  if (sel.species?.uuid) uuids.push(sel.species.uuid);
  // Background
  if (sel.background?.uuid) uuids.push(sel.background.uuid);
  // Origin feat (from background grants or player swap)
  if (sel.originFeat?.uuid) uuids.push(sel.originFeat.uuid);
  // Class
  if (sel.class?.uuid) uuids.push(sel.class.uuid);
  // Subclass (if applicable at starting level)
  if (sel.subclass?.uuid) uuids.push(sel.subclass.uuid);
  // Feat item (if player chose a feat instead of ASI)
  if (sel.feats?.featUuid) uuids.push(sel.feats.featUuid);
  // Spell UUIDs (cantrips + leveled spells)
  for (const uuid of [...(sel.spells?.cantrips ?? []), ...(sel.spells?.spells ?? [])]) {
    uuids.push(uuid);
  }

  // Fetch full documents and convert to plain data
  const items: Record<string, unknown>[] = [];
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (doc) {
      const obj = doc.toObject();
      // Remove _id so Foundry generates a new one
      delete obj._id;
      items.push(obj);
    } else {
      Log.warn(`ActorCreationEngine: Could not resolve UUID ${uuid}`);
    }
  }

  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
    Log.debug(`ActorCreationEngine: Embedded ${items.length} items`);
  }
}

/* ── Step 4: Apply Proficiencies ─────────────────────────── */

async function applyProficiencies(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const skillUpdates: Record<string, unknown> = {};

  // Background-granted skills
  for (const key of sel.background?.grants.skillProficiencies ?? []) {
    skillUpdates[`system.skills.${key}.proficient`] = 1;
  }
  // Class-chosen skills
  for (const key of sel.skills?.chosen ?? []) {
    skillUpdates[`system.skills.${key}.proficient`] = 1;
  }

  if (Object.keys(skillUpdates).length > 0) {
    await actor.update(skillUpdates);
    Log.debug("ActorCreationEngine: Applied skill proficiencies");
  }
}

/* ── Step 5: Apply Languages ─────────────────────────────── */

async function applyLanguages(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const fixed = sel.background?.languages.fixed ?? [];
  const chosen = sel.background?.languages.chosen ?? [];
  const allLanguages = [...fixed, ...chosen];

  if (allLanguages.length > 0) {
    await actor.update({ "system.traits.languages.value": allLanguages });
    Log.debug(`ActorCreationEngine: Applied ${allLanguages.length} languages`);
  }
}

/* ── Step 6: Portrait Upload ─────────────────────────────── */

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

/* ── Step 7: Set Ownership ───────────────────────────────── */

async function setOwnership(actor: FoundryDocument): Promise<void> {
  const userId = getGame()?.userId as string | undefined;
  if (userId) {
    await actor.update({ [`ownership.${userId}`]: 3 }); // OWNER level
    Log.debug(`ActorCreationEngine: Set OWNER permission for user ${userId}`);
  }
}

/* ── Step 8: Notify GM ───────────────────────────────────── */

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

/* ── Utilities ───────────────────────────────────────────── */

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
