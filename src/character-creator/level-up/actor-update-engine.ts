/**
 * Level-Up Manager — Actor Update Engine
 *
 * Applies level-up selections to an existing actor.
 * Unlike ActorCreationEngine, this updates — not creates.
 */

import { Log } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryDocument } from "../../types";
import type { LevelUpState, LevelUpClassChoice } from "./level-up-types";
import { ABILITY_KEYS } from "../data/dnd5e-constants";

/* ── Public API ──────────────────────────────────────────── */

/**
 * Apply level-up changes to an existing actor.
 * Returns true on success.
 */
export async function applyLevelUp(state: LevelUpState): Promise<boolean> {
  const actor = getActorById(state.actorId);
  if (!actor) {
    Log.error("ActorUpdateEngine: Actor not found", { actorId: state.actorId });
    return false;
  }

  const sel = state.selections;

  try {
    // 1. Update class levels
    await updateClassLevels(actor, sel.classChoice);

    // 2. Update HP
    if (sel.hp) {
      await updateHp(actor, sel.hp.hpGained);
    }

    // 3. Grant features
    if (sel.features && sel.features.acceptedFeatureUuids.length > 0) {
      await grantItems(actor, sel.features.acceptedFeatureUuids);
    }

    // 4. Grant subclass
    if (sel.subclass?.uuid) {
      await grantItems(actor, [sel.subclass.uuid]);
    }

    // 5. Apply ASI or grant feat
    if (sel.feats) {
      if (sel.feats.choice === "asi" && sel.feats.asiAbilities) {
        await applyAsi(actor, sel.feats.asiAbilities);
      } else if (sel.feats.choice === "feat" && sel.feats.featUuid) {
        await grantItems(actor, [sel.feats.featUuid]);
      }
    }

    // 6. Grant new spells
    if (sel.spells) {
      const newUuids = [
        ...sel.spells.newSpellUuids,
        ...sel.spells.newCantripUuids,
        ...sel.spells.swappedInUuids,
      ];
      if (newUuids.length > 0) {
        await grantItems(actor, newUuids);
      }

      // Remove swapped-out spells
      if (sel.spells.swappedOutUuids.length > 0) {
        await removeSpells(actor, sel.spells.swappedOutUuids);
      }
    }

    Log.info(`ActorUpdateEngine: Level-up complete for "${actor.name}" → Level ${state.targetLevel}`);
    return true;
  } catch (err) {
    Log.error("ActorUpdateEngine: Failed to apply level-up", err);
    return false;
  }
}

/* ── Internal Helpers ────────────────────────────────────── */

function getActorById(id: string): FoundryDocument | null {
  const game = getGame();
  if (!game?.actors) return null;
  return game.actors.get(id) ?? null;
}

/**
 * Update class item levels (or add new class for multiclass).
 */
async function updateClassLevels(
  actor: FoundryDocument,
  classChoice?: LevelUpClassChoice,
): Promise<void> {
  if (!classChoice) return;

  if (classChoice.mode === "existing" && classChoice.classItemId) {
    // Increment levels on existing class item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (actor as any).items;
    const classItem = items?.get?.(classChoice.classItemId);
    if (classItem) {
      const currentLevels = classItem.system?.levels ?? 0;
      await classItem.update({ "system.levels": currentLevels + 1 });
      Log.debug(`ActorUpdateEngine: ${classChoice.className} → Level ${currentLevels + 1}`);
    }
  } else if (classChoice.mode === "multiclass" && classChoice.newClassUuid) {
    // Add new class item from compendium
    const doc = await fromUuid(classChoice.newClassUuid);
    if (doc) {
      const obj = doc.toObject();
      delete obj._id;
      // Set initial level to 1
      if (typeof obj.system === "object" && obj.system !== null) {
        (obj.system as Record<string, unknown>).levels = 1;
      }
      await actor.createEmbeddedDocuments("Item", [obj]);
      Log.debug(`ActorUpdateEngine: Multiclassed into ${classChoice.className}`);
    }
  }
}

/**
 * Update actor HP (add hpGained to max and current).
 */
async function updateHp(actor: FoundryDocument, hpGained: number): Promise<void> {
  const system = actor.system as Record<string, unknown> | undefined;
  const attrs = system?.attributes as Record<string, unknown> | undefined;
  const hp = attrs?.hp as { value?: number; max?: number } | undefined;

  const currentMax = hp?.max ?? 0;
  const currentVal = hp?.value ?? 0;

  await actor.update({
    "system.attributes.hp.max": currentMax + hpGained,
    "system.attributes.hp.value": currentVal + hpGained,
  });

  Log.debug(`ActorUpdateEngine: HP ${currentMax} → ${currentMax + hpGained}`);
}

/**
 * Grant items from compendium UUIDs.
 */
async function grantItems(actor: FoundryDocument, uuids: string[]): Promise<void> {
  const items: Record<string, unknown>[] = [];
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (doc) {
      const obj = doc.toObject();
      delete obj._id;
      items.push(obj);
    }
  }
  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
    Log.debug(`ActorUpdateEngine: Granted ${items.length} items`);
  }
}

/**
 * Apply Ability Score Improvement.
 * If 1 ability selected: +2. If 2 abilities: +1 each.
 */
async function applyAsi(actor: FoundryDocument, abilities: string[]): Promise<void> {
  const system = actor.system as Record<string, unknown> | undefined;
  const actorAbilities = system?.abilities as Record<string, { value?: number }> | undefined;
  if (!actorAbilities) return;

  const updates: Record<string, number> = {};
  const bonus = abilities.length === 1 ? 2 : 1;

  for (const key of abilities) {
    if (!ABILITY_KEYS.includes(key as typeof ABILITY_KEYS[number])) continue;
    const current = actorAbilities[key]?.value ?? 10;
    updates[`system.abilities.${key}.value`] = Math.min(current + bonus, 20);
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
    Log.debug(`ActorUpdateEngine: Applied ASI`, updates);
  }
}

/**
 * Remove spells that were swapped out.
 * Finds spells on the actor by matching name against compendium originals.
 */
async function removeSpells(actor: FoundryDocument, uuids: string[]): Promise<void> {
  // Resolve the names of spells to remove
  const namesToRemove = new Set<string>();
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (doc?.name) namesToRemove.add(doc.name);
  }

  if (namesToRemove.size === 0) return;

  // Find matching items on the actor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (actor as any).items;
  if (!items) return;

  const idsToDelete: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of items) {
    if (item.type === "spell" && namesToRemove.has(item.name)) {
      idsToDelete.push(item.id);
    }
  }

  if (idsToDelete.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (actor as any).deleteEmbeddedDocuments("Item", idsToDelete);
    Log.debug(`ActorUpdateEngine: Removed ${idsToDelete.length} swapped-out spells`);
  }
}
