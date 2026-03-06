/**
 * D&D 5e (2024) skill descriptions and usage examples.
 * Keyed by the dnd5e system's internal skill ID (e.g., "prc" for Perception).
 * Used to populate the skill info popup in the LPCS skills tab.
 */

export interface SkillDescription {
  name: string;
  description: string;
  examples: string[];
}

export const SKILL_DESCRIPTIONS: Record<string, SkillDescription> = {
  acr: {
    name: "Acrobatics",
    description: "Your ability to stay on your feet and perform feats of balance and agility. Covers tumbling, dodging, and moving through tight spaces.",
    examples: [
      "Running across ice or a slippery deck without falling",
      "Performing a flip to land on your feet after a fall",
      "Squeezing through a narrow gap while maintaining control",
    ],
  },
  ani: {
    name: "Animal Handling",
    description: "Your ability to calm, direct, and intuit the behavior of animals. Also covers keeping a mount under control during chaotic situations.",
    examples: [
      "Calming a spooked horse in combat",
      "Reading whether a wolf is about to attack or is just cautious",
      "Steering a mount to perform a difficult maneuver",
    ],
  },
  arc: {
    name: "Arcana",
    description: "Your knowledge of magic, spells, magical traditions, and the planes of existence. Covers identifying spells, magical effects, and arcane symbols.",
    examples: [
      "Identifying a spell as it is being cast",
      "Recognizing a magical rune carved into a dungeon wall",
      "Recalling lore about a demon's weaknesses",
    ],
  },
  ath: {
    name: "Athletics",
    description: "Your physical prowess in climbing, jumping, and swimming. Used when raw strength and endurance are needed for movement challenges.",
    examples: [
      "Climbing a sheer cliff face",
      "Jumping across a wide chasm",
      "Swimming against a powerful current",
    ],
  },
  dec: {
    name: "Deception",
    description: "Your ability to convincingly hide the truth through lies, misleading statements, or false body language. Covers fast talk and long cons alike.",
    examples: [
      "Bluffing a guard that you have an appointment",
      "Maintaining a false identity in conversation",
      "Lying about your intentions under interrogation",
    ],
  },
  his: {
    name: "History",
    description: "Your recall of historical events, legendary people, ancient kingdoms, past wars, and civilizations. Useful for context on the world around you.",
    examples: [
      "Recalling which noble house controls a contested border region",
      "Identifying an ancient empire's crest on a ruin",
      "Knowing the cause and outcome of a war from centuries ago",
    ],
  },
  ins: {
    name: "Insight",
    description: "Your ability to read people \u2014 detecting lies, true intentions, and emotional states. An active read of a specific person, not general awareness.",
    examples: [
      "Determining whether an NPC is lying during negotiations",
      "Sensing that a merchant is nervous and hiding something",
      "Reading whether a creature's posture signals an imminent attack",
    ],
  },
  itm: {
    name: "Intimidation",
    description: "Your ability to influence others through threats, hostile actions, or sheer force of presence. The DM may allow Strength instead of Charisma for physical threats.",
    examples: [
      "Threatening a thug to make them back down",
      "Interrogating a prisoner through implied violence",
      "Staring down an opponent to make them hesitate",
    ],
  },
  inv: {
    name: "Investigation",
    description: "Your ability to find clues, deduce conclusions, and search methodically. Distinct from Perception \u2014 Investigation is active reasoning, not passive noticing.",
    examples: [
      "Searching a room for a hidden compartment or trap",
      "Piecing together what happened at a crime scene",
      "Determining the structural weak point in a wall",
    ],
  },
  med: {
    name: "Medicine",
    description: "Your knowledge of anatomy, injury, disease, and treatment. Used to stabilize the dying, diagnose illness, or identify cause of death.",
    examples: [
      "Stabilizing a dying creature as an action",
      "Diagnosing whether a patient is poisoned versus diseased",
      "Determining how and approximately when a body died",
    ],
  },
  nat: {
    name: "Nature",
    description: "Your knowledge of the natural world \u2014 plants, animals, weather, geography, and natural cycles. Covers terrain lore and creature biology.",
    examples: [
      "Identifying a poisonous plant in the wild",
      "Knowing the migration patterns of a creature",
      "Predicting incoming weather from cloud and wind patterns",
    ],
  },
  prc: {
    name: "Perception",
    description: "Your ability to notice things in your environment through any sense \u2014 sight, hearing, smell, or touch. The most commonly used passive skill.",
    examples: [
      "Noticing a hidden creature lurking in shadows",
      "Hearing footsteps approaching from around a corner",
      "Detecting the faint smell of poison in a goblet",
    ],
  },
  prf: {
    name: "Performance",
    description: "Your ability to entertain an audience through music, dance, acting, storytelling, or other performing arts.",
    examples: [
      "Playing an instrument at a tavern to earn coin",
      "Putting on a convincing dramatic performance as a distraction",
      "Delivering an inspiring speech that moves a crowd",
    ],
  },
  per: {
    name: "Persuasion",
    description: "Your ability to influence others through honest, good-faith appeals \u2014 logic, charm, flattery, or diplomacy. The non-deceptive social skill.",
    examples: [
      "Convincing a guard to let your party pass",
      "Negotiating a better price with a merchant",
      "Appealing to a noble's sense of honor to gain support",
    ],
  },
  rel: {
    name: "Religion",
    description: "Your knowledge of deities, religious rites, holy symbols, cults, and the planes associated with divine power.",
    examples: [
      "Recognizing which god a temple is dedicated to by its iconography",
      "Recalling the tenets of an obscure cult encountered in a dungeon",
      "Knowing an undead creature's weakness based on its divine origin",
    ],
  },
  slt: {
    name: "Sleight of Hand",
    description: "Your manual dexterity for picking pockets, palming objects, planting items on others, or performing fine-motor trickery without being noticed.",
    examples: [
      "Picking a guard's pocket without them noticing",
      "Palming a card or coin during a street performance",
      "Planting a forged document in someone's satchel",
    ],
  },
  ste: {
    name: "Stealth",
    description: "Your ability to move quietly and stay hidden from creatures that might detect you. Contested against Passive Perception or an active Perception check.",
    examples: [
      "Sneaking past a guard post without being heard",
      "Hiding in shadows to ambush an enemy",
      "Following a target through a crowd without being spotted",
    ],
  },
  sur: {
    name: "Survival",
    description: "Your ability to navigate the wilderness, track creatures, predict natural hazards, and find food and shelter in harsh environments.",
    examples: [
      "Following a creature's tracks through a forest",
      "Navigating by stars to avoid getting lost",
      "Identifying which berries are safe to eat in an unfamiliar biome",
    ],
  },
};
