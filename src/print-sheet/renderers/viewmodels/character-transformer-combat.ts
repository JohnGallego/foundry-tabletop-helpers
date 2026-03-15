import type {
  CharacterData,
  CharacterActions,
  FeatureData,
  WeaponActionData,
} from "../../extractors/dnd5e-types";
import { getFeatureSummary, type SummaryContext } from "../../data/feature-summaries";
import type {
  ActionItemViewModel,
  ActionsViewModel,
  CombatStatsViewModel,
  MasteryDescViewModel,
  WeaponRowViewModel,
} from "./character-viewmodel";
import { esc, replaceAdvDisText, signStr, stripHtml } from "./character-transformer-common";

/** Weapon mastery descriptions from 2024 PHB */
const MASTERY_DESCRIPTIONS: Record<string, string> = {
  cleave: "If you hit a creature, you can make an attack roll against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier unless it's negative.",
  graze: "If your attack roll misses a creature, that creature takes damage equal to your ability modifier. This damage is the same type as the weapon's damage, and can't be increased in any way other than increasing the ability modifier.",
  nick: "When you make the extra attack of the Light weapon property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.",
  push: "If you hit a creature, you can push that creature up to 10 feet straight away from yourself if it is Large or smaller.",
  sap: "If you hit a creature, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  slow: "If you hit a creature, that creature's Speed is reduced by 10 feet until the start of your next turn. This can't reduce the creature's speed below 0.",
  topple: "If you hit a creature, you can force that creature to make a Constitution saving throw (DC 8 + your Proficiency Bonus + the ability modifier used to make the attack roll). On a failed save, the creature has the Prone condition.",
  vex: "If you hit a creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
};

export function buildSummaryContext(data: CharacterData): SummaryContext {
  const classes = data.details.classes;

  const classLevel = (name: string): number => {
    const found = classes.find((item) => item.name.toLowerCase() === name.toLowerCase());
    return found ? found.level : 0;
  };

  const rogueLevel = classLevel("rogue");
  const monkLevel = classLevel("monk");
  const paladinLevel = classLevel("paladin");
  const sorcererLevel = classLevel("sorcerer");
  const bardLevel = classLevel("bard");

  const sneakDiceCount = rogueLevel > 0 ? Math.ceil(rogueLevel / 2) : 0;
  const sneakAttackDice = sneakDiceCount > 0 ? `${sneakDiceCount}d6` : null;

  let bardicInspirationDie: string | null = null;
  if (bardLevel >= 15) bardicInspirationDie = "d12";
  else if (bardLevel >= 10) bardicInspirationDie = "d10";
  else if (bardLevel >= 5) bardicInspirationDie = "d8";
  else if (bardLevel > 0) bardicInspirationDie = "d6";

  return {
    level: data.details.level,
    proficiencyBonus: data.combat.proficiency,
    classes: classes.map((item) => ({ name: item.name, level: item.level })),
    sneakAttackDice,
    kiPoints: monkLevel > 0 ? monkLevel : null,
    layOnHandsPool: paladinLevel > 0 ? 5 * paladinLevel : null,
    sorceryPoints: sorcererLevel > 0 ? sorcererLevel : null,
    bardicInspirationDie,
  };
}

/** Map die type to a display icon. */
function getDieIcon(dieType: string): string {
  const dieIcons: Record<string, string> = {
    d4: "🜂",
    d6: "⚅",
    d8: "◆",
    d10: "⬟",
    d12: "⬡",
    d20: "🎲",
  };
  return dieIcons[dieType] || "🎲";
}

export function buildCombatStats(data: CharacterData): CombatStatsViewModel {
  const combat = data.combat;
  const speed = combat.speed.map((item) => `${item.value} ft ${item.key}`).join(", ");

  const hitDiceEntries = Object.entries(combat.hitDice)
    .filter(([, hd]) => hd.max > 0)
    .sort((a, b) => parseInt(b[0].slice(1), 10) - parseInt(a[0].slice(1), 10));

  const hitDice = hitDiceEntries.map(([denom, hd]) => `${hd.max}${denom}`).join(", ") || "—";
  const hitDieType = hitDiceEntries.length > 0 ? hitDiceEntries[0][0] : "d8";

  return {
    ac: combat.ac,
    hpMax: combat.hp.max,
    hitDice,
    hitDieType,
    hitDieIcon: getDieIcon(hitDieType),
    initiative: signStr(combat.initiative),
    speed,
    proficiency: signStr(combat.proficiency),
  };
}

export function buildActions(actions: CharacterActions, ctx: SummaryContext): ActionsViewModel {
  const usedMasteries = new Set<string>();

  const weapons: WeaponRowViewModel[] = actions.weapons.map((weapon) => {
    if (weapon.mastery && weapon.hasMastery) {
      usedMasteries.add(weapon.mastery.toLowerCase());
    }
    return buildWeaponRow(weapon);
  });

  const masteryDescriptions: MasteryDescViewModel[] = [];
  for (const mastery of usedMasteries) {
    const description = MASTERY_DESCRIPTIONS[mastery];
    if (description) {
      const name = mastery.charAt(0).toUpperCase() + mastery.slice(1);
      masteryDescriptions.push({
        name: `Mastery: ${name}`,
        description: replaceAdvDisText(esc(description)),
      });
    }
  }

  const buildItem = (feature: FeatureData) => buildActionItem(feature, ctx);

  return {
    weapons,
    hasWeapons: weapons.length > 0,
    combatActionsRef: "Attack, Dash, Disengage, Dodge, Grapple, Help, Hide, Ready, Search, Shove, Use an Object",
    otherActions: actions.actions.length > 0 ? [{ title: "Other Actions", items: actions.actions.map(buildItem), hasItems: true }] : [],
    bonusActions: actions.bonusActions.length > 0 ? [{ title: "Bonus Actions", items: actions.bonusActions.map(buildItem), hasItems: true }] : [],
    reactions: actions.reactions.length > 0 ? [{ title: "Reactions", items: actions.reactions.map(buildItem), hasItems: true }] : [],
    other: actions.other.length > 0 ? [{ title: "Other", items: actions.other.map(buildItem), hasItems: true }] : [],
    masteryDescriptions,
    hasMasteryDescriptions: masteryDescriptions.length > 0,
  };
}

function buildWeaponRow(weapon: WeaponActionData): WeaponRowViewModel {
  return {
    favStar: weapon.isFavorite ? "★" : "",
    name: esc(weapon.name),
    masteryBadge: weapon.mastery && weapon.hasMastery ? esc(weapon.mastery) : "",
    hasMastery: !!(weapon.mastery && weapon.hasMastery),
    weaponType: esc(weapon.weaponType),
    range: esc(weapon.range),
    rangeType: weapon.rangeType ? esc(weapon.rangeType) : "",
    toHit: esc(weapon.toHit),
    damage: esc(weapon.damage),
    damageType: weapon.damageType ? esc(weapon.damageType) : "",
    properties: esc(weapon.properties),
  };
}

function buildActionItem(feature: FeatureData, ctx: SummaryContext): ActionItemViewModel {
  const favStar = feature.isFavorite ? "★ " : "";
  let usesDisplay = "";
  let checkboxes = "";

  if (feature.uses) {
    const recoveryLabel = formatRecoveryPeriod(feature.uses.recovery);
    usesDisplay = `(${feature.uses.max}/${recoveryLabel})`;
    checkboxes = "☐".repeat(feature.uses.max);
  }

  const rawDescription = feature.description ? stripHtml(feature.description) : "";
  const description = getFeatureSummary(feature.name, rawDescription, ctx, feature.description || undefined);

  return {
    favStar,
    name: esc(feature.name),
    usesDisplay,
    checkboxes,
    description: esc(description),
  };
}

function formatRecoveryPeriod(recovery: string | undefined): string {
  if (!recovery) return "";

  const map: Record<string, string> = {
    day: "Day",
    lr: "Long Rest",
    sr: "Short Rest",
    dawn: "Dawn",
    dusk: "Dusk",
    round: "Round",
    turn: "Turn",
  };

  return map[recovery.toLowerCase()] || recovery;
}
