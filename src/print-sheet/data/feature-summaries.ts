/**
 * Context derived from the character's current stats used to interpolate
 * placeholders (e.g. {sneakAttackDice}) inside summary strings.
 * All fields are optional/nullable — if a value cannot be computed (because
 * the character doesn't have the relevant class) the placeholder is left as "?".
 */
export interface SummaryContext {
  /** Total character level */
  level: number;
  /** Proficiency bonus (e.g. 3) */
  proficiencyBonus: number;
  /** Per-class levels, used to derive class-specific resources */
  classes: { name: string; level: number }[];
  /** Sneak attack damage dice string, e.g. "3d6". null if not a rogue. */
  sneakAttackDice: string | null;
  /** Total ki points (= monk level). null if not a monk. */
  kiPoints: number | null;
  /** Lay on Hands HP pool (= 5 × paladin level). null if not a paladin. */
  layOnHandsPool: number | null;
  /** Sorcery points (= sorcerer level). null if not a sorcerer. */
  sorceryPoints: number | null;
  /** Bardic Inspiration die size ("d6"/"d8"/"d10"/"d12"). null if not a bard. */
  bardicInspirationDie: string | null;
}

/**
 * Curated summaries for features with lengthy descriptions.
 * Keys are lowercase feature names for case-insensitive matching.
 * Only include features where the original description is excessively long.
 *
 * Placeholders supported (resolved via SummaryContext):
 *   {level}               – total character level
 *   {proficiencyBonus}    – proficiency bonus prefixed with "+" (e.g. "+3")
 *   {sneakAttackDice}     – Sneak Attack damage dice (e.g. "3d6")
 *   {kiPoints}            – ki points (monk level)
 *   {layOnHandsPool}      – Lay on Hands HP pool (5 × paladin level)
 *   {sorceryPoints}       – sorcery points (sorcerer level)
 *   {bardicInspirationDie} – Bardic Inspiration die ("d6"–"d12")
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
  "sneak attack": "Once per turn, deal extra {sneakAttackDice} damage when you hit with a finesse/ranged weapon and have advantage OR an ally within 5ft of target. No disadvantage required.",
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
  "lay on hands": "Touch a creature to restore HP from your pool ({layOnHandsPool} HP). Or spend 5 HP from the pool to cure one disease or neutralize one poison.",
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
  "bardic inspiration": "Bonus action to give one creature within 60ft an Inspiration die ({bardicInspirationDie}). Within 10 minutes, they can add it to one ability check, attack roll, or saving throw.",
  "song of rest": "During a short rest, you or friendly creatures who hear your performance regain extra HP when spending Hit Dice (1d6, increases at higher levels).",
  "countercharm": "As an action, start a performance lasting until end of your next turn. You and friendly creatures within 30ft have advantage on saves vs frightened/charmed.",
  "magical secrets": "Choose two spells from any class's spell list. They count as bard spells for you and don't count against spells known.",

  // ─── Class Features: Monk ───────────────────────────────────────────────────
  "unarmored defense (monk)": "While not wearing armor or a shield, AC = 10 + DEX mod + WIS mod.",
  "martial arts": "While unarmed or using monk weapons and not wearing armor/shield: use DEX for attack/damage, roll martial arts die for damage, bonus action unarmed strike after Attack action.",
  "ki": "You have {kiPoints} ki points. Spend them on special abilities. All ki points restore on short or long rest.",
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
  "font of magic": "You have {sorceryPoints} sorcery points. Convert spell slots to sorcery points or vice versa. Restore all on long rest.",
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
  "alert": "Add your Proficiency Bonus to Initiative rolls. After rolling Initiative, you can swap your result with one willing ally in the same combat (neither of you can be Incapacitated).",
  "tough": "Your HP maximum increases by 2 × your level. Each time you gain a level, your HP max increases by 2.",
  "observant": "+5 to passive Perception and passive Investigation. You can read lips if you can see and understand the language.",
  "magic initiate": "Choose Cleric, Druid, or Wizard. Learn 2 cantrips and 1 level-1 spell from that list. The spell is always prepared; cast it once without a slot (recharges on Long Rest), or use any spell slot you have. On each new character level, you can swap one chosen spell for another of the same level from the same list. INT, WIS, or CHA is your spellcasting ability. Repeatable (different list each time).",
  "ritual caster": "You gain a ritual book with two 1st-level ritual spells. You can cast spells from the book as rituals. You can copy new rituals you find into the book.",
  "elemental adept": "Choose a damage type (acid, cold, fire, lightning, or thunder). Spells you cast ignore resistance to that type. When you roll damage, treat any 1 as a 2.",
  "inspiring leader": "Spend 10 minutes to give up to 6 creatures (including yourself) temporary HP equal to your level + CHA modifier. Creatures can only benefit once per rest.",
  "healer": "When you use a healer's kit to stabilize, the creature regains 1 HP. As an action, spend one use to restore 1d6+4 HP + additional HP equal to creature's max Hit Dice. A creature can only benefit once per rest.",
  "mage slayer": "When a creature within 5ft casts a spell, use reaction to attack it. Creatures you damage have disadvantage on concentration saves. Advantage on saves against spells cast within 5ft of you.",
  "dual wielder": "+1 AC while wielding two weapons. You can two-weapon fight with non-light weapons. You can draw/stow two weapons at once.",
  "defensive duelist": "While wielding a finesse weapon, use reaction to add proficiency bonus to AC against one attack that would hit you.",
  "athlete": "+1 STR or DEX. Standing from prone costs only 5ft. Climbing doesn't cost extra movement. Running long/high jumps require only 5ft movement.",
  "charger": "When you Dash, use bonus action to make one melee attack (+5 damage) or shove a creature.",
  "grappler": "+1 STR or DEX (max 20). When you hit with an Unarmed Strike as part of the Attack action, you can use both the Damage and Grapple options (once per turn). Advantage on attacks against creatures you are grappling. No extra movement required to move a grappled creature of your size or smaller.",
  "tavern brawler": "+1 STR or CON. Proficient with improvised weapons. Unarmed strikes deal 1d4. When you hit with unarmed/improvised, bonus action to grapple.",
  "savage attacker": "Once per turn when you hit a target with a weapon, roll the weapon's damage dice twice and use either result.",
  "skulker": "You can try to hide when lightly obscured. Missing a ranged attack while hidden doesn't reveal your position. Dim light doesn't impose disadvantage on Perception.",
  "medium armor master": "No disadvantage on Stealth in medium armor. Max DEX bonus to AC in medium armor is +3 instead of +2.",
  "heavily armored": "+1 STR. You gain proficiency with heavy armor.",
  "heavily armored master": "While wearing heavy armor, reduce bludgeoning, piercing, and slashing damage from nonmagical weapons by 3.",
  "shield master": "Bonus action to shove with your shield after Attack action. Add shield's AC bonus to DEX saves vs effects targeting only you. On successful DEX save for half damage, use reaction to take no damage.",
  // NOTE: Musician and Crafter are 2024 PHB-only content — they are NOT part of the
  // CC-BY-4.0 SRD (feats24/origin-feats returns 404 for both). No summaries may be
  // provided for them to avoid copyright infringement.
};

const MAX_DESCRIPTION_LENGTH = 750;

/**
 * Replace {placeholder} tokens inside a summary string with values from a
 * SummaryContext. Any placeholder whose corresponding value is null/undefined
 * is replaced with "?" so the output is always human-readable.
 */
function interpolate(text: string, ctx: SummaryContext): string {
  return text
    .replace(/\{level\}/g, String(ctx.level))
    .replace(/\{proficiencyBonus\}/g, `+${ctx.proficiencyBonus}`)
    .replace(/\{sneakAttackDice\}/g, ctx.sneakAttackDice ?? "?")
    .replace(/\{kiPoints\}/g, ctx.kiPoints != null ? String(ctx.kiPoints) : "?")
    .replace(/\{layOnHandsPool\}/g, ctx.layOnHandsPool != null ? String(ctx.layOnHandsPool) : "?")
    .replace(/\{sorceryPoints\}/g, ctx.sorceryPoints != null ? String(ctx.sorceryPoints) : "?")
    .replace(/\{bardicInspirationDie\}/g, ctx.bardicInspirationDie ?? "?");
}

/**
 * Attempt to extract a concise summary from a feature description by parsing
 * the standard dnd5e benefit format:
 *
 *   <p><strong>Benefit Name.</strong> First sentence of explanation...</p>
 *
 * This is used as the middle step in the fallback chain for descriptions that
 * exceed MAX_DESCRIPTION_LENGTH but have no curated summary. Because parsing
 * occurs at runtime from content already loaded in the user's Foundry instance,
 * this approach is legally safe for any content (PHB, third-party, homebrew).
 *
 * @param html  Raw HTML description (after Foundry enriched-text stripping,
 *              but before generic HTML tag removal). `<p>`, `<strong>`, and
 *              `<table>` tags are expected to be present.
 * @returns     A condensed plain-text summary, or `null` if the description
 *              does not follow the structured benefit pattern or if the result
 *              would still exceed MAX_DESCRIPTION_LENGTH.
 */
export function extractStructuredSummary(html: string): string | null {
  if (!html || !html.trim()) return null;

  // Remove <table>…</table> blocks entirely — tables (like Fast Crafting) are
  // not distillable into inline text and are the primary cause of overflow.
  const withoutTables = html.replace(/<table[\s\S]*?<\/table>/gi, "");

  // Extract individual <p>…</p> blocks to avoid bleeding across paragraphs.
  const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const benefits: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(withoutTables)) !== null) {
    const inner = match[1];

    // Look for the dnd5e structured benefit pattern:
    //   <strong>Heading text</strong> followed by a period (inside or immediately after the tag)
    // Handles both `<strong>Name.</strong>` and `<strong>Name</strong>.`
    const headingPattern = /<strong[^>]*>([\s\S]*?)<\/strong>\.?\s*/i;
    const headingMatch = headingPattern.exec(inner);
    if (!headingMatch) continue;

    // Strip any HTML inside the heading (e.g. <strong><em>Name</em></strong>)
    const headingRaw = headingMatch[1].replace(/<[^>]*>/g, "").trim();

    // Remove trailing period from heading if present (we'll add our own separator)
    const heading = headingRaw.replace(/\.$/, "").trim();
    if (!heading) continue;

    // Get the text after the <strong> block — this is the benefit description
    const afterHeading = inner.slice(headingMatch.index + headingMatch[0].length);

    // Strip remaining HTML tags to get plain text
    const plainText = afterHeading.replace(/<[^>]*>/g, "").trim();
    if (!plainText) continue;

    // Extract only the first sentence (ends at . ! or ?)
    const sentenceEnd = plainText.search(/[.!?]/);
    const firstSentence = sentenceEnd >= 0
      ? plainText.slice(0, sentenceEnd + 1).trim()
      : plainText.trim();

    if (firstSentence) {
      benefits.push(`${heading}: ${firstSentence}`);
    }
  }

  // Require at least 2 structured benefits — if there's only one, the description
  // probably isn't using the structured format and truncation is more appropriate.
  if (benefits.length < 2) return null;

  const result = benefits.join(" ");

  // If structural parsing didn't actually shorten it enough, don't use it.
  if (result.length > MAX_DESCRIPTION_LENGTH) return null;

  return result;
}

/**
 * Get a summary for a feature if one exists, otherwise truncate long descriptions.
 * Pass an optional SummaryContext to resolve character-specific placeholders
 * (e.g. {sneakAttackDice}, {proficiencyBonus}) in the curated summary strings.
 *
 * Fallback chain (in order):
 *   1. Curated SRD summary map (exact match)
 *   2. Curated SRD summary map (partial match)
 *   3. Runtime structural parser — extracts <strong>Heading.</strong> benefits
 *      from the raw HTML the user already owns (legal for any content)
 *   4. Dumb truncation at MAX_DESCRIPTION_LENGTH
 *
 * @param name        The feature name
 * @param description The plain-text (HTML-stripped) description
 * @param context     Optional character context for placeholder interpolation
 * @param rawHtml     Optional raw HTML description for structural parsing (step 3)
 * @returns           The summary, structurally extracted text, truncated description, or original
 */
export function getFeatureSummary(
  name: string,
  description: string,
  context?: SummaryContext,
  rawHtml?: string,
): string {
  const key = name.toLowerCase().trim();

  // Step 1 — Check for exact match in curated map
  if (FEATURE_SUMMARIES[key]) {
    const summary = FEATURE_SUMMARIES[key];
    return context ? interpolate(summary, context) : summary;
  }

  // Step 2 — Qualified-name partial match.
  //
  // Only allow a match when the feature key starts with the summary key (or vice versa)
  // AND the next character is the start of a recognised qualifier:
  //   • " ("  → parenthetical class/variant, e.g. "Spellcasting (Cleric)"
  //   • ": "  → colon subtype, e.g. "Channel Divinity: Sacred Weapon"
  //
  // This prevents short keys like "ki" or "rage" from matching unrelated feature names
  // such as "skilled" (contains "ki"), "storage" (contains "rage"), etc.
  //
  // When multiple summary keys match (shouldn't happen with well-formed data, but
  // possible), prefer the LONGEST key so "spellcasting (cleric)" beats "spellcasting".
  const qualifiedSeparators = [" (", ": "];

  const isQualifiedMatch = (longer: string, shorter: string): boolean => {
    if (!longer.startsWith(shorter)) return false;
    const rest = longer.slice(shorter.length);
    return rest === "" || qualifiedSeparators.some(sep => rest.startsWith(sep));
  };

  let bestKey: string | null = null;
  let bestSummary: string | null = null;

  for (const [summaryKey, summary] of Object.entries(FEATURE_SUMMARIES)) {
    if (isQualifiedMatch(key, summaryKey) || isQualifiedMatch(summaryKey, key)) {
      // Prefer longest matching key for specificity
      if (bestKey === null || summaryKey.length > bestKey.length) {
        bestKey = summaryKey;
        bestSummary = summary;
      }
    }
  }

  if (bestSummary !== null) {
    return context ? interpolate(bestSummary, context) : bestSummary;
  }

  // Step 3 — Runtime structural parsing from raw HTML (safe for any user-owned content)
  if (description.length > MAX_DESCRIPTION_LENGTH && rawHtml) {
    const structural = extractStructuredSummary(rawHtml);
    if (structural) return context ? interpolate(structural, context) : structural;
  }

  // Step 4 — Dumb truncation fallback
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    const truncated = description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd() + "…";
    return context ? interpolate(truncated, context) : truncated;
  }

  // Return full description, still applying interpolation so {token} placeholders
  // in homebrew/PHB descriptions resolve to real character values.
  return context ? interpolate(description, context) : description;
}

