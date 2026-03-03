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
  LPCSFeatureGroup, LPCSTraitGroup, LPCSProficiencies, LPCSHitDice, LPCSSpeed,
  LPCSHitDiceSummary,
} from "./lpcs-types";

import { ABILITY_KEYS, abilityLabel } from "../print-sheet/extractors/dnd5e-extract-helpers";
import { Log } from "../logger";
import { getRollMode } from "./lpcs-settings";

/* ── Utility ──────────────────────────────────────────────── */

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function hpColor(pct: number): string {
  if (pct > 50) return "#2d8a4e";
  if (pct > 25) return "#c49a2a";
  return "#8b1e2d";
}

/** Strip HTML tags and return first sentence (≤120 chars). */
function shortDesc(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const end = text.search(/[.!?]/);
  const sentence = end !== -1 ? text.slice(0, end + 1) : text;
  return sentence.length > 120 ? sentence.slice(0, 117) + "…" : sentence;
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
  const abilities = (system.abilities as Record<string, Record<string, number>> | undefined) ?? {};
  return ABILITY_KEYS.map((key) => {
    const a = abilities[key] ?? { value: 10, mod: 0 };
    const score = a.value ?? 10;
    const modValue = a.mod ?? Math.floor((score - 10) / 2);
    return {
      key,
      label: abilityLabel(key),
      abbr: key.toUpperCase(),
      score,
      mod: formatMod(modValue),
      modValue,
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

function buildSkills(system: Record<string, unknown>): LPCSSkill[] {
  const skills = (system.skills as Record<string, Record<string, unknown>> | undefined) ?? {};
  return Object.entries(skills).map(([key, s]) => {
    const total = (s.total as number) ?? (s.mod as number) ?? 0;
    const profLevel = (s.value as number) ?? 0;
    return {
      key,
      label: (s.label as string) ?? key,
      mod: formatMod(total),
      modValue: total,
      ability: ((s.ability as string) ?? "").toUpperCase(),
      proficient: profLevel > 0,
      profLevel,
      passive: (s.passive as number) ?? 10 + total,
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

function buildWeapons(actor: Record<string, unknown>): LPCSWeapon[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const prof = ((actor.system as Record<string, unknown> | undefined)
    ?.attributes as Record<string, unknown> | undefined)?.prof as number ?? 2;

  return items
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
      const isRanged = (sys.actionType as string) === "rwak" || (sys.type as Record<string, string>)?.value === "ranged";
      const abilityMod = isRanged || (isFinesse && dexMod > strMod) ? dexMod : strMod;

      const attackBonus = prof + abilityMod + ((sys.attackBonus as number) ?? 0);

      // Damage — basic formula fallback
      const damageFormula = (sys.damage as Record<string, string> | undefined)?.base ?? "1d6";
      const damageType = (sys.damage as Record<string, string> | undefined)?.damageType ?? "";
      const damage = `${damageFormula}+${abilityMod} ${damageType}`.trim();

      // Range
      const rangeData = sys.range as Record<string, number | string> | undefined ?? {};
      let range = "5 ft.";
      if (rangeData.value) range = `${rangeData.value} ft.`;
      if (rangeData.long) range += `/${rangeData.long} ft.`;

      // Properties list
      const propLabels: string[] = [];
      for (const p of ["fin", "hvy", "lgt", "lod", "rch", "thr", "two", "ver", "amm"]) {
        if (hasProp(p)) propLabels.push(p.toUpperCase());
      }

      // Mastery
      const mastery = (sys.mastery as string | undefined) ?? null;

      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        attackBonus: formatMod(attackBonus),
        damage,
        range,
        properties: propLabels,
        mastery,
        img: String(item.img ?? ""),
      } satisfies LPCSWeapon;
    });
}

function buildActions(actor: Record<string, unknown>, actionType: string): LPCSAction[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const EXCLUDED_TYPES = new Set(["spell", "weapon", "class", "subclass", "background", "race"]);

  return items
    .filter((i) => {
      const sys = i.system as Record<string, unknown> | undefined ?? {};
      const activation = sys.activation as Record<string, string> | undefined ?? {};
      return (
        !EXCLUDED_TYPES.has(String(i.type ?? "")) &&
        activation.type === actionType
      );
    })
    .map((item) => {
      const sys = item.system as Record<string, unknown> ?? {};
      const uses = sys.uses as Record<string, number> | undefined;
      const recharge = sys.recharge as Record<string, unknown> | undefined;
      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        description: shortDesc(String((sys.description as Record<string, string> | undefined)?.value ?? "")),
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

function buildInventory(actor: Record<string, unknown>): LPCSInventoryItem[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const SKIP = new Set(["spell", "class", "subclass", "background", "race", "feat"]);

  return items
    .filter((i) => !SKIP.has(String(i.type ?? "")))
    .map((item) => {
      const sys = item.system as Record<string, unknown> ?? {};
      return {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        img: String(item.img ?? ""),
        quantity: (sys.quantity as number) ?? 1,
        weight: (sys.weight as number) ?? 0,
        equipped: !!(sys.equipped),
        attuned: !!(sys.attuned),
        type: String(item.type ?? ""),
      } satisfies LPCSInventoryItem;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildEncumbrance(system: Record<string, unknown>): LPCSEncumbrance {
  const enc = (system.attributes as Record<string, unknown> | undefined)?.encumbrance as
    Record<string, number> | undefined ?? {};
  const value = enc.value ?? 0;
  const max = enc.max ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return { value, max, pct, encumbered: pct >= 100 };
}

function buildFeatures(actor: Record<string, unknown>): LPCSFeatureGroup[] {
  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const groups = new Map<string, LPCSFeatureGroup>();

  for (const item of items.filter((i) => i.type === "feat")) {
    const sys = item.system as Record<string, unknown> ?? {};
    const typeObj = sys.type as Record<string, string> | undefined ?? {};
    const source = typeObj.subtype ?? typeObj.value ?? "Other";

    if (!groups.has(source)) {
      groups.set(source, { label: source, features: [] });
    }

    const uses = sys.uses as Record<string, number> | undefined;
    groups.get(source)!.features.push({
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      img: String(item.img ?? ""),
      description: shortDesc(String((sys.description as Record<string, string> | undefined)?.value ?? "")),
      uses: uses?.max ? { value: uses.value ?? 0, max: uses.max } : null,
      source,
    });
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
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

function buildProficiencies(actor: Record<string, unknown>): LPCSProficiencies {
  const sys = actor.system as Record<string, unknown> ?? {};
  const traits = sys.traits as Record<string, unknown> | undefined ?? {};

  const extractTrait = (key: string): string[] => {
    const t = traits[key] as Record<string, unknown> | undefined;
    if (!t) return [];
    const values: string[] = [];
    const raw = t.value;
    if (raw instanceof Set) for (const v of raw) values.push(String(v));
    else if (Array.isArray(raw)) for (const v of raw) values.push(String(v));
    const custom = t.custom as string | undefined;
    if (custom?.trim()) values.unshift(...custom.split(";").map((s) => s.trim()).filter(Boolean));
    return values;
  };

  return {
    armor: extractTrait("armorProf").join(", "),
    weapons: extractTrait("weaponProf").join(", "),
    tools: extractTrait("toolProf").join(", "),
    languages: extractTrait("languages").join(", "),
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
    spellcasting: null,
    spellSlots: [],
    spells: [],
    inventory: [],
    currency: [],
    encumbrance: { value: 0, max: 0, pct: 0, encumbered: false },
    features: [],
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

    weapons: buildWeapons(actor),
    actions: buildActions(actor, "action"),
    bonusActions: buildActions(actor, "bonus"),
    reactions: buildActions(actor, "reaction"),

    spellcasting: buildSpellcasting(system),
    spellSlots: buildSpellSlots(system),
    spells: buildSpellLevels(actor),

    inventory: buildInventory(actor),
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

    features: buildFeatures(actor),
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

