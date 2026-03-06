/**
 * LPCS View Model builder.
 * Sole bridge between dnd5e actor data and LPCS Handlebars templates.
 * Templates must never access actor.system directly — only use the returned view model.
 *
 * Reuses extraction helpers from the existing print-sheet feature where possible.
 *
 * @see src/print-sheet/extractors/dnd5e-extract-helpers.ts
 */

import type {
  LPCSViewModel, LPCSHitPoints, LPCSAbility, LPCSSave, LPCSSkill,
  LPCSSense, LPCSWeapon, LPCSAction, LPCSSpellcasting, LPCSSpellSlotLevel,
  LPCSSpellLevel, LPCSSpell, LPCSInventoryItem, LPCSEncumbrance,
  LPCSFeature, LPCSFeatureGroup, LPCSTraitGroup, LPCSProficiencies, LPCSHitDice, LPCSSpeed,
  LPCSHitDiceSummary, LPCSCombatSpell, LPCSCombatGroup, LPCSStandardAction,
  LPCSWeaponSubGroup, LPCSEffectAnnotation, LPCSContainerCurrency,
} from "./lpcs-types";

import { ABILITY_KEYS, abilityLabel } from "../print-sheet/extractors/dnd5e-extract-helpers";
import { SKILL_DESCRIPTIONS } from "./data/skill-descriptions";
import { getActivityValues } from "../print-sheet/extractors/dnd5e-system-types";
import { Log } from "../logger";
import { getRollMode } from "./lpcs-settings";
import { COMBAT_ACTIONS, interpolateCombatAction } from "./data/combat-actions";
import type { CombatContext } from "./data/combat-actions";
import { getDamageTypeInfo } from "./data/damage-icons";
import { getAoeTypeInfo } from "./data/aoe-icons";
import { getFeatureSummary } from "../print-sheet/data/feature-summaries";
import type { SummaryContext } from "../print-sheet/data/feature-summaries";

/* ── Utility ──────────────────────────────────────────────── */

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function hpColor(pct: number): string {
  if (pct > 50) return "#2d8a4e";
  if (pct > 25) return "#c49a2a";
  return "#8b1e2d";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Strip Foundry enriched-text references (@UUID, @Compendium, etc.) and HTML tags.
 * Preserves display text from `@UUID[...]{Display Text}` patterns.
 */
function stripFoundryRefs(html: string): string {
  return html
    // @UUID[...]{display text} → display text
    .replace(/@(?:UUID|Compendium|Item|Actor|JournalEntry|RollTable|Scene|Macro)\[[^\]]*\]\{([^}]+)\}/gi, "$1")
    // @UUID[...] without display text → empty
    .replace(/@(?:UUID|Compendium|Item|Actor|JournalEntry|RollTable|Scene|Macro)\[[^\]]*\]/gi, "")
    // &Reference[Tremorsense] or &amp;Reference[Tremorsense] → Tremorsense
    .replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/gi, "$1")
    // Strip "Foundry Note ..." helper text that dnd5e injects
    .replace(/Foundry Note\b[^.]*\./gi, "")
    // Strip HTML tags
    .replace(/<[^>]+>/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip HTML tags and return first sentence (≤120 chars). Used for compact spell table rows. */
function shortDesc(html: string): string {
  const text = stripFoundryRefs(html);
  const end = text.search(/[.!?]/);
  const sentence = end !== -1 ? text.slice(0, end + 1) : text;
  return sentence.length > 120 ? sentence.slice(0, 117) + "…" : sentence;
}

/** Strip HTML and return full text, only truncating past ~200 words (1200 chars). Used for drawer descriptions. */
function drawerDesc(html: string): string {
  const text = stripFoundryRefs(html);
  if (text.length <= 1200) return text;
  return text.slice(0, 1200).trimEnd() + "…";
}

/* ── Active Effect Annotations ────────────────────────────── */

/** Well-known change keys that map to bonus targets and weapon categories. */
interface EffectKeyMapping {
  target: string;
  targetLabel: string;
  category: "melee" | "ranged" | "spell" | "all";
}

const EFFECT_KEY_MAP: Record<string, EffectKeyMapping> = {
  // Weapon bonuses
  "system.bonuses.mwak.attack":    { target: "attack",    targetLabel: "melee attack",    category: "melee" },
  "system.bonuses.mwak.damage":    { target: "damage",    targetLabel: "melee damage",    category: "melee" },
  "system.bonuses.rwak.attack":    { target: "attack",    targetLabel: "ranged attack",   category: "ranged" },
  "system.bonuses.rwak.damage":    { target: "damage",    targetLabel: "ranged damage",   category: "ranged" },
  "system.bonuses.weapon.attack":  { target: "attack",    targetLabel: "weapon attack",   category: "all" },
  "system.bonuses.weapon.damage":  { target: "damage",    targetLabel: "weapon damage",   category: "all" },
  // Spell bonuses
  "system.bonuses.msak.attack":    { target: "spell-atk", targetLabel: "spell attack",    category: "spell" },
  "system.bonuses.msak.damage":    { target: "spell-dmg", targetLabel: "spell damage",    category: "spell" },
  "system.bonuses.rsak.attack":    { target: "spell-atk", targetLabel: "spell attack",    category: "spell" },
  "system.bonuses.rsak.damage":    { target: "spell-dmg", targetLabel: "spell damage",    category: "spell" },
  "system.bonuses.spell.attack":   { target: "spell-atk", targetLabel: "spell attack",    category: "spell" },
  "system.bonuses.spell.damage":   { target: "spell-dmg", targetLabel: "spell damage",    category: "spell" },
  "system.bonuses.spell.dc":       { target: "save-dc",   targetLabel: "spell save DC",   category: "spell" },
  // General bonuses (AC, saves, HP, etc.)
  "system.attributes.ac.bonus":    { target: "ac",        targetLabel: "AC",              category: "all" },
  "system.attributes.hp.bonuses.overall": { target: "hp", targetLabel: "max HP",          category: "all" },
  "system.bonuses.abilities.save": { target: "save",      targetLabel: "saving throws",   category: "all" },
};

/** Parsed effect data from a single ActiveEffect. */
interface ParsedEffect {
  sourceName: string;
  sourceItemId: string;
  icon: string;
  annotations: LPCSEffectAnnotation[];
}

/** All parsed effects from the actor, organized for lookup. */
interface ParsedEffectData {
  /** All parsed effects */
  effects: ParsedEffect[];
  /** Annotations grouped by weapon/spell category */
  byCategory: {
    melee: LPCSEffectAnnotation[];
    ranged: LPCSEffectAnnotation[];
    spell: LPCSEffectAnnotation[];
    all: LPCSEffectAnnotation[];
  };
  /** Annotations grouped by source item ID (for feature lookups) */
  bySourceItem: Map<string, LPCSEffectAnnotation[]>;
}

/**
 * Parse all active effects from the actor into structured annotation data.
 * Called once per render, results shared across weapons, spells, and features.
 */
function parseAllEffects(actor: Record<string, unknown>): ParsedEffectData {
  const byCategory: ParsedEffectData["byCategory"] = { melee: [], ranged: [], spell: [], all: [] };
  const bySourceItem = new Map<string, LPCSEffectAnnotation[]>();
  const effects: ParsedEffect[] = [];

  const allEffects = typeof (actor as Record<string, unknown>).allApplicableEffects === "function"
    ? (actor as { allApplicableEffects(): Iterable<Record<string, unknown>> }).allApplicableEffects()
    : [];

  for (const effect of allEffects) {
    if (effect.disabled || effect.isSuppressed) continue;

    const changes = effect.changes as Array<{
      key: string;
      mode: number;
      value: string;
    }> | undefined;
    if (!changes?.length) continue;

    // Resolve source name and item ID from origin
    let sourceName = String(effect.name ?? "Effect");
    const originStr = String(effect.origin ?? "");
    const sourceItemId = originStr.split(".").pop() ?? "";

    const originItem = sourceItemId
      ? (actor as { items?: { get?(id: string): Record<string, unknown> | undefined } }).items?.get?.(sourceItemId)
      : undefined;
    if (originItem?.name) sourceName = String(originItem.name);

    const icon = String(effect.icon ?? originItem?.img ?? "");
    const parsed: ParsedEffect = { sourceName, sourceItemId, icon, annotations: [] };

    for (const change of changes) {
      const mapping = EFFECT_KEY_MAP[change.key];
      if (!mapping) continue;

      const value = change.value.startsWith("+") || change.value.startsWith("-")
        ? change.value
        : `+${change.value}`;

      const annotation: LPCSEffectAnnotation = {
        source: sourceName,
        value,
        target: mapping.target,
        targetLabel: mapping.targetLabel,
        icon,
        label: `${value} ${sourceName}`,
      };

      parsed.annotations.push(annotation);
      byCategory[mapping.category].push(annotation);

      if (sourceItemId) {
        if (!bySourceItem.has(sourceItemId)) bySourceItem.set(sourceItemId, []);
        bySourceItem.get(sourceItemId)!.push(annotation);
      }
    }

    if (parsed.annotations.length > 0) effects.push(parsed);
  }

  return { effects, byCategory, bySourceItem };
}

/**
 * Get effect annotations applicable to a weapon based on its category.
 */
function getWeaponAnnotations(
  category: "melee" | "ranged" | "other",
  data: ParsedEffectData,
): LPCSEffectAnnotation[] {
  const result = [...data.byCategory.all.filter(a => a.target === "attack" || a.target === "damage")];
  if (category === "melee") result.push(...data.byCategory.melee);
  else if (category === "ranged") result.push(...data.byCategory.ranged);
  return result;
}

/**
 * Get spell-related effect annotations.
 */
function getSpellAnnotations(data: ParsedEffectData): LPCSEffectAnnotation[] {
  return [...data.byCategory.spell];
}

/**
 * Get effect annotations originating from a specific item (for features tab).
 */
function getFeatureAnnotations(itemId: string, data: ParsedEffectData): LPCSEffectAnnotation[] {
  return data.bySourceItem.get(itemId) ?? [];
}

/* ── Sub-builders ─────────────────────────────────────────── */

function buildHP(system: Record<string, unknown>): LPCSHitPoints {
  const hp = (system.attributes as Record<string, unknown> | undefined)?.hp as
    Record<string, number> | undefined;
  const value = hp?.value ?? 0;
  const max = hp?.max ?? 1;
  const temp = hp?.temp ?? 0;
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return { value, max, temp, pct, color: hpColor(pct) };
}

function buildSpeed(system: Record<string, unknown>): LPCSSpeed {
  const movement = (system.attributes as Record<string, unknown> | undefined)?.movement as
    Record<string, number> | undefined ?? {};
  const types = ["walk", "fly", "swim", "climb", "burrow"];
  const all = types
    .filter((t) => (movement[t] ?? 0) > 0)
    .map((t) => ({ type: t, value: movement[t] }));
  if (all.length === 0) all.push({ type: "walk", value: 30 });
  const primary = all.reduce((best, cur) => cur.value > best.value ? cur : best);
  return { primary: primary.value, label: primary.type, all };
}

function buildAbilities(system: Record<string, unknown>): LPCSAbility[] {
  const abilities = (system.abilities as Record<string, Record<string, unknown>> | undefined) ?? {};
  return ABILITY_KEYS.map((key) => {
    const a = abilities[key] ?? { value: 10, mod: 0 };
    const score = (a.value as number) ?? 10;
    const modValue = (a.mod as number) ?? Math.floor((score - 10) / 2);

    // Save modifier — same logic as buildSaves()
    const saveRaw = a.save;
    let saveMod: number;
    if (typeof saveRaw === "number") {
      saveMod = saveRaw;
    } else if (saveRaw !== null && typeof saveRaw === "object") {
      saveMod = (saveRaw as Record<string, number>).value ?? 0;
    } else {
      saveMod = modValue;
    }

    return {
      key,
      label: abilityLabel(key),
      abbr: key.toUpperCase(),
      score,
      mod: formatMod(modValue),
      modValue,
      saveMod: formatMod(saveMod),
      saveProficient: !!(a.proficient),
    };
  });
}

function buildSaves(system: Record<string, unknown>): LPCSSave[] {
  const abilities = (system.abilities as Record<string, Record<string, unknown>> | undefined) ?? {};
  return ABILITY_KEYS.map((key) => {
    const a = abilities[key] ?? {};
    const saveRaw = a.save;
    let mod: number;
    if (typeof saveRaw === "number") {
      mod = saveRaw;
    } else if (saveRaw !== null && typeof saveRaw === "object") {
      mod = (saveRaw as Record<string, number>).value ?? 0;
    } else {
      mod = (a.mod as number) ?? 0;
    }
    return {
      key,
      abbr: key.toUpperCase(),
      mod: formatMod(mod),
      proficient: !!(a.proficient),
    };
  });
}

const PASSIVE_SKILL_KEYS = new Set(["prc", "inv", "ins"]);

function profIconForLevel(level: number): string {
  if (level >= 2) return "fas fa-star";
  if (level >= 1) return "fas fa-circle";
  if (level > 0)  return "fas fa-adjust";
  return "far fa-circle";
}

function profCssForLevel(level: number): string {
  if (level >= 2) return "lpcs-prof--expert";
  if (level >= 1) return "lpcs-prof--prof";
  if (level > 0)  return "lpcs-prof--half";
  return "lpcs-prof--none";
}

function buildSkills(system: Record<string, unknown>): LPCSSkill[] {
  const skills = (system.skills as Record<string, Record<string, unknown>> | undefined) ?? {};
  return Object.entries(skills).map(([key, s]) => {
    const total = (s.total as number) ?? (s.mod as number) ?? 0;
    const profLevel = (s.value as number) ?? 0;
    const desc = SKILL_DESCRIPTIONS[key];
    return {
      key,
      label: (s.label as string) ?? desc?.name ?? key,
      mod: formatMod(total),
      modValue: total,
      ability: ((s.ability as string) ?? "").toUpperCase(),
      proficient: profLevel > 0,
      profLevel,
      passive: (s.passive as number) ?? 10 + total,
      isPassiveRelevant: PASSIVE_SKILL_KEYS.has(key),
      profIcon: profIconForLevel(profLevel),
      profCss: profCssForLevel(profLevel),
      description: desc?.description ?? "",
      examples: desc?.examples ?? [],
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

function buildSenses(system: Record<string, unknown>): LPCSSense[] {
  const senses = (system.attributes as Record<string, unknown> | undefined)?.senses as
    Record<string, unknown> | undefined ?? {};
  const result: LPCSSense[] = [];
  for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    const val = senses[key];
    if (val && Number(val) > 0) result.push({ label: key, value: `${Number(val)} ft.` });
  }
  if (senses.special && String(senses.special).trim()) {
    result.push({ label: "Special", value: String(senses.special) });
  }
  return result;
}

function buildWeapons(actor: Record<string, unknown>, effectData?: ParsedEffectData): LPCSWeapon[] {
  const annotations = effectData ?? parseAllEffects(actor);
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const prof = ((actor.system as Record<string, unknown> | undefined)
    ?.attributes as Record<string, unknown> | undefined)?.prof as number ?? 2;

  const weapons: LPCSWeapon[] = items
    .filter((i) => i.type === "weapon" && (i.system as Record<string, unknown>)?.equipped)
    .map((item) => {
      const sys = item.system as Record<string, unknown> ?? {};
      const attrs = (actor.system as Record<string, unknown>)?.abilities as
        Record<string, Record<string, number>> | undefined ?? {};

      // Determine attack ability (finesse: use higher of str/dex)
      const propsRaw = sys.properties as Set<string> | string[] | Record<string, boolean> | undefined;
      const hasProp = (p: string): boolean => {
        if (propsRaw instanceof Set) return propsRaw.has(p);
        if (Array.isArray(propsRaw)) return propsRaw.includes(p);
        if (propsRaw && typeof propsRaw === "object") return !!(propsRaw as Record<string, boolean>)[p];
        return false;
      };

      const strMod = attrs.str?.mod ?? 0;
      const dexMod = attrs.dex?.mod ?? 0;
      const isFinesse = hasProp("fin") || hasProp("finesse");
      const isThrown = hasProp("thr") || hasProp("thrown");
      const weaponType = (sys.type as Record<string, string>)?.value ?? "";
      const isRanged = (sys.actionType as string) === "rwak"
        || weaponType === "simpleR" || weaponType === "martialR"
        || weaponType === "ranged";
      const abilityMod = isRanged || (isFinesse && dexMod > strMod) ? dexMod : strMod;

      const attackBonus = prof + abilityMod + ((sys.attackBonus as number) ?? 0);

      // Damage — handle dnd5e 5.x nested object or legacy string
      const damageRaw = sys.damage as Record<string, unknown> | undefined;
      let damageFormula = "";
      let damageType = "";
      let hasModInFormula = false;
      if (damageRaw) {
        const base = damageRaw.base;
        if (base && typeof base === "object") {
          // dnd5e 5.x: base is { number, denomination, bonus, types }
          const dp = base as Record<string, unknown>;
          const num = (dp.number as number) ?? 1;
          const den = dp.denomination as number | undefined;
          const bonus = dp.bonus as string | undefined;
          if (den) {
            damageFormula = `${num}d${den}`;
            if (bonus) {
              hasModInFormula = bonus.includes("@mod");
              damageFormula += bonus.startsWith("+") || bonus.startsWith("-") ? bonus : `+${bonus}`;
            }
          } else if (bonus) {
            hasModInFormula = bonus.includes("@mod");
            damageFormula = bonus;
          }
          // Types can be Set or array
          const types = dp.types;
          if (types instanceof Set) damageType = [...types][0] ?? "";
          else if (Array.isArray(types)) damageType = types[0] ?? "";
        } else if (typeof base === "string") {
          hasModInFormula = base.includes("@mod");
          damageFormula = base;
        }
        if (!damageType) {
          damageType = String(damageRaw.damageType ?? "");
        }
      }
      if (!damageFormula) damageFormula = "1d6";
      // Replace @mod placeholder with actual ability modifier
      const damageStr = damageFormula.replace(/@mod/g, String(abilityMod));
      // Only append ability mod if it wasn't already embedded via @mod or bonus
      const resolvedFormula = !hasModInFormula && abilityMod
        ? `${damageStr}+${abilityMod}`
        : damageStr;
      const damage = `${resolvedFormula} ${damageType}`.trim();

      // Range
      const rangeData = sys.range as Record<string, number | string> | undefined ?? {};
      let range = "5 ft.";
      if (rangeData.value) range = `${rangeData.value} ft.`;
      if (rangeData.long) range += `/${rangeData.long} ft.`;

      // Properties list
      const PROP_LABELS: Record<string, string> = {
        fin: "Finesse", hvy: "Heavy", lgt: "Light", lod: "Loading",
        rch: "Reach", thr: "Thrown", two: "Two-handed", ver: "Versatile", amm: "Ammunition",
      };
      const propLabels: string[] = [];
      const noteWords: string[] = [];
      for (const p of ["fin", "hvy", "lgt", "lod", "rch", "thr", "two", "ver", "amm"]) {
        if (hasProp(p)) {
          propLabels.push(p.toUpperCase());
          noteWords.push(PROP_LABELS[p]);
        }
      }

      // Mastery
      const mastery = (sys.mastery as string | undefined) ?? null;

      // Category: thrown weapons are melee-primary, so list under melee only
      const category: "melee" | "ranged" | "other" = (isRanged && !isThrown) ? "ranged" : "melee";

      // Damage type icon
      const dmgInfo = getDamageTypeInfo(damageType);

      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        attackBonus: formatMod(attackBonus),
        damage,
        damageFormula: resolvedFormula,
        damageType,
        damageTypeIcon: dmgInfo.icon,
        damageTypeCss: dmgInfo.cssClass,
        category,
        range,
        properties: propLabels,
        notes: noteWords.join(", "),
        mastery,
        img: String(item.img ?? ""),
        iconClass: "",
        effectAnnotations: getWeaponAnnotations(category, annotations),
      } satisfies LPCSWeapon;
    });

  // Append Unarmed Strike and Improvised Weapon as always-available options
  const system = actor.system as Record<string, unknown> ?? {};
  const abilities = system.abilities as Record<string, Record<string, number>> | undefined ?? {};
  const strMod = abilities.str?.mod ?? 0;
  const bludgInfo = getDamageTypeInfo("bludgeoning");

  // Unarmed Strike: STR-based, 1 + STR mod bludgeoning (no die roll)
  const unarmedMod = strMod;
  const unarmedAtk = prof + unarmedMod;
  const unarmedDmg = Math.max(1, 1 + unarmedMod);
  weapons.push({
    id: "__unarmed__",
    name: "Unarmed Strike",
    attackBonus: formatMod(unarmedAtk),
    damage: `${unarmedDmg} bludgeoning`,
    damageFormula: String(unarmedDmg),
    damageType: "bludgeoning",
    damageTypeIcon: bludgInfo.icon,
    damageTypeCss: bludgInfo.cssClass,
    category: "other",
    range: "5 ft.",
    properties: [],
    notes: "",
    mastery: null,
    img: "",
    iconClass: "fas fa-hand-fist",
    effectAnnotations: getWeaponAnnotations("melee", annotations),
  });

  // Improvised Weapon: STR-based (or DEX for thrown), 1d4 + STR mod bludgeoning
  const improvMod = strMod;
  const improvAtk = improvMod; // no proficiency bonus
  // Only append +mod when mod is non-zero
  const improvFormula = improvMod !== 0
    ? `1d4${improvMod >= 0 ? "+" : ""}${improvMod}`
    : "1d4";
  weapons.push({
    id: "__improvised__",
    name: "Improvised Weapon",
    attackBonus: formatMod(improvAtk),
    damage: `${improvFormula} bludgeoning`,
    damageFormula: improvFormula,
    damageType: "bludgeoning",
    damageTypeIcon: bludgInfo.icon,
    damageTypeCss: bludgInfo.cssClass,
    category: "other",
    range: "5 ft./20 ft.",
    properties: [],
    notes: "No proficiency",
    mastery: null,
    img: "",
    iconClass: "fas fa-chair",
    effectAnnotations: [],
  });

  return weapons;
}

function buildActions(actor: Record<string, unknown>, actionType: string): LPCSAction[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const EXCLUDED_TYPES = new Set(["spell", "weapon", "class", "subclass", "background", "race"]);

  return items
    .filter((i) => {
      return (
        !EXCLUDED_TYPES.has(String(i.type ?? "")) &&
        getItemActivationType(i) === actionType
      );
    })
    .map((item) => {
      const sys = item.system as Record<string, unknown> ?? {};
      const uses = sys.uses as Record<string, number> | undefined;
      const recharge = sys.recharge as Record<string, unknown> | undefined;
      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        description: drawerDesc(String((sys.description as Record<string, string> | undefined)?.value ?? "")),
        img: String(item.img ?? ""),
        uses: uses?.max ? { value: uses.value ?? 0, max: uses.max } : null,
        recharge: recharge?.value ? `${recharge.value}+` : null,
      } satisfies LPCSAction;
    });
}

function buildSpellcasting(system: Record<string, unknown>): LPCSSpellcasting | null {
  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const abilityKey = attrs.spellcasting as string | undefined;
  if (!abilityKey) return null;

  const prof = (attrs.prof as number) ?? 2;
  const abilities = system.abilities as Record<string, Record<string, number>> | undefined ?? {};
  const abilityMod = abilities[abilityKey]?.mod ?? 0;

  return {
    ability: abilityKey.toUpperCase(),
    attackBonus: formatMod(prof + abilityMod),
    saveDC: 8 + prof + abilityMod,
  };
}

function buildSpellSlots(system: Record<string, unknown>): LPCSSpellSlotLevel[] {
  const spells = system.spells as Record<string, Record<string, number>> | undefined ?? {};
  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  const result: LPCSSpellSlotLevel[] = [];

  for (let level = 1; level <= 9; level++) {
    const slot = spells[`spell${level}`];
    if (!slot || (slot.max ?? 0) === 0) continue;
    const max = slot.max ?? 0;
    const value = slot.value ?? 0;
    const pips = Array.from({ length: max }, (_, i) => ({ n: i + 1, filled: i < value }));
    result.push({ level, label: `${ORDINALS[level]} Level`, slots: { value, max }, pips });
  }

  // Pact slots (Warlock)
  const pact = spells.pact;
  if (pact && (pact.max ?? 0) > 0) {
    const max = pact.max ?? 0;
    const value = pact.value ?? 0;
    const lvl = (pact as Record<string, number>).level ?? 1;
    result.push({
      level: lvl,
      label: `Pact (${ORDINALS[lvl] ?? lvl}th)`,
      slots: { value, max },
      pips: Array.from({ length: max }, (_, i) => ({ n: i + 1, filled: i < value })),
    });
  }

  return result;
}

function buildSpellLevels(actor: Record<string, unknown>): LPCSSpellLevel[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const ORDINALS = ["Cantrips", "1st Level", "2nd Level", "3rd Level", "4th Level",
    "5th Level", "6th Level", "7th Level", "8th Level", "9th Level"];
  const byLevel = new Map<number, LPCSSpell[]>();

  for (const item of items.filter((i) => i.type === "spell")) {
    const sys = item.system as Record<string, unknown> ?? {};
    const level = (sys.level as number) ?? 0;
    const props = sys.properties as Set<string> | string[] | undefined;

    const hasProp = (p: string): boolean => {
      if (props instanceof Set) return props.has(p);
      if (Array.isArray(props)) return props.includes(p);
      return false;
    };

    const parts: string[] = [];
    if (hasProp("vocal")) parts.push("V");
    if (hasProp("somatic")) parts.push("S");
    if (hasProp("material")) parts.push("M");

    const spell: LPCSSpell = {
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      level,
      school: String(sys.school ?? ""),
      img: String(item.img ?? ""),
      prepared: !!(sys.prepared ?? (sys.preparation as Record<string, unknown> | undefined)?.prepared),
      concentration: hasProp("concentration") || hasProp("concentration"),
      ritual: hasProp("ritual"),
      components: parts.join(", "),
      castingTime: String((sys.activation as Record<string, unknown> | undefined)?.type ?? ""),
      range: String((sys.range as Record<string, unknown> | undefined)?.value ?? ""),
      description: shortDesc(String((sys.description as Record<string, string> | undefined)?.value ?? "")),
    };

    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(spell);
  }

  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, spells]) => ({
      level,
      label: ORDINALS[level] ?? `${level}th Level`,
      spells: spells.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

const DENOMINATION_DISPLAY: Record<string, { icon: string; label: string; cssClass: string }> = {
  pp: { icon: "fas fa-coins", label: "pp", cssClass: "lpcs-coin-icon--pp" },
  gp: { icon: "fas fa-coins", label: "gp", cssClass: "lpcs-coin-icon--gp" },
  ep: { icon: "fas fa-coins", label: "ep", cssClass: "lpcs-coin-icon--ep" },
  sp: { icon: "fas fa-coins", label: "sp", cssClass: "lpcs-coin-icon--sp" },
  cp: { icon: "fas fa-coins", label: "cp", cssClass: "lpcs-coin-icon--cp" },
};

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  veryRare: "Very Rare",
  legendary: "Legendary",
  artifact: "Artifact",
};

const TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon",
  equipment: "Equipment",
  consumable: "Consumable",
  tool: "Tool",
  loot: "Loot",
  container: "Container",
  facility: "Facility",
};

const WEAPON_PROP_LABELS: Record<string, string> = {
  fin: "Finesse", hvy: "Heavy", lgt: "Light", lod: "Loading",
  rch: "Reach", thr: "Thrown", two: "Two-handed", ver: "Versatile", amm: "Ammunition",
  ret: "Returning", rel: "Reload", spc: "Special",
};

const ARMOR_TYPE_LABELS: Record<string, string> = {
  light: "Light Armor", medium: "Medium Armor", heavy: "Heavy Armor",
  shield: "Shield", natural: "Natural Armor", bonus: "Bonus",
};

function buildWeaponStatsBlock(sys: Record<string, unknown>): string {
  const lines: string[] = [];

  // Magical property
  const propSet = sys.properties as { has?: (k: string) => boolean } | undefined;
  const hasProp = (k: string) => propSet && typeof propSet.has === "function" && propSet.has(k);
  if (hasProp("mgc")) lines.push("Magical");

  // Damage and mastery
  const damageRaw = sys.damage as Record<string, unknown> | undefined;
  let damageStr = "";
  let damageType = "";
  if (damageRaw) {
    const base = damageRaw.base;
    if (base && typeof base === "object") {
      const dp = base as Record<string, unknown>;
      const num = (dp.number as number) ?? 1;
      const den = dp.denomination as number | undefined;
      const bonus = dp.bonus as string | undefined;
      if (den) {
        damageStr = `${num}d${den}`;
        if (bonus && bonus !== "@mod") {
          const cleanBonus = bonus.replace(/@mod/g, "").replace(/^\+$/, "").replace(/^-$/, "");
          if (cleanBonus) damageStr += cleanBonus.startsWith("+") || cleanBonus.startsWith("-") ? cleanBonus : `+${cleanBonus}`;
        }
      }
      const types = dp.types;
      if (types instanceof Set) damageType = [...types][0] ?? "";
      else if (Array.isArray(types)) damageType = types[0] ?? "";
    }
  }
  const mastery = (sys.mastery as string | undefined) ?? "";
  const damageLine = [damageStr, damageType, mastery ? `(${capitalize(mastery)})` : ""].filter(Boolean).join(" ");
  if (damageLine) lines.push(damageLine);

  // Other properties (finesse, thrown, etc.)
  const propWords: string[] = [];
  for (const p of ["fin", "hvy", "lgt", "lod", "rch", "thr", "two", "ver", "amm", "ret", "rel", "spc"]) {
    if (hasProp(p)) propWords.push(WEAPON_PROP_LABELS[p]);
  }
  if (propWords.length) lines.push(propWords.join(", "));

  // Range
  const rangeData = sys.range as Record<string, number | string> | undefined;
  if (rangeData?.value) {
    let range = `Range: ${rangeData.value} ft.`;
    if (rangeData.long) range += `/${rangeData.long} ft.`;
    lines.push(range);
  }

  return lines.join("\n");
}

function buildArmorStatsBlock(sys: Record<string, unknown>): string {
  const lines: string[] = [];

  // Magical property
  const propSet = sys.properties as { has?: (k: string) => boolean } | undefined;
  const hasProp = (k: string) => propSet && typeof propSet.has === "function" && propSet.has(k);
  if (hasProp("mgc")) lines.push("Magical");

  // AC and armor type
  const armor = sys.armor as Record<string, number> | undefined;
  const typeData = sys.type as Record<string, string> | undefined;
  const armorType = typeData?.value ?? "";
  const armorTypeLabel = ARMOR_TYPE_LABELS[armorType] ?? "";
  const acValue = armor?.value ?? 0;

  if (acValue > 0 || armorTypeLabel) {
    const parts: string[] = [];
    if (acValue > 0) parts.push(`AC ${acValue}`);
    if (armorTypeLabel) parts.push(armorTypeLabel);
    lines.push(parts.join(" · "));
  }

  return lines.join("\n");
}

function buildOneInventoryItem(item: Record<string, unknown>): LPCSInventoryItem {
  const sys = item.system as Record<string, unknown> ?? {};
  const rawType = String(item.type ?? "");
  const rawRarity = String(sys.rarity ?? "");

  // Price extraction (dnd5e stores as system.price = { value, denomination })
  const priceData = sys.price as Record<string, unknown> | undefined;
  const priceValue = (priceData?.value as number) ?? 0;
  const priceDenom = String(priceData?.denomination ?? "gp");
  const price = priceValue > 0
    ? { value: priceValue, denomination: priceDenom }
    : null;

  const priceDisplay = price
    ? [{ ...(DENOMINATION_DISPLAY[price.denomination] ?? DENOMINATION_DISPLAY.gp), label: String(price.value) }]
    : [];

  // Description — dnd5e stores as { value: "html string" }
  const descHtml = String((sys.description as Record<string, string> | undefined)?.value ?? "");
  const description = drawerDesc(descHtml);

  // Stats block for weapons/armor
  let statsBlock = "";
  if (rawType === "weapon") statsBlock = buildWeaponStatsBlock(sys);
  else if (rawType === "equipment") statsBlock = buildArmorStatsBlock(sys);

  // Weight — dnd5e v5.x uses { value } object, older uses plain number
  const rawWeight = sys.weight;
  const weight = typeof rawWeight === "object" && rawWeight !== null
    ? ((rawWeight as Record<string, unknown>).value as number) ?? 0
    : (rawWeight as number) ?? 0;

  // Container currency (only containers have system.currency)
  const containerCurrency: LPCSContainerCurrency[] = [];
  if (rawType === "container") {
    const curr = sys.currency as Record<string, number> | undefined;
    if (curr) {
      for (const k of ["pp", "gp", "ep", "sp", "cp"]) {
        const amt = curr[k] ?? 0;
        if (amt > 0) containerCurrency.push({ key: k, amount: amt });
      }
    }
  }

  // Container capacity
  let capacityLabel = "";
  let contentsWeightVal = 0;
  let capacityMax = 0;
  let capacityPct = 0;
  if (rawType === "container") {
    const cap = sys.capacity as Record<string, unknown> | undefined;
    const capWeight = (cap?.weight as Record<string, unknown> | undefined)?.value as number | undefined;
    const capCount = cap?.count as number | undefined;
    const cw = sys.contentsWeight as number | undefined;
    contentsWeightVal = cw != null ? Math.round(cw * 10) / 10 : 0;
    if (capWeight && capWeight > 0) {
      capacityMax = capWeight;
      capacityPct = Math.min(100, Math.round((contentsWeightVal / capWeight) * 100));
      capacityLabel = `${contentsWeightVal} / ${capWeight} lb`;
    } else if (capCount && capCount > 0) {
      const cc = sys.contentsCount as number | undefined;
      capacityLabel = `${cc ?? 0} / ${capCount} items`;
      capacityPct = Math.min(100, Math.round(((cc ?? 0) / capCount) * 100));
    }
  }

  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    img: String(item.img ?? ""),
    quantity: (sys.quantity as number) ?? 1,
    weight,
    equipped: !!(sys.equipped),
    attuned: !!(sys.attuned),
    type: rawType,
    typeLabel: TYPE_LABELS[rawType] ?? capitalize(rawType),
    description,
    statsBlock,
    rarity: rawRarity,
    rarityLabel: RARITY_LABELS[rawRarity] ?? "",
    price,
    priceDisplay,
    isContainer: rawType === "container",
    contentsCount: 0,        // filled in second pass
    contents: [],             // filled in second pass
    containerCurrency,
    capacityLabel,
    contentsWeight: contentsWeightVal,
    capacityMax,
    capacityPct,
    capacityColor: capacityPct < 60 ? "#2d8a4e" : capacityPct < 85 ? "#c49a2a" : "#8b1e2d",
    containerId: (sys.container as string) ?? null,
    isEquippable: "equipped" in sys,
  } satisfies LPCSInventoryItem;
}

function buildInventory(actor: Record<string, unknown>): { looseItems: LPCSInventoryItem[]; containers: LPCSInventoryItem[] } {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const SKIP = new Set(["spell", "class", "subclass", "background", "race", "feat"]);

  // First pass: build all items
  const allItems = items
    .filter((i) => !SKIP.has(String(i.type ?? "")))
    .map(buildOneInventoryItem);

  // Index by ID for container lookups
  const byId = new Map<string, LPCSInventoryItem>();
  for (const item of allItems) byId.set(item.id, item);

  // Second pass: assign items to their parent container
  const topLevel: LPCSInventoryItem[] = [];
  for (const item of allItems) {
    if (item.containerId && byId.has(item.containerId)) {
      const parent = byId.get(item.containerId)!;
      parent.contents.push(item);
    } else {
      topLevel.push(item);
    }
  }

  // Set contents count on containers and sort their contents
  for (const item of allItems) {
    if (item.isContainer) {
      item.contentsCount = item.contents.length;
      item.contents.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // Separate loose items from containers
  const looseItems: LPCSInventoryItem[] = [];
  const containers: LPCSInventoryItem[] = [];
  for (const item of topLevel) {
    if (item.isContainer) containers.push(item);
    else looseItems.push(item);
  }

  return {
    looseItems: looseItems.sort((a, b) => a.name.localeCompare(b.name)),
    containers: containers.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function buildEncumbrance(system: Record<string, unknown>): LPCSEncumbrance {
  const enc = (system.attributes as Record<string, unknown> | undefined)?.encumbrance as
    Record<string, number> | undefined ?? {};
  const value = enc.value ?? 0;
  const max = enc.max ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return { value, max, pct, encumbered: pct >= 100 };
}

function buildSummaryContext(actor: Record<string, unknown>): SummaryContext {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const system = actor.system as Record<string, unknown> ?? {};
  const details = system.details as Record<string, unknown> | undefined ?? {};
  const level = (details.level as number) ?? 0;
  const prof = (system.attributes as Record<string, unknown> | undefined)?.prof as number ?? 2;

  const classes = items
    .filter((i) => i.type === "class")
    .map((c) => ({
      name: String(c.name ?? ""),
      level: ((c.system as Record<string, unknown> | undefined)?.levels as number) ?? 0,
    }));

  const classLevel = (name: string) => classes.find((c) => c.name.toLowerCase() === name)?.level ?? 0;

  const rogueLevel = classLevel("rogue");
  const monkLevel = classLevel("monk");
  const paladinLevel = classLevel("paladin");
  const sorcererLevel = classLevel("sorcerer");
  const bardLevel = classLevel("bard");

  return {
    level,
    proficiencyBonus: prof,
    classes,
    sneakAttackDice: rogueLevel > 0 ? `${Math.ceil(rogueLevel / 2)}d6` : null,
    kiPoints: monkLevel > 0 ? monkLevel : null,
    layOnHandsPool: paladinLevel > 0 ? paladinLevel * 5 : null,
    sorceryPoints: sorcererLevel > 0 ? sorcererLevel : null,
    bardicInspirationDie: bardLevel >= 15 ? "d12" : bardLevel >= 10 ? "d10" : bardLevel >= 5 ? "d8" : bardLevel > 0 ? "d6" : null,
  };
}

function featureDescription(name: string, rawHtml: string, ctx: SummaryContext): string {
  const stripped = stripFoundryRefs(rawHtml);
  return getFeatureSummary(name, stripped, ctx, rawHtml);
}

function buildFeatures(actor: Record<string, unknown>, effectData?: ParsedEffectData): { mainGroups: LPCSFeatureGroup[]; speciesGroup: LPCSFeatureGroup[] } {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const ctx = buildSummaryContext(actor);
  const efx = effectData ?? parseAllEffects(actor);

  // Buckets: feats (non-origin), origin feats, class features (keyed by class name), species traits, other
  const feats: LPCSFeature[] = [];
  const originFeats: LPCSFeature[] = [];
  const classGroups = new Map<string, LPCSFeature[]>();
  const speciesTraits: LPCSFeature[] = [];
  const other: LPCSFeature[] = [];

  for (const item of items.filter((i) => i.type === "feat")) {
    const sys = item.system as Record<string, unknown> ?? {};
    const typeObj = sys.type as Record<string, string> | undefined ?? {};
    const typeValue = typeObj.value ?? "";
    const subtype = typeObj.subtype ?? "";

    const uses = sys.uses as Record<string, number> | undefined;
    const rawHtml = String((sys.description as Record<string, string> | undefined)?.value ?? "");
    const itemId = String(item.id ?? "");
    const feat: LPCSFeature = {
      id: itemId,
      name: String(item.name ?? ""),
      img: String(item.img ?? ""),
      description: featureDescription(String(item.name ?? ""), rawHtml, ctx),
      uses: uses?.max ? { value: uses.value ?? 0, max: uses.max } : null,
      source: subtype || typeValue || "Other",
      effectAnnotations: getFeatureAnnotations(itemId, efx),
    };

    if (typeValue === "class") {
      const className = subtype || "Class";
      if (!classGroups.has(className)) classGroups.set(className, []);
      classGroups.get(className)!.push(feat);
    } else if (typeValue === "race") {
      speciesTraits.push(feat);
    } else if (typeValue === "background" || subtype === "origin") {
      originFeats.push(feat);
    } else if (typeValue === "feat") {
      feats.push(feat);
    } else {
      other.push(feat);
    }
  }

  // Build ordered groups: Feats → Origin Feats → Class Features → Other
  // Species traits are returned separately so the template can render proficiencies between them.
  const mainGroups: LPCSFeatureGroup[] = [];
  if (feats.length) mainGroups.push({ label: "Feats", features: feats });
  if (originFeats.length) mainGroups.push({ label: "Origin Feats", features: originFeats });
  for (const [className, features] of [...classGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    mainGroups.push({ label: `${className} Features`, features });
  }
  if (other.length) mainGroups.push({ label: "Other", features: other });

  const speciesGroup: LPCSFeatureGroup[] = [];
  if (speciesTraits.length) speciesGroup.push({ label: "Species Traits", features: speciesTraits });

  return { mainGroups, speciesGroup };
}

function buildTraits(system: Record<string, unknown>): LPCSTraitGroup[] {
  const traits = system.traits as Record<string, unknown> | undefined ?? {};
  const TRAIT_LABELS: Record<string, string> = {
    dr: "Damage Resistances",
    di: "Damage Immunities",
    dv: "Damage Vulnerabilities",
    dm: "Damage Modification",
    ci: "Condition Immunities",
  };

  const result: LPCSTraitGroup[] = [];
  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    const t = traits[key] as Record<string, unknown> | undefined;
    if (!t) continue;
    const values: string[] = [];
    const raw = t.value;
    if (raw instanceof Set) for (const v of raw) values.push(String(v));
    else if (Array.isArray(raw)) for (const v of raw) values.push(String(v));
    const custom = t.custom as string | undefined;
    if (custom?.trim()) values.unshift(...custom.split(";").map((s) => s.trim()).filter(Boolean));
    if (values.length > 0) result.push({ key, label, values: values.join(", ") });
  }
  return result;
}

const ARMOR_LABELS: Record<string, string> = {
  lgt: "Light Armor", med: "Medium Armor", hvy: "Heavy Armor", shl: "Shields",
};
const WEAPON_LABELS: Record<string, string> = {
  sim: "Simple Weapons", mar: "Martial Weapons",
};
const TOOL_LABELS: Record<string, string> = {
  alchemist: "Alchemist's Supplies", brewer: "Brewer's Supplies",
  calligrapher: "Calligrapher's Supplies", carpenter: "Carpenter's Tools",
  cartographer: "Cartographer's Tools", cobbler: "Cobbler's Tools",
  cook: "Cook's Utensils", glassblower: "Glassblower's Tools",
  jeweler: "Jeweler's Tools", leatherworker: "Leatherworker's Tools",
  mason: "Mason's Tools", painter: "Painter's Supplies",
  potter: "Potter's Tools", smith: "Smith's Tools",
  tinker: "Tinker's Tools", weaver: "Weaver's Tools",
  woodcarver: "Woodcarver's Tools", disguise: "Disguise Kit",
  forgery: "Forgery Kit", herbalism: "Herbalism Kit",
  poisoner: "Poisoner's Kit", navigator: "Navigator's Tools",
  thief: "Thieves' Tools", vehicle: "Vehicles",
};

function resolveProfLabel(abbrev: string, labelMap: Record<string, string>): string {
  return labelMap[abbrev.toLowerCase()] ?? capitalize(abbrev);
}

function buildProficiencies(actor: Record<string, unknown>): LPCSProficiencies {
  const sys = actor.system as Record<string, unknown> ?? {};
  const traits = sys.traits as Record<string, unknown> | undefined ?? {};

  const extractTrait = (key: string, labelMap: Record<string, string>): string[] => {
    const t = traits[key] as Record<string, unknown> | undefined;
    if (!t) return [];
    const values: string[] = [];
    const raw = t.value;
    if (raw instanceof Set) for (const v of raw) values.push(resolveProfLabel(String(v), labelMap));
    else if (Array.isArray(raw)) for (const v of raw) values.push(resolveProfLabel(String(v), labelMap));
    const custom = t.custom as string | undefined;
    if (custom?.trim()) values.unshift(...custom.split(";").map((s) => s.trim()).filter(Boolean));
    return values;
  };

  return {
    armor: extractTrait("armorProf", ARMOR_LABELS).join(", "),
    weapons: extractTrait("weaponProf", WEAPON_LABELS).join(", "),
    tools: extractTrait("toolProf", TOOL_LABELS).join(", "),
    languages: extractTrait("languages", {}).join(", "),
  };
}

function buildHitDice(actor: Record<string, unknown>): LPCSHitDice[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  return items
    .filter((i) => i.type === "class")
    .map((cls) => {
      const hd = (cls.system as Record<string, unknown> ?? {}).hd as Record<string, unknown> | undefined ?? {};
      return {
        die: String(hd.denomination ?? "d8"),
        value: (hd.value as number) ?? 0,
        max: (hd.max as number) ?? 0,
        class: String(cls.name ?? ""),
      } satisfies LPCSHitDice;
    });
}

function buildHitDiceSummary(actor: Record<string, unknown>): LPCSHitDiceSummary {
  const dice = buildHitDice(actor);
  if (dice.length === 0) return { die: "d8", current: 0, max: 0 };
  // Primary die: from the first (highest-level) class entry
  const die = dice[0].die;
  const current = dice.reduce((sum, d) => sum + d.value, 0);
  const max = dice.reduce((sum, d) => sum + d.max, 0);
  return { die, current, max } satisfies LPCSHitDiceSummary;
}

function buildClassLabel(actor: Record<string, unknown>): string {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const classes = items.filter((i) => i.type === "class");
  if (classes.length === 0) return "No Class";
  return classes
    .map((c) => `${c.name} ${(c.system as Record<string, unknown> | undefined)?.levels ?? 1}`)
    .join(" / ");
}

function buildSubtitle(actor: Record<string, unknown>): string {
  const sys = actor.system as Record<string, unknown> ?? {};
  const details = sys.details as Record<string, unknown> | undefined ?? {};

  let race = "";
  if (typeof details.race === "string") race = details.race;
  else if ((details.race as Record<string, string> | undefined)?.name) {
    race = (details.race as Record<string, string>).name;
  } else {
    const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
    race = String(items.find((i) => i.type === "race")?.name ?? "");
  }

  // Class names only — level is already shown in the hex badge
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const classNames = items
    .filter((i) => i.type === "class")
    .map((c) => String(c.name ?? ""))
    .filter(Boolean)
    .join(" / ");

  return [race, classNames].filter(Boolean).join(" ");
}

function buildXP(system: Record<string, unknown>): import("./lpcs-types").LPCSExperience | null {
  const details = system.details as Record<string, unknown> | undefined ?? {};
  const xp = details.xp as Record<string, number> | undefined;
  if (!xp) return null;
  const value = xp.value ?? 0;
  const max = xp.max ?? 1;
  if (max === 0) return null;
  return { value, max, pct: Math.min(100, Math.round((value / max) * 100)) };
}

/* ── Combat Groups ────────────────────────────────────────── */

/**
 * Determine the activation type for an item, checking dnd5e 5.x activities
 * first, then falling back to legacy activation.type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getItemActivationType(item: any): string {
  try {
    for (const activity of getActivityValues(item.system?.activities)) {
      const type = (activity as unknown as Record<string, unknown>)?.activation as Record<string, unknown> | undefined;
      if (type?.type) return String(type.type);
    }
  } catch {
    // Fall through to legacy activation
  }
  const activation = (item.system as Record<string, unknown> | undefined)
    ?.activation as Record<string, string> | undefined;
  return activation?.type ?? "";
}

/**
 * Build the interpolation context for standard combat action descriptions.
 */
function buildCombatContext(actor: Record<string, unknown>): CombatContext {
  const system = actor.system as Record<string, unknown> ?? {};
  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const abilities = system.abilities as Record<string, Record<string, number>> | undefined ?? {};
  const prof = (attrs.prof as number) ?? 2;
  const strMod = abilities.str?.mod ?? 0;

  // Spell save DC
  const spellcastingAbility = attrs.spellcasting as string | undefined;
  const spellMod = spellcastingAbility ? (abilities[spellcastingAbility]?.mod ?? 0) : 0;
  const spellSaveDC = spellcastingAbility ? 8 + prof + spellMod : 0;

  // Grapple DC: 8 + prof + STR mod
  const grappleDC = 8 + prof + strMod;

  // Sneak attack dice: ceil(rogueLevel / 2)d6
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const rogueClass = items.find((i) =>
    i.type === "class" && String(i.name ?? "").toLowerCase() === "rogue"
  );
  const rogueLevel = rogueClass
    ? ((rogueClass.system as Record<string, unknown> | undefined)?.levels as number ?? 0)
    : 0;
  const sneakDice = rogueLevel > 0 ? Math.ceil(rogueLevel / 2) : 0;
  const sneakAttackDice = sneakDice > 0 ? `${sneakDice}d6` : "0";

  return { proficiencyBonus: prof, spellSaveDC, grappleDC, sneakAttackDice };
}

/**
 * Detect which equipped weapons should appear as off-hand candidates
 * in the Bonus Action group.
 *
 * Rules: if 2+ equipped weapons have the Light property, the second+ are
 * off-hand candidates. If the character has the Dual Wielder feat, the
 * Light restriction is removed. Weapons with the Nick mastery are excluded
 * (TWF becomes part of the Attack action).
 */
function detectOffhandWeapons(actor: Record<string, unknown>, weapons: LPCSWeapon[]): LPCSWeapon[] {
  if (weapons.length < 2) return [];

  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const hasDualWielder = items.some((i) =>
    i.type === "feat" && String(i.name ?? "").toLowerCase().includes("dual wielder")
  );

  // Check which weapons have the Light property
  const equipped = items.filter((i) =>
    i.type === "weapon" && (i.system as Record<string, unknown>)?.equipped
  );

  const hasPropOnItem = (item: Record<string, unknown>, p: string): boolean => {
    const propsRaw = (item.system as Record<string, unknown>)?.properties as
      Set<string> | string[] | Record<string, boolean> | undefined;
    if (propsRaw instanceof Set) return propsRaw.has(p);
    if (Array.isArray(propsRaw)) return propsRaw.includes(p);
    if (propsRaw && typeof propsRaw === "object") return !!(propsRaw as Record<string, boolean>)[p];
    return false;
  };

  // Build candidates: light weapons (or all if Dual Wielder), excluding nick mastery
  const candidates = equipped.filter((item) => {
    const hasLight = hasPropOnItem(item, "lgt");
    const mastery = ((item.system as Record<string, unknown>)?.mastery as string | undefined) ?? "";
    if (mastery.toLowerCase() === "nick") return false;
    return hasDualWielder || hasLight;
  });

  if (candidates.length < 2) return [];

  // The first weapon is the main-hand, the rest are off-hand
  const offhandIds = new Set(candidates.slice(1).map((i) => String(i.id ?? "")));
  return weapons
    .filter((w) => offhandIds.has(w.id))
    .map((w) => ({ ...w, name: `${w.name} (Off-hand)` }));
}

/**
 * Build combat-relevant spells for a given action type.
 * Filters prepared spells + all cantrips by their activation type.
 * Extracts full spell data for table display (atk/DC, damage, range, etc.).
 */
function buildCombatSpells(actor: Record<string, unknown>, actionType: string, effectData?: ParsedEffectData): LPCSCombatSpell[] {
  const spellAnns = effectData ? getSpellAnnotations(effectData) : [];
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const system = actor.system as Record<string, unknown> ?? {};
  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const abilities = system.abilities as Record<string, Record<string, number>> | undefined ?? {};
  const prof = (attrs.prof as number) ?? 2;
  const spellcastingAbility = attrs.spellcasting as string | undefined;
  const abilityMod = spellcastingAbility ? (abilities[spellcastingAbility]?.mod ?? 0) : 0;
  const attackMod = prof + abilityMod;
  const dc = 8 + prof + abilityMod;

  const result: LPCSCombatSpell[] = [];

  for (const item of items.filter((i) => i.type === "spell")) {
    const sys = item.system as Record<string, unknown> ?? {};
    const level = (sys.level as number) ?? 0;

    // Only include cantrips (always) or prepared spells
    const prepared = !!(sys.prepared ?? (sys.preparation as Record<string, unknown> | undefined)?.prepared);
    if (level > 0 && !prepared) continue;

    // Check activation type matches
    const activationType = getItemActivationType(item);
    if (activationType !== actionType) continue;

    const props = sys.properties as Set<string> | string[] | undefined;
    const hasProp = (p: string): boolean => {
      if (props instanceof Set) return props.has(p);
      if (Array.isArray(props)) return props.includes(p);
      return false;
    };

    // ── Components ──
    const compParts: string[] = [];
    if (hasProp("vocal")) compParts.push("V");
    if (hasProp("somatic")) compParts.push("S");
    if (hasProp("material")) compParts.push("M");

    // ── Casting time ──
    const activation = sys.activation as Record<string, unknown> | undefined ?? {};
    const actType = (activation.type as string) ?? "";
    const actVal = (activation.value as number) ?? 1;
    let castingTime = "";
    if (actType === "action") castingTime = actVal > 1 ? `${actVal}A` : "1A";
    else if (actType === "bonus") castingTime = "1BA";
    else if (actType === "reaction") castingTime = "1R";
    else if (actType === "minute") castingTime = `${actVal}m`;
    else if (actType === "hour") castingTime = `${actVal}h`;
    else if (actType) castingTime = actType;

    // ── Range ──
    const rangeData = sys.range as Record<string, unknown> | undefined ?? {};
    let range = "";
    const rangeUnits = (rangeData.units as string) ?? "";
    if (rangeUnits === "self") range = "Self";
    else if (rangeUnits === "touch") range = "Touch";
    else if (rangeData.value) range = `${rangeData.value} ft.`;
    else if (rangeUnits) range = rangeUnits;

    // ── Duration ──
    const durData = sys.duration as Record<string, unknown> | undefined ?? {};
    const isConc = hasProp("concentration");
    let duration = "";
    const durUnits = (durData.units as string) ?? "";
    if (durUnits === "inst") duration = "Instant";
    else if (durUnits === "perm") duration = "Permanent";
    else if (durUnits === "spec") duration = "Special";
    else if (durData.value) {
      const unit = durUnits === "minute" ? "m" : durUnits === "hour" ? "h" : durUnits === "round" ? "r" : durUnits;
      duration = `${durData.value}${unit}`;
    }

    // ── AoE (target) ──
    const targetData = sys.target as Record<string, unknown> | undefined ?? {};
    const targetType = (targetData.type as string) ?? "";
    const targetValue = targetData.value as number | undefined;
    const aoeInfo = getAoeTypeInfo(targetType);

    // ── Attack/Save & Damage from activities ──
    let attackSave = "";
    let damageFormula = "";
    let damageType = "";
    let isHealing = false;

    const activityList = getActivityValues(sys.activities as Parameters<typeof getActivityValues>[0]);
    if (activityList.length > 0) {
      try {
        const act = activityList[0];
        // Attack
        if (act?.attack?.type) {
          attackSave = formatMod(attackMod);
        }
        // Save
        if (act?.save?.dc?.calculation) {
          const ability = act.save.ability;
          const saveAbility = (ability instanceof Set ? [...ability][0] : (ability ?? "")).toUpperCase().slice(0, 3);
          attackSave = `DC ${dc}${saveAbility ? " " + saveAbility : ""}`;
        }
        // Damage
        const damageParts = act?.damage?.parts;
        const rawDamageArr = Array.isArray(damageParts) ? damageParts :
          damageParts instanceof Map ? Array.from(damageParts.values()) :
          damageParts && typeof damageParts === "object" ? Object.values(damageParts) : [];
        if (rawDamageArr.length > 0) {
          const first = rawDamageArr[0] as unknown as Record<string, unknown>;
          // Try structured damage data (number + denomination + bonus)
          if (first && typeof first === "object" && first.denomination) {
            const num = (first.number as number) ?? 1;
            const den = first.denomination as number;
            const bonus = first.bonus as string | undefined;
            damageFormula = `${num}d${den}`;
            if (bonus) {
              const resolved = bonus.replace(/@mod/g, String(abilityMod));
              damageFormula += resolved.startsWith("+") || resolved.startsWith("-") ? resolved : `+${resolved}`;
            }
            // Get damage type from types Set/Array
            const types = first.types;
            if (types instanceof Set) damageType = [...types][0] ?? "";
            else if (Array.isArray(types)) damageType = types[0] ?? "";
          } else {
            // Fallback: formula string in bonus field
            const formula = typeof first === "string" ? first :
              (first && typeof first === "object" && "bonus" in first ? String(first.bonus ?? "") : "");
            if (formula) damageFormula = formula.replace(/@mod/g, String(abilityMod));
          }
        }
        // Healing
        if (!damageFormula && act?.healing) {
          const healParts = act.healing.parts as unknown;
          const healArr = Array.isArray(healParts) ? healParts as Array<Record<string, unknown>> : [];
          if (healArr.length > 0) {
            const first = healArr[0];
            if (first && typeof first === "object" && first.denomination) {
              const num = (first.number as number) ?? 1;
              const den = first.denomination as number;
              const bonus = first.bonus as string | undefined;
              damageFormula = `${num}d${den}`;
              if (bonus) {
                const resolved = bonus.replace(/@mod/g, String(abilityMod));
                damageFormula += resolved.startsWith("+") || resolved.startsWith("-") ? resolved : `+${resolved}`;
              }
            } else if (act.healing.formula) {
              damageFormula = String(act.healing.formula).replace(/@mod/g, String(abilityMod));
            }
            isHealing = true;
            damageType = "healing";
          } else if (act.healing.formula) {
            damageFormula = String(act.healing.formula).replace(/@mod/g, String(abilityMod));
            isHealing = true;
            damageType = "healing";
          }
        }
      } catch { /* ignore activity extraction errors */ }
    }

    const dmgInfo = isHealing
      ? { icon: "fas fa-heart", cssClass: "lpcs-dmg--healing" }
      : damageType ? getDamageTypeInfo(damageType) : { icon: "", cssClass: "" };

    // ── Effect label for non-damage spells ──
    let effectLabel = "";
    if (!damageFormula) {
      const school = String(sys.school ?? "");
      const SCHOOL_EFFECTS: Record<string, string> = {
        con: "Creation", evo: "Creation", ill: "Control",
        enc: "Control", abj: "Warding", div: "Detection",
        nec: "Debuff", trs: "Utility",
      };
      effectLabel = SCHOOL_EFFECTS[school] ?? "Utility";
    }

    // ── Source (class/feat that grants the spell) ──
    const flags = item.flags as Record<string, Record<string, unknown>> | undefined;
    const sourceRaw = (sys.sourceClass as string)
      ?? (flags?.dnd5e?.sourceClass as string)
      ?? "";
    // Look up the class/feat name from source identifier
    let source = "";
    if (sourceRaw) {
      const sourceItem = items.find((i) =>
        (i.type === "class" || i.type === "subclass" || i.type === "feat" || i.type === "background") &&
        (String(i.identifier ?? "").toLowerCase() === sourceRaw.toLowerCase() ||
         String(i.name ?? "").toLowerCase() === sourceRaw.toLowerCase())
      );
      source = sourceItem ? String(sourceItem.name ?? sourceRaw) : capitalize(sourceRaw);
    }

    // ── Uses / restriction label ──
    const uses = sys.uses as Record<string, unknown> | undefined;
    let usesLabel = "";
    const usesMax = (uses?.max as number) ?? 0;
    if (usesMax > 0) {
      const recovery = uses?.recovery as Array<Record<string, string>> | undefined;
      const period = recovery?.[0]?.period ?? "";
      const PERIOD_ABBR: Record<string, string> = { lr: "LR", sr: "SR", dawn: "Dawn", dusk: "Dusk", day: "Day" };
      const periodLabel = PERIOD_ABBR[period] ?? period.toUpperCase();
      usesLabel = periodLabel ? `${usesMax}/${periodLabel}` : `${usesMax}×`;
    }

    // ── AoE fields ──
    const aoeIcon = aoeInfo.icon;
    const aoeLabel = targetValue ? `${targetValue} ft.` : "";

    // ── Notes (restrictions, duration, components) ──
    const noteParts: string[] = [];
    if (usesLabel) noteParts.push(usesLabel);
    // Duration — skip "Instant" since it's the default/obvious
    if (duration && duration !== "Instant") noteParts.push(`D: ${duration}`);
    // Components — V/S/M letters only, no material description
    const compStr = compParts.join("/");
    if (compStr) noteParts.push(compStr);
    const notes = noteParts.join("; ");

    result.push({
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      level,
      img: String(item.img ?? ""),
      concentration: isConc,
      ritual: hasProp("ritual"),
      description: shortDesc(String((sys.description as Record<string, string> | undefined)?.value ?? "")),
      levelLabel: level === 0 ? "C" : `Lvl ${level}`,
      source,
      attackSave,
      damageFormula,
      damageType,
      damageTypeIcon: dmgInfo.icon,
      damageTypeCss: dmgInfo.cssClass,
      isHealing,
      effectLabel,
      range,
      castingTime,
      notes,
      aoeIcon,
      aoeLabel,
      usesLabel,
      school: String(sys.school ?? ""),
      fullDescription: String((sys.description as Record<string, string> | undefined)?.value ?? ""),
      effectAnnotations: spellAnns,
    });
  }

  return result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/**
 * Group weapons by category (melee → ranged → other), omitting empty groups.
 */
function buildWeaponSubGroups(weapons: LPCSWeapon[]): LPCSWeaponSubGroup[] {
  const CATEGORY_ORDER: Array<{ category: "melee" | "ranged" | "other"; label: string }> = [
    { category: "melee", label: "Melee" },
    { category: "ranged", label: "Ranged" },
    { category: "other", label: "Other" },
  ];
  return CATEGORY_ORDER
    .map(({ category, label }) => ({
      category,
      label,
      weapons: weapons.filter((w) => w.category === category),
    }))
    .filter((g) => g.weapons.length > 0);
}

/**
 * Build the four action-economy combat groups for the combat tab.
 */
function buildCombatGroups(actor: Record<string, unknown>, effectData?: ParsedEffectData): LPCSCombatGroup[] {
  const efx = effectData ?? parseAllEffects(actor);
  const weapons = buildWeapons(actor, efx);
  const ctx = buildCombatContext(actor);
  const system = actor.system as Record<string, unknown> ?? {};
  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const spellsFirst = !!(attrs.spellcasting);

  const groups: Array<{ key: string; label: string; actionType: string }> = [
    { key: "action", label: "Actions", actionType: "action" },
    { key: "bonus", label: "Bonus Actions", actionType: "bonus" },
    { key: "reaction", label: "Reactions", actionType: "reaction" },
    { key: "other", label: "Other", actionType: "other" },
  ];

  // Off-hand weapons for the bonus action group
  const offhandWeapons = detectOffhandWeapons(actor, weapons);

  // Build standard actions per group
  const standardActionsByGroup = new Map<string, LPCSStandardAction[]>();
  for (const def of Object.values(COMBAT_ACTIONS)) {
    if (!standardActionsByGroup.has(def.group)) {
      standardActionsByGroup.set(def.group, []);
    }
    standardActionsByGroup.get(def.group)!.push({
      key: def.key,
      name: def.name,
      description: interpolateCombatAction(def.description, ctx),
      icon: def.icon,
    });
  }

  return groups.map(({ key, label, actionType }) => {
    const groupWeapons = key === "action" ? weapons : key === "bonus" ? offhandWeapons : [];
    const spells = buildCombatSpells(actor, actionType, efx);
    const items = buildActions(actor, actionType);
    const standardActions = standardActionsByGroup.get(key) ?? [];

    // Sub-group weapons by category
    const weaponGroups = buildWeaponSubGroups(groupWeapons);

    return {
      key,
      label,
      weaponGroups,
      spells,
      items,
      standardActions,
      isEmpty: weaponGroups.length === 0 && spells.length === 0 &&
               items.length === 0 && standardActions.length === 0,
      spellsFirst,
    } satisfies LPCSCombatGroup;
  });
}

/* ── Empty fallback ───────────────────────────────────────── */

function createEmptyViewModel(name: string): LPCSViewModel {
  return {
    name,
    img: "",
    subtitle: "",
    classLabel: "Unknown",
    level: 0,
    species: "",
    background: "",
    inspiration: false,
    hp: { value: 0, max: 0, temp: 0, pct: 0, color: "#8b1e2d" },
    ac: 10,
    speed: { primary: 30, label: "walk", all: [{ type: "walk", value: 30 }] },
    initiative: "+0",
    proficiencyBonus: "+2",
    xp: null,
    abilities: [],
    saves: [],
    skills: [],
    senses: [],
    weapons: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    combatGroups: [],
    spellcasting: null,
    spellSlots: [],
    spells: [],
    inventory: [],
    containers: [],
    currency: [],
    encumbrance: { value: 0, max: 0, pct: 0, encumbered: false },
    features: [],
    speciesTraits: [],
    traits: [],
    proficiencies: { armor: "", weapons: "", tools: "", languages: "" },
    deathSaves: { successes: 0, failures: 0, show: false, successPips: [], failurePips: [], rollMode: "digital" as const },
    hitDice: [],
    hitDiceSummary: { die: "d8", current: 0, max: 0 },
    exhaustion: { level: 0, pips: [] },
  };
}

/* ── Main export ──────────────────────────────────────────── */

/**
 * Build the complete LPCS view model from a dnd5e Actor document.
 *
 * @param actor - A dnd5e character Actor document (typed as unknown; accessed defensively)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLPCSViewModel(actor: any): LPCSViewModel {
  const system = actor?.system as Record<string, unknown> | undefined;
  if (!system) {
    Log.warn("buildLPCSViewModel: actor has no system data");
    return createEmptyViewModel(String(actor?.name ?? "Unknown"));
  }

  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const prof = (attrs.prof as number) ?? 2;
  const initTotal = (attrs.init as Record<string, number> | undefined)?.total ?? (attrs.init as number | undefined) ?? 0;

  // Parse active effects once, share across all builders
  const effectData = parseAllEffects(actor);

  return {
    name: String(actor.name ?? "Unknown"),
    img: String(actor.img ?? ""),
    subtitle: buildSubtitle(actor),
    classLabel: buildClassLabel(actor),
    level: (system.details as Record<string, number> | undefined)?.level ?? 0,
    species: (() => {
      const d = system.details as Record<string, unknown> | undefined ?? {};
      if (typeof d.race === "string") return d.race;
      if ((d.race as Record<string, string> | undefined)?.name) return (d.race as Record<string, string>).name;
      return "";
    })(),
    background: (() => {
      const d = system.details as Record<string, unknown> | undefined ?? {};
      if (typeof d.background === "string") return d.background;
      if ((d.background as Record<string, string> | undefined)?.name) return (d.background as Record<string, string>).name;
      return "";
    })(),
    inspiration: !!(attrs.inspiration),

    hp: buildHP(system),
    ac: (attrs.ac as Record<string, number> | undefined)?.value ?? 10,
    speed: buildSpeed(system),
    initiative: formatMod(initTotal),
    proficiencyBonus: formatMod(prof),

    xp: buildXP(system),

    abilities: buildAbilities(system),
    saves: buildSaves(system),
    skills: buildSkills(system),
    senses: buildSenses(system),

    weapons: buildWeapons(actor, effectData),
    actions: buildActions(actor, "action"),
    bonusActions: buildActions(actor, "bonus"),
    reactions: buildActions(actor, "reaction"),
    combatGroups: buildCombatGroups(actor, effectData),

    spellcasting: buildSpellcasting(system),
    spellSlots: buildSpellSlots(system),
    spells: buildSpellLevels(actor),

    ...(() => {
      const inv = buildInventory(actor);
      return { inventory: inv.looseItems, containers: inv.containers };
    })(),
    currency: ((): import("./lpcs-types").LPCSCurrencyEntry[] => {
      const c = system.currency as Record<string, number> | undefined ?? {};
      return [
        { key: "pp", amount: c.pp ?? 0 },
        { key: "gp", amount: c.gp ?? 0 },
        { key: "ep", amount: c.ep ?? 0 },
        { key: "sp", amount: c.sp ?? 0 },
        { key: "cp", amount: c.cp ?? 0 },
      ];
    })(),
    encumbrance: buildEncumbrance(system),

    ...(() => {
      const { mainGroups, speciesGroup } = buildFeatures(actor, effectData);
      return { features: mainGroups, speciesTraits: speciesGroup };
    })(),
    traits: buildTraits(system),
    proficiencies: buildProficiencies(actor),

    deathSaves: (() => {
      const death = attrs.death as Record<string, number> | undefined;
      const successes = death?.success ?? 0;
      const failures = death?.failure ?? 0;
      const show = ((attrs.hp as Record<string, number> | undefined)?.value ?? 1) === 0;
      return {
        successes,
        failures,
        show,
        successPips: [1, 2, 3].map((n) => ({ n, filled: n <= successes })),
        failurePips: [1, 2, 3].map((n) => ({ n, filled: n <= failures })),
        rollMode: getRollMode("deathSaves"),
      };
    })(),

    hitDice: buildHitDice(actor),
    hitDiceSummary: buildHitDiceSummary(actor),
    exhaustion: (() => {
      const level = (attrs.exhaustion as number) ?? 0;
      return { level, pips: [1, 2, 3, 4, 5, 6].map((n) => ({ n, active: n <= level })) };
    })(),
  };
}

