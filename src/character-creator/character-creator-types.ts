/**
 * Character Creator & Level-Up Manager — Type Definitions
 *
 * All TypeScript interfaces for the character creation wizard,
 * GM configuration, and data layer.
 *
 * Updated for the 2024 D&D PHB character creation workflow.
 */

/* ── Content Types ───────────────────────────────────────── */

/** Compendium content categories the creator indexes. */
export type CreatorContentType =
  | "class"
  | "subclass"
  | "race"
  | "background"
  | "feat"
  | "spell"
  | "item";

/** Normalized compendium index entry. */
export interface CreatorIndexEntry {
  /** Full UUID for fromUuid() lookups */
  uuid: string;
  /** Item name */
  name: string;
  /** Compendium artwork path */
  img: string;
  /** Source pack collection ID */
  packId: string;
  /** Human-readable source label */
  packLabel: string;
  /** Creator content category */
  type: CreatorContentType;
  /** System identifier (e.g., "fighter", "elf") */
  identifier?: string;
  /** For subclasses: parent class identifier */
  classIdentifier?: string;
  /** For spells: spell level (0 = cantrip) */
  spellLevel?: number;
  /** For spells: school of magic */
  school?: string;
  /** For equipment: armor category */
  armorType?: string;
  /** For equipment: weapon category */
  weaponType?: string;
}

/* ── Pack Source Configuration ────────────────────────────── */

/** Maps content types to arrays of compendium pack collection IDs. */
export interface PackSourceConfig {
  classes: string[];
  subclasses: string[];
  races: string[];
  backgrounds: string[];
  feats: string[];
  spells: string[];
  items: string[];
}

/* ── GM Configuration ────────────────────────────────────── */

/** Ability score generation methods. */
export type AbilityScoreMethod = "4d6" | "pointBuy" | "standardArray";

/** Starting equipment method. */
export type EquipmentMethod = "equipment" | "gold" | "both";

/** Level 1 HP method. */
export type HpMethod = "max" | "roll";

/** Ability score keys. */
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** Six ability scores. */
export type AbilityScores = Record<AbilityKey, number>;

/** Frozen snapshot of all GM configuration at wizard open time. */
export interface GMConfig {
  packSources: PackSourceConfig;
  disabledUUIDs: Set<string>;
  allowedAbilityMethods: AbilityScoreMethod[];
  /** Max 4d6 rerolls. 0 = unlimited. */
  maxRerolls: number;
  startingLevel: number;
  allowMulticlass: boolean;
  equipmentMethod: EquipmentMethod;
  level1HpMethod: HpMethod;
  /** Whether custom/homebrew backgrounds are permitted. Added for 2024 rules. */
  allowCustomBackgrounds: boolean;
}

/* ── GM Config App ViewModels ────────────────────────────── */

/** A compendium pack entry for the Sources tab. */
export interface PackEntry {
  /** Pack collection ID */
  collection: string;
  /** Human-readable label */
  label: string;
  /** Source module/package name */
  packageName: string;
  /** Number of items in the pack */
  itemCount: number;
  /** Whether this pack is enabled in the current config */
  enabled: boolean;
  /** Content types detected in this pack */
  contentTypes: CreatorContentType[];
}

/** Grouped packs for the Sources tab. */
export interface SourcesTabViewModel {
  /** Packs grouped by primary content type */
  groups: Array<{
    type: CreatorContentType;
    label: string;
    packs: PackEntry[];
  }>;
}

/** A content curation entry (index entry + enabled state). */
export interface CurationEntry extends CreatorIndexEntry {
  /** Whether this item is enabled (not disabled by GM) */
  enabled: boolean;
}

/** Content Curation tab view model. */
export interface CurationTabViewModel {
  /** Whether compendium data has been loaded */
  loaded: boolean;
  /** Entries grouped by content type */
  groups: Array<{
    type: CreatorContentType;
    label: string;
    entries: CurationEntry[];
    enabledCount: number;
    totalCount: number;
  }>;
}

/** Rules Configuration tab view model. */
export interface RulesConfigViewModel {
  allowedAbilityMethods: {
    "4d6": boolean;
    pointBuy: boolean;
    standardArray: boolean;
  };
  startingLevel: number;
  allowMulticlass: boolean;
  equipmentMethod: EquipmentMethod;
  level1HpMethod: HpMethod;
  allowCustomBackgrounds: boolean;
}

/** Full GM Config App context. */
export interface GMConfigAppContext {
  tabs: Record<string, { id: string; label: string; icon: string; active: boolean }>;
  activeTab: string;
  sources?: SourcesTabViewModel;
  curation?: CurationTabViewModel;
  rules?: RulesConfigViewModel;
}

/* ── Wizard State Machine ───────────────────────────────── */

/** Status of a wizard step. */
export type StepStatus = "pending" | "complete" | "invalid";

/** The wizard's in-memory state. Discarded on close. */
export interface WizardState {
  /** Index into applicableSteps */
  currentStep: number;
  /** Step IDs in navigation order (recalculated when selections change) */
  applicableSteps: string[];
  /** Per-step selections (keyed by step ID) */
  selections: WizardSelections;
  /** Per-step completion status */
  stepStatus: Map<string, StepStatus>;
  /** Frozen GM config snapshot taken at wizard open */
  config: GMConfig;
}

/* ── Step Selection Types ───────────────────────────────── */

/** Ability score step state. */
export interface AbilityScoreState {
  method: AbilityScoreMethod;
  /** Final assigned scores. Values are 0 until assigned. */
  scores: Record<AbilityKey, number>;
  /** 4d6/standard array: which rolled/array value is assigned to each ability. -1 = unassigned. */
  assignments: Record<AbilityKey, number>;
  /** 4d6: The six rolled totals. */
  rolledValues?: number[];
}

/** Species selection state (2024 PHB — replaces "Race" in the wizard). */
export interface SpeciesSelection {
  uuid: string;
  name: string;
  img: string;
  /** Display-only summaries parsed from advancement (e.g., "Darkvision", "Fey Ancestry"). */
  traits?: string[];
}

/** What a background grants — parsed from advancement data. */
export interface BackgroundGrants {
  /** Skill proficiency keys granted by this background. */
  skillProficiencies: string[];
  /** Tool proficiency key (e.g., "art:calligrapher") or null. */
  toolProficiency: string | null;
  /** UUID of the origin feat, or null if none (homebrew/legacy). */
  originFeatUuid: string | null;
  /** Display name of the origin feat. */
  originFeatName: string | null;
  /** Image path of the origin feat. */
  originFeatImg: string | null;
  /** Total ASI points to distribute (typically 3; 0 if no ASI advancement). */
  asiPoints: number;
  /** Max points in a single ability (typically 2; 0 if no ASI advancement). */
  asiCap: number;
  /** Abilities the PHB suggests — UI hint only, NOT enforced. */
  asiSuggested: string[];
  /** Languages auto-granted by this background (e.g., ["common"]). */
  languageGrants: string[];
  /** Number of additional language choices (typically 2; 0 if none). */
  languageChoiceCount: number;
  /** Pool of choosable languages (e.g., ["languages:standard:*"]). */
  languageChoicePool: string[];
}

/** Player's ability score increase assignments from their background. */
export interface BackgroundASI {
  /**
   * Maps ability keys to point values.
   * Must sum to grants.asiPoints, each value <= grants.asiCap.
   * e.g., { wis: 2, cha: 1 }
   */
  assignments: Partial<Record<AbilityKey, number>>;
}

/** Player's language selections (fixed + chosen). */
export interface LanguageSelection {
  /** Auto-granted from advancement (e.g., ["common"]). */
  fixed: string[];
  /** Player-chosen languages. */
  chosen: string[];
}

/** Player's origin feat selection from their background. */
export interface OriginFeatSelection {
  uuid: string;
  name: string;
  img: string;
  /** True if the GM allowed the player to swap to a different origin feat. */
  isCustom: boolean;
}

/** Background selection state (2024 PHB — enriched with grants and sub-selections). */
export interface BackgroundSelection {
  uuid: string;
  name: string;
  img: string;
  /** Parsed grants from the background's advancement data. */
  grants: BackgroundGrants;
  /** Player's ASI distribution. */
  asi: BackgroundASI;
  /** Player's language selections. */
  languages: LanguageSelection;
}

/** Class selection state (2024 PHB — includes skill pool from advancement). */
export interface ClassSelection {
  uuid: string;
  name: string;
  img: string;
  /** System identifier (e.g., "fighter", "wizard"). */
  identifier: string;
  /** Available skill keys from class advancement. */
  skillPool: string[];
  /** How many skills to pick (fallback 2). */
  skillCount: number;
}

/** Subclass selection state. */
export interface SubclassSelection {
  uuid: string;
  name: string;
  img: string;
  classIdentifier?: string;
}

/** Feat/ASI selection state. */
export interface FeatSelection {
  /** Whether the player chose ASI or a feat. */
  choice: "asi" | "feat";
  /** ASI: which abilities get +1 (up to 2 abilities). */
  asiAbilities?: AbilityKey[];
  /** Feat: selected feat UUID. */
  featUuid?: string;
  featName?: string;
  featImg?: string;
}

/** Spell selection state. */
export interface SpellSelection {
  /** Selected cantrip UUIDs. */
  cantrips: string[];
  /** Selected spell UUIDs. */
  spells: string[];
}

/** Equipment selection state. */
export interface EquipmentSelection {
  /** Method chosen by the player. */
  method: "equipment" | "gold";
  /** Gold amount (if gold method). */
  goldAmount?: number;
}

/** Skills selection state (class-chosen only). */
export interface SkillSelection {
  /** Player-chosen skill proficiency keys. */
  chosen: string[];
}

/** Portrait selection state. */
export interface PortraitSelection {
  /** Data URL or uploaded path for the portrait image. */
  portraitDataUrl?: string;
  /** Data URL or uploaded path for the token image (square crop). */
  tokenDataUrl?: string;
  /** Whether the portrait was AI-generated or manually uploaded. */
  source: "generated" | "uploaded" | "none";
}

/** Callbacks passed to step onActivate for state updates. */
export interface StepCallbacks {
  /** Store step data. Cascades invalidation if step was previously complete. */
  setData: (value: unknown) => void;
  /** Re-render the wizard shell. */
  rerender: () => void;
}

/** All wizard selections, keyed by step ID. */
export interface WizardSelections {
  abilities?: AbilityScoreState;
  species?: SpeciesSelection;
  background?: BackgroundSelection;
  class?: ClassSelection;
  subclass?: SubclassSelection;
  skills?: SkillSelection;
  originFeat?: OriginFeatSelection;
  feats?: FeatSelection;
  spells?: SpellSelection;
  equipment?: EquipmentSelection;
  portrait?: PortraitSelection;
  [key: string]: unknown;
}

/** Metadata for a wizard step (used by StepRegistry, rendered by shell). */
export interface WizardStepDefinition {
  /** Unique step identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** FontAwesome icon class */
  icon: string;
  /** Template path for step content */
  templatePath: string;
  /** Step IDs this step depends on */
  dependencies: string[];

  /** Should this step appear given current state? */
  isApplicable(state: WizardState): boolean;
  /** Is this step's data complete? */
  isComplete(state: WizardState): boolean;
  /** Build the template ViewModel */
  buildViewModel(state: WizardState): Promise<Record<string, unknown>>;
  /** Action handlers merged into the app's actions */
  actions?: Record<string, (app: unknown, event: Event, target: HTMLElement) => void>;
  /** Called when step gains focus (bind event listeners here) */
  onActivate?(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void;
  /** Called when step loses focus */
  onDeactivate?(state: WizardState, el: HTMLElement): void;
}

/** ViewModel for the wizard shell template. */
export interface WizardShellContext {
  /** Step indicator entries */
  steps: Array<{
    id: string;
    label: string;
    icon: string;
    status: StepStatus;
    active: boolean;
    index: number;
  }>;
  /** Pre-rendered step content HTML */
  stepContentHtml: string;
  /** Current step metadata */
  currentStepId: string;
  currentStepLabel: string;
  currentStepIcon: string;
  /** Navigation state */
  canGoBack: boolean;
  canGoNext: boolean;
  isReviewStep: boolean;
  /** Atmospheric gradient class for current step */
  atmosphereClass: string;
}

/* ── Content Type Labels ─────────────────────────────────── */

/** Human-readable labels for content types. */
export const CONTENT_TYPE_LABELS: Record<CreatorContentType, string> = {
  class: "Classes",
  subclass: "Subclasses",
  race: "Races & Species",
  background: "Backgrounds",
  feat: "Feats",
  spell: "Spells",
  item: "Equipment",
};
