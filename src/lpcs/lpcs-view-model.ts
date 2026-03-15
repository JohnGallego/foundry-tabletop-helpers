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
  LPCSSpellLevel, LPCSSpell, LPCSHitDice, LPCSSpeed, LPCSHitDiceSummary, LPCSEffectAnnotation,
} from "./lpcs-types";

import { ABILITY_KEYS, abilityLabel } from "../print-sheet/extractors/dnd5e-extract-helpers";
import { SKILL_DESCRIPTIONS } from "./data/skill-descriptions";
import { Log } from "../logger";
import { getRollMode } from "./lpcs-settings";
import { getDamageTypeInfo } from "./data/damage-icons";
import { buildCombatGroups, getItemActivationType } from "./lpcs-view-model-combat";
import { buildEncumbrance, buildInventory } from "./lpcs-view-model-inventory";
import { buildFeatures, buildProficiencies, buildTraits } from "./lpcs-view-model-character";

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
  const weapons = buildWeapons(actor, effectData);
  const spellAnnotations = getSpellAnnotations(effectData);
  const spellsFirst = !!(attrs.spellcasting);

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

    weapons,
    actions: buildActions(actor, "action"),
    bonusActions: buildActions(actor, "bonus"),
    reactions: buildActions(actor, "reaction"),
    combatGroups: buildCombatGroups(actor, { weapons, spellsFirst, buildActions, formatMod, shortDesc, spellAnnotations }),

    spellcasting: buildSpellcasting(system),
    spellSlots: buildSpellSlots(system),
    spells: buildSpellLevels(actor),

    ...(() => {
      const inv = buildInventory(actor, { capitalize, drawerDesc });
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
      const { mainGroups, speciesGroup } = buildFeatures(actor, {
        stripFoundryRefs,
        getFeatureAnnotations: (itemId) => getFeatureAnnotations(itemId, effectData),
      });
      return { features: mainGroups, speciesTraits: speciesGroup };
    })(),
    traits: buildTraits(system),
    proficiencies: buildProficiencies(actor, { capitalize }),

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
