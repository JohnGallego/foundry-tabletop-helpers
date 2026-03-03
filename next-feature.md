
Live Play Character Sheet (LPCS) — Implementation Plan
0. Executive Summary
What: A premium, iPad-first digital character sheet registered as an alternative Actor sheet for dnd5e character type actors. It auto-opens on player login, provides glanceable stats, live HP/XP adjustment, instant tab switching, and expandable drawers — all optimized for in-person D&D sessions with real dice.

Why: Transforms the module from a print companion into a full live-play digital companion.

How: A new HandlebarsApplicationMixin(ActorSheetV2) subclass, registered via DocumentSheetConfig.registerSheet(), with Handlebars templates, a view-model data layer that reuses existing extract helpers, and a responsive CSS design system.

1. Source-First References (Mandatory per AGENTS.md §1)
Foundry v13 API Pages
API	URL
ActorSheetV2	https://foundryvtt.com/api/classes/foundry.applications.sheets.ActorSheetV2.html
HandlebarsApplicationMixin	https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html
DocumentSheetConfig.registerSheet	https://foundryvtt.com/api/classes/foundry.applications.apps.DocumentSheetConfig.html
ApplicationV2 lifecycle	https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
BaseActor (document schema)	https://foundryvtt.com/api/classes/foundry.documents.BaseActor.html
dnd5e Source Files (patterning after)
File	What we reference
dnd5e.mjs (entry point)	DocumentSheetConfig.registerSheet(Actor, "dnd5e", ...) pattern
module/applications/actor/character-sheet.mjs	PARTS, TABS, _prepareContext, _preparePartContext, actions, tabGroups
module/applications/actor/api/base-actor-sheet.mjs	DEFAULT_OPTIONS, form handling, _prepareContext base, _prepareItems
Community Wiki
Page	What we reference
ApplicationV2 guide	https://foundryvtt.wiki/en/development/api/applicationv2 — PARTS system, actions, tabs, sheet registration for modules
Hooks/Classes We Will Touch
Hook/Class	Why
Hooks.once("init") in src/index.ts	Register LPCS sheet class, settings, preload templates
Hooks.once("ready") in src/index.ts	Auto-open LPCS for players
DocumentSheetConfig.registerSheet	Register LPCS as selectable sheet for character type
HandlebarsApplicationMixin(ActorSheetV2)	Base class for LPCS sheet
game.user.character	Detect player's assigned character for auto-open
2. Architecture & File Structure
New files to create

```
src/lpcs/
├── lpcs-sheet.ts           # Sheet class (HandlebarsApplicationMixin + ActorSheetV2)
├── lpcs-view-model.ts      # Data transformation: actor → view model
├── lpcs-types.ts           # TypeScript interfaces for view model
├── lpcs-settings.ts        # LPCS-specific settings registration + accessors
├── lpcs-auto-open.ts       # Auto-open logic for ready hook
└── lpcs-styles.css         # All LPCS CSS (design system + responsive)

templates/lpcs/
├── lpcs-shell.hbs          # Outer wrapper (form tag, CSS class hooks)
├── lpcs-header.hbs         # Character name, class, level, portrait
├── lpcs-stats-bar.hbs      # HP bar, AC, speed, initiative, prof bonus
├── lpcs-tab-nav.hbs        # Tab navigation strip
├── lpcs-tab-abilities.hbs  # Abilities + saves + skills
├── lpcs-tab-combat.hbs     # Attacks, actions, bonus actions, reactions
├── lpcs-tab-spells.hbs     # Spell slots + spell list
├── lpcs-tab-inventory.hbs  # Equipment + currency
├── lpcs-tab-features.hbs   # Class features, feats, traits
└── lpcs-drawer.hbs         # Reusable expandable drawer partial
```

Modified existing files
File	Change
src/index.ts	Import & call LPCS init + ready hooks
src/settings.ts	Import & call LPCS settings registration
src/types/foundry.d.ts	Add type shims for ActorSheetV2, HandlebarsApplicationMixin, DocumentSheetConfig
vite.config.ts	No changes needed — single entry src/index.ts already bundles everything
3. Implementation Phases
Phase 1: Infrastructure (Foundation)
3.1.1 Type Shims (src/types/foundry.d.ts)
Add minimal type declarations for the Foundry v13 APIs LPCS needs. These are defensive shims — not full type coverage.

```
/* ── ActorSheetV2 ──────────────────────────────────────── */

/** Minimal ActorSheetV2 type shim for Foundry v13 */
export interface ActorSheetV2Class {
  new (options?: Record<string, unknown>): ActorSheetV2Instance;
  DEFAULT_OPTIONS: Record<string, unknown>;
  PARTS: Record<string, HandlebarsTemplatePart>;
  TABS: Array<{ tab: string; label: string; icon?: string; svg?: string }>;
}

export interface ActorSheetV2Instance {
  actor: FoundryDocument & {
    system: Record<string, unknown>;
    items: FoundryCollection<FoundryDocument>;
    isOwner: boolean;
    limited: boolean;
    img: string;
    prototypeToken?: { texture?: { src?: string } };
  };
  element: HTMLElement;
  tabGroups: Record<string, string>;
  isEditable: boolean;
  render(options?: { force?: boolean }): unknown;
  close(options?: Record<string, unknown>): Promise<void>;
}

export interface HandlebarsTemplatePart {
  template: string;
  templates?: string[];
  classes?: string[];
  container?: { classes?: string[]; id?: string };
  scrollable?: string[];
}

/* ── DocumentSheetConfig ───────────────────────────────── */

export interface DocumentSheetConfigStatic {
  registerSheet(
    documentClass: unknown,
    scope: string,
    sheetClass: unknown,
    options?: {
      types?: string[];
      makeDefault?: boolean;
      label?: string;
    }
  ): void;
  unregisterSheet(
    documentClass: unknown,
    scope: string,
    sheetClass: unknown,
    options?: { types?: string[] }
  ): void;
}
```
3.1.3 Sheet Class (src/lpcs/lpcs-sheet.ts)
This is the core class. It extends HandlebarsApplicationMixin(ActorSheetV2) following the exact pattern from the dnd5e CharacterActorSheet.

```
// src/lpcs/lpcs-sheet.ts

import { MOD } from "../logger";
import { buildLPCSViewModel } from "./lpcs-view-model";
import { lpcsDefaultTab } from "./lpcs-settings";
import type { LPCSViewModel } from "./lpcs-types";

// Access Foundry globals at runtime
const { HandlebarsApplicationMixin, ActorSheetV2, DocumentSheetConfig } = (() => {
  const api = (globalThis as any).foundry?.applications?.api;
  const sheets = (globalThis as any).foundry?.applications?.sheets;
  const apps = (globalThis as any).foundry?.applications?.apps;
  return {
    HandlebarsApplicationMixin: api?.HandlebarsApplicationMixin,
    ActorSheetV2: sheets?.ActorSheetV2,
    DocumentSheetConfig: apps?.DocumentSheetConfig,
  };
})();

/**
 * Live Play Character Sheet — a premium, iPad-first character sheet
 * optimized for in-person D&D sessions with real dice.
 *
 * @see https://foundryvtt.com/api/classes/foundry.applications.sheets.ActorSheetV2.html
 * @see https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html
 */
export class LPCSSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /* ── Static Configuration ──────────────────────────────── */

  static override DEFAULT_OPTIONS = {
    id: "lpcs-{id}",
    classes: ["lpcs-sheet", "fth-lpcs"],
    tag: "form",
    form: {
      handler: LPCSSheet.#onFormSubmit,
      submitOnChange: true,
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-dice-d20",
    },
    position: {
      width: 520,
      height: 780,
    },
    actions: {
      adjustHP: LPCSSheet.#adjustHP,
      adjustXP: LPCSSheet.#adjustXP,
      rollAbility: LPCSSheet.#rollAbility,
      rollSave: LPCSSheet.#rollSave,
      rollSkill: LPCSSheet.#rollSkill,
      rollInitiative: LPCSSheet.#rollInitiative,
      rollDeathSave: LPCSSheet.#rollDeathSave,
      useItem: LPCSSheet.#useItem,
      toggleDrawer: LPCSSheet.#toggleDrawer,
      toggleInspiration: LPCSSheet.#toggleInspiration,
      toggleSpellSlot: LPCSSheet.#toggleSpellSlot,
    },
  };

  /* ── PARTS ─────────────────────────────────────────────── */

  static override PARTS = {
    header: {
      template: `modules/${MOD}/templates/lpcs/lpcs-header.hbs`,
    },
    statsBar: {
      template: `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs`,
    },
    tabNav: {
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs`,
    },
    abilities: {
      container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-abilities.hbs`,
      scrollable: [""],
    },
    combat: {
      container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-combat.hbs`,
      scrollable: [""],
    },
    spells: {
      container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-spells.hbs`,
      scrollable: [""],
    },
    inventory: {
      container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
      scrollable: [""],
    },
    features: {
      container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
      template: `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
      scrollable: [""],
    },
  };

  /* ── TABS ──────────────────────────────────────────────── */

  static override TABS = [
    { tab: "abilities", label: "FTH.LPCS.Tabs.Abilities", icon: "fas fa-fist-raised" },
    { tab: "combat",    label: "FTH.LPCS.Tabs.Combat",    icon: "fas fa-swords" },
    { tab: "spells",    label: "FTH.LPCS.Tabs.Spells",    icon: "fas fa-hat-wizard" },
    { tab: "inventory", label: "FTH.LPCS.Tabs.Inventory", icon: "fas fa-backpack" },
    { tab: "features",  label: "FTH.LPCS.Tabs.Features",  icon: "fas fa-scroll" },
  ];

  /* ── Properties ────────────────────────────────────────── */

  override tabGroups = {
    primary: lpcsDefaultTab(),
  };

  /** Track which drawers are currently expanded, keyed by item/ability ID */
  private _expandedDrawers: Set<string> = new Set();

  /* ── Title ─────────────────────────────────────────────── */

  override get title(): string {
    return `${this.actor.name} — Live Sheet`;
  }

  /* ── Context Preparation ───────────────────────────────── */

  override async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
    const baseContext = await super._prepareContext(options);
    const viewModel: LPCSViewModel = buildLPCSViewModel(this.actor);

    return {
      ...baseContext,
      vm: viewModel,
      editable: this.isEditable,
      expandedDrawers: this._expandedDrawers,
    };
  }

  override async _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    context = await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "tabNav":
        context.tabs = this._prepareTabs();
        break;
      // Each tab part gets the full vm — templates pick what they need
    }

    return context;
  }

  /** Build tab state array for the navigation template */
  private _prepareTabs(): Array<{ tab: string; label: string; icon: string; active: boolean }> {
    return (this.constructor as typeof LPCSSheet).TABS.map((t) => ({
      ...t,
      active: t.tab === this.tabGroups.primary,
    }));
  }

  /* ── Lifecycle ─────────────────────────────────────────── */

  override async _onRender(context: Record<string, unknown>, options: Record<string, unknown>): Promise<void> {
    await super._onRender(context, options);

    // HP bar: attach delta-input listeners
    this.element.querySelectorAll<HTMLInputElement>(".lpcs-hp-input").forEach((input) => {
      input.addEventListener("change", this._onHPInputChange.bind(this));
      input.addEventListener("focus", () => input.select());
    });

    // XP bar input
    this.element.querySelectorAll<HTMLInputElement>(".lpcs-xp-input").forEach((input) => {
      input.addEventListener("change", this._onXPInputChange.bind(this));
      input.addEventListener("focus", () => input.select());
    });
  }

  /* ── Action Handlers (static methods, bound via data-action) ── */

  static async #onFormSubmit(
    this: LPCSSheet,
    event: Event,
    form: HTMLFormElement,
    formData: Record<string, unknown>
  ): Promise<void> {
    await this.actor.update(formData);
  }

  static #adjustHP(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const delta = Number(target.dataset.delta);
    if (!Number.isFinite(delta)) return;
    const hp = (this.actor.system as any).attributes?.hp;
    if (!hp) return;
    const newValue = Math.clamped(hp.value + delta, 0, hp.max);
    this.actor.update({ "system.attributes.hp.value": newValue });
  }

  static #adjustXP(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const delta = Number(target.dataset.delta);
    if (!Number.isFinite(delta)) return;
    const xp = (this.actor.system as any).details?.xp;
    if (!xp) return;
    this.actor.update({ "system.details.xp.value": xp.value + delta });
  }

  static #rollAbility(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const ability = target.closest<HTMLElement>("[data-ability]")?.dataset.ability;
    if (ability) this.actor.rollAbilityCheck?.({ ability, event });
  }

  static #rollSave(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const ability = target.closest<HTMLElement>("[data-ability]")?.dataset.ability;
    if (ability) this.actor.rollSavingThrow?.({ ability, event });
  }

  static #rollSkill(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const skill = target.closest<HTMLElement>("[data-skill]")?.dataset.skill;
    if (skill) this.actor.rollSkill?.({ event, skill });
  }

  static #rollInitiative(this: LPCSSheet, event: Event, target: HTMLElement): void {
    this.actor.rollInitiativeDialog?.({ event });
  }

  static #rollDeathSave(this: LPCSSheet, event: Event, target: HTMLElement): void {
    this.actor.rollDeathSave?.({ event, legacy: false });
  }

  static #useItem(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const itemId = target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items?.get(itemId ?? "");
    if (item) item.use?.({ event });
  }

  static #toggleDrawer(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const drawerId = target.closest<HTMLElement>("[data-drawer-id]")?.dataset.drawerId;
    if (!drawerId) return;
    if (this._expandedDrawers.has(drawerId)) {
      this._expandedDrawers.delete(drawerId);
    } else {
      this._expandedDrawers.add(drawerId);
    }
    // Re-render just the relevant part by toggling CSS class (no full re-render)
    const drawerEl = this.element.querySelector(`[data-drawer-id="${drawerId}"] .lpcs-drawer-body`);
    drawerEl?.classList.toggle("expanded");
  }

  static #toggleInspiration(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const current = (this.actor.system as any).attributes?.inspiration;
    this.actor.update({ "system.attributes.inspiration": !current });
  }

  static #toggleSpellSlot(this: LPCSSheet, event: Event, target: HTMLElement): void {
    const prop = target.dataset.prop;
    const n = Number(target.dataset.n);
    if (!prop || !Number.isFinite(n)) return;
    const current = (foundry as any).utils.getProperty(this.actor, prop) ?? 0;
    const newValue = current === n ? n - 1 : n;
    this.actor.update({ [prop]: newValue });
  }

  /* ── HP/XP Input Handlers ──────────────────────────────── */

  private _onHPInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    const hp = (this.actor.system as any).attributes?.hp;
    if (!hp) return;

    let newValue: number;
    if (raw.startsWith("+") || raw.startsWith("-")) {
      // Delta mode: "+5" or "-3"
      newValue = hp.value + Number(raw);
    } else {
      newValue = Number(raw);
    }

    if (Number.isFinite(newValue)) {
      newValue = Math.clamped(newValue, 0, hp.max);
      this.actor.update({ "system.attributes.hp.value": newValue });
    }
  }

  private _onXPInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    const xp = (this.actor.system as any).details?.xp;
    if (!xp) return;

    let newValue: number;
    if (raw.startsWith("+") || raw.startsWith("-")) {
      newValue = xp.value + Number(raw);
    } else {
      newValue = Number(raw);
    }

    if (Number.isFinite(newValue)) {
      this.actor.update({ "system.details.xp.value": Math.max(0, newValue) });
    }
  }
}

/* ── Registration ─────────────────────────────────────── */

/**
 * Register the LPCS sheet with Foundry's DocumentSheetConfig.
 * Called from Hooks.once("init") in src/index.ts.
 *
 * Pattern from dnd5e.mjs:
 *   DocumentSheetConfig.registerSheet(Actor, "dnd5e", CharacterActorSheet, { ... })
 */
export function registerLPCSSheet(): void {
  const DSC = (globalThis as any).foundry?.applications?.apps?.DocumentSheetConfig;
  const Actor = (globalThis as any).Actor;
  if (!DSC || !Actor) return;

  DSC.registerSheet(Actor, MOD, LPCSSheet, {
    types: ["character"],
    makeDefault: false,
    label: "FTH.LPCS.SheetLabel",
  });
}
```

Key design decisions:

makeDefault: false — players opt-in via sheet configuration (right-click actor → Sheet Configuration)
id: "lpcs-{id}" — Foundry replaces {id} with the document ID, ensuring unique window IDs
form.submitOnChange: true — matches dnd5e convention for live editing
Actions are static methods following the exact dnd5e pattern
Drawers toggle via CSS class (no re-render), keeping interaction instant
HP/XP inputs support delta syntax (+5, -3) like dnd5e sheets
3.1.4 Sheet Registration & Hook Wiring (src/index.ts)
Add LPCS initialization to the existing hook wiring:

```
// In init hook:
import { registerLPCSSheet } from "./lpcs/lpcs-sheet";
import { registerLPCSSettings } from "./lpcs/lpcs-settings";

getHooks()?.on?.("init", () => {
  registerSettings();             // existing
  registerLPCSSettings(game.settings);  // NEW
  registerWindowRotationHooks();  // existing
  registerPrintSheetHooks();      // existing
  registerLPCSSheet();            // NEW — registers sheet class
  // ... existing log level + Log.info
});

// In ready hook:
import { autoOpenLPCS } from "./lpcs/lpcs-auto-open";

getHooks()?.on?.("ready", () => {
  // ... existing ready logic ...
  autoOpenLPCS();                 // NEW
});
```

3.1.5 Auto-Open Logic (src/lpcs/lpcs-auto-open.ts)

```
import { Log } from "../logger";
import { getGame, isDnd5eWorld, isGM } from "../types";
import { lpcsEnabled, lpcsAutoOpen } from "./lpcs-settings";

/**
 * Auto-open the LPCS for the current player if:
 * 1. The feature is enabled (world setting)
 * 2. Auto-open is enabled (client setting)
 * 3. The world is dnd5e
 * 4. The user is NOT a GM
 * 5. The user has an assigned character
 * 6. The character's current sheet class is LPCSSheet
 *
 * Called from Hooks.once("ready").
 *
 * @see game.user.character — https://foundryvtt.com/api/classes/foundry.documents.BaseUser.html
 */
export function autoOpenLPCS(): void {
  if (!lpcsEnabled() || !lpcsAutoOpen()) return;
  if (!isDnd5eWorld()) return;
  if (isGM()) return;

  const game = getGame();
  const character = (game?.user as any)?.character;
  if (!character) {
    Log.debug("LPCS auto-open: no assigned character for this user");
    return;
  }

  // Only auto-open if the character's configured sheet is LPCS
  // This respects the user's sheet choice
  try {
    character.sheet?.render({ force: true });
    Log.info("LPCS auto-open: opened sheet for", character.name);
  } catch (err) {
    Log.warn("LPCS auto-open failed:", err);
  }
}
```

Important: This opens whatever sheet the character is configured to use. If the player has set LPCS as their sheet, it opens LPCS. If they use the default dnd5e sheet, it opens that. This is intentional — we don't force LPCS.

Phase 2: View Model Layer
3.2.1 View Model Types (src/lpcs/lpcs-types.ts)

```
/**
 * LPCS View Model types.
 * These define the exact shape of data passed to Handlebars templates.
 * Templates should NEVER reach into actor.system directly — only use these.
 */

export interface LPCSViewModel {
  /** Character identity */
  name: string;
  img: string;
  classLabel: string;     // e.g., "Fighter 5 / Wizard 3"
  level: number;
  species: string;        // e.g., "Human"
  background: string;     // e.g., "Soldier"
  inspiration: boolean;

  /** Core stats bar */
  hp: LPCSHitPoints;
  ac: number;
  speed: LPCSSpeed;
  initiative: string;     // e.g., "+3"
  proficiencyBonus: string; // e.g., "+2"

  /** XP (only shown if levelingMode !== "noxp") */
  xp: LPCSExperience | null;

  /** Abilities tab */
  abilities: LPCSAbility[];
  saves: LPCSSave[];
  skills: LPCSSkill[];
  senses: LPCSSense[];

  /** Combat tab */
  weapons: LPCSWeapon[];
  actions: LPCSAction[];
  bonusActions: LPCSAction[];
  reactions: LPCSAction[];

  /** Spells tab */
  spellcasting: LPCSSpellcasting | null;
  spellSlots: LPCSSpellSlotLevel[];
  spells: LPCSSpellLevel[];

  /** Inventory tab */
  inventory: LPCSInventoryItem[];
  currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
  encumbrance: LPCSEncumbrance;

  /** Features tab */
  features: LPCSFeatureGroup[];
  traits: LPCSTraitGroup[];
  proficiencies: LPCSProficiencies;

  /** Death saves (shown when HP === 0) */
  deathSaves: LPCSDeathSaves;

  /** Hit dice */
  hitDice: LPCSHitDice[];

  /** Conditions/exhaustion */
  exhaustion: number;
}

export interface LPCSHitPoints {
  value: number;
  max: number;
  temp: number;
  pct: number;            // 0-100 for progress bar width
  color: string;          // CSS color based on HP percentage
}

export interface LPCSExperience {
  value: number;
  max: number;
  pct: number;
}

export interface LPCSSpeed {
  primary: number;        // Highest speed
  label: string;          // e.g., "Walk" or "Fly"
  all: Array<{ type: string; value: number }>;
}

export interface LPCSAbility {
  key: string;            // "str", "dex", etc.
  label: string;          // "Strength"
  abbr: string;           // "STR"
  score: number;          // 18
  mod: string;            // "+4"
  modValue: number;       // 4 (numeric for conditional styling)
}

export interface LPCSSave {
  key: string;
  abbr: string;
  mod: string;            // "+6"
  proficient: boolean;
}

export interface LPCSSkill {
  key: string;
  label: string;
  mod: string;            // "+5"
  modValue: number;
  ability: string;        // "DEX"
  proficient: boolean;    // has any proficiency
  profLevel: number;      // 0=none, 0.5=half, 1=prof, 2=expertise
  passive: number;
}

export interface LPCSSense {
  label: string;
  value: number | string;
}

export interface LPCSWeapon {
  id: string;
  name: string;
  attackBonus: string;    // "+7"
  damage: string;         // "1d8 + 4 slashing"
  range: string;          // "5 ft." or "150/600 ft."
  properties: string[];   // ["Versatile", "Finesse"]
  mastery: string | null; // "Graze" or null
  img: string;
}

export interface LPCSAction {
  id: string;
  name: string;
  description: string;    // Short, first-sentence summary
  img: string;
  uses: { value: number; max: number } | null;
  recharge: string | null;
}

export interface LPCSSpellcasting {
  ability: string;        // "INT"
  attackBonus: string;    // "+7"
  saveDC: number;         // 15
}

export interface LPCSSpellSlotLevel {
  level: number;          // 1-9
  label: string;          // "1st Level"
  slots: { value: number; max: number };
  pips: Array<{ n: number; filled: boolean }>;
}

export interface LPCSSpellLevel {
  level: number;
  label: string;
  spells: LPCSSpell[];
}

export interface LPCSSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  img: string;
  prepared: boolean;
  concentration: boolean;
  ritual: boolean;
  components: string;     // "V, S, M"
  castingTime: string;
  range: string;
  description: string;    // Short summary
}

export interface LPCSInventoryItem {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  type: string;           // "weapon", "armor", "consumable", etc.
}

export interface LPCSEncumbrance {
  value: number;
  max: number;
  pct: number;
  encumbered: boolean;
}

export interface LPCSFeatureGroup {
  label: string;
  features: LPCSFeature[];
}

export interface LPCSFeature {
  id: string;
  name: string;
  img: string;
  description: string;    // Short summary
  uses: { value: number; max: number } | null;
  source: string;         // "Fighter", "Feat", etc.
}

export interface LPCSTraitGroup {
  key: string;            // "dr", "di", "dv", etc.
  label: string;          // "Damage Resistances"
  values: string[];       // ["Fire", "Cold"]
}

export interface LPCSProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  weaponMasteries: string[];
}

export interface LPCSDeathSaves {
  successes: number;
  failures: number;
  show: boolean;          // true when HP === 0
}

export interface LPCSHitDice {
  die: string;            // "d10"
  value: number;          // remaining
  max: number;
  class: string;          // "Fighter"
}
```

/**
 * LPCS View Model types.
 * These define the exact shape of data passed to Handlebars templates.
 * Templates should NEVER reach into actor.system directly — only use these.
 */

export interface LPCSViewModel {
  /** Character identity */
  name: string;
  img: string;
  classLabel: string;     // e.g., "Fighter 5 / Wizard 3"
  level: number;
  species: string;        // e.g., "Human"
  background: string;     // e.g., "Soldier"
  inspiration: boolean;

  /** Core stats bar */
  hp: LPCSHitPoints;
  ac: number;
  speed: LPCSSpeed;
  initiative: string;     // e.g., "+3"
  proficiencyBonus: string; // e.g., "+2"

  /** XP (only shown if levelingMode !== "noxp") */
  xp: LPCSExperience | null;

  /** Abilities tab */
  abilities: LPCSAbility[];
  saves: LPCSSave[];
  skills: LPCSSkill[];
  senses: LPCSSense[];

  /** Combat tab */
  weapons: LPCSWeapon[];
  actions: LPCSAction[];
  bonusActions: LPCSAction[];
  reactions: LPCSAction[];

  /** Spells tab */
  spellcasting: LPCSSpellcasting | null;
  spellSlots: LPCSSpellSlotLevel[];
  spells: LPCSSpellLevel[];

  /** Inventory tab */
  inventory: LPCSInventoryItem[];
  currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
  encumbrance: LPCSEncumbrance;

  /** Features tab */
  features: LPCSFeatureGroup[];
  traits: LPCSTraitGroup[];
  proficiencies: LPCSProficiencies;

  /** Death saves (shown when HP === 0) */
  deathSaves: LPCSDeathSaves;

  /** Hit dice */
  hitDice: LPCSHitDice[];

  /** Conditions/exhaustion */
  exhaustion: number;
}

export interface LPCSHitPoints {
  value: number;
  max: number;
  temp: number;
  pct: number;            // 0-100 for progress bar width
  color: string;          // CSS color based on HP percentage
}

export interface LPCSExperience {
  value: number;
  max: number;
  pct: number;
}

export interface LPCSSpeed {
  primary: number;        // Highest speed
  label: string;          // e.g., "Walk" or "Fly"
  all: Array<{ type: string; value: number }>;
}

export interface LPCSAbility {
  key: string;            // "str", "dex", etc.
  label: string;          // "Strength"
  abbr: string;           // "STR"
  score: number;          // 18
  mod: string;            // "+4"
  modValue: number;       // 4 (numeric for conditional styling)
}

export interface LPCSSave {
  key: string;
  abbr: string;
  mod: string;            // "+6"
  proficient: boolean;
}

export interface LPCSSkill {
  key: string;
  label: string;
  mod: string;            // "+5"
  modValue: number;
  ability: string;        // "DEX"
  proficient: boolean;    // has any proficiency
  profLevel: number;      // 0=none, 0.5=half, 1=prof, 2=expertise
  passive: number;
}

export interface LPCSSense {
  label: string;
  value: number | string;
}

export interface LPCSWeapon {
  id: string;
  name: string;
  attackBonus: string;    // "+7"
  damage: string;         // "1d8 + 4 slashing"
  range: string;          // "5 ft." or "150/600 ft."
  properties: string[];   // ["Versatile", "Finesse"]
  mastery: string | null; // "Graze" or null
  img: string;
}

export interface LPCSAction {
  id: string;
  name: string;
  description: string;    // Short, first-sentence summary
  img: string;
  uses: { value: number; max: number } | null;
  recharge: string | null;
}

export interface LPCSSpellcasting {
  ability: string;        // "INT"
  attackBonus: string;    // "+7"
  saveDC: number;         // 15
}

export interface LPCSSpellSlotLevel {
  level: number;          // 1-9
  label: string;          // "1st Level"
  slots: { value: number; max: number };
  pips: Array<{ n: number; filled: boolean }>;
}

export interface LPCSSpellLevel {
  level: number;
  label: string;
  spells: LPCSSpell[];
}

export interface LPCSSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  img: string;
  prepared: boolean;
  concentration: boolean;
  ritual: boolean;
  components: string;     // "V, S, M"
  castingTime: string;
  range: string;
  description: string;    // Short summary
}

export interface LPCSInventoryItem {
  id: string;
  name: string;
  img: string;
  quantity: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  type: string;           // "weapon", "armor", "consumable", etc.
}

export interface LPCSEncumbrance {
  value: number;
  max: number;
  pct: number;
  encumbered: boolean;
}

export interface LPCSFeatureGroup {
  label: string;
  features: LPCSFeature[];
}

export interface LPCSFeature {
  id: string;
  name: string;
  img: string;
  description: string;    // Short summary
  uses: { value: number; max: number } | null;
  source: string;         // "Fighter", "Feat", etc.
}

export interface LPCSTraitGroup {
  key: string;            // "dr", "di", "dv", etc.
  label: string;          // "Damage Resistances"
  values: string[];       // ["Fire", "Cold"]
}

export interface LPCSProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  weaponMasteries: string[];
}

export interface LPCSDeathSaves {
  successes: number;
  failures: number;
  show: boolean;          // true when HP === 0
}

export interface LPCSHitDice {
  die: string;            // "d10"
  value: number;          // remaining
  max: number;
  class: string;          // "Fighter"
}

```
import type { LPCSViewModel, LPCSHitPoints, LPCSAbility, LPCSSkill /* ... */ } from "./lpcs-types";
import { ABILITY_KEYS, abilityLabel } from "../print-sheet/extractors/dnd5e-extract-helpers";
import { Log } from "../logger";

/**
 * Build the complete LPCS view model from a dnd5e Actor document.
 *
 * This function is the SOLE bridge between actor data and templates.
 * Templates must never access actor.system directly.
 *
 * @param actor - A dnd5e character Actor document
 * @returns Complete view model for all LPCS templates
 */
export function buildLPCSViewModel(actor: any): LPCSViewModel {
  const system = actor.system;
  if (!system) {
    Log.warn("buildLPCSViewModel: actor has no system data");
    return createEmptyViewModel(actor.name ?? "Unknown");
  }

  return {
    name: actor.name ?? "Unknown",
    img: actor.img ?? "",
    classLabel: buildClassLabel(actor),
    level: system.details?.level ?? 0,
    species: system.details?.race?.name ?? system.details?.race ?? "",
    background: system.details?.background?.name ?? system.details?.background ?? "",
    inspiration: system.attributes?.inspiration ?? false,

    hp: buildHP(system),
    ac: system.attributes?.ac?.value ?? 10,
    speed: buildSpeed(system),
    initiative: formatMod(system.attributes?.init?.total ?? 0),
    proficiencyBonus: formatMod(system.attributes?.prof ?? 0),

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
    currency: {
      pp: system.currency?.pp ?? 0,
      gp: system.currency?.gp ?? 0,
      ep: system.currency?.ep ?? 0,
      sp: system.currency?.sp ?? 0,
      cp: system.currency?.cp ?? 0,
    },
    encumbrance: buildEncumbrance(system),

    features: buildFeatures(actor),
    traits: buildTraits(system),
    proficiencies: buildProficiencies(actor, system),

    deathSaves: {
      successes: system.attributes?.death?.success ?? 0,
      failures: system.attributes?.death?.failure ?? 0,
      show: (system.attributes?.hp?.value ?? 1) === 0,
    },

    hitDice: buildHitDice(actor),
    exhaustion: system.attributes?.exhaustion ?? 0,
  };
}
```

Implementation notes for each builder function:

buildHP: Reads system.attributes.hp.{value, max, temp}. Calculates pct as Math.round((value / max) * 100). Sets color to green (>50%), amber (25-50%), red (<25%).
buildSpeed: Iterates CONFIG.DND5E.movementTypes, finds highest. Falls back to system.attributes.movement.walk.
buildAbilities: Uses ABILITY_KEYS from existing helpers. Reads system.abilities[key].{value, mod}.
buildSkills: Iterates system.skills, reads {total, ability, value (proficiency level), passive}. Uses CONFIG.DND5E.skills[key].label for display name.
buildWeapons: Filters actor.items for type "weapon" with equipped status. Reads activities for attack/damage formulas.
buildSpellSlots: Iterates system.spells entries, builds pip arrays for each level.
buildInventory: Filters items, excludes spells and class/subclass/background types.
buildFeatures: Groups by origin (class name, species, background, feat).
buildTraits: Reads system.traits.{dr, di, dv, dm, ci} for damage/condition resistances/immunities.
buildProficiencies: Reads trait config, reuses existing extractProficiencies pattern.
Each function follows defensive coding — optional chaining everywhere, fallbacks for every value. Actor data shape is NEVER assumed to be complete.

Phase 3: Templates (Handlebars)
All templates live in templates/lpcs/. They render data from the vm (view model) property in context. Templates are "dumb" — zero logic beyond simple {{#if}}, {{#each}}, and value display.

3.3.1 Template Overview
Template	Purpose	Key data
lpcs-header.hbs	Portrait, name, class/level, species, inspiration	vm.name, vm.img, vm.classLabel, vm.level, vm.inspiration
lpcs-stats-bar.hbs	HP bar (editable), AC badge, speed, initiative, prof bonus, death saves	vm.hp, vm.ac, vm.speed, vm.initiative, vm.deathSaves
lpcs-tab-nav.hbs	Horizontal tab buttons	tabs[] array with active flag
lpcs-tab-abilities.hbs	6 ability cards, saves row, skills list, senses	vm.abilities, vm.saves, vm.skills, vm.senses
lpcs-tab-combat.hbs	Weapons table, actions/bonus/reactions with drawers	vm.weapons, vm.actions, vm.bonusActions, vm.reactions
lpcs-tab-spells.hbs	Spellcasting header, slot pips, spells by level	vm.spellcasting, vm.spellSlots, vm.spells
lpcs-tab-inventory.hbs	Item list with equip toggles, currency, encumbrance	vm.inventory, vm.currency, vm.encumbrance
lpcs-tab-features.hbs	Feature groups with drawers, traits, proficiencies	vm.features, vm.traits, vm.proficiencies
lpcs-drawer.hbs	Reusable partial: expandable detail panel	Receives title, content, drawerId
3.3.2 Template Patterns
Tab content pattern (each tab follows this):

```
{{!-- lpcs-tab-abilities.hbs --}}
<section class="lpcs-tab lpcs-tab--abilities" data-tab="abilities">

  {{!-- Ability Score Grid --}}
  <div class="lpcs-ability-grid">
    {{#each vm.abilities}}
    <div class="lpcs-ability-card" data-ability="{{key}}" data-drawer-id="ability-{{key}}">
      <span class="lpcs-ability-abbr">{{abbr}}</span>
      <span class="lpcs-ability-score">{{score}}</span>
      <button class="lpcs-ability-mod rollable" data-action="rollAbility"
              type="button" aria-label="Roll {{label}} check">
        {{mod}}
      </button>
    </div>
    {{/each}}
  </div>

  {{!-- Saving Throws --}}
  <div class="lpcs-saves-row">
    <h3 class="lpcs-section-title">Saving Throws</h3>
    {{#each vm.saves}}
    <button class="lpcs-save-chip {{#if proficient}}proficient{{/if}} rollable"
            data-action="rollSave" data-ability="{{key}}" type="button">
      <span class="lpcs-save-abbr">{{abbr}}</span>
      <span class="lpcs-save-mod">{{mod}}</span>
    </button>
    {{/each}}
  </div>

  {{!-- Skills List --}}
  <div class="lpcs-skills-list">
    <h3 class="lpcs-section-title">Skills</h3>
    {{#each vm.skills}}
    <button class="lpcs-skill-row rollable" data-action="rollSkill" data-skill="{{key}}" type="button">
      <span class="lpcs-skill-prof lpcs-prof--{{profLevel}}"></span>
      <span class="lpcs-skill-name">{{label}}</span>
      <span class="lpcs-skill-ability">({{ability}})</span>
      <span class="lpcs-skill-mod">{{mod}}</span>
    </button>
    {{/each}}
  </div>

</section>
```

Drawer partial pattern:

```
{{!-- lpcs-drawer.hbs --}}
<div class="lpcs-drawer" data-drawer-id="{{drawerId}}">
  <button class="lpcs-drawer-header" data-action="toggleDrawer" type="button">
    {{#if img}}<img src="{{img}}" alt="" class="lpcs-drawer-icon" loading="lazy">{{/if}}
    <span class="lpcs-drawer-title">{{title}}</span>
    {{#if uses}}
    <span class="lpcs-drawer-uses">{{uses.value}}/{{uses.max}}</span>
    {{/if}}
    <i class="lpcs-drawer-chevron fas fa-chevron-down"></i>
  </button>
  <div class="lpcs-drawer-body">
    <p class="lpcs-drawer-desc">{{{description}}}</p>
  </div>
</div>
```

HP bar pattern (in stats-bar):

```
<div class="lpcs-hp-container">
  <div class="lpcs-hp-bar" role="meter"
       aria-valuemin="0" aria-valuemax="{{vm.hp.max}}" aria-valuenow="{{vm.hp.value}}">
    <div class="lpcs-hp-fill" style="width: {{vm.hp.pct}}%; background-color: {{vm.hp.color}};"></div>
    <input class="lpcs-hp-input" type="text" value="{{vm.hp.value}}"
           aria-label="Hit Points" inputmode="numeric">
    <span class="lpcs-hp-max">/ {{vm.hp.max}}</span>
  </div>
  {{#if vm.hp.temp}}
  <span class="lpcs-hp-temp">+{{vm.hp.temp}} temp</span>
  {{/if}}
</div>
```

Phase 4: CSS Design System (src/lpcs/lpcs-styles.css)
3.4.1 Design Tokens (CSS Custom Properties)

```
.lpcs-sheet {
  /* ── Color System ─────────────────────────────────────── */
  --lpcs-bg-base:         #0f1115;
  --lpcs-bg-panel:        #1a1d24;
  --lpcs-bg-panel-hover:  #22262f;
  --lpcs-bg-glass:        rgba(255, 255, 255, 0.04);
  --lpcs-bg-glass-hover:  rgba(255, 255, 255, 0.08);

  --lpcs-accent-bronze:   #c8a75d;
  --lpcs-accent-crimson:  #8b1e2d;
  --lpcs-accent-gold:     #d4af37;

  --lpcs-text-primary:    #e8e4dc;
  --lpcs-text-secondary:  #9a9590;
  --lpcs-text-muted:      #5a5550;

  --lpcs-border:          rgba(200, 167, 93, 0.15);
  --lpcs-border-accent:   rgba(200, 167, 93, 0.4);

  /* ── HP Colors ────────────────────────────────────────── */
  --lpcs-hp-healthy:      #2d8a4e;
  --lpcs-hp-wounded:      #c49a2a;
  --lpcs-hp-critical:     #8b1e2d;
  --lpcs-hp-temp:         #4a7ab5;

  /* ── Layout ───────────────────────────────────────────── */
  --lpcs-radius-sm:       8px;
  --lpcs-radius-md:       12px;
  --lpcs-radius-lg:       16px;
  --lpcs-radius-xl:       18px;

  --lpcs-space-xs:        4px;
  --lpcs-space-sm:        8px;
  --lpcs-space-md:        12px;
  --lpcs-space-lg:        16px;
  --lpcs-space-xl:        24px;

  /* ── Typography ───────────────────────────────────────── */
  --lpcs-font-display:    "Roboto Slab", serif;
  --lpcs-font-body:       "Roboto", sans-serif;
  --lpcs-font-mono:       "Roboto Condensed", sans-serif;

  /* ── Touch Targets ────────────────────────────────────── */
  --lpcs-touch-min:       44px;  /* Apple HIG minimum */
}
```

3.4.2 Key CSS Patterns
Glass panel effect:

```
.lpcs-panel {
  background: var(--lpcs-bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--lpcs-border);
  border-radius: var(--lpcs-radius-lg);
  padding: var(--lpcs-space-md);
}
```

Touch-friendly button:

```
.lpcs-sheet button.rollable,
.lpcs-sheet .lpcs-skill-row,
.lpcs-sheet .lpcs-drawer-header {
  min-height: var(--lpcs-touch-min);
  min-width: var(--lpcs-touch-min);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
```

.lpcs-sheet button.rollable,
.lpcs-sheet .lpcs-skill-row,
.lpcs-sheet .lpcs-drawer-header {
  min-height: var(--lpcs-touch-min);
  min-width: var(--lpcs-touch-min);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

Drawer animation (CSS-only, no JS re-render):

```
.lpcs-drawer-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease-out, padding 0.25s ease-out;
  padding: 0 var(--lpcs-space-md);
}

.lpcs-drawer-body.expanded {
  max-height: 500px; /* generous max, content determines actual */
  padding: var(--lpcs-space-sm) var(--lpcs-space-md) var(--lpcs-space-md);
}

.lpcs-drawer-chevron {
  transition: transform 0.25s ease;
}

.lpcs-drawer-body.expanded ~ .lpcs-drawer-header .lpcs-drawer-chevron,
.lpcs-drawer:has(.lpcs-drawer-body.expanded) .lpcs-drawer-chevron {
  transform: rotate(180deg);
}
```

HP bar:

```
.lpcs-hp-container {
  position: relative;
  width: 100%;
}

.lpcs-hp-bar {
  position: relative;
  height: 36px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--lpcs-radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  border: 1px solid var(--lpcs-border);
}

.lpcs-hp-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: var(--lpcs-radius-md);
  transition: width 0.3s ease, background-color 0.3s ease;
}

.lpcs-hp-input {
  position: relative;
  z-index: 1;
  background: transparent;
  border: none;
  color: var(--lpcs-text-primary);
  font-weight: bold;
  font-size: 1rem;
  text-align: center;
  width: 60px;
  padding: 0;
  font-family: var(--lpcs-font-mono);
}
```

3.4.3 Responsive Breakpoints

```
/* iPad landscape (default target) */
/* No media query needed — base styles ARE the iPad layout */

/* iPad portrait / smaller tablets */
@media (max-width: 768px) {
  .lpcs-ability-grid {
    grid-template-columns: repeat(3, 1fr);  /* 3x2 instead of 6x1 */
  }
  .lpcs-sheet {
    --lpcs-space-md: 10px;
    --lpcs-space-lg: 14px;
  }
}

/* Phone layout */
@media (max-width: 480px) {
  .lpcs-ability-grid {
    grid-template-columns: repeat(2, 1fr);  /* 2x3 */
  }
  .lpcs-stats-bar {
    flex-wrap: wrap;
  }
  .lpcs-tab-nav {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

Phase 5: Template Preloading
Templates must be preloaded during init for performance. Add to registerLPCSSheet():

```
export async function preloadLPCSTemplates(): Promise<void> {
  const templatePaths = [
    `modules/${MOD}/templates/lpcs/lpcs-header.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-abilities.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-combat.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-spells.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-drawer.hbs`,
  ];
  // loadTemplates is a Foundry global
  await (globalThis as any).loadTemplates(templatePaths);
}
```

Call this from the init hook after registerLPCSSheet().

4. Edge Cases & Failure Modes
Scenario	Expected Behavior
Non-dnd5e world	LPCS doesn't register (guard by isDnd5eWorld() in sheet registration)
Actor with no system data	buildLPCSViewModel returns safe empty defaults
No assigned character	Auto-open silently skips
GM user	Auto-open skips (GMs don't need auto-open)
Limited permission on actor	Show limited view (name + portrait only)
Actor with 0 HP	Death save tray shown automatically
HP input with non-numeric value	Silently ignored, no update
Missing spell slots	Empty array, no crash
Actor without classes	classLabel shows "No Class", level 0
Drawer opened, then actor updated	Drawer state preserved in _expandedDrawers Set
Sheet opened via right-click config	Works normally — sheet is registered as an option
Multiple LPCS windows	Each has unique ID via lpcs-{id} pattern
Template not found	Foundry logs error, sheet shows blank — handled by Foundry's template loader
5. What This Plan Does NOT Include (Scope Boundaries)
No drag-and-drop — LPCS is read-mostly + roll; editing is done on the full dnd5e sheet
No item editing — Tap to use/roll only
No spell preparation — Players manage spell prep on the full sheet
No inventory management (add/remove/reorder) — Display + use only
No multi-actor sheets — One character at a time
No custom themes — Single design language per spec
No offline/PWA support — Requires active Foundry connection
No i18n beyond Foundry's localization — Labels use localization keys that Foundry resolves
6. Implementation Order (Developer Checklist)
Execute in this exact order. Each step should compile and build before moving to the next.

Step	Files	Description
1	src/types/foundry.d.ts	Add ActorSheetV2, HandlebarsApplicationMixin, DocumentSheetConfig type shims
2	src/lpcs/lpcs-types.ts	Create all view model interfaces
3	src/lpcs/lpcs-settings.ts	Create settings registration + accessors
4	src/lpcs/lpcs-view-model.ts	Create view model builder with all transform functions
5	src/lpcs/lpcs-sheet.ts	Create sheet class + registration function
6	src/lpcs/lpcs-auto-open.ts	Create auto-open logic
7	templates/lpcs/*.hbs	Create all 9 Handlebars templates
8	src/lpcs/lpcs-styles.css	Create full CSS design system
9	src/index.ts	Wire up init + ready hooks
10	src/settings.ts	Import and call LPCS settings registration
11	Build + test	npm run build, verify no errors
7. Verification Checklist (Mandatory per AGENTS.md §9C)
Fresh World Test
Create new dnd5e world
Enable module
Confirm no console errors on init/ready
Create a character actor
Right-click actor → Sheet Configuration → LPCS should be listed
Select LPCS sheet → opens correctly
All tabs render without errors
Close and reopen → no duplicate listeners
Existing World Test
Load world with existing characters
Switch a character to LPCS sheet
All data renders correctly (abilities, skills, spells, inventory)
HP adjustment works (click +/- buttons, type delta in input)
Tab switching is instant (no visible delay)
Drawers expand/collapse smoothly
Rolling works (click ability, save, skill, attack)
Auto-Open Test
Assign a character to a player
Set character's sheet to LPCS
Enable auto-open setting
Log in as that player → LPCS opens automatically
Log in as GM → LPCS does NOT auto-open
Non-dnd5e World Test
Create a non-dnd5e world (e.g., simple worldbuilding)
Enable module
Confirm no console errors
LPCS sheet is NOT listed in sheet options
iPad/Mobile Test
Open LPCS on iPad Safari (or responsive mode at 1024×768)
Layout doesn't break
All touch targets are ≥44px
Scrolling works within tab content
HP input works with on-screen keyboard
Performance Test
Open LPCS for a character with 50+ items and 30+ spells
Tab switching remains under 100ms perceived
No visible jank on drawer open/close
No memory leaks on repeated open/close cycles
Compatibility Test
Other sheets (dnd5e default) still work normally
Window rotation feature still works on LPCS window
Print sheet feature still works
No interference with other installed modules
8. API References Quick-Lookup
What	Access Pattern
Register sheet	foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, moduleId, SheetClass, opts)
Base class	foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)
Actor from sheet	this.actor (inherited from ActorSheetV2)
Actor HP	this.actor.system.attributes.hp.{value, max, temp}
Actor abilities	this.actor.system.abilities[key].{value, mod, save}
Actor skills	this.actor.system.skills[key].{total, passive, ability, value}
Actor items	this.actor.items (Collection)
Actor spells	this.actor.system.spells[slotKey].{value, max}
Roll ability check	this.actor.rollAbilityCheck({ ability, event })
Roll save	this.actor.rollSavingThrow({ ability, event })
Roll skill	this.actor.rollSkill({ event, skill })
Roll initiative	this.actor.rollInitiativeDialog({ event })
Roll death save	this.actor.rollDeathSave({ event, legacy: false })
Use item	item.use({ event })
User's character	game.user.character
Preload templates	loadTemplates(paths[])
Math clamp	Math.clamped(value, min, max) (Foundry global)
Get nested prop	foundry.utils.getProperty(obj, path)



Template details:

1) Implementation specs (handoff)
Goals

Glanceable, real-dice-first: show mods, not “roll buttons”

Tap to expand: mastery, weapons, skills, effects open a detail drawer/modal

Mobile-first: iPad portrait primary, phone scales gracefully

Performance-friendly: minimal layout thrash; avoid heavy shadows on low-end devices

Rendering approach

Render this sheet as a single container with “sections”:

header (hero art + identity)

quickbar (HP/XP)

stats (abilities)

tabs (Actions / Spells / Inventory / Effects)

list (contextual to current tab)

Data contract (what template expects)

Prepare a view-model (plain JS object) like:

character

name, subtitle (e.g. "Human Rogue 1"), levelBadge

portraitUrl, heroArtUrl (optional; can reuse portrait)

wifiIcon, batteryIcon (optional; you can omit these)

hp

value, max, temp, pct (0–100)

xp

value, max, pct

abilities[] (6 items)

key (STR), mod (+3), score (17)

tooltip (optional)

tabs[]

id (actions|spells|inventory|effects), label, icon

isActive

actionSubtabs[] (only for Actions tab)

id (attacks|bonus|reactions|utility), label, isActive

actions.attacks[]

name

toHit (e.g. +5)

damage (e.g. 1d6+3)

damageType (Piercing)

tags[] e.g. {label:"DEX", kind:"meta"}, {label:"Vex", kind:"mastery", masteryId:"vex"}

properties[] e.g. {icon:"light", label:"Light"}

rangeShort, rangeLong optional

img optional

favorites[] (small list)

same shape as actions or items (your choice) with type field

Interactions (classes used as hooks)

Your dev should wire these to Foundry / module logic:

.lpcs-tab click → switch activeTab

.lpcs-subtab click → switch activeSubtab

.lpcs-hp-adjust (heal/damage) opens a small numeric prompt or bottom sheet

.lpcs-row click → open detail drawer for that entity

.lpcs-tag--mastery click → open mastery rules drawer (lookup by masteryId)

.lpcs-clear-log (optional future) → clear change log

Responsiveness rules

iPad portrait: keep everything single column, list scrolls

Phone: abilities become 2 rows of 3; list rows tighten; header art reduces

Use clamp() for font sizes and padding.

Theming

Support data-theme="dark|light" on root container

Use CSS variables for palette so the theme swap is trivial.

2) Mustache template (lpcs-sheet.mustache)

This is pure Mustache-compatible HTML. No logic beyond sections/loops.
Your dev supplies the view-model and inserts into Foundry sheet HTML.

```
<div class="lpcs" data-theme="{{theme}}">
  <!-- HERO HEADER -->
  <header class="lpcs-hero" style="{{#character.heroArtUrl}}--hero-art: url('{{character.heroArtUrl}}');{{/character.heroArtUrl}}">
    <div class="lpcs-hero__bg"></div>

    <div class="lpcs-hero__top">
      <div class="lpcs-hero__avatar">
        <img class="lpcs-avatar__img" src="{{character.portraitUrl}}" alt="{{character.name}}" />
        <div class="lpcs-avatar__badge">{{character.levelBadge}}</div>
      </div>

      <div class="lpcs-hero__identity">
        <div class="lpcs-hero__name">{{character.name}}</div>
        <div class="lpcs-hero__subtitle">{{character.subtitle}}</div>
      </div>

      <div class="lpcs-hero__status">
        {{#character.wifiIcon}}
          <span class="lpcs-status__icon" aria-hidden="true">{{{character.wifiIcon}}}</span>
        {{/character.wifiIcon}}
        {{#character.batteryIcon}}
          <span class="lpcs-status__icon" aria-hidden="true">{{{character.batteryIcon}}}</span>
        {{/character.batteryIcon}}
      </div>
    </div>

    <!-- QUICKBARS -->
    <div class="lpcs-bars">
      <section class="lpcs-bar lpcs-bar--hp" aria-label="Hit Points">
        <div class="lpcs-bar__label">
          <span class="lpcs-ico lpcs-ico--heart" aria-hidden="true">❤</span>
          <span class="lpcs-bar__text">{{hp.value}} / {{hp.max}}</span>
          {{#hp.temp}}<span class="lpcs-bar__meta">TMP {{hp.temp}}</span>{{/hp.temp}}
        </div>
        <div class="lpcs-bar__track">
          <div class="lpcs-bar__fill" style="width: {{hp.pct}}%;"></div>
        </div>

        <!-- Optional controls (wire to prompts) -->
        <div class="lpcs-bar__controls">
          <button type="button" class="lpcs-btn lpcs-hp-adjust" data-hp-action="damage">Damage</button>
          <button type="button" class="lpcs-btn lpcs-btn--primary lpcs-hp-adjust" data-hp-action="heal">Heal</button>
        </div>
      </section>

      <section class="lpcs-bar lpcs-bar--xp" aria-label="Experience">
        <div class="lpcs-bar__label">
          <span class="lpcs-ico" aria-hidden="true">✦</span>
          <span class="lpcs-bar__text">{{xp.value}} / {{xp.max}}</span>
        </div>
        <div class="lpcs-bar__track">
          <div class="lpcs-bar__fill lpcs-bar__fill--xp" style="width: {{xp.pct}}%;"></div>
        </div>
      </section>
    </div>
  </header>

  <!-- ABILITIES -->
  <section class="lpcs-abilities" aria-label="Ability Scores">
    {{#abilities}}
      <button type="button"
              class="lpcs-ability lpcs-row"
              data-ability="{{key}}"
              aria-label="{{key}} {{mod}} ({{score}})">
        <div class="lpcs-ability__key">{{key}}</div>
        <div class="lpcs-ability__mod">{{mod}}</div>
        <div class="lpcs-ability__score">{{score}}</div>
      </button>
    {{/abilities}}
  </section>

  <!-- PRIMARY TABS -->
  <nav class="lpcs-tabs" aria-label="Character Tabs">
    {{#tabs}}
      <button type="button"
              class="lpcs-tab {{#isActive}}is-active{{/isActive}}"
              data-tab="{{id}}">
        {{#icon}}<span class="lpcs-tab__ico" aria-hidden="true">{{{icon}}}</span>{{/icon}}
        <span class="lpcs-tab__label">{{label}}</span>
      </button>
    {{/tabs}}
  </nav>

  <!-- SUBTABS (Actions only; still safe to render if empty) -->
  {{#actionSubtabs.length}}
  <nav class="lpcs-subtabs" aria-label="Action Categories">
    {{#actionSubtabs}}
      <button type="button"
              class="lpcs-subtab {{#isActive}}is-active{{/isActive}}"
              data-subtab="{{id}}">
        <span class="lpcs-subtab__label">{{label}}</span>
      </button>
    {{/actionSubtabs}}
  </nav>
  {{/actionSubtabs.length}}

  <!-- LIST AREA -->
  <main class="lpcs-main" aria-label="Sheet Content">
    <!-- ACTIONS: ATTACKS -->
    {{#showAttacks}}
    <section class="lpcs-list" aria-label="Attacks">
      {{#actions.attacks}}
      <article class="lpcs-card lpcs-row" data-entity-type="attack" data-entity-id="{{id}}">
        <div class="lpcs-card__left">
          {{#img}}<img class="lpcs-card__img" src="{{img}}" alt="" />{{/img}}
          {{^img}}<div class="lpcs-card__img lpcs-card__img--placeholder" aria-hidden="true">⚔</div>{{/img}}
        </div>

        <div class="lpcs-card__body">
          <div class="lpcs-card__title">{{name}}</div>

          <div class="lpcs-card__meta">
            <span class="lpcs-pill lpcs-pill--num">{{toHit}}</span>
            <span class="lpcs-pill lpcs-pill--num">{{damage}}</span>
            <span class="lpcs-pill lpcs-pill--muted">{{damageType}}</span>
          </div>

          <div class="lpcs-card__tags">
            {{#tags}}
              <button type="button"
                      class="lpcs-tag {{#masteryId}}lpcs-tag--mastery{{/masteryId}}"
                      data-mastery-id="{{masteryId}}">
                {{label}}
              </button>
            {{/tags}}

            {{#properties}}
              <span class="lpcs-prop" title="{{label}}">
                <span class="lpcs-prop__ico" aria-hidden="true">{{icon}}</span>
              </span>
            {{/properties}}
          </div>
        </div>

        <div class="lpcs-card__right">
          {{#rangeShort}}
            <div class="lpcs-card__range">{{rangeShort}}{{#rangeLong}} / {{rangeLong}}{{/rangeLong}}</div>
          {{/rangeShort}}
          <span class="lpcs-chevron" aria-hidden="true">›</span>
        </div>
      </article>
      {{/actions.attacks}}
    </section>
    {{/showAttacks}}

    <!-- FAVORITES -->
    {{#favorites.length}}
    <section class="lpcs-favorites" aria-label="Favorites">
      <div class="lpcs-sectionTitle">Favorites</div>
      <div class="lpcs-list">
        {{#favorites}}
          <article class="lpcs-card lpcs-row" data-entity-type="{{type}}" data-entity-id="{{id}}">
            <div class="lpcs-card__body">
              <div class="lpcs-card__title">{{name}}</div>
              {{#subtext}}<div class="lpcs-card__sub">{{subtext}}</div>{{/subtext}}
            </div>
            <span class="lpcs-chevron" aria-hidden="true">›</span>
          </article>
        {{/favorites}}
      </div>
    </section>
    {{/favorites.length}}
  </main>

  <!-- DETAIL DRAWER (initially empty; dev populates + toggles) -->
  <aside class="lpcs-drawer" aria-hidden="true">
    <div class="lpcs-drawer__handle"></div>
    <div class="lpcs-drawer__content">
      <!-- injected content -->
    </div>
  </aside>
</div>
```
3) CSS styling (lpcs-sheet.css)

This is the “look” you liked: dark, red/bronze accents, punchy typography, card rows.

```
/* =========================================================
   Live Play Character Sheet (LPCS) — v1
   ========================================================= */

.lpcs {
  /* layout */
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;

  /* type */
  font-family: ui-serif, "Cinzel", "Georgia", serif;
  letter-spacing: 0.2px;

  /* theme vars (default dark) */
  --bg: #0f1115;
  --surface: rgba(18, 20, 26, 0.72);
  --surface-2: rgba(18, 20, 26, 0.88);
  --border: rgba(200, 167, 93, 0.16);
  --text: #f4f4f4;
  --muted: rgba(244, 244, 244, 0.68);

  --accent: #8b1e2d;
  --accent-2: #c8a75d;
  --hp: #3da35d;
  --xp: #c8a75d;

  --shadow: 0 10px 30px rgba(0,0,0,0.35);
  --radius: 16px;
  --radius-sm: 12px;

  background: radial-gradient(1200px 600px at 70% 0%, rgba(139,30,45,0.18), transparent 55%),
              radial-gradient(900px 500px at 10% 10%, rgba(200,167,93,0.12), transparent 60%),
              var(--bg);
  color: var(--text);
}

/* Light theme toggle */
.lpcs[data-theme="light"]{
  --bg: #f3ebdd;
  --surface: rgba(255,255,255,0.72);
  --surface-2: rgba(255,255,255,0.88);
  --border: rgba(122,92,46,0.20);
  --text: #2b2e34;
  --muted: rgba(43,46,52,0.64);

  --accent: #7a2a2a;
  --accent-2: #7a5c2e;
  --shadow: 0 10px 26px rgba(10,10,10,0.14);
}

/* ===================== HERO ===================== */

.lpcs-hero {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.lpcs-hero__bg{
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.10) 100%),
    var(--hero-art, none);
  background-size: cover;
  background-position: center;
  filter: saturate(1.05) contrast(1.06);
  transform: scale(1.03);
}

.lpcs-hero__top{
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px 14px 10px;
}

.lpcs-hero__avatar{
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.25);
}

.lpcs-avatar__img{
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lpcs-avatar__badge{
  position: absolute;
  bottom: -8px;
  right: -8px;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(200,167,93,0.95), rgba(200,167,93,0.70));
  color: #111;
  display: grid;
  place-items: center;
  font-weight: 800;
  border: 1px solid rgba(0,0,0,0.25);
  box-shadow: 0 10px 18px rgba(0,0,0,0.35);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-hero__name{
  font-size: clamp(22px, 3.2vw, 34px);
  font-weight: 700;
  line-height: 1.05;
  text-shadow: 0 10px 28px rgba(0,0,0,0.55);
}

.lpcs-hero__subtitle{
  margin-top: 2px;
  font-size: 14px;
  color: var(--muted);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-hero__status{
  display: flex;
  gap: 8px;
  opacity: 0.8;
}

.lpcs-status__icon{
  font-size: 14px;
  color: var(--muted);
}

/* ===================== BARS ===================== */

.lpcs-bars{
  position: relative;
  display: grid;
  gap: 10px;
  padding: 0 14px 14px;
}

.lpcs-bar{
  background: rgba(0,0,0,0.28);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 10px 10px;
  backdrop-filter: blur(8px);
}

.lpcs-bar__label{
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 13px;
  color: var(--muted);
}

.lpcs-ico{
  font-size: 14px;
  color: var(--accent-2);
}

.lpcs-ico--heart{ color: #ff6b6b; }

.lpcs-bar__text{
  color: var(--text);
  font-weight: 650;
}

.lpcs-bar__meta{
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.lpcs-bar__track{
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.10);
  overflow: hidden;
}

.lpcs-bar__fill{
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(61,163,93,1), rgba(61,163,93,0.55));
  border-radius: 999px;
  transition: width 180ms ease;
}

.lpcs-bar__fill--xp{
  background: linear-gradient(90deg, rgba(200,167,93,1), rgba(200,167,93,0.55));
}

.lpcs-bar__controls{
  margin-top: 10px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.lpcs-btn{
  appearance: none;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.26);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 12px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 13px;
  min-height: 44px;
}

.lpcs-btn--primary{
  background: linear-gradient(180deg, rgba(139,30,45,0.9), rgba(139,30,45,0.6));
  border-color: rgba(139,30,45,0.55);
}

/* ===================== ABILITIES ===================== */

.lpcs-abilities{
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}

.lpcs-ability{
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 18px;
  padding: 10px 8px;
  min-height: 82px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.25);
  display: grid;
  gap: 4px;
  place-items: center;
  text-align: center;
}

.lpcs-ability__key{
  font-size: 12px;
  color: var(--muted);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  letter-spacing: 0.12em;
}

.lpcs-ability__mod{
  font-size: 22px;
  font-weight: 800;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-ability__score{
  font-size: 12px;
  color: var(--muted);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

/* ===================== TABS ===================== */

.lpcs-tabs{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.lpcs-tab{
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 14px;
  padding: 10px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  color: var(--muted);
}

.lpcs-tab.is-active{
  color: var(--text);
  border-color: rgba(200,167,93,0.40);
  background: linear-gradient(180deg, rgba(200,167,93,0.18), rgba(18,20,26,0.70));
}

.lpcs-subtabs{
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
}

.lpcs-subtab{
  appearance: none;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.18);
  color: var(--muted);
  padding: 10px 12px;
  border-radius: 999px;
  min-height: 44px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  white-space: nowrap;
}

.lpcs-subtab.is-active{
  color: var(--text);
  background: linear-gradient(180deg, rgba(139,30,45,0.85), rgba(139,30,45,0.45));
  border-color: rgba(139,30,45,0.55);
}

/* ===================== LIST / CARDS ===================== */

.lpcs-main{
  flex: 1;
  overflow: auto;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}

.lpcs-sectionTitle{
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 10px 2px 8px;
}

.lpcs-list{
  display: grid;
  gap: 10px;
}

.lpcs-card{
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
  box-shadow: 0 10px 24px rgba(0,0,0,0.22);
}

.lpcs-card__img{
  width: 40px;
  height: 40px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.25);
  display: grid;
  place-items: center;
}

.lpcs-card__title{
  font-size: 16px;
  font-weight: 650;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-card__sub{
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-card__meta{
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lpcs-pill{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 12px;
  color: var(--text);
}

.lpcs-pill--muted{
  color: var(--muted);
}

.lpcs-card__tags{
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.lpcs-tag{
  appearance: none;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 999px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 12px;
  min-height: 36px;
}

.lpcs-tag--mastery{
  color: var(--text);
  border-color: rgba(200,167,93,0.30);
  background: linear-gradient(180deg, rgba(200,167,93,0.16), rgba(0,0,0,0.20));
}

.lpcs-prop{
  display: inline-flex;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  align-items: center;
  justify-content: center;
  color: var(--muted);
}

.lpcs-card__right{
  display: grid;
  justify-items: end;
  gap: 6px;
  color: var(--muted);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.lpcs-card__range{
  font-size: 12px;
}

.lpcs-chevron{
  font-size: 24px;
  opacity: 0.6;
}

/* clickable row affordance */
.lpcs-row{
  cursor: pointer;
}

/* ===================== DRAWER ===================== */

.lpcs-drawer{
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: 60vh;
  transform: translateY(110%);
  transition: transform 180ms ease;
  background: var(--surface-2);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border: 1px solid var(--border);
  box-shadow: 0 -18px 40px rgba(0,0,0,0.45);
  padding: 10px 14px 18px;
}

.lpcs-drawer.is-open{
  transform: translateY(0%);
}

.lpcs-drawer__handle{
  width: 56px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.20);
  margin: 4px auto 12px;
}

.lpcs-drawer__content{
  height: calc(60vh - 40px);
  overflow: auto;
}

/* ===================== RESPONSIVE ===================== */

@media (max-width: 680px){
  .lpcs{ padding: 12px; }
  .lpcs-abilities{ grid-template-columns: repeat(3, 1fr); }
  .lpcs-tabs{ grid-template-columns: repeat(2, 1fr); }
  .lpcs-card{ grid-template-columns: auto 1fr; }
  .lpcs-card__right{ display: none; }
}
```

4) Developer integration notes (Foundry-specific)
Where this plugs in

Most Foundry sheet frameworks use Handlebars, but you can still:

compile Mustache yourself, or

translate this template to Handlebars 1:1 (minimal changes), or

use it as an “inner template” rendered into the sheet body.

Minimal wiring tasks

Build view-model from actor each render:

hp, xp, abilities, list of attacks/items/spells/effects

Attach listeners:

tabs/subtabs

.lpcs-row → open drawer

.lpcs-tag--mastery → open mastery rules drawer

hp heal/damage prompt → actor.update({ "system.attributes.hp.value": ... })

Ensure scroll performance:

avoid re-render on every small input; debounce where needed

Theme:

set theme = dark by default

optionally read a module setting or Foundry theme

5) What I’d hand to the dev as acceptance criteria

Matches the prototype layout and styling within ~90%

Touch targets ≥ 44px for all interactive elements

iPad portrait and phone widths render cleanly

Tabs switch without full sheet reload (client-side state)

Drawer opens for:

ability

attack row

mastery pill

Updates propagate via standard Foundry document updates