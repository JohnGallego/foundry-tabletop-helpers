/**
 * Quick Rules Reference — Rule Data
 *
 * All rule entries as typed TypeScript objects for the 2024 D&D rules revision.
 * Organized into Tier 1 (at-a-glance cards) and categorized Tier 2 entries.
 */

import type { RuleEntry, RuleCategory } from "./rules-reference-types";

/* ═══════════════════════════════════════════════════════════
 * Tier 1 — At-a-Glance Cards (10 most-referenced rules)
 * ═══════════════════════════════════════════════════════════ */

export const TIER_1_RULES: readonly RuleEntry[] = [
  {
    id: "conditions",
    title: "Conditions",
    tags: ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"],
    tier: 1,
    summary: "15 conditions. Exhaustion now uses 10 levels (−2 per level to d20 rolls, speed). Grappled = speed 0. Prone = disadvantage on attacks.",
    body: `<strong>Blinded</strong> — Auto-fail sight checks; attacks have Disadvantage, attacks against have Advantage.<br>
<strong>Charmed</strong> — Can't attack the charmer; charmer has Advantage on social checks.<br>
<strong>Deafened</strong> — Auto-fail hearing checks.<br>
<strong>Exhaustion</strong> — 10 levels: −2 per level to d20 rolls and spell save DCs; speed reduced by 5×level ft. Level 10 = death.<br>
<strong>Frightened</strong> — Disadvantage on ability checks and attacks while source is in line of sight; can't willingly move closer to source.<br>
<strong>Grappled</strong> — Speed becomes 0; attacks against grappler aren't affected. Escape via Unarmed Strike (damage or shove) or escape action.<br>
<strong>Incapacitated</strong> — Can't take Actions, Bonus Actions, or Reactions.<br>
<strong>Invisible</strong> — Heavily Obscured; attacks have Advantage, attacks against have Disadvantage.<br>
<strong>Paralyzed</strong> — Incapacitated, auto-fail STR/DEX saves, attacks have Advantage, hits within 5ft are crits.<br>
<strong>Petrified</strong> — Weight ×10, aging stops, Incapacitated, auto-fail STR/DEX saves, Resistance to all damage, immune to poison/disease.<br>
<strong>Poisoned</strong> — Disadvantage on attack rolls and ability checks.<br>
<strong>Prone</strong> — Disadvantage on attacks; melee within 5ft has Advantage, ranged has Disadvantage. Standing costs half speed.<br>
<strong>Restrained</strong> — Speed 0, attacks have Disadvantage, attacks against have Advantage, Disadvantage on DEX saves.<br>
<strong>Stunned</strong> — Incapacitated, auto-fail STR/DEX saves, attacks against have Advantage.<br>
<strong>Unconscious</strong> — Incapacitated, drop everything, fall Prone, auto-fail STR/DEX saves, attacks have Advantage, hits within 5ft are crits.`,
    keyStats: [
      { label: "Total", value: "15" },
      { label: "Exhaustion", value: "10 lvl" },
    ],
  },
  {
    id: "combat-actions",
    title: "Combat Actions",
    tags: ["attack", "cast", "dash", "disengage", "dodge", "help", "hide", "influence", "magic", "ready", "search", "study", "utilize", "action"],
    tier: 1,
    summary: "13 actions: Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize. Plus any special actions.",
    body: `<strong>Attack</strong> — Make weapon or Unarmed Strike attacks (multiple if Extra Attack).<br>
<strong>Dash</strong> — Gain extra movement equal to your speed.<br>
<strong>Disengage</strong> — Movement doesn't provoke Opportunity Attacks for the rest of the turn.<br>
<strong>Dodge</strong> — Attacks against you have Disadvantage (if you can see the attacker); Advantage on DEX saves. Lost if Incapacitated or speed drops to 0.<br>
<strong>Help</strong> — Give Advantage on one ability check or attack roll (next roll before your next turn). Must be within 5ft of target or creature being helped against.<br>
<strong>Hide</strong> — Make a Stealth check (DC = passive Perception of searchers). On success, you have the Invisible condition benefits for attacks.<br>
<strong>Influence</strong> — Make a Charisma check to alter a creature's attitude (new 2024 action).<br>
<strong>Magic</strong> — Cast a spell, use a magic item, or use a magical feature.<br>
<strong>Ready</strong> — Set a trigger and a reaction response (spell requires Concentration until triggered). Uses your Reaction.<br>
<strong>Search</strong> — Make Perception or Investigation check to find something.<br>
<strong>Study</strong> — Make a check to learn information about a creature or object (new 2024 action).<br>
<strong>Utilize</strong> — Interact with a second object, use a non-magical feature, or other activities (new 2024 action).`,
    keyStats: [
      { label: "Actions", value: "13" },
    ],
  },
  {
    id: "death-saves",
    title: "Death Saves",
    tags: ["dying", "unconscious", "death saving throw", "nat 20", "stabilize", "healing", "instant death"],
    tier: 1,
    summary: "CON save DC 10 at start of each turn. 3 successes = stabilize, 3 failures = death. Nat 20 = regain 1 HP. Nat 1 = 2 failures.",
    body: `When you start your turn with 0 HP, make a <strong>DC 10 Constitution saving throw</strong> (Death Save).<br><br>
<strong>Success</strong> — 3 successes: you stabilize (Unconscious but no longer rolling).<br>
<strong>Failure</strong> — 3 failures: you die.<br>
<strong>Nat 20</strong> — Regain 1 HP and become conscious.<br>
<strong>Nat 1</strong> — Counts as 2 failures.<br>
<strong>Damage at 0 HP</strong> — Each hit = 1 death save failure. Critical hit = 2 failures.<br>
<strong>Instant Death</strong> — If remaining damage after hitting 0 HP ≥ your HP maximum, you die instantly.<br>
<strong>Stabilized</strong> — Regain 1 HP after 1d4 hours. Healing of any amount restores consciousness.`,
    keyStats: [
      { label: "DC", value: "10" },
      { label: "Save", value: "CON" },
      { label: "Nat 20", value: "1 HP" },
    ],
  },
  {
    id: "concentration",
    title: "Concentration",
    tags: ["concentration check", "con save", "spellcasting", "maintain", "break concentration"],
    tier: 1,
    summary: "CON save DC = max(10, damage÷2). Lost on: casting another concentration spell, incapacitated, or killed.",
    body: `When you take damage while concentrating, make a <strong>Constitution saving throw</strong>.<br><br>
<strong>DC</strong> = the greater of <strong>10</strong> or <strong>half the damage taken</strong> (round down).<br>
<strong>Multiple hits</strong> — Roll separately for each source of damage.<br><br>
Concentration also ends if you:<br>
• Cast another spell that requires Concentration<br>
• Become Incapacitated or die<br>
• The DM decides an environmental effect warrants a check<br><br>
<strong>Duration</strong> — Up to the time listed in the spell description (e.g., "up to 1 minute"). You can end it voluntarily at any time (no action required).`,
    keyStats: [
      { label: "DC", value: "max(10, dmg÷2)" },
      { label: "Save", value: "CON" },
    ],
  },
  {
    id: "cover",
    title: "Cover",
    tags: ["half cover", "three-quarters cover", "total cover", "ac bonus", "dex save"],
    tier: 1,
    summary: "Half: +2 AC & DEX saves. Three-Quarters: +5 AC & DEX saves. Total: can't be targeted directly.",
    body: `<strong>Half Cover (+2)</strong> — Obstacle blocks at least half the target. +2 bonus to AC and DEX saving throws. Examples: low wall, furniture, another creature.<br><br>
<strong>Three-Quarters Cover (+5)</strong> — Obstacle blocks at least three-quarters. +5 bonus to AC and DEX saving throws. Examples: arrow slit, thick tree trunk.<br><br>
<strong>Total Cover</strong> — Completely concealed. Can't be targeted directly by attacks or spells (but area effects can still reach).<br><br>
<strong>2024 change</strong> — Other creatures no longer automatically provide half cover. DM adjudicates based on size and positioning.`,
    keyStats: [
      { label: "Half", value: "+2" },
      { label: "¾", value: "+5" },
      { label: "Total", value: "No target" },
    ],
  },
  {
    id: "surprise",
    title: "Surprise",
    tags: ["surprised", "ambush", "initiative", "stealth", "first round"],
    tier: 1,
    summary: "No separate surprise round. Surprised creatures have Disadvantage on their Initiative roll.",
    body: `<strong>2024 Revision</strong> — Surprise no longer skips turns. Instead:<br><br>
• Compare the ambushing group's <strong>Stealth checks</strong> against each target's <strong>Passive Perception</strong>.<br>
• Any creature that didn't notice a threat has <strong>Disadvantage on their Initiative roll</strong>.<br>
• Combat proceeds normally — surprised creatures still get their full turn, they just tend to go later in initiative order.<br><br>
This replaces the 2014 "Surprised condition" where affected creatures couldn't act on the first round.`,
    keyStats: [
      { label: "Effect", value: "Disadv. Init" },
    ],
  },
  {
    id: "opportunity-attacks",
    title: "Opportunity Attacks",
    tags: ["reaction", "leaving reach", "melee attack", "aoo", "opportunity attack"],
    tier: 1,
    summary: "Triggered when a creature leaves your melee reach. Uses Reaction. One melee attack only (Unarmed Strike allowed).",
    body: `<strong>Trigger</strong> — A creature you can see moves out of your melee reach using its action, Bonus Action, or movement.<br><br>
<strong>The Attack</strong> — Make <strong>one melee attack</strong> (weapon attack or Unarmed Strike) as a Reaction. Uses your Reaction for the round.<br><br>
<strong>Doesn't trigger on</strong>:<br>
• Forced movement (shove, spell push, grapple drag)<br>
• Teleportation<br>
• When the creature uses the Disengage action<br>
• Moving within your reach (only leaving triggers it)<br><br>
<strong>2024 note</strong> — Unarmed Strikes can now be used for Opportunity Attacks.`,
    keyStats: [
      { label: "Cost", value: "Reaction" },
      { label: "Attacks", value: "1 melee" },
    ],
  },
  {
    id: "two-weapon-fighting",
    title: "Two-Weapon Fighting",
    tags: ["dual wield", "bonus action", "light weapon", "offhand", "nick", "weapon mastery", "twf"],
    tier: 1,
    summary: "Both weapons must have Light property. Bonus Action for second attack. No ability mod to damage unless you have the fighting style.",
    body: `<strong>Requirements</strong> — Both weapons must have the <strong>Light</strong> property.<br><br>
<strong>Bonus Action attack</strong> — When you take the Attack action with a Light weapon, you can make one extra attack with the other Light weapon as a <strong>Bonus Action</strong>.<br><br>
<strong>Damage modifier</strong> — Don't add your ability modifier to the damage of the Bonus Action attack, <em>unless</em> you have the <strong>Two-Weapon Fighting</strong> style.<br><br>
<strong>Nick Mastery</strong> — If a weapon has the Nick mastery property, the extra attack doesn't cost a Bonus Action (it's part of the Attack action instead). This lets you still use your Bonus Action for other things.<br><br>
<strong>Drawing weapons</strong> — You can draw or stow two weapons when you would normally draw or stow one (2024 rule).`,
    keyStats: [
      { label: "Req", value: "Light" },
      { label: "Cost", value: "Bonus Action" },
    ],
  },
  {
    id: "typical-dcs",
    title: "Typical DCs",
    tags: ["difficulty class", "dc", "easy", "medium", "hard", "very hard", "nearly impossible", "ability check"],
    tier: 1,
    summary: "Easy 10, Medium 15, Hard 20, Very Hard 25, Nearly Impossible 30.",
    body: `<strong>DC 5</strong> — Very Easy: almost anyone can do this.<br>
<strong>DC 10</strong> — Easy: a straightforward task, most competent people succeed.<br>
<strong>DC 15</strong> — Medium: requires focus or skill. The default "baseline" difficulty.<br>
<strong>DC 20</strong> — Hard: highly skilled characters succeed regularly; others struggle.<br>
<strong>DC 25</strong> — Very Hard: even experts find this challenging.<br>
<strong>DC 30</strong> — Nearly Impossible: legendary-level feat.<br><br>
<strong>Tip</strong> — If no check is needed, don't ask for one. Use DC 10 only when failure is interesting. DC 15 is the workhorse difficulty.`,
    keyStats: [
      { label: "Easy", value: "10" },
      { label: "Medium", value: "15" },
      { label: "Hard", value: "20" },
      { label: "V. Hard", value: "25" },
      { label: "Imp.", value: "30" },
    ],
  },
  {
    id: "light-and-vision",
    title: "Light & Vision",
    tags: ["bright light", "dim light", "darkness", "heavily obscured", "lightly obscured", "darkvision", "blindsight", "truesight", "torch"],
    tier: 1,
    summary: "Bright: normal. Dim: Lightly Obscured (Disadvantage on Perception). Darkness: Heavily Obscured (effectively Blinded).",
    body: `<strong>Bright Light</strong> — Normal vision. Most environments during the day.<br>
<strong>Dim Light</strong> — Creates a <em>Lightly Obscured</em> area. Disadvantage on Perception checks relying on sight. Shadows, twilight, moderately foliage.<br>
<strong>Darkness</strong> — Creates a <em>Heavily Obscured</em> area. Creatures are effectively Blinded.<br><br>
<strong>Darkvision</strong> — Treat darkness as dim light within range (typically 60ft). Treat dim light as bright light. Still can't discern color, only shades of gray.<br>
<strong>Blindsight</strong> — Perceive surroundings without sight within range.<br>
<strong>Truesight</strong> — See in darkness, see invisible, detect illusions, see into Ethereal, all within range.<br><br>
<strong>Common light sources</strong>: Candle (5ft bright/5ft dim), Torch (20ft bright/20ft dim), Lantern (30ft bright/30ft dim), Light cantrip (20ft bright/20ft dim), Daylight spell (60ft bright/60ft dim).`,
    keyStats: [
      { label: "Torch", value: "20/20 ft" },
      { label: "Darkvision", value: "60 ft" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
 * Tier 2 — Categorized Rules (accordion sections)
 * ═══════════════════════════════════════════════════════════ */

export const RULE_CATEGORIES: readonly RuleCategory[] = [
  /* ── Movement & Terrain ────────────────────────────────── */
  {
    id: "movement",
    label: "Movement & Terrain",
    icon: "fa-solid fa-person-walking",
    entries: [
      {
        id: "difficult-terrain",
        title: "Difficult Terrain",
        tags: ["movement", "half speed", "terrain", "rubble", "undergrowth"],
        tier: 2,
        summary: "Every foot costs 1 extra foot of movement. Doesn't affect forced movement.",
        body: `Moving 1 foot in Difficult Terrain costs <strong>2 feet of movement</strong>.<br><br>
Examples: dense forest, rubble, ice, mud, shallow water, steep stairs, thick undergrowth, furniture-cluttered rooms.<br><br>
<strong>Multiple sources don't stack</strong> — difficult terrain is either present or not; two overlapping sources don't make it cost 3 feet.<br>
<strong>Forced movement</strong> is unaffected by Difficult Terrain.<br>
<strong>Creatures</strong> — A space occupied by another creature (hostile or not) counts as Difficult Terrain.`,
        keyStats: [{ label: "Cost", value: "2× movement" }],
      },
      {
        id: "jumping",
        title: "Jumping",
        tags: ["long jump", "high jump", "strength", "athletics", "leap"],
        tier: 2,
        summary: "Long jump: STR score in feet (running), half standing. High jump: 3 + STR mod feet (running), half standing.",
        body: `<strong>Long Jump</strong> — With 10ft running start: jump up to your <strong>STR score</strong> in feet. Standing: half that distance. Either way, costs movement.<br><br>
<strong>High Jump</strong> — With 10ft running start: leap <strong>3 + STR modifier</strong> feet into the air. Standing: half that height. Arms extend 1½× your height during the jump.<br><br>
<strong>Clearing obstacles</strong> — You can clear obstacles up to ¼ of the jump distance. Low obstacles (≤ ¼ height for high jump) can be cleared automatically.<br>
<strong>Athletics check</strong> — DM can require an Athletics check for difficult jumps (landing on slippery or narrow surfaces).`,
        keyStats: [
          { label: "Long", value: "STR score ft" },
          { label: "High", value: "3+STR mod ft" },
        ],
      },
      {
        id: "climbing-swimming",
        title: "Climbing & Swimming",
        tags: ["climb", "swim", "movement cost", "Athletics"],
        tier: 2,
        summary: "Each foot costs 1 extra foot of movement (unless you have a climb/swim speed). Athletics check for hazardous surfaces.",
        body: `<strong>Cost</strong> — Each foot of climbing or swimming costs <strong>1 extra foot of movement</strong> (effectively half speed). If you have a climb or swim speed, use it at normal rate instead.<br><br>
<strong>Hazardous surfaces</strong> — DM may require a <strong>STR (Athletics)</strong> check for slippery vertical surfaces, rough water, or similar hazards.<br><br>
<strong>Underwater</strong> — Without a swim speed, creatures have Disadvantage on melee attack rolls with non-aquatic weapons. Ranged weapon attacks auto-miss beyond normal range.`,
        keyStats: [{ label: "Cost", value: "2× movement" }],
      },
      {
        id: "falling",
        title: "Falling",
        tags: ["fall damage", "1d6", "prone", "flying", "landing"],
        tier: 2,
        summary: "1d6 bludgeoning per 10 ft fallen (max 20d6). Land Prone unless damage is avoided.",
        body: `<strong>Damage</strong> — <strong>1d6 bludgeoning damage per 10 feet</strong> fallen, maximum <strong>20d6</strong> (200 ft).<br>
<strong>Landing</strong> — Creature lands <strong>Prone</strong> unless it avoids all fall damage.<br>
<strong>Flying creatures</strong> — If speed is reduced to 0 or otherwise unable to move, the creature falls.<br><br>
<strong>Falling into water</strong> — DM may reduce damage for deep water (typically half damage or Acrobatics check to negate).`,
        keyStats: [
          { label: "Damage", value: "1d6/10 ft" },
          { label: "Max", value: "20d6" },
        ],
      },
      {
        id: "crawling",
        title: "Crawling",
        tags: ["prone", "crawl", "movement", "half speed", "standing"],
        tier: 2,
        summary: "While Prone, movement costs 1 extra foot per foot. Standing up costs half your speed.",
        body: `<strong>Crawling</strong> — Every foot of movement while Prone costs <strong>1 extra foot</strong> (like Difficult Terrain, and they stack).<br>
<strong>Standing up</strong> — Costs <strong>half your speed</strong>. You can't stand if your remaining speed is 0.<br>
<strong>Dropping Prone</strong> — Costs <strong>no movement</strong>.`,
        keyStats: [
          { label: "Crawl", value: "2× movement" },
          { label: "Stand", value: "½ speed" },
        ],
      },
      {
        id: "flying",
        title: "Flying",
        tags: ["fly", "flight", "hover", "falling", "speed reduced"],
        tier: 2,
        summary: "Fall if speed reduced to 0 or knocked Prone (unless you can hover). No Opportunity Attacks when flying out of reach.",
        body: `<strong>Flying movement</strong> — A creature with a fly speed can use it to move through the air. If the creature is not hovering, it falls if:<br>
• Its speed is reduced to 0<br>
• It is knocked Prone<br>
• It is otherwise deprived of the ability to move<br><br>
<strong>Hovering</strong> — Creatures that can hover don't fall from any of the above conditions.<br>
<strong>Flying and Opportunity Attacks</strong> — Moving out of a creature's reach while flying still provokes Opportunity Attacks normally.`,
        keyStats: [{ label: "Fall if", value: "Speed 0 / Prone" }],
      },
    ],
  },

  /* ── Exploration & Travel ──────────────────────────────── */
  {
    id: "exploration",
    label: "Exploration & Travel",
    icon: "fa-solid fa-compass",
    entries: [
      {
        id: "travel-pace",
        title: "Travel Pace",
        tags: ["overland", "travel", "fast pace", "normal pace", "slow pace", "stealth", "passive perception", "miles per day"],
        tier: 2,
        summary: "Fast: 4 mph (−5 passive Perception). Normal: 3 mph. Slow: 2 mph (can use stealth). 8 hours/day typical.",
        body: `<strong>Fast</strong> — 400 ft/min, 4 miles/hour, 30 miles/day. <strong>−5 penalty to passive Perception</strong>. Can't use Stealth.<br>
<strong>Normal</strong> — 300 ft/min, 3 miles/hour, 24 miles/day.<br>
<strong>Slow</strong> — 200 ft/min, 2 miles/hour, 18 miles/day. <strong>Can use Stealth.</strong><br><br>
<strong>Travel day</strong> — 8 hours of travel. Beyond that, CON save each hour (DC 10 + hours past 8) or gain 1 Exhaustion level.<br>
<strong>Mounts</strong> — Can gallop for 1 hour at double pace, then travel at normal pace.`,
        keyStats: [
          { label: "Fast", value: "4 mph" },
          { label: "Normal", value: "3 mph" },
          { label: "Slow", value: "2 mph" },
        ],
      },
      {
        id: "foraging",
        title: "Foraging",
        tags: ["survival", "food", "water", "wilderness", "forage", "rations"],
        tier: 2,
        summary: "Survival check during travel (slow pace). DC depends on terrain: 10 (abundant) to 20 (barren).",
        body: `<strong>Requirements</strong> — Must be traveling at slow pace or spending time foraging instead of traveling.<br><br>
<strong>WIS (Survival) check</strong>:<br>
• <strong>DC 10</strong> — Abundant food/water (forest, grassland)<br>
• <strong>DC 15</strong> — Limited (hills, coast, desert oasis)<br>
• <strong>DC 20</strong> — Very scarce (desert, arctic, underdark)<br><br>
<strong>On success</strong> — Find 1d6 + WIS modifier pounds of food and/or gallons of water.<br>
<strong>Needs</strong> — 1 pound of food and 1 gallon of water per creature per day (2 gallons in hot weather).`,
        keyStats: [
          { label: "Easy", value: "DC 10" },
          { label: "Hard", value: "DC 20" },
        ],
      },
      {
        id: "navigation",
        title: "Navigation",
        tags: ["navigator", "lost", "survival", "map", "compass"],
        tier: 2,
        summary: "Navigator makes Survival check to avoid getting lost. DC 10 (road) to DC 20 (dense forest, open sea).",
        body: `The party's navigator makes a <strong>WIS (Survival) check</strong> to stay on course:<br><br>
<strong>DC 10</strong> — Road, well-marked trail, clear landmarks<br>
<strong>DC 15</strong> — Wilderness with some landmarks, overcast conditions<br>
<strong>DC 20</strong> — Dense forest, swamp, underground, open sea, heavy weather<br><br>
<strong>Getting lost</strong> — On failure, the party veers off course. DM determines direction and distance. Party may not realize they're lost until they encounter an unexpected landmark (or fail to encounter an expected one).`,
        keyStats: [
          { label: "Road", value: "DC 10" },
          { label: "Wild", value: "DC 15" },
          { label: "Dense", value: "DC 20" },
        ],
      },
    ],
  },

  /* ── Resting & Recovery ────────────────────────────────── */
  {
    id: "resting",
    label: "Resting & Recovery",
    icon: "fa-solid fa-campground",
    entries: [
      {
        id: "short-rest",
        title: "Short Rest",
        tags: ["short rest", "hit dice", "1 hour", "healing", "recovery"],
        tier: 2,
        summary: "1 hour of downtime. Spend Hit Dice to heal (roll + CON mod per die).",
        body: `<strong>Duration</strong> — At least <strong>1 hour</strong> of resting: eating, drinking, reading, tending wounds, standing watch.<br><br>
<strong>Hit Dice</strong> — Spend any number of Hit Dice. For each die spent, roll it and add your <strong>CON modifier</strong>. Regain that many HP (minimum 0).<br><br>
<strong>Features</strong> — Many class features (Warlock spell slots, Fighter's Second Wind, Monk's Ki) recharge on a Short Rest.`,
        keyStats: [
          { label: "Duration", value: "1 hour" },
          { label: "Healing", value: "Hit Dice + CON" },
        ],
      },
      {
        id: "long-rest",
        title: "Long Rest",
        tags: ["long rest", "8 hours", "full heal", "hit dice recovery", "spell slots", "1 per day"],
        tier: 2,
        summary: "8 hours (at least 6 sleeping). Regain all HP, half your max Hit Dice (min 1), all spell slots. Once per 24 hours.",
        body: `<strong>Duration</strong> — At least <strong>8 hours</strong>, at least 6 of which are sleeping. Up to 2 hours of light activity (reading, talking, eating, keeping watch).<br><br>
<strong>Recovery</strong>:<br>
• Regain <strong>all lost HP</strong><br>
• Regain spent Hit Dice up to <strong>half your maximum</strong> (minimum 1)<br>
• Regain all expended <strong>spell slots</strong><br>
• <strong>Exhaustion</strong> — Reduce by 1 level (requires food and drink)<br><br>
<strong>Limit</strong> — Can't benefit from more than one Long Rest in a <strong>24-hour period</strong>.<br>
<strong>Interruption</strong> — If interrupted by 1+ hour of strenuous activity (fighting, casting spells, marching), must restart.`,
        keyStats: [
          { label: "Duration", value: "8 hours" },
          { label: "HD back", value: "½ max" },
          { label: "Limit", value: "1/24 hrs" },
        ],
      },
      {
        id: "interrupted-rest",
        title: "Interrupting a Rest",
        tags: ["rest", "interrupted", "combat", "strenuous activity"],
        tier: 2,
        summary: "Short Rest: combat restarts the timer. Long Rest: 1+ hour of strenuous activity forces restart.",
        body: `<strong>Short Rest</strong> — Any combat or strenuous activity interrupts the rest. Must start a new 1-hour period.<br><br>
<strong>Long Rest</strong> — If interrupted by at least <strong>1 hour</strong> of strenuous activity (fighting, walking, casting spells), the rest must start over.<br>
Brief interruptions (a single combat encounter of a few rounds) don't typically invalidate a Long Rest, as long as the total strenuous activity stays under 1 hour.`,
        keyStats: [
          { label: "Long Rest", value: "1 hr activity = restart" },
        ],
      },
    ],
  },

  /* ── Combat Mechanics ──────────────────────────────────── */
  {
    id: "combat-mechanics",
    label: "Combat Mechanics",
    icon: "fa-solid fa-swords",
    entries: [
      {
        id: "grapple",
        title: "Grapple",
        tags: ["grapple", "grappled", "athletics", "acrobatics", "unarmed strike", "escape", "restrain"],
        tier: 2,
        summary: "Replaces one Attack. STR (Athletics) vs target's STR (Athletics) or DEX (Acrobatics). Target's speed becomes 0.",
        body: `<strong>2024 Rules</strong> — Grappling is now part of <strong>Unarmed Strike</strong> (replaces one attack).<br><br>
<strong>To Grapple</strong> — Make an Unarmed Strike. Instead of dealing damage, the target must succeed on a <strong>STR (Athletics) or DEX (Acrobatics)</strong> check (target's choice) against your <strong>STR (Athletics) check</strong> result, or it has the Grappled condition.<br><br>
<strong>Grappled</strong> — Speed becomes 0. No other penalties.<br>
<strong>Moving a Grappled creature</strong> — When you move, you can drag or carry the creature. Your speed is halved unless the creature is two or more sizes smaller.<br>
<strong>Escape</strong> — The grappled creature uses its action to make STR (Athletics) or DEX (Acrobatics) vs your STR (Athletics). Or it can use an Unarmed Strike to escape.<br><br>
<strong>Size limit</strong> — You can only grapple a creature no more than <strong>one size larger</strong> than you.`,
        keyStats: [
          { label: "Check", value: "Athletics" },
          { label: "Size", value: "≤ 1 larger" },
        ],
      },
      {
        id: "shove",
        title: "Shove",
        tags: ["shove", "push", "prone", "unarmed strike", "athletics", "acrobatics"],
        tier: 2,
        summary: "Replaces one Attack (Unarmed Strike). STR (Athletics) vs target's STR (Athletics) or DEX (Acrobatics). Push 5 ft or knock Prone.",
        body: `<strong>2024 Rules</strong> — Shoving is part of <strong>Unarmed Strike</strong> (replaces one attack).<br><br>
<strong>To Shove</strong> — Make an Unarmed Strike. Instead of dealing damage, the target must succeed on a <strong>STR (Athletics) or DEX (Acrobatics)</strong> check (target's choice) against your <strong>STR (Athletics) check</strong>.<br><br>
<strong>On failure</strong>, choose one:<br>
• <strong>Push</strong> the target 5 feet away from you<br>
• Knock the target <strong>Prone</strong><br><br>
<strong>Size limit</strong> — Target can be no more than <strong>one size larger</strong> than you.`,
        keyStats: [
          { label: "Check", value: "Athletics" },
          { label: "Push", value: "5 ft" },
        ],
      },
      {
        id: "mounted-combat",
        title: "Mounted Combat",
        tags: ["mount", "mounted", "horse", "controlled", "independent", "dismount", "riding"],
        tier: 2,
        summary: "Controlled mount: acts on your turn, can only Dash/Disengage/Dodge. Independent mount: acts on its own initiative.",
        body: `<strong>Mounting/Dismounting</strong> — Costs half your movement speed.<br><br>
<strong>Controlled mount</strong> (your initiative, cooperative): Can only take <strong>Dash, Disengage, or Dodge</strong> actions. Moves on your turn. You direct where it goes.<br>
<strong>Independent mount</strong> (its own initiative): Takes its own actions. DM controls its behavior.<br><br>
<strong>Falling off</strong> — If the mount is knocked Prone, you can use your Reaction to land on your feet (DEX save DC 10). Otherwise, you're dismounted and fall Prone within 5 feet.<br>
<strong>Attacks against you</strong> — The attacker can choose to target you or the mount.`,
        keyStats: [
          { label: "Mount/Dismount", value: "½ speed" },
        ],
      },
      {
        id: "object-hp",
        title: "Object Hit Points",
        tags: ["object", "hp", "ac", "breaking", "destroy", "item"],
        tier: 2,
        summary: "Typical objects: AC 10-19, HP varies by size and material. Many are immune to poison and psychic damage.",
        body: `<strong>Object AC</strong>:<br>
• Cloth/paper/rope: <strong>AC 11</strong><br>
• Crystal/glass/ice: <strong>AC 13</strong><br>
• Wood/bone: <strong>AC 15</strong><br>
• Stone: <strong>AC 17</strong><br>
• Iron/steel: <strong>AC 19</strong><br>
• Mithral/Adamantine: <strong>AC 21+</strong><br><br>
<strong>Object HP</strong> (by size): Tiny 2d4 (5), Small 3d6 (10), Medium 4d8 (18), Large 5d10 (27).<br>
<strong>Resilient objects</strong> (iron door, etc.) may have damage thresholds.<br>
<strong>Immunities</strong> — Objects are immune to Poison and Psychic damage. Many are immune to other types based on material.`,
        keyStats: [
          { label: "Wood", value: "AC 15" },
          { label: "Iron", value: "AC 19" },
        ],
      },
      {
        id: "underwater-combat",
        title: "Underwater Combat",
        tags: ["underwater", "swim", "aquatic", "ranged attack", "melee", "drowning"],
        tier: 2,
        summary: "Without swim speed: Disadvantage on melee (except certain weapons). Ranged attacks auto-miss beyond normal range.",
        body: `<strong>Melee attacks</strong> — Creatures without a swim speed have <strong>Disadvantage on melee attack rolls</strong> unless using a dagger, javelin, shortsword, spear, or trident.<br><br>
<strong>Ranged attacks</strong> — Ranged weapon attacks <strong>automatically miss</strong> targets beyond the weapon's normal range. Even within normal range, attacks have Disadvantage unless using a crossbow, net, or weapon that is thrown like a javelin.<br><br>
<strong>Breathing</strong> — Creatures without a way to breathe underwater must hold their breath (see Suffocation rules). Fire-based effects generally don't work underwater.`,
        keyStats: [
          { label: "Melee", value: "Disadvantage" },
          { label: "Ranged", value: "Auto-miss past normal" },
        ],
      },
      {
        id: "critical-hits",
        title: "Critical Hits",
        tags: ["crit", "critical hit", "nat 20", "double dice", "weapon", "unarmed strike"],
        tier: 2,
        summary: "Nat 20 on attack = Critical Hit. Roll damage dice twice (weapon/unarmed only). Modifiers not doubled.",
        body: `<strong>2024 Rules</strong> — Roll a nat 20 on an attack roll = Critical Hit.<br><br>
<strong>Extra damage</strong> — Roll the attack's damage dice <strong>twice</strong> and add them together, then add modifiers as normal. Only the <strong>weapon or Unarmed Strike dice</strong> are doubled — not extra dice from features like Sneak Attack or Divine Smite.<br><br>
<strong>Major 2024 change</strong> — Only player characters (and PCs controlling companions) score Critical Hits. Monsters deal their normal damage on a nat 20; they just auto-hit.<br><br>
<strong>Spells</strong> — Spell attacks can score Critical Hits and double their damage dice.`,
        keyStats: [
          { label: "Trigger", value: "Nat 20" },
          { label: "Effect", value: "2× weapon dice" },
        ],
      },
    ],
  },

  /* ── Spellcasting ──────────────────────────────────────── */
  {
    id: "spellcasting",
    label: "Spellcasting",
    icon: "fa-solid fa-wand-sparkles",
    entries: [
      {
        id: "ritual-casting",
        title: "Ritual Casting",
        tags: ["ritual", "casting time", "spell slot", "10 minutes"],
        tier: 2,
        summary: "Add 10 minutes to casting time. No spell slot expended. Spell must have the Ritual tag.",
        body: `<strong>Requirements</strong> — The spell must have the <strong>Ritual</strong> tag. You must have the ability to cast rituals (most full casters can).<br><br>
<strong>Casting</strong> — Cast the spell as normal but add <strong>10 minutes</strong> to the casting time. <strong>No spell slot is expended.</strong><br><br>
<strong>2024 note</strong> — Ritual casting works largely the same as 2014. Wizards can ritual-cast any ritual spell in their spellbook. Other classes must have the spell prepared.`,
        keyStats: [
          { label: "Extra time", value: "+10 min" },
          { label: "Slot", value: "None" },
        ],
      },
      {
        id: "spell-scrolls",
        title: "Spell Scrolls",
        tags: ["scroll", "spell scroll", "dc", "attack bonus", "spell level", "ability check"],
        tier: 2,
        summary: "If spell is on your list and your level, no check needed. Otherwise, Arcana check DC 10 + spell level. Scroll DCs: 13 (1st) to 19 (9th).",
        body: `<strong>Using a Spell Scroll</strong> — If the spell is on your class's spell list and you're high enough level to cast it, you can read the scroll and cast the spell. No components needed; the scroll provides them.<br><br>
<strong>Not on your list / too high level</strong> — Make an <strong>INT (Arcana)</strong> check, DC = <strong>10 + spell level</strong>. On failure, the scroll is not destroyed.<br><br>
<strong>Scroll Save DCs & Attack Bonuses</strong>:<br>
• Cantrip: DC 13, +5 • 1st: DC 13, +5 • 2nd: DC 13, +5<br>
• 3rd: DC 15, +7 • 4th: DC 15, +7 • 5th: DC 17, +9<br>
• 6th: DC 17, +9 • 7th: DC 18, +10 • 8th: DC 18, +10<br>
• 9th: DC 19, +11`,
        keyStats: [
          { label: "1st-2nd DC", value: "13" },
          { label: "3rd-4th DC", value: "15" },
          { label: "9th DC", value: "19" },
        ],
      },
      {
        id: "counterspell",
        title: "Counterspell & Dispel Magic",
        tags: ["counterspell", "dispel magic", "ability check", "dc", "spell level", "reaction"],
        tier: 2,
        summary: "Auto-succeeds if slot ≥ target spell level. Otherwise, ability check DC 10 + spell level.",
        body: `<strong>Counterspell</strong> (3rd level, Reaction):<br>
• If you use a spell slot ≥ the target spell's level: <strong>automatic success</strong>.<br>
• If your slot is lower: make a <strong>spellcasting ability check</strong>, DC = <strong>10 + spell's level</strong>.<br>
• Range: 60 ft. Must see the caster. Uses your Reaction.<br><br>
<strong>Dispel Magic</strong> (3rd level, Action):<br>
• Same rules — auto-success if slot ≥ effect's level, otherwise ability check DC = 10 + spell's level.<br>
• Targets one creature, object, or magical effect within 120 ft.<br>
• Only ends spells; doesn't affect magical abilities or magic items.`,
        keyStats: [
          { label: "DC", value: "10 + spell lvl" },
          { label: "Auto", value: "slot ≥ level" },
        ],
      },
    ],
  },

  /* ── Items & Equipment ─────────────────────────────────── */
  {
    id: "items",
    label: "Items & Equipment",
    icon: "fa-solid fa-shield-halved",
    entries: [
      {
        id: "weapon-mastery",
        title: "Weapon Mastery",
        tags: ["mastery", "cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex", "weapon properties"],
        tier: 2,
        summary: "8 mastery properties. Gained via class features. Each weapon has a fixed mastery type.",
        body: `<strong>Cleave</strong> — On hit, make a second attack against a different creature within 5ft (same roll vs new target's AC). No ability mod to damage on the second hit.<br>
<strong>Graze</strong> — On miss, deal damage equal to your ability modifier (minimum 1) of the weapon's damage type.<br>
<strong>Nick</strong> — Extra Light weapon attack as part of the Attack action (doesn't cost Bonus Action). See Two-Weapon Fighting.<br>
<strong>Push</strong> — On hit, push a Large or smaller target 10 ft straight away from you.<br>
<strong>Sap</strong> — On hit, target has Disadvantage on its next attack roll before the start of your next turn.<br>
<strong>Slow</strong> — On hit, target's speed is reduced by 10 ft until the start of your next turn.<br>
<strong>Topple</strong> — On hit, target must succeed on a CON save (DC = 8 + PB + ability mod) or be knocked Prone.<br>
<strong>Vex</strong> — On hit, you have Advantage on your next attack roll against that target before the end of your next turn.`,
        keyStats: [
          { label: "Types", value: "8" },
        ],
      },
      {
        id: "crafting",
        title: "Crafting",
        tags: ["crafting", "tools", "gold per day", "artisan", "create item", "downtime"],
        tier: 2,
        summary: "25 gp/day of progress. Need proficiency with appropriate tools. Half the item's market price in raw materials.",
        body: `<strong>2024 Crafting Rules</strong>:<br><br>
<strong>Requirements</strong> — Proficiency with the relevant <strong>Artisan's Tools</strong> and access to them.<br>
<strong>Raw materials</strong> — Cost <strong>half the item's market price</strong>.<br>
<strong>Progress</strong> — <strong>25 gp of progress per day</strong> of crafting.<br>
<strong>Multiple crafters</strong> — Each additional helper with tool proficiency adds 25 gp/day.<br><br>
<strong>Magic items</strong> — Require a formula (recipe). May also require exotic materials. Crafting time depends on rarity:<br>
• Common: 1 week, 50 gp • Uncommon: 2 weeks, 200 gp<br>
• Rare: 10 weeks, 2,000 gp • Very Rare: 25 weeks, 20,000 gp<br>
• Legendary: 50 weeks, 100,000 gp`,
        keyStats: [
          { label: "Rate", value: "25 gp/day" },
          { label: "Materials", value: "½ price" },
        ],
      },
      {
        id: "potions",
        title: "Potions",
        tags: ["potion", "healing", "bonus action", "action", "drink", "administer"],
        tier: 2,
        summary: "Drinking a potion = Bonus Action (self) or Action (administer to another). Healing: 2d4+2 / 4d4+4 / 8d4+8 / 10d4+20.",
        body: `<strong>2024 Rule</strong> — Drinking a potion yourself is a <strong>Bonus Action</strong>. Administering to another creature is an <strong>Action</strong>.<br><br>
<strong>Potion of Healing</strong>: <strong>2d4 + 2</strong> HP (50 gp)<br>
<strong>Greater Healing</strong>: <strong>4d4 + 4</strong> HP (100 gp)<br>
<strong>Superior Healing</strong>: <strong>8d4 + 8</strong> HP (500 gp)<br>
<strong>Supreme Healing</strong>: <strong>10d4 + 20</strong> HP (5,000 gp)<br><br>
<strong>Note</strong> — This was often house-ruled in 2014 (Bonus Action to drink). Now it's official in 2024.`,
        keyStats: [
          { label: "Self", value: "Bonus Action" },
          { label: "Other", value: "Action" },
          { label: "Basic", value: "2d4+2" },
        ],
      },
    ],
  },

  /* ── Environment ───────────────────────────────────────── */
  {
    id: "environment",
    label: "Environment",
    icon: "fa-solid fa-mountain-sun",
    entries: [
      {
        id: "suffocation",
        title: "Suffocation",
        tags: ["suffocate", "breath", "hold breath", "drowning", "con", "minutes", "rounds"],
        tier: 2,
        summary: "Hold breath: 1 + CON mod minutes (min 30 sec). Then survive CON mod rounds (min 1). Then drop to 0 HP.",
        body: `<strong>Holding breath</strong> — A creature can hold its breath for <strong>1 + CON modifier</strong> minutes (minimum 30 seconds).<br><br>
<strong>Running out of air</strong> — When a creature runs out of breath or is choking, it can survive for <strong>CON modifier</strong> rounds (minimum 1 round). At the start of its next turn after that, it <strong>drops to 0 HP</strong> and is dying. It can't regain HP or be stabilized until it can breathe again.<br><br>
<strong>Surprise suffocation</strong> — A creature that is surprised or pulled underwater suddenly can only hold its breath for a number of <strong>rounds</strong> equal to its CON modifier (not minutes).`,
        keyStats: [
          { label: "Hold", value: "1+CON min" },
          { label: "Choking", value: "CON mod rnds" },
        ],
      },
      {
        id: "extreme-heat-cold",
        title: "Extreme Heat & Cold",
        tags: ["extreme heat", "extreme cold", "temperature", "exhaustion", "con save", "weather"],
        tier: 2,
        summary: "Extreme Cold: CON save DC 10 each hour or gain 1 Exhaustion. Extreme Heat: CON save or gain Exhaustion (no heavy armor).",
        body: `<strong>Extreme Cold</strong> (0°F / −18°C or colder):<br>
• <strong>CON save DC 10</strong> at the end of each hour.<br>
• On failure, gain <strong>1 level of Exhaustion</strong>.<br>
• Cold Resistance or cold weather gear = auto-success.<br><br>
<strong>Extreme Heat</strong> (100°F / 38°C or hotter):<br>
• <strong>CON save DC 5</strong> at the end of each hour, +1 DC per subsequent hour.<br>
• On failure, gain <strong>1 level of Exhaustion</strong>.<br>
• Heavy armor or heavy clothing = Disadvantage on the save.<br>
• Fire Resistance or hot weather gear = auto-success.`,
        keyStats: [
          { label: "Cold DC", value: "10/hr" },
          { label: "Heat DC", value: "5+1/hr" },
        ],
      },
      {
        id: "high-altitude",
        title: "High Altitude",
        tags: ["altitude", "thin air", "mountain", "exhaustion", "acclimation"],
        tier: 2,
        summary: "Above 10,000 ft: each hour = 1 Exhaustion (CON save DC 10, +1 per hour). Acclimated creatures are immune.",
        body: `<strong>High Altitude</strong> (above 10,000 feet):<br><br>
• Each hour spent at high altitude without acclimation, make a <strong>CON save DC 10</strong> (+1 per subsequent hour).<br>
• On failure, gain <strong>1 level of Exhaustion</strong>.<br>
• Creatures acclimated to high altitude (lived there for 30+ days) are immune to this effect.<br><br>
<strong>Above 20,000 feet</strong> — Breathing apparatus required. The air is too thin to breathe normally.`,
        keyStats: [
          { label: "Threshold", value: "10,000 ft" },
          { label: "DC", value: "10+1/hr" },
        ],
      },
    ],
  },
];
