import type {
  LPCSAction,
  LPCSCombatGroup,
  LPCSCombatSpell,
  LPCSEffectAnnotation,
  LPCSStandardAction,
  LPCSWeapon,
  LPCSWeaponSubGroup,
} from "./lpcs-types";

import { getActivityValues } from "../print-sheet/extractors/dnd5e-system-types";
import { COMBAT_ACTIONS, interpolateCombatAction } from "./data/combat-actions";
import type { CombatContext } from "./data/combat-actions";
import { getDamageTypeInfo } from "./data/damage-icons";
import { getAoeTypeInfo } from "./data/aoe-icons";

interface BuildCombatSpellsOptions {
  formatMod(modifier: number): string;
  shortDesc(html: string): string;
  spellAnnotations: LPCSEffectAnnotation[];
}

interface BuildCombatGroupsOptions extends BuildCombatSpellsOptions {
  weapons: LPCSWeapon[];
  spellsFirst: boolean;
  buildActions(actor: Record<string, unknown>, actionType: string): LPCSAction[];
}

/**
 * Determine the activation type for an item, checking dnd5e 5.x activities
 * first, then falling back to legacy activation.type.
 */
export function getItemActivationType(item: Record<string, unknown>): string {
  try {
    const activities = (item.system as Record<string, unknown> | undefined)?.activities as
      Parameters<typeof getActivityValues>[0];
    for (const activity of getActivityValues(activities)) {
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
export function buildCombatContext(actor: Record<string, unknown>): CombatContext {
  const system = actor.system as Record<string, unknown> ?? {};
  const attrs = system.attributes as Record<string, unknown> | undefined ?? {};
  const abilities = system.abilities as Record<string, Record<string, number>> | undefined ?? {};
  const prof = (attrs.prof as number) ?? 2;
  const strMod = abilities.str?.mod ?? 0;

  const spellcastingAbility = attrs.spellcasting as string | undefined;
  const spellMod = spellcastingAbility ? (abilities[spellcastingAbility]?.mod ?? 0) : 0;
  const spellSaveDC = spellcastingAbility ? 8 + prof + spellMod : 0;

  const grappleDC = 8 + prof + strMod;

  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const rogueClass = items.find((item) =>
    item.type === "class" && String(item.name ?? "").toLowerCase() === "rogue"
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
 */
export function detectOffhandWeapons(actor: Record<string, unknown>, weapons: LPCSWeapon[]): LPCSWeapon[] {
  if (weapons.length < 2) return [];

  const items = actor.items as Array<Record<string, unknown>> | undefined ?? [];
  const hasDualWielder = items.some((item) =>
    item.type === "feat" && String(item.name ?? "").toLowerCase().includes("dual wielder")
  );

  const equipped = items.filter((item) =>
    item.type === "weapon" && (item.system as Record<string, unknown>)?.equipped
  );

  const hasPropOnItem = (item: Record<string, unknown>, property: string): boolean => {
    const propsRaw = (item.system as Record<string, unknown>)?.properties as
      Set<string> | string[] | Record<string, boolean> | undefined;
    if (propsRaw instanceof Set) return propsRaw.has(property);
    if (Array.isArray(propsRaw)) return propsRaw.includes(property);
    if (propsRaw && typeof propsRaw === "object") return !!(propsRaw as Record<string, boolean>)[property];
    return false;
  };

  const candidates = equipped.filter((item) => {
    const hasLight = hasPropOnItem(item, "lgt");
    const mastery = ((item.system as Record<string, unknown>)?.mastery as string | undefined) ?? "";
    if (mastery.toLowerCase() === "nick") return false;
    return hasDualWielder || hasLight;
  });

  if (candidates.length < 2) return [];

  const offhandIds = new Set(candidates.slice(1).map((item) => String(item.id ?? "")));
  return weapons
    .filter((weapon) => offhandIds.has(weapon.id))
    .map((weapon) => ({ ...weapon, name: `${weapon.name} (Off-hand)` }));
}

/**
 * Build combat-relevant spells for a given action type.
 * Filters prepared spells + all cantrips by their activation type.
 */
export function buildCombatSpells(
  actor: Record<string, unknown>,
  actionType: string,
  { formatMod, shortDesc, spellAnnotations }: BuildCombatSpellsOptions,
): LPCSCombatSpell[] {
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

  for (const item of items.filter((entry) => entry.type === "spell")) {
    const sys = item.system as Record<string, unknown> ?? {};
    const level = (sys.level as number) ?? 0;
    const prepared = !!(sys.prepared ?? (sys.preparation as Record<string, unknown> | undefined)?.prepared);
    if (level > 0 && !prepared) continue;

    if (getItemActivationType(item) !== actionType) continue;

    const props = sys.properties as Set<string> | string[] | undefined;
    const hasProp = (property: string): boolean => {
      if (props instanceof Set) return props.has(property);
      if (Array.isArray(props)) return props.includes(property);
      return false;
    };

    const compParts: string[] = [];
    if (hasProp("vocal")) compParts.push("V");
    if (hasProp("somatic")) compParts.push("S");
    if (hasProp("material")) compParts.push("M");

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

    const rangeData = sys.range as Record<string, unknown> | undefined ?? {};
    let range = "";
    const rangeUnits = (rangeData.units as string) ?? "";
    if (rangeUnits === "self") range = "Self";
    else if (rangeUnits === "touch") range = "Touch";
    else if (rangeData.value) range = `${rangeData.value} ft.`;
    else if (rangeUnits) range = rangeUnits;

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

    const targetData = sys.target as Record<string, unknown> | undefined ?? {};
    const targetType = (targetData.type as string) ?? "";
    const targetValue = targetData.value as number | undefined;
    const aoeInfo = getAoeTypeInfo(targetType);

    let attackSave = "";
    let damageFormula = "";
    let damageType = "";
    let isHealing = false;

    const activityList = getActivityValues(sys.activities as Parameters<typeof getActivityValues>[0]);
    if (activityList.length > 0) {
      try {
        const activity = activityList[0];
        if (activity?.attack?.type) {
          attackSave = formatMod(attackMod);
        }
        if (activity?.save?.dc?.calculation) {
          const ability = activity.save.ability;
          const saveAbility = (ability instanceof Set ? [...ability][0] : (ability ?? "")).toUpperCase().slice(0, 3);
          attackSave = `DC ${dc}${saveAbility ? " " + saveAbility : ""}`;
        }

        const damageParts = activity?.damage?.parts;
        const rawDamageArr = Array.isArray(damageParts) ? damageParts :
          damageParts instanceof Map ? Array.from(damageParts.values()) :
          damageParts && typeof damageParts === "object" ? Object.values(damageParts) : [];
        if (rawDamageArr.length > 0) {
          const first = rawDamageArr[0] as unknown as Record<string, unknown>;
          if (first && typeof first === "object" && first.denomination) {
            const num = (first.number as number) ?? 1;
            const den = first.denomination as number;
            const bonus = first.bonus as string | undefined;
            damageFormula = `${num}d${den}`;
            if (bonus) {
              const resolved = bonus.replace(/@mod/g, String(abilityMod));
              damageFormula += resolved.startsWith("+") || resolved.startsWith("-") ? resolved : `+${resolved}`;
            }
            const types = first.types;
            if (types instanceof Set) damageType = [...types][0] ?? "";
            else if (Array.isArray(types)) damageType = types[0] ?? "";
          } else {
            const formula = typeof first === "string" ? first :
              (first && typeof first === "object" && "bonus" in first ? String(first.bonus ?? "") : "");
            if (formula) damageFormula = formula.replace(/@mod/g, String(abilityMod));
          }
        }

        if (!damageFormula && activity?.healing) {
          const healParts = activity.healing.parts as unknown;
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
            } else if (activity.healing.formula) {
              damageFormula = String(activity.healing.formula).replace(/@mod/g, String(abilityMod));
            }
            isHealing = true;
            damageType = "healing";
          } else if (activity.healing.formula) {
            damageFormula = String(activity.healing.formula).replace(/@mod/g, String(abilityMod));
            isHealing = true;
            damageType = "healing";
          }
        }
      } catch {
        // Ignore activity extraction errors
      }
    }

    const dmgInfo = isHealing
      ? { icon: "fas fa-heart", cssClass: "lpcs-dmg--healing" }
      : damageType ? getDamageTypeInfo(damageType) : { icon: "", cssClass: "" };

    let effectLabel = "";
    if (!damageFormula) {
      const school = String(sys.school ?? "");
      const schoolEffects: Record<string, string> = {
        con: "Creation", evo: "Creation", ill: "Control",
        enc: "Control", abj: "Warding", div: "Detection",
        nec: "Debuff", trs: "Utility",
      };
      effectLabel = schoolEffects[school] ?? "Utility";
    }

    const flags = item.flags as Record<string, Record<string, unknown>> | undefined;
    const sourceRaw = (sys.sourceClass as string)
      ?? (flags?.dnd5e?.sourceClass as string)
      ?? "";
    let source = "";
    if (sourceRaw) {
      const sourceItem = items.find((entry) =>
        (entry.type === "class" || entry.type === "subclass" || entry.type === "feat" || entry.type === "background") &&
        (String(entry.identifier ?? "").toLowerCase() === sourceRaw.toLowerCase() ||
         String(entry.name ?? "").toLowerCase() === sourceRaw.toLowerCase())
      );
      source = sourceItem ? String(sourceItem.name ?? sourceRaw) : sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1);
    }

    const uses = sys.uses as Record<string, unknown> | undefined;
    let usesLabel = "";
    const usesMax = (uses?.max as number) ?? 0;
    if (usesMax > 0) {
      const recovery = uses?.recovery as Array<Record<string, string>> | undefined;
      const period = recovery?.[0]?.period ?? "";
      const periodAbbr: Record<string, string> = { lr: "LR", sr: "SR", dawn: "Dawn", dusk: "Dusk", day: "Day" };
      const periodLabel = periodAbbr[period] ?? period.toUpperCase();
      usesLabel = periodLabel ? `${usesMax}/${periodLabel}` : `${usesMax}x`;
    }

    const noteParts: string[] = [];
    if (usesLabel) noteParts.push(usesLabel);
    if (duration && duration !== "Instant") noteParts.push(`D: ${duration}`);
    const compStr = compParts.join("/");
    if (compStr) noteParts.push(compStr);

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
      notes: noteParts.join("; "),
      aoeIcon: aoeInfo.icon,
      aoeLabel: targetValue ? `${targetValue} ft.` : "",
      usesLabel,
      school: String(sys.school ?? ""),
      fullDescription: String((sys.description as Record<string, string> | undefined)?.value ?? ""),
      effectAnnotations: spellAnnotations,
    });
  }

  return result.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
}

/**
 * Group weapons by category (melee -> ranged -> other), omitting empty groups.
 */
export function buildWeaponSubGroups(weapons: LPCSWeapon[]): LPCSWeaponSubGroup[] {
  const categoryOrder: Array<{ category: "melee" | "ranged" | "other"; label: string }> = [
    { category: "melee", label: "Melee" },
    { category: "ranged", label: "Ranged" },
    { category: "other", label: "Other" },
  ];

  return categoryOrder
    .map(({ category, label }) => ({
      category,
      label,
      weapons: weapons.filter((weapon) => weapon.category === category),
    }))
    .filter((group) => group.weapons.length > 0);
}

/**
 * Build the four action-economy combat groups for the combat tab.
 */
export function buildCombatGroups(
  actor: Record<string, unknown>,
  { weapons, spellsFirst, buildActions, formatMod, shortDesc, spellAnnotations }: BuildCombatGroupsOptions,
): LPCSCombatGroup[] {
  const context = buildCombatContext(actor);
  const groups: Array<{ key: string; label: string; actionType: string }> = [
    { key: "action", label: "Actions", actionType: "action" },
    { key: "bonus", label: "Bonus Actions", actionType: "bonus" },
    { key: "reaction", label: "Reactions", actionType: "reaction" },
    { key: "other", label: "Other", actionType: "other" },
  ];

  const offhandWeapons = detectOffhandWeapons(actor, weapons);

  const standardActionsByGroup = new Map<string, LPCSStandardAction[]>();
  for (const definition of Object.values(COMBAT_ACTIONS)) {
    if (!standardActionsByGroup.has(definition.group)) {
      standardActionsByGroup.set(definition.group, []);
    }
    standardActionsByGroup.get(definition.group)!.push({
      key: definition.key,
      name: definition.name,
      description: interpolateCombatAction(definition.description, context),
      icon: definition.icon,
    });
  }

  return groups.map(({ key, label, actionType }) => {
    const groupWeapons = key === "action" ? weapons : key === "bonus" ? offhandWeapons : [];
    const spells = buildCombatSpells(actor, actionType, { formatMod, shortDesc, spellAnnotations });
    const items = buildActions(actor, actionType);
    const standardActions = standardActionsByGroup.get(key) ?? [];
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
    };
  });
}
