import type { AdvancementEntry, ClassItemInfo } from "./level-up-types";

const LEVEL1_SUBCLASS_CLASSES = new Set(["cleric", "sorcerer", "warlock"]);
const LEVEL2_SUBCLASS_CLASSES = new Set(["druid", "wizard"]);
const STANDARD_ASI_LEVELS = new Set([4, 8, 12, 16, 19]);
const FIGHTER_EXTRA_ASI_LEVELS = new Set([6, 14]);
const ROGUE_EXTRA_ASI_LEVELS = new Set([10]);

export function extractActorTotalLevel(actor: { system?: Record<string, unknown> }): number {
  const details = actor.system?.details as Record<string, unknown> | undefined;
  const level = details?.level;
  return typeof level === "number" ? level : 0;
}

export function normalizeLevelUpAdvancement(raw: unknown[]): AdvancementEntry[] {
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      type: typeof entry.type === "string" ? entry.type : "",
      level: typeof entry.level === "number" ? entry.level : undefined,
      configuration: typeof entry.configuration === "object" ? entry.configuration as Record<string, unknown> : undefined,
      title: typeof entry.title === "string" ? entry.title : undefined,
    }));
}

export function extractClassAdvancement(sys: Record<string, unknown>): AdvancementEntry[] {
  const advancement = sys.advancement;
  if (Array.isArray(advancement)) return normalizeLevelUpAdvancement(advancement);

  const collectionLike = advancement as { contents?: unknown[]; _source?: unknown[] } | undefined;
  if (Array.isArray(collectionLike?.contents)) return normalizeLevelUpAdvancement(collectionLike.contents);
  if (Array.isArray(collectionLike?._source)) return normalizeLevelUpAdvancement(collectionLike._source);
  return [];
}

export function findLevelUpSubclassName(
  items: Iterable<{ type?: string; name?: string; system?: Record<string, unknown> }>,
  classIdentifier: string,
): string | undefined {
  for (const item of items) {
    if (item.type !== "subclass") continue;
    if (item.system?.classIdentifier === classIdentifier) {
      return item.name;
    }
  }
  return undefined;
}

export function buildLevelUpClassItems(
  items: Iterable<{
    id?: string;
    _id?: string;
    type?: string;
    name?: string;
    system?: Record<string, unknown>;
  }>,
): ClassItemInfo[] {
  const classItems: ClassItemInfo[] = [];

  for (const item of items) {
    if (item.type !== "class") continue;

    const sys = item.system;
    if (!sys) continue;

    const levels = typeof sys.levels === "number" ? sys.levels : 0;
    const identifier = typeof sys.identifier === "string" ? sys.identifier : item.name?.toLowerCase() ?? "";
    const hitDie = typeof sys.hitDice === "string" ? sys.hitDice : "d8";

    classItems.push({
      itemId: item.id ?? item._id ?? "",
      name: item.name ?? "Unknown Class",
      identifier,
      levels,
      hitDie,
      subclassName: findLevelUpSubclassName(items, identifier),
      advancement: extractClassAdvancement(sys),
    });
  }

  return classItems;
}

export function isLevelUpAsiLevel(classIdentifier: string, classLevel: number): boolean {
  if (STANDARD_ASI_LEVELS.has(classLevel)) return true;
  if (classIdentifier === "fighter" && FIGHTER_EXTRA_ASI_LEVELS.has(classLevel)) return true;
  if (classIdentifier === "rogue" && ROGUE_EXTRA_ASI_LEVELS.has(classLevel)) return true;
  return false;
}

export function isLevelUpSubclassLevel(classIdentifier: string, classLevel: number): boolean {
  if (LEVEL1_SUBCLASS_CLASSES.has(classIdentifier) && classLevel === 1) return true;
  if (LEVEL2_SUBCLASS_CLASSES.has(classIdentifier) && classLevel === 2) return true;
  return classLevel === 3;
}
