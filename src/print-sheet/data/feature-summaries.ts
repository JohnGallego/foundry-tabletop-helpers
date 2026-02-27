/**
 * Curated summaries for features with lengthy descriptions.
 * Keys are lowercase feature names for case-insensitive matching.
 * Only include features where the original description is excessively long.
 */
export const FEATURE_SUMMARIES: Record<string, string> = {
  // ─── Class Features: Cleric ─────────────────────────────────────────────────
  "spellcasting (cleric)": "Prepare WIS mod + cleric level spells daily from the cleric list. Use holy symbol as focus. Can ritual cast prepared spells without using a slot.",
  "spellcasting": "See your class for spellcasting ability, spell slots, and preparation rules. You can ritual cast spells marked as rituals without using a slot if you have them prepared.",
  "channel divinity": "Use one of your Channel Divinity options. Uses recharge on short or long rest. The DC for any saving throw equals your spell save DC.",
  "turn undead": "As an action, present holy symbol. Each undead within 30ft that can see/hear you must make WIS save or be turned for 1 minute (flees, can't take reactions, can only Dash).",
  "destroy undead": "When an undead fails its save against Turn Undead, it is instantly destroyed if its CR is at or below your threshold (CR 1/2 at 5th, CR 1 at 8th, CR 2 at 11th, CR 3 at 14th, CR 4 at 17th).",
  "divine intervention": "As an action, describe assistance you seek. Roll d100; if ≤ cleric level, the DM chooses the nature of the intervention. If it works, you can't use this again for 7 days.",
  "blessed strikes": "When you hit with a weapon or cantrip, deal +1d8 radiant damage (once per turn).",

  // ─── Class Features: Fighter ────────────────────────────────────────────────
  "action surge": "On your turn, take one additional action. Recharges on short or long rest.",
  "second wind": "Bonus action: regain HP equal to 1d10 + fighter level. Recharges on short or long rest.",
  "indomitable": "Reroll a failed saving throw. You must use the new roll. Uses recharge on long rest.",
  "extra attack": "Attack twice instead of once when you take the Attack action on your turn.",
  "extra attack (2)": "Attack three times when you take the Attack action.",
  "extra attack (3)": "Attack four times when you take the Attack action.",

  // ─── Class Features: Rogue ──────────────────────────────────────────────────
  "sneak attack": "Once per turn, deal extra damage (see class table) when you hit with a finesse/ranged weapon and have advantage OR an ally within 5ft of target. No disadvantage required.",
  "cunning action": "Bonus action to Dash, Disengage, or Hide.",
  "uncanny dodge": "Reaction when hit by an attack you can see: halve the damage.",
  "evasion": "DEX saves for half damage: take no damage on success, half on failure.",
  "reliable talent": "When you make an ability check using a skill you're proficient in, treat any d20 roll of 9 or lower as a 10.",
  "blindsense": "If you can hear, you know the location of any hidden or invisible creature within 10 feet.",
  "slippery mind": "You gain proficiency in Wisdom saving throws.",
  "elusive": "No attack roll has advantage against you while you aren't incapacitated.",
  "stroke of luck": "If your attack misses, turn it into a hit. Or turn a failed ability check into a 20. Recharges on short or long rest.",

  // ─── Class Features: Wizard ─────────────────────────────────────────────────
  "spellcasting (wizard)": "Prepare INT mod + wizard level spells from your spellbook daily. You can ritual cast any ritual spell in your spellbook without preparing it.",
  "arcane recovery": "Once per day after a short rest, recover spell slots with combined level ≤ half your wizard level (rounded up). No 6th level or higher slots.",
  "spell mastery": "Choose one 1st-level and one 2nd-level spell from your spellbook. Cast them at their lowest level without expending a slot while prepared.",
  "signature spells": "Choose two 3rd-level spells from your spellbook. They're always prepared, don't count against your limit, and you can cast each once at 3rd level without a slot (recharges on short/long rest).",

  // ─── Class Features: Paladin ────────────────────────────────────────────────
  "spellcasting (paladin)": "Prepare CHA mod + half paladin level spells daily from the paladin list. Use holy symbol as focus.",
  "divine smite": "When you hit with a melee weapon, expend a spell slot to deal +2d8 radiant damage (+1d8 per slot level above 1st, max 5d8). +1d8 vs undead/fiends.",
  "lay on hands": "Touch a creature to restore HP from your pool (5 × paladin level). Or spend 5 HP from the pool to cure one disease or neutralize one poison.",
  "divine sense": "As an action, detect celestials, fiends, and undead within 60ft not behind total cover. Also detect consecrated/desecrated places. Uses = 1 + CHA mod per long rest.",
  "aura of protection": "You and friendly creatures within 10ft (30ft at 18th) gain a bonus to saving throws equal to your CHA modifier (minimum +1) while you're conscious.",
  "aura of courage": "You and friendly creatures within 10ft (30ft at 18th) can't be frightened while you're conscious.",
  "cleansing touch": "As an action, end one spell on yourself or a willing creature you touch. Uses = CHA mod per long rest.",

  // ─── Class Features: Barbarian ──────────────────────────────────────────────
  "rage": "Bonus action to rage for 1 minute. Advantage on STR checks/saves, bonus rage damage on STR melee attacks, resistance to bludgeoning/piercing/slashing. Can't cast or concentrate on spells.",
  "unarmored defense (barbarian)": "While not wearing armor, AC = 10 + DEX mod + CON mod. You can use a shield.",
  "reckless attack": "On your first attack of your turn, you can attack recklessly. You gain advantage on melee STR attacks this turn, but attacks against you have advantage until your next turn.",
  "danger sense": "Advantage on DEX saves against effects you can see (traps, spells, etc.) while not blinded, deafened, or incapacitated.",
  "feral instinct": "Advantage on initiative. If surprised but not incapacitated, you can act normally if you enter rage first.",
  "brutal critical": "Roll additional weapon damage dice on a critical hit (1 extra at 9th, 2 at 13th, 3 at 17th).",
  "relentless rage": "If you drop to 0 HP while raging, make DC 10 CON save to drop to 1 HP instead. DC increases by 5 each use, resets on rest.",
  "persistent rage": "Your rage only ends early if you fall unconscious or choose to end it.",
  "primal champion": "+4 to Strength and Constitution. Maximum for those scores is now 24.",

  // ─── Class Features: Bard ───────────────────────────────────────────────────
  "spellcasting (bard)": "CHA is your spellcasting ability. You know a set number of spells (see class table). You can use a musical instrument as a spellcasting focus.",
  "bardic inspiration": "Bonus action to give one creature within 60ft an Inspiration die (d6, increases at higher levels). Within 10 minutes, they can add it to one ability check, attack roll, or saving throw.",
  "song of rest": "During a short rest, you or friendly creatures who hear your performance regain extra HP when spending Hit Dice (1d6, increases at higher levels).",
  "countercharm": "As an action, start a performance lasting until end of your next turn. You and friendly creatures within 30ft have advantage on saves vs frightened/charmed.",
  "magical secrets": "Choose two spells from any class's spell list. They count as bard spells for you and don't count against spells known.",

  // ─── Class Features: Monk ───────────────────────────────────────────────────
  "unarmored defense (monk)": "While not wearing armor or a shield, AC = 10 + DEX mod + WIS mod.",
  "martial arts": "While unarmed or using monk weapons and not wearing armor/shield: use DEX for attack/damage, roll martial arts die for damage, bonus action unarmed strike after Attack action.",
  "ki": "You have ki points equal to your monk level. Spend them on special abilities. All ki points restore on short or long rest.",
  "flurry of blows": "After Attack action, spend 1 ki to make two unarmed strikes as a bonus action.",
  "patient defense": "Spend 1 ki to take Dodge as a bonus action.",
  "step of the wind": "Spend 1 ki to Disengage or Dash as a bonus action; your jump distance is doubled this turn.",
  "deflect missiles": "Reaction to reduce ranged weapon damage by 1d10 + DEX mod + monk level. If reduced to 0, spend 1 ki to throw it back (monk weapon attack, 20/60 range).",
  "slow fall": "Reaction when falling to reduce fall damage by 5 × monk level.",
  "stunning strike": "When you hit with a melee weapon attack, spend 1 ki. Target must succeed CON save or be stunned until end of your next turn.",
  "ki-empowered strikes": "Your unarmed strikes count as magical for overcoming resistance and immunity.",
  "stillness of mind": "Use your action to end one effect causing you to be charmed or frightened.",
  "purity of body": "You are immune to disease and poison.",
  "tongue of the sun and moon": "You can understand all spoken languages and any creature that speaks can understand you.",
  "diamond soul": "Proficiency in all saving throws. Spend 1 ki to reroll a failed save.",
  "timeless body": "You suffer none of the frailty of old age, can't be aged magically, and don't need food or water.",
  "empty body": "Spend 4 ki to become invisible for 1 minute and gain resistance to all damage except force. Spend 8 ki to cast Astral Projection without material components.",
  "perfect self": "When you roll initiative and have no ki points, you regain 4 ki points.",

  // ─── Class Features: Ranger ─────────────────────────────────────────────────
  "spellcasting (ranger)": "WIS is your spellcasting ability. You know a set number of spells (see class table). Prepare spells from your known list.",
  "favored enemy": "Advantage on Survival checks to track and INT checks to recall info about your favored enemies. You learn one language spoken by them if they speak one.",
  "natural explorer": "In favored terrain: difficult terrain doesn't slow your group, can't become lost except by magic, always alert to danger, move stealthily at normal pace alone, find twice as much food, learn exact info about tracked creatures.",
  "primeval awareness": "Spend a spell slot to sense aberrations, celestials, dragons, elementals, fey, fiends, and undead within 1 mile (6 miles in favored terrain) for 1 minute per slot level.",
  "land's stride": "Moving through nonmagical difficult terrain costs no extra movement. You can pass through nonmagical plants without being slowed or taking damage. Advantage on saves vs magically created/manipulated plants.",
  "hide in plain sight": "Spend 1 minute creating camouflage. While you remain still, you gain +10 to Stealth checks. Moving or taking damage ends the benefit.",
  "vanish": "You can Hide as a bonus action. You can't be tracked by nonmagical means unless you choose to leave a trail.",
  "feral senses": "No disadvantage on attacks against creatures you can't see. You know the location of invisible creatures within 30ft if not hidden from you.",
  "foe slayer": "Once per turn, add WIS mod to attack roll or damage roll against a favored enemy.",

  // ─── Class Features: Sorcerer ───────────────────────────────────────────────
  "spellcasting (sorcerer)": "CHA is your spellcasting ability. You know a set number of spells (see class table). You can use an arcane focus.",
  "font of magic": "You have sorcery points equal to your sorcerer level. Convert spell slots to sorcery points or vice versa. Restore all on long rest.",
  "metamagic": "You can modify spells using Metamagic options, spending sorcery points. You can use only one Metamagic option per spell unless otherwise noted.",
  "sorcerous restoration": "On a short rest, regain 4 sorcery points.",

  // ─── Class Features: Warlock ────────────────────────────────────────────────
  "pact magic": "CHA is your spellcasting ability. You have limited spell slots that recharge on short or long rest. All slots are the same level (see class table).",
  "eldritch invocations": "You gain special abilities from your patron. Some have prerequisites. You can replace one invocation when you gain a level.",
  "pact boon": "Your patron grants you a special gift: Pact of the Blade (create/bond weapon), Pact of the Chain (improved familiar), or Pact of the Tome (Book of Shadows with cantrips).",
  "mystic arcanum": "Choose one spell of the indicated level from the warlock list. You can cast it once without a slot; recharges on long rest.",
  "eldritch master": "Spend 1 minute entreating your patron to regain all Pact Magic spell slots. Usable once per long rest.",

  // ─── Class Features: Druid ──────────────────────────────────────────────────
  "spellcasting (druid)": "Prepare WIS mod + druid level spells daily from the druid list. Use druidic focus. Can ritual cast prepared spells.",
  "wild shape": "As an action (bonus at higher levels), transform into a beast you've seen. See class table for max CR and limitations. Lasts hours = half druid level.",
  "druidic": "You know Druidic, the secret language of druids. You can speak it and use it to leave hidden messages.",
  "beast spells": "You can perform the somatic and verbal components of druid spells while in Wild Shape, but you can't provide material components.",
  "archdruid": "You can use Wild Shape unlimited times, and you can ignore verbal/somatic components of druid spells as well as material components without a cost.",

  // ─── Racial Features ────────────────────────────────────────────────────────
  "lucky (halfling)": "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
  "brave": "Advantage on saving throws against being frightened.",
  "halfling nimbleness": "You can move through the space of any creature that is of a size larger than yours.",
  "relentless endurance": "When reduced to 0 HP but not killed outright, drop to 1 HP instead. Usable once per long rest.",
  "savage attacks": "When you score a critical hit with a melee weapon, roll one additional weapon damage die.",
  "infernal legacy": "You know Thaumaturgy. At 3rd level, cast Hellish Rebuke once per long rest. At 5th, cast Darkness once per long rest. CHA is your spellcasting ability.",
  "breath weapon": "As an action, exhale destructive energy. Shape and damage type depend on your ancestry. DC = 8 + CON mod + proficiency. Damage increases at 6th, 11th, 16th level.",
  "draconic resistance": "You have resistance to the damage type associated with your draconic ancestry.",
  "fey ancestry": "Advantage on saves against being charmed, and magic can't put you to sleep.",
  "trance": "You don't need to sleep. Instead, you meditate deeply for 4 hours a day. You gain the same benefit a human does from 8 hours of sleep.",
  "mask of the wild": "You can attempt to hide even when only lightly obscured by foliage, heavy rain, falling snow, mist, or other natural phenomena.",
  "stonecunning": "When you make an INT (History) check related to stonework, add double your proficiency bonus.",
  "dwarven resilience": "Advantage on saves against poison, and resistance to poison damage.",
  "gnome cunning": "Advantage on INT, WIS, and CHA saves against magic.",

  // ─── Feats ──────────────────────────────────────────────────────────────────
  "great weapon master": "Before you attack with a heavy melee weapon you're proficient with, you can choose to take -5 to hit for +10 damage. On a crit or reducing a creature to 0 HP, make a bonus action melee attack.",
  "sharpshooter": "No disadvantage at long range. Ignore half and three-quarters cover. Before attacking with a ranged weapon, choose -5 to hit for +10 damage.",
  "sentinel": "When you hit with an opportunity attack, target's speed becomes 0. Creatures within 5ft provoke opportunity attacks even if they Disengage. When a creature attacks someone other than you within 5ft, use reaction to attack it.",
  "polearm master": "When you Attack with a glaive/halberd/quarterstaff/spear, bonus action to attack with the opposite end (1d4 bludgeoning). Creatures provoke opportunity attacks when entering your reach.",
  "war caster": "Advantage on CON saves to maintain concentration. Perform somatic components with weapons/shield in hand. Cast a spell as an opportunity attack instead of a weapon attack.",
  "lucky": "You have 3 luck points. Spend one to roll an additional d20 for an attack/ability check/save (choose which to use), or force a reroll of an attack against you. Regain all points on long rest.",
  "mobile": "+10 speed. When you Dash, difficult terrain doesn't cost extra movement. When you make a melee attack against a creature, you don't provoke opportunity attacks from it this turn.",
  "crossbow expert": "Ignore loading on crossbows you're proficient with. No disadvantage on ranged attacks within 5ft. When you Attack with a one-handed weapon, bonus action attack with a hand crossbow.",
  "resilient": "+1 to chosen ability score. Gain proficiency in saving throws using that ability.",
  "alert": "+5 to initiative. Can't be surprised while conscious. Hidden creatures don't gain advantage on attacks against you.",
  "tough": "Your HP maximum increases by 2 × your level. Each time you gain a level, your HP max increases by 2.",
  "observant": "+5 to passive Perception and passive Investigation. You can read lips if you can see and understand the language.",
  "magic initiate": "Learn two cantrips and one 1st-level spell from a chosen class's list. Cast the 1st-level spell once per long rest. Your spellcasting ability is the class's ability.",
  "ritual caster": "You gain a ritual book with two 1st-level ritual spells. You can cast spells from the book as rituals. You can copy new rituals you find into the book.",
  "elemental adept": "Choose a damage type (acid, cold, fire, lightning, or thunder). Spells you cast ignore resistance to that type. When you roll damage, treat any 1 as a 2.",
  "inspiring leader": "Spend 10 minutes to give up to 6 creatures (including yourself) temporary HP equal to your level + CHA modifier. Creatures can only benefit once per rest.",
  "healer": "When you use a healer's kit to stabilize, the creature regains 1 HP. As an action, spend one use to restore 1d6+4 HP + additional HP equal to creature's max Hit Dice. A creature can only benefit once per rest.",
  "mage slayer": "When a creature within 5ft casts a spell, use reaction to attack it. Creatures you damage have disadvantage on concentration saves. Advantage on saves against spells cast within 5ft of you.",
  "dual wielder": "+1 AC while wielding two weapons. You can two-weapon fight with non-light weapons. You can draw/stow two weapons at once.",
  "defensive duelist": "While wielding a finesse weapon, use reaction to add proficiency bonus to AC against one attack that would hit you.",
  "athlete": "+1 STR or DEX. Standing from prone costs only 5ft. Climbing doesn't cost extra movement. Running long/high jumps require only 5ft movement.",
  "charger": "When you Dash, use bonus action to make one melee attack (+5 damage) or shove a creature.",
  "grappler": "Advantage on attacks against creatures you're grappling. You can use an action to try to pin a grappled creature (both restrained until grapple ends).",
  "tavern brawler": "+1 STR or CON. Proficient with improvised weapons. Unarmed strikes deal 1d4. When you hit with unarmed/improvised, bonus action to grapple.",
  "savage attacker": "Once per turn, when you roll damage for a melee weapon attack, you can reroll the weapon's damage dice and use either total.",
  "skulker": "You can try to hide when lightly obscured. Missing a ranged attack while hidden doesn't reveal your position. Dim light doesn't impose disadvantage on Perception.",
  "medium armor master": "No disadvantage on Stealth in medium armor. Max DEX bonus to AC in medium armor is +3 instead of +2.",
  "heavily armored": "+1 STR. You gain proficiency with heavy armor.",
  "heavily armored master": "While wearing heavy armor, reduce bludgeoning, piercing, and slashing damage from nonmagical weapons by 3.",
  "shield master": "Bonus action to shove with your shield after Attack action. Add shield's AC bonus to DEX saves vs effects targeting only you. On successful DEX save for half damage, use reaction to take no damage.",
};

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Get a summary for a feature if one exists, otherwise truncate long descriptions.
 * @param name The feature name
 * @param description The original description
 * @returns The summary, truncated description, or original description
 */
export function getFeatureSummary(name: string, description: string): string {
  const key = name.toLowerCase().trim();
  
  // Check for exact match
  if (FEATURE_SUMMARIES[key]) {
    return FEATURE_SUMMARIES[key];
  }
  
  // Check for partial match (e.g., "Spellcasting (Cleric)" matches "spellcasting (cleric)")
  for (const [summaryKey, summary] of Object.entries(FEATURE_SUMMARIES)) {
    if (key.includes(summaryKey) || summaryKey.includes(key)) {
      return summary;
    }
  }
  
  // No summary found - truncate if needed
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd() + "…";
  }
  
  return description;
}

