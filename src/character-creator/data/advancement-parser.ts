/**
 * Character Creator — Advancement Parser
 *
 * Parses dnd5e 5.x `system.advancement` arrays from compendium documents
 * to extract grants for backgrounds, class skills, and species traits.
 *
 * Advancement data lives on compendium items (backgrounds, classes, species)
 * and describes what they grant during character creation: ability score
 * improvements, skill/tool/language proficiencies, feat grants, etc.
 */

import type { FoundryDocument } from "../../types";
import { fromUuid } from "../../types";
import type { BackgroundGrants } from "../character-creator-types";
import { ABILITY_KEYS, SKILLS } from "./dnd5e-constants";

/* ── Internal Types ─────────────────────────────────────── */

/** Shape of a single advancement entry in `system.advancement`. */
interface AdvancementEntry {
  type?: string;
  title?: string;
  configuration?: Record<string, unknown>;
}

/* ── Helpers ────────────────────────────────────────────── */

/** Safely extract the advancement array from a Foundry document. */
function getAdvancementArray(doc: FoundryDocument): AdvancementEntry[] {
  const system = doc.system;
  if (!system) return [];
  const adv = system.advancement;
  if (!Array.isArray(adv)) return [];
  return adv as AdvancementEntry[];
}

/** Find an advancement entry by type and optional title substring match. */
function findAdvancement(
  entries: AdvancementEntry[],
  type: string,
  titleContains?: string,
): AdvancementEntry | undefined {
  return entries.find((e) => {
    if (e.type !== type) return false;
    if (titleContains && !(e.title ?? "").toLowerCase().includes(titleContains.toLowerCase())) {
      return false;
    }
    return true;
  });
}

/**
 * Parse a trait grant key into a usable identifier.
 * - `"skills:ins"` -> `"ins"`
 * - `"tool:art:calligrapher"` -> `"art:calligrapher"`
 * - `"languages:standard:common"` -> `"common"`
 * - `"languages:standard:*"` -> `"languages:standard:*"` (kept as-is for pool matching)
 */
function parseGrantKey(key: string): string {
  if (typeof key !== "string") return "";
  if (key.startsWith("skills:")) return key.slice("skills:".length);
  if (key.startsWith("tool:")) return key.slice("tool:".length);
  if (key.startsWith("languages:")) {
    // e.g., "languages:standard:common" -> "common"
    // But for wildcard pools like "languages:standard:*", keep as-is
    const parts = key.split(":");
    const last = parts[parts.length - 1] ?? "";
    if (last === "*") return key; // preserve pool wildcard
    return last;
  }
  return key;
}

/** All 18 skill abbreviation keys. */
const ALL_SKILL_KEYS = Object.keys(SKILLS);

/* ── Background Grants ──────────────────────────────────── */

/**
 * Parse a background document's advancement data into typed grants.
 *
 * Extracts ASI configuration, skill/tool proficiencies, origin feat,
 * and language grants/choices from the `system.advancement` array.
 */
export async function parseBackgroundGrants(doc: FoundryDocument): Promise<BackgroundGrants> {
  const advancements = getAdvancementArray(doc);

  // Defaults for a fully empty/missing advancement array
  const result: BackgroundGrants = {
    skillProficiencies: [],
    toolProficiency: null,
    originFeatUuid: null,
    originFeatName: null,
    originFeatImg: null,
    asiPoints: 0,
    asiCap: 0,
    asiSuggested: [],
    languageGrants: [],
    languageChoiceCount: 0,
    languageChoicePool: [],
  };

  // --- Ability Score Improvement ---
  const asi = findAdvancement(advancements, "AbilityScoreImprovement");
  if (asi?.configuration) {
    const config = asi.configuration;
    result.asiPoints = typeof config.points === "number" ? config.points : 0;
    result.asiCap = typeof config.cap === "number" ? config.cap : 0;

    // `locked` contains abilities NOT suggested — invert to get suggested
    const locked = Array.isArray(config.locked) ? (config.locked as string[]) : [];
    const lockedSet = new Set(locked);
    result.asiSuggested = ABILITY_KEYS.filter((k) => !lockedSet.has(k));
  }

  // --- Skill & Tool Proficiencies ---
  const proficiencies = findAdvancement(advancements, "Trait", "proficiencies");
  if (proficiencies?.configuration) {
    const grants = Array.isArray(proficiencies.configuration.grants)
      ? (proficiencies.configuration.grants as string[])
      : [];

    for (const grant of grants) {
      if (typeof grant !== "string") continue;
      if (grant.startsWith("skills:")) {
        result.skillProficiencies.push(parseGrantKey(grant));
      } else if (grant.startsWith("tool:")) {
        result.toolProficiency = parseGrantKey(grant);
      }
    }
  }

  // --- Origin Feat (ItemGrant) ---
  const featGrant = findAdvancement(advancements, "ItemGrant", "feat");
  if (featGrant?.configuration) {
    const items = Array.isArray(featGrant.configuration.items)
      ? (featGrant.configuration.items as Array<Record<string, unknown>>)
      : [];
    const first = items[0];
    if (first && typeof first.uuid === "string") {
      result.originFeatUuid = first.uuid;
      // Attempt to resolve name/img from the compendium
      try {
        const featDoc = await fromUuid(first.uuid);
        if (featDoc) {
          result.originFeatName = featDoc.name ?? null;
          result.originFeatImg = featDoc.img ?? null;
        }
      } catch {
        // fromUuid may fail in non-Foundry environments; leave name/img null
      }
    }
  }

  // --- Languages ---
  const languages = findAdvancement(advancements, "Trait", "language");
  if (languages?.configuration) {
    const grants = Array.isArray(languages.configuration.grants)
      ? (languages.configuration.grants as string[])
      : [];

    for (const grant of grants) {
      if (typeof grant !== "string") continue;
      const parsed = parseGrantKey(grant);
      if (parsed && !parsed.includes("*")) {
        result.languageGrants.push(parsed);
      }
    }

    const choices = Array.isArray(languages.configuration.choices)
      ? (languages.configuration.choices as Array<Record<string, unknown>>)
      : [];
    const firstChoice = choices[0];
    if (firstChoice) {
      result.languageChoiceCount = typeof firstChoice.count === "number" ? firstChoice.count : 0;
      result.languageChoicePool = Array.isArray(firstChoice.pool)
        ? (firstChoice.pool as string[])
        : [];
    }
  }

  return result;
}

/* ── Class Skill Advancement ────────────────────────────── */

/**
 * Parse a class document's skill proficiency advancement.
 *
 * Returns the pool of choosable skills and how many to pick.
 * Falls back to all skills / 2 choices if the advancement is missing.
 */
export function parseClassSkillAdvancement(
  doc: FoundryDocument,
): { skillPool: string[]; skillCount: number } {
  const advancements = getAdvancementArray(doc);
  const fallback = { skillPool: ALL_SKILL_KEYS, skillCount: 2 };

  const skillAdv = advancements.find((e) => {
    if (e.type !== "Trait") return false;
    if (e.title !== "Skill Proficiencies") return false;
    const mode = e.configuration?.mode;
    return mode === "default" || mode === undefined;
  });

  if (!skillAdv?.configuration) return fallback;

  const choices = Array.isArray(skillAdv.configuration.choices)
    ? (skillAdv.configuration.choices as Array<Record<string, unknown>>)
    : [];
  const firstChoice = choices[0];
  if (!firstChoice) return fallback;

  const count = typeof firstChoice.count === "number" ? firstChoice.count : 2;
  const pool = Array.isArray(firstChoice.pool) ? (firstChoice.pool as string[]) : [];

  // Convert pool entries: "skills:ath" -> "ath", "skills:*" -> all skill keys
  const skillPool: string[] = [];
  for (const entry of pool) {
    if (typeof entry !== "string") continue;
    if (entry === "skills:*") {
      return { skillPool: ALL_SKILL_KEYS, skillCount: count };
    }
    const key = parseGrantKey(entry);
    if (key) skillPool.push(key);
  }

  if (skillPool.length === 0) return fallback;
  return { skillPool, skillCount: count };
}

/* ── Species Traits ─────────────────────────────────────── */

/**
 * Extract display-friendly trait names from a species document.
 *
 * Collects the `title` from all `ItemGrant` advancements,
 * which represent the species' racial traits (e.g., "Darkvision", "Fey Ancestry").
 */
export function parseSpeciesTraits(doc: FoundryDocument): string[] {
  const advancements = getAdvancementArray(doc);
  const traits: string[] = [];

  for (const entry of advancements) {
    if (entry.type === "ItemGrant" && typeof entry.title === "string" && entry.title.length > 0) {
      traits.push(entry.title);
    }
  }

  return traits;
}
