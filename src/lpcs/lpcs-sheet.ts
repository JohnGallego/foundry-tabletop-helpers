/**
 * Live Play Character Sheet (LPCS) — core sheet class.
 *
 * Extends HandlebarsApplicationMixin(ActorSheetV2), following the exact pattern
 * used by dnd5e's CharacterActorSheet.
 *
 * @see https://foundryvtt.com/api/classes/foundry.applications.sheets.ActorSheetV2.html
 * @see https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html
 * @see https://foundryvtt.com/api/classes/foundry.applications.apps.DocumentSheetConfig.html
 * @see dnd5e: module/applications/actor/character-sheet.mjs
 */

import { MOD, Log } from "../logger";
import { buildLPCSViewModel } from "./lpcs-view-model";
import { lpcsEnabled, lpcsDefaultTab } from "./lpcs-settings";
import { isDnd5eWorld } from "../types";

/* ── Runtime access to Foundry globals ────────────────────── */
// These are resolved at runtime inside the init hook after Foundry has loaded.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFoundryClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: (api?.api as Record<string, unknown> | undefined)
      ?.HandlebarsApplicationMixin as ((...args: unknown[]) => unknown) | undefined,
    ActorSheetV2: (api?.sheets as Record<string, unknown> | undefined)
      ?.ActorSheetV2 as (new (...args: unknown[]) => unknown) | undefined,
    DocumentSheetConfig: (api?.apps as Record<string, unknown> | undefined)
      ?.DocumentSheetConfig as Record<string, unknown> | undefined,
    Actor: g.Actor as (new (...args: unknown[]) => unknown) | undefined,
  };
};

/* ── LPCS Sheet Class Factory ─────────────────────────────── */

/**
 * Build the LPCSSheet class at runtime once Foundry globals are available.
 * Returns null if the required Foundry classes are unavailable.
 */
export function buildLPCSSheetClass(): (new (...args: unknown[]) => unknown) | null {
  const { HandlebarsApplicationMixin, ActorSheetV2 } = getFoundryClasses();

  if (typeof HandlebarsApplicationMixin !== "function" || typeof ActorSheetV2 !== "function") {
    Log.warn("LPCS: HandlebarsApplicationMixin or ActorSheetV2 not available");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Base = (HandlebarsApplicationMixin as any)(ActorSheetV2);

  class LPCSSheet extends Base {

    /* ── Static Configuration ──────────────────────────────── */

    static DEFAULT_OPTIONS = {
      id: "lpcs-{id}",
      classes: ["lpcs-sheet", "fth-lpcs"],
      tag: "form",
      form: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async function (this: any, _event: Event, _form: HTMLFormElement, formData: Record<string, unknown>) {
          await this.actor.update(formData);
        },
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adjustHP(this: any, _event: Event, target: HTMLElement): void {
          const delta = Number(target.dataset.delta);
          if (!Number.isFinite(delta)) return;
          const hp = this.actor.system?.attributes?.hp;
          if (!hp) return;
          const clamped = Math.max(0, Math.min(hp.value + delta, hp.max));
          this.actor.update({ "system.attributes.hp.value": clamped });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rollAbility(this: any, event: Event, target: HTMLElement): void {
          const ability = (target.closest("[data-ability]") as HTMLElement | null)?.dataset.ability;
          if (ability) this.actor.rollAbilityCheck?.({ ability, event });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rollSave(this: any, event: Event, target: HTMLElement): void {
          const ability = (target.closest("[data-ability]") as HTMLElement | null)?.dataset.ability;
          if (ability) this.actor.rollSavingThrow?.({ ability, event });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rollSkill(this: any, event: Event, target: HTMLElement): void {
          const skill = (target.closest("[data-skill]") as HTMLElement | null)?.dataset.skill;
          if (skill) this.actor.rollSkill?.({ event, skill });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rollInitiative(this: any, event: Event): void {
          this.actor.rollInitiativeDialog?.({ event });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rollDeathSave(this: any, event: Event): void {
          this.actor.rollDeathSave?.({ event, legacy: false });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useItem(this: any, event: Event, target: HTMLElement): void {
          const itemId = (target.closest("[data-item-id]") as HTMLElement | null)?.dataset.itemId;
          const item = this.actor.items?.get(itemId ?? "");
          if (item) item.use?.({ event });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toggleDrawer(this: any, _event: Event, target: HTMLElement): void {
          const drawerId = (target.closest("[data-drawer-id]") as HTMLElement | null)?.dataset.drawerId;
          if (!drawerId) return;
          if (!this._expandedDrawers) this._expandedDrawers = new Set<string>();
          if (this._expandedDrawers.has(drawerId)) {
            this._expandedDrawers.delete(drawerId);
          } else {
            this._expandedDrawers.add(drawerId);
          }
          const bodyEl = this.element?.querySelector(`[data-drawer-id="${drawerId}"] .lpcs-drawer-body`);
          bodyEl?.classList.toggle("expanded");
          const chevron = this.element?.querySelector(`[data-drawer-id="${drawerId}"] .lpcs-drawer-chevron`);
          chevron?.classList.toggle("rotated");
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toggleInspiration(this: any): void {
          const current = this.actor.system?.attributes?.inspiration;
          this.actor.update({ "system.attributes.inspiration": !current });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toggleSpellSlot(this: any, _event: Event, target: HTMLElement): void {
          const prop = target.dataset.prop;
          const n = Number(target.dataset.n);
          if (!prop || !Number.isFinite(n)) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const current = (globalThis as any).foundry?.utils?.getProperty(this.actor, prop) ?? 0;
          this.actor.update({ [prop]: current === n ? n - 1 : n });
        },
      },
    };

    static PARTS = {
      header: { template: `modules/${MOD}/templates/lpcs/lpcs-header.hbs` },
      statsBar: { template: `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs` },
      tabNav: { template: `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs` },
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

    static TABS = [
      { tab: "abilities", label: "Abilities",  icon: "fas fa-fist-raised" },
      { tab: "combat",    label: "Actions",    icon: "fas fa-swords" },
      { tab: "spells",    label: "Spells",     icon: "fas fa-hat-wizard" },
      { tab: "inventory", label: "Inventory",  icon: "fas fa-backpack" },
      { tab: "features",  label: "Features",   icon: "fas fa-scroll" },
    ];

    /* ── Instance State ──────────────────────────────────────── */

    tabGroups: Record<string, string> = { primary: lpcsDefaultTab() };
    private _expandedDrawers: Set<string> = new Set();

    /* ── Title ───────────────────────────────────────────────── */

    get title(): string {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `${(this as any).actor?.name ?? "Character"} — Live Sheet`;
    }

    /* ── Context ─────────────────────────────────────────────── */

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const baseContext = await super._prepareContext(options);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = buildLPCSViewModel((this as any).actor);
      return {
        ...baseContext,
        vm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editable: (this as any).isEditable,
        expandedDrawers: this._expandedDrawers,
      };
    }

    async _preparePartContext(
      partId: string,
      context: Record<string, unknown>,
      options: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
      context = await super._preparePartContext(partId, context, options);

      if (partId === "tabNav") {
        context.tabs = (this.constructor as typeof LPCSSheet).TABS.map((t) => ({
          ...t,
          active: t.tab === this.tabGroups.primary,
        }));
      }

      // Inject active tab state into each tab part
      const tabKey = this.tabGroups.primary;
      if (partId !== "header" && partId !== "statsBar" && partId !== "tabNav") {
        context.isActiveTab = partId === tabKey;
        context.currentTab = tabKey;
      }

      return context;
    }

    /* ── Render Lifecycle ────────────────────────────────────── */

    async _onRender(context: Record<string, unknown>, options: Record<string, unknown>): Promise<void> {
      await super._onRender(context, options);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | undefined;
      if (!el) return;

      // HP inline input — supports "+5" / "-3" delta mode
      el.querySelectorAll<HTMLInputElement>(".lpcs-hp-input").forEach((input) => {
        input.addEventListener("change", (e) => this._onHPInputChange(e));
        input.addEventListener("focus", () => input.select());
      });
    }

    private _onHPInputChange(event: Event): void {
      const input = event.target as HTMLInputElement;
      const raw = input.value.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hp = (this as any).actor?.system?.attributes?.hp;
      if (!hp) return;
      let newValue: number;
      if (raw.startsWith("+") || raw.startsWith("-")) {
        newValue = hp.value + Number(raw);
      } else {
        newValue = Number(raw);
      }
      if (Number.isFinite(newValue)) {
        const clamped = Math.max(0, Math.min(newValue, hp.max));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).actor.update({ "system.attributes.hp.value": clamped });
      }
    }
  }

  return LPCSSheet as unknown as new (...args: unknown[]) => unknown;
}

/* ── Registration ─────────────────────────────────────────── */

/** Cached reference to the dynamically-built sheet class */
let _LPCSSheetClass: (new (...args: unknown[]) => unknown) | null = null;

/**
 * Register the LPCS sheet with Foundry's DocumentSheetConfig.
 * Called from Hooks.once("init") in src/index.ts.
 *
 * Follows the pattern from dnd5e.mjs:
 *   DocumentSheetConfig.registerSheet(Actor, "dnd5e", CharacterActorSheet, { ... })
 */
export function registerLPCSSheet(): void {
  if (!isDnd5eWorld()) {
    Log.debug("LPCS: not a dnd5e world, skipping sheet registration");
    return;
  }

  if (!lpcsEnabled()) {
    Log.debug("LPCS: feature disabled via settings");
    return;
  }

  const { DocumentSheetConfig, Actor } = getFoundryClasses();

  if (!DocumentSheetConfig || !Actor) {
    Log.warn("LPCS: DocumentSheetConfig or Actor not available");
    return;
  }

  _LPCSSheetClass = buildLPCSSheetClass();
  if (!_LPCSSheetClass) return;

  try {
    (DocumentSheetConfig as Record<string, unknown> & {
      registerSheet(
        docClass: unknown, scope: string, sheetClass: unknown,
        opts: { types: string[]; makeDefault: boolean; label: string }
      ): void;
    }).registerSheet(Actor, MOD, _LPCSSheetClass, {
      types: ["character"],
      makeDefault: false,
      label: "Live Play Character Sheet (FTH)",
    });
    Log.info("LPCS: sheet registered");
  } catch (err) {
    Log.warn("LPCS: failed to register sheet", err);
  }
}

/**
 * Preload all LPCS Handlebars templates during init for performance.
 *
 * Templates used as Handlebars partials (via `{{> name}}`) must be registered
 * with a short name. This requires passing an object to `loadTemplates` so
 * Foundry registers them under that key rather than their full file path.
 * See: https://foundryvtt.com/api/functions/foundry.applications.handlebars.loadTemplates.html
 *
 * Non-partial templates (used only as ApplicationV2 PARTS) are passed as an
 * array — they are cached for performance but do not need a registered name.
 */
export async function preloadLPCSTemplates(): Promise<void> {
  // Partials — registered under a short name so {{> lpcs-drawer}} resolves.
  const partials: Record<string, string> = {
    "lpcs-drawer": `modules/${MOD}/templates/lpcs/lpcs-drawer.hbs`,
  };

  // Non-partial PARTS templates — cached but not referenced by short name.
  const parts: string[] = [
    `modules/${MOD}/templates/lpcs/lpcs-header.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-abilities.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-combat.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-spells.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const load = (globalThis as any).loadTemplates as
    | ((paths: string[] | Record<string, string>) => Promise<unknown>)
    | undefined;

  if (!load) {
    Log.warn("LPCS: loadTemplates not available — templates will load on demand");
    return;
  }

  try {
    // Register partials first so they are available when PARTS templates render.
    await load(partials);
    await load(parts);
    Log.debug("LPCS: templates preloaded");
  } catch (err) {
    Log.warn("LPCS: template preload failed", err);
  }
}

