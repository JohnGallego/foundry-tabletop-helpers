import type { LevelUpClassChoice, LevelUpState } from "./level-up-types";
import { ABILITY_KEYS } from "../data/dnd5e-constants";

export interface LevelUpItemOperations {
  featureUuids: string[];
  subclassUuids: string[];
  featUuids: string[];
  spellGrantUuids: string[];
  swappedOutSpellUuids: string[];
}

export function collectLevelUpItemOperations(state: LevelUpState): LevelUpItemOperations {
  const selections = state.selections;

  return {
    featureUuids: selections.features?.acceptedFeatureUuids ?? [],
    subclassUuids: selections.subclass?.uuid ? [selections.subclass.uuid] : [],
    featUuids:
      selections.feats?.choice === "feat" && selections.feats.featUuid
        ? [selections.feats.featUuid]
        : [],
    spellGrantUuids: selections.spells
      ? [
          ...selections.spells.newSpellUuids,
          ...selections.spells.newCantripUuids,
          ...selections.spells.swappedInUuids,
        ]
      : [],
    swappedOutSpellUuids: selections.spells?.swappedOutUuids ?? [],
  };
}

export function buildClassLevelUpdatePayload(currentLevels: number): Record<string, number> {
  return {
    "system.levels": currentLevels + 1,
  };
}

export function prepareMulticlassItemData(itemData: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...itemData };
  delete clone._id;

  if (typeof clone.system === "object" && clone.system !== null) {
    clone.system = {
      ...(clone.system as Record<string, unknown>),
      levels: 1,
    };
  }

  return clone;
}

export function buildHpUpdatePayload(
  current: { value?: number; max?: number } | undefined,
  hpGained: number,
): Record<string, number> {
  const currentMax = current?.max ?? 0;
  const currentValue = current?.value ?? 0;

  return {
    "system.attributes.hp.max": currentMax + hpGained,
    "system.attributes.hp.value": currentValue + hpGained,
  };
}

export function buildAsiUpdatePayload(
  abilities: Record<string, { value?: number }> | undefined,
  selectedAbilityKeys: string[],
): Record<string, number> {
  if (!abilities) return {};

  const updates: Record<string, number> = {};
  const bonus = selectedAbilityKeys.length === 1 ? 2 : 1;

  for (const key of selectedAbilityKeys) {
    if (!ABILITY_KEYS.includes(key as typeof ABILITY_KEYS[number])) continue;
    const current = abilities[key]?.value ?? 10;
    updates[`system.abilities.${key}.value`] = Math.min(current + bonus, 20);
  }

  return updates;
}

export function resolveSpellsToDelete(
  actorItems: Iterable<{ id?: string; type?: string; name?: string }>,
  namesToRemove: ReadonlySet<string>,
): string[] {
  const idsToDelete: string[] = [];

  for (const item of actorItems) {
    if (item.type === "spell" && item.id && item.name && namesToRemove.has(item.name)) {
      idsToDelete.push(item.id);
    }
  }

  return idsToDelete;
}

export function describeClassLevelTarget(
  classChoice: LevelUpClassChoice | undefined,
  currentLevels: number,
): string | null {
  if (!classChoice) return null;

  if (classChoice.mode === "existing") {
    return `${classChoice.className} → Level ${currentLevels + 1}`;
  }

  if (classChoice.mode === "multiclass") {
    return `Multiclassed into ${classChoice.className}`;
  }

  return null;
}
