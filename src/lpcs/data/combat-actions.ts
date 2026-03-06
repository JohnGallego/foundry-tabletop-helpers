/**
 * Standard combat action reference data for the LPCS combat tab.
 *
 * Each entry defines a standard D&D 5e 2024 combat action with its
 * action economy group and description (which may contain interpolation
 * placeholders for character-derived values).
 */

export interface CombatActionDef {
  key: string;
  name: string;
  /** "action" | "bonus" | "reaction" | "other" */
  group: string;
  description: string;
  icon: string;
}

export interface CombatContext {
  proficiencyBonus: number;
  spellSaveDC: number;
  grappleDC: number;
  sneakAttackDice: string;
}

export const COMBAT_ACTIONS: Record<string, CombatActionDef> = {
  dodge: {
    key: "dodge",
    name: "Dodge",
    group: "action",
    icon: "fas fa-shield",
    description: "Until the start of your next turn, attack rolls against you have Disadvantage and you make Dexterity saving throws with Advantage. You lose this benefit if you're Incapacitated or your Speed is 0.",
  },
  help: {
    key: "help",
    name: "Help",
    group: "action",
    icon: "fas fa-handshake-angle",
    description: "You lend aid to another creature within 10 feet, giving them Advantage on their next ability check or attack roll before the start of your next turn.",
  },
  shove: {
    key: "shove",
    name: "Shove",
    group: "action",
    icon: "fas fa-hand-back-fist",
    description: "Using an Unarmed Strike, you push the target 5 feet away or knock it Prone. You make a Strength-based Unarmed Strike against the target.",
  },
  dash: {
    key: "dash",
    name: "Dash",
    group: "action",
    icon: "fas fa-person-running",
    description: "You gain extra movement equal to your Speed for the current turn.",
  },
  disengage: {
    key: "disengage",
    name: "Disengage",
    group: "action",
    icon: "fas fa-person-walking-arrow-right",
    description: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn.",
  },
  grapple: {
    key: "grapple",
    name: "Grapple",
    group: "action",
    icon: "fas fa-hands-bound",
    description: "Using an Unarmed Strike, you grapple the target. The target must succeed on a Strength or Dexterity saving throw (DC {grappleDC}) or gain the Grappled condition.",
  },
  hide: {
    key: "hide",
    name: "Hide",
    group: "action",
    icon: "fas fa-eye-slash",
    description: "You make a Dexterity (Stealth) check to become Hidden. While Hidden, you have Advantage on attack rolls and creatures have Disadvantage on attack rolls against you.",
  },
  influence: {
    key: "influence",
    name: "Influence",
    group: "action",
    icon: "fas fa-comments",
    description: "You make a Charisma (Deception, Intimidation, Performance, or Persuasion) check to alter a creature's attitude.",
  },
  search: {
    key: "search",
    name: "Search",
    group: "action",
    icon: "fas fa-magnifying-glass",
    description: "You make a Wisdom (Insight, Medicine, Perception, or Survival) check to discern something not readily apparent.",
  },
  study: {
    key: "study",
    name: "Study",
    group: "action",
    icon: "fas fa-book-open-reader",
    description: "You make an Intelligence (Arcana, History, Investigation, Nature, or Religion) check to recall or deduce information.",
  },
  utilize: {
    key: "utilize",
    name: "Utilize",
    group: "action",
    icon: "fas fa-hand",
    description: "You use a non-magical object or interact with an object that requires your action.",
  },
  coatWeapon: {
    key: "coatWeapon",
    name: "Coat Weapon",
    group: "action",
    icon: "fas fa-flask",
    description: "You apply one dose of a poison to a weapon or piece of ammunition. Once applied, the poison retains its potency for 1 minute or until you hit with the weapon.",
  },
  drinkPotion: {
    key: "drinkPotion",
    name: "Drink Potion",
    group: "action",
    icon: "fas fa-wine-bottle",
    description: "You drink a potion or administer one to a willing creature within 5 feet of you.",
  },
  escape: {
    key: "escape",
    name: "Escape",
    group: "action",
    icon: "fas fa-lock-open",
    description: "You attempt to escape a grapple. You make a Strength (Athletics) or Dexterity (Acrobatics) check against the grapple DC.",
  },
  offhandAttack: {
    key: "offhandAttack",
    name: "Off-hand Attack",
    group: "bonus",
    icon: "fas fa-hand-fist",
    description: "When you take the Attack action and attack with a Light weapon, you can make one extra attack as a Bonus Action with a different Light weapon. You don't add your ability modifier to the damage unless it's negative.",
  },
  opportunityAttack: {
    key: "opportunityAttack",
    name: "Opportunity Attack",
    group: "reaction",
    icon: "fas fa-bolt",
    description: "When a creature you can see leaves your reach, you can use your Reaction to make one melee attack with a weapon or Unarmed Strike against that creature.",
  },
  readiedAction: {
    key: "readiedAction",
    name: "Readied Action",
    group: "reaction",
    icon: "fas fa-clock-rotate-left",
    description: "When the trigger you specified with the Ready action occurs, you use your Reaction to execute the readied action.",
  },
  ready: {
    key: "ready",
    name: "Ready",
    group: "other",
    icon: "fas fa-hourglass-half",
    description: "You prepare to act later. Choose a trigger and an action (or movement up to your Speed). When the trigger occurs, you can use your Reaction to execute it. Readied spells require Concentration.",
  },
};

/**
 * Replace interpolation placeholders in a combat action description
 * with character-derived values.
 */
export function interpolateCombatAction(text: string, ctx: CombatContext): string {
  return text
    .replace(/\{grappleDC\}/g, String(ctx.grappleDC))
    .replace(/\{proficiencyBonus\}/g, String(ctx.proficiencyBonus))
    .replace(/\{spellSaveDC\}/g, String(ctx.spellSaveDC))
    .replace(/\{sneakAttackDice\}/g, ctx.sneakAttackDice);
}
