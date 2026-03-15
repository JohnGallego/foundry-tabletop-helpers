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
import type { LPCSSkill, LPCSInventoryItem } from "./lpcs-types";
import { buildLPCSSheetActions } from "./lpcs-sheet-actions";
import {
  buildSkillGroups,
  setLPCSVitalsView,
} from "./lpcs-sheet-ui";
import {
  attachLPCSBaseRenderListeners,
  buildInventoryModalItems,
  setupClosableModalRender,
  setupCurrencyEditorRender,
  setupItemDetailModalRender,
  setupExhaustionDialogRender,
  setupHPDrawerRender,
  setupRestModalRender,
} from "./lpcs-sheet-render";
import {
  populateCurrencyEditorModal,
  populateItemDetailModal,
  updateCurrencyEditorDisplayValue,
} from "./lpcs-sheet-modal-content";

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
      actions: buildLPCSSheetActions(),
    };

    static PARTS = {
      systemBar:     { template: `modules/${MOD}/templates/lpcs/lpcs-system-bar.hbs` },
      header:        { template: `modules/${MOD}/templates/lpcs/lpcs-header.hbs` },
      abilityScores: { template: `modules/${MOD}/templates/lpcs/lpcs-ability-scores.hbs` },
      statsBar:      { template: `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs` },
      tabNav: { template: `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs` },
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
      skills: {
        container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
        template: `modules/${MOD}/templates/lpcs/lpcs-tab-skills.hbs`,
        scrollable: [""],
      },
      features: {
        container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
        template: `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
        scrollable: [""],
      },
      inventory: {
        container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
        template: `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
        scrollable: [""],
      },
      journal: {
        container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
        template: `modules/${MOD}/templates/lpcs/lpcs-tab-journal.hbs`,
        scrollable: [""],
      },
    };

    static TABS = [
      { tab: "combat",    label: "Actions",    icon: "fas fa-swords" },
      { tab: "spells",    label: "Spells",     icon: "fas fa-hat-wizard" },
      { tab: "skills",    label: "Skills",      icon: "fas fa-hand-sparkles" },
      { tab: "features",  label: "Features",   icon: "fas fa-scroll" },
      { tab: "inventory", label: "Inventory",  icon: "fas fa-backpack" },
      { tab: "journal",   label: "Journal",    icon: "fas fa-book-open" },
    ];

    /* ── Instance State ──────────────────────────────────────── */

    tabGroups: Record<string, string> = { primary: lpcsDefaultTab() };
    private _expandedDrawers: Set<string> = new Set();

    /** Whether the HP management bottom drawer is currently open. */
    private _hpDrawerOpen = false;
    /** Current mode of the HP drawer: damage / heal / temp HP. */
    private _hpDrawerMode: "damage" | "heal" | "temp" = "damage";
    /**
     * AbortController used to clean up HP drawer DOM listeners on every re-render.
     * Prevents listener accumulation across repeated open/close cycles.
     */
    private _hpDrawerAbortCtrl: AbortController | null = null;

    /**
     * Tracks whether death saves were showing on the previous render.
     * Used to detect the HP-0 → HP-healed transition and trigger the animation.
     */
    private _wasShowingDeathSaves = false;
    /**
     * True while the "third success" dramatic-pause + healing-surge animation is running.
     * Prevents _onRender() from resetting vitals classes during the sequence.
     */
    private _deathSaveAnimating = false;

    /**
     * HP value from the previous render.
     * null on the very first render so we don't flash on sheet open.
     */
    private _prevHPValue: number | null = null;

    /**
     * HP fill percentage from the previous render.
     * null on the very first render so we don't animate on sheet open.
     */
    private _prevHPPct: number | null = null;

    /**
     * Running Web Animations API animation for the HP fill width.
     * Cancelled and replaced on every HP change so rapid updates don't stack.
     */
    private _hpWidthAnimation: Animation | null = null;

    /** Whether the combat info modal is currently open. */
    private _combatInfoModalOpen = false;
    /** AbortController for combat info modal DOM listeners. */
    private _combatInfoModalAbortCtrl: AbortController | null = null;
    /** Cached view model for combat action lookups in the action handler. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _lastCombatVM: any = null;

    /** Whether the rest modal is currently open. */
    private _restModalOpen = false;
    /**
     * AbortController for rest modal DOM listeners.
     * Aborted and replaced on every re-render.
     */
    private _restModalAbortCtrl: AbortController | null = null;
    /**
     * setTimeout handle for the long rest press-and-hold guard.
     * Cleared on mouseup / touchend / touchcancel so partial holds don't fire.
     */
    private _longRestHoldTimer: ReturnType<typeof setTimeout> | null = null;

    /** Current skills tab sort/group mode. Resets on page reload. */
    private _skillSortMode: "proficiency" | "ability" | "alphabetical" = "proficiency";
    /** Cached skills array for the skill info action handler. */
    private _lastSkillsVM: LPCSSkill[] = [];
    /** Whether the skill info modal is currently open. */
    private _skillInfoModalOpen = false;
    /** AbortController for skill info modal DOM listeners. */
    private _skillInfoModalAbortCtrl: AbortController | null = null;

    /** Whether the exhaustion stepper dialog is currently open. */
    private _exhaustionDialogOpen = false;
    /** Pending exhaustion level being adjusted in the dialog (not yet applied). */
    private _pendingExhaustion = 0;
    /**
     * AbortController used to clean up exhaustion dialog DOM listeners on every re-render.
     */
    private _exhaustionDialogAbortCtrl: AbortController | null = null;

    /** Cached inventory VM for item detail lookups. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _lastInventoryVM: LPCSInventoryItem[] = [];
    /** Whether the item detail modal is currently open. */
    private _itemDetailModalOpen = false;
    /** ID of the item currently shown in the detail modal (for re-population on re-render). */
    private _itemDetailModalItemId: string | null = null;
    /** AbortController for item detail modal DOM listeners. */
    private _itemDetailModalAbortCtrl: AbortController | null = null;

    /** Whether the currency editor is currently open. */
    private _currencyEditorOpen = false;
    /** Which currency denomination is being edited. */
    private _currencyEditorKey = "";
    /** AbortController for currency editor DOM listeners. */
    private _currencyEditorAbortCtrl: AbortController | null = null;

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vm = context.vm as Record<string, unknown> | undefined;
        const hasSpells = !!vm?.spellcasting;
        context.tabs = (this.constructor as typeof LPCSSheet).TABS
          .filter((t) => t.tab !== "spells" || hasSpells)
          .map((t) => ({
            ...t,
            active: t.tab === this.tabGroups.primary,
          }));
      }

      // Build skill groups for the skills tab
      if (partId === "skills") {
        const vm = context.vm as Record<string, unknown> | undefined;
        const skills = (vm?.skills as LPCSSkill[] | undefined) ?? [];
        this._lastSkillsVM = skills;
        context.skillGroups = buildSkillGroups(skills, this._skillSortMode);
        context.skillSortMode = this._skillSortMode;
      }

      // Inject active tab state into each tab part
      const tabKey = this.tabGroups.primary;
      if (partId !== "systemBar" && partId !== "header" && partId !== "abilityScores" && partId !== "statsBar" && partId !== "tabNav") {
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

      attachLPCSBaseRenderListeners({
        el,
        tabGroups: this.tabGroups,
        onHPInputChange: (event) => this._onHPInputChange(event),
      });

      this._hpDrawerAbortCtrl = setupHPDrawerRender({
        el,
        previousAbortController: this._hpDrawerAbortCtrl,
        drawerOpen: this._hpDrawerOpen,
        getMode: () => this._hpDrawerMode,
        hp: this.actor?.system?.attributes?.hp,
        setMode: (mode) => { this._hpDrawerMode = mode; },
        applyHPChange: (mode, amount) => this._applyHPChange(mode, amount),
        closeHPDrawer: () => this._closeHPDrawer(),
      });

      // ── Vitals cross-fade (HP ↔ Death Saves) ──────────────────────
      const vm = (context as { vm?: { deathSaves?: { show?: boolean } } }).vm;
      const deathSavesShow = vm?.deathSaves?.show ?? false;

      const hpView = el.querySelector<HTMLElement>("[data-vitals='hp']");
      const dsView = el.querySelector<HTMLElement>("[data-vitals='ds']");

      if (hpView && dsView) {
        const transitionToHP =
          this._wasShowingDeathSaves && !deathSavesShow && !this._deathSaveAnimating;

        if (transitionToHP) {
          // Healing detected: dramatic 800ms pause before cross-fading back.
          this._deathSaveAnimating = true;
          // Keep death saves visible and non-interactive during the pause.
          setLPCSVitalsView(hpView, dsView, "ds");
          dsView.style.pointerEvents = "none";

          window.setTimeout(() => {
            if (!this._deathSaveAnimating) return; // aborted by a re-render
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sheetEl = (this as any).element as HTMLElement | null;
            const hv = sheetEl?.querySelector<HTMLElement>("[data-vitals='hp']");
            const dv = sheetEl?.querySelector<HTMLElement>("[data-vitals='ds']");
            if (!hv || !dv) { this._deathSaveAnimating = false; return; }

            // Cross-fade to HP view and play healing-surge glow.
            setLPCSVitalsView(hv, dv, "hp");
            dv.style.pointerEvents = "";
            hv.classList.add("healed-animation");

            window.setTimeout(() => {
              hv.classList.remove("healed-animation");
              this._deathSaveAnimating = false;
            }, 800);
          }, 800);

        } else if (this._deathSaveAnimating) {
          // A re-render fired while the animation was running — abort gracefully.
          this._deathSaveAnimating = false;
          setLPCSVitalsView(hpView, dsView, deathSavesShow ? "ds" : "hp");

        } else {
          // Normal sync — apply the correct active/hidden state immediately.
          setLPCSVitalsView(hpView, dsView, deathSavesShow ? "ds" : "hp");
        }

        this._wasShowingDeathSaves = deathSavesShow;
      }

      // ── HP fill width animation + flash ───────────────────────
      // Both effects use the Web Animations API so they run on isolated tracks and
      // never interfere with each other or with CSS class-driven style recalculations.
      const hpFill = el.querySelector<HTMLElement>(".lpcs-hp-fill");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newHPValue = (this as any).actor?.system?.attributes?.hp?.value ?? 0;
      const newHPPct = (context as { vm?: { hp?: { pct?: number } } }).vm?.hp?.pct ?? 0;

      // Width animation — animates the crimson fill from old % to new %.
      // fill: "none" means after the animation the element snaps back to the
      // template's inline style="width: X%" cleanly.
      // _prevHPPct is only updated in onfinish so that if Foundry fires a second
      // render for the same HP change (dnd5e side-effects), the new DOM element
      // still gets the animation rather than the now-detached old element.
      if (hpFill && this._prevHPPct !== null && newHPPct !== this._prevHPPct) {
        this._hpWidthAnimation?.cancel();
        const isHealing = newHPValue > (this._prevHPValue ?? newHPValue);
        this._hpWidthAnimation = hpFill.animate(
          [{ width: `${this._prevHPPct}%` }, { width: `${newHPPct}%` }],
          {
            duration: isHealing ? 600 : 450,
            easing: isHealing
              ? "cubic-bezier(0.25, 1, 0.5, 1)"   // spring grow
              : "cubic-bezier(0.5, 0, 0.75, 0)",   // sharp drain
            fill: "none",
          }
        );
        const targetPct = newHPPct;
        this._hpWidthAnimation.onfinish = () => {
          this._hpWidthAnimation = null;
          this._prevHPPct = targetPct;
        };
      } else {
        // No animation needed (first render or same pct) — just track.
        this._prevHPPct = newHPPct;
      }

      // Flash animation — brightness pulse on HP change (WAAPI, no CSS classes).
      // Skips on first render (_prevHPValue null) and during the death-save animation.
      if (hpFill && this._prevHPValue !== null && !this._deathSaveAnimating) {
        if (newHPValue > this._prevHPValue) {
          hpFill.animate(
            [
              { filter: "brightness(1)", offset: 0 },
              { filter: "brightness(2.0)", offset: 0.3 },
              { filter: "brightness(1)", offset: 1 },
            ],
            { duration: 550, easing: "ease-out", fill: "none" }
          );
        } else if (newHPValue < this._prevHPValue) {
          hpFill.animate(
            [
              { filter: "brightness(1)", offset: 0 },
              { filter: "brightness(0.35)", offset: 0.15 },
              { filter: "brightness(1.15)", offset: 0.45 },
              { filter: "brightness(1)", offset: 1 },
            ],
            { duration: 450, easing: "ease-out", fill: "none" }
          );
        }
      }

      this._prevHPValue = newHPValue;

      this._exhaustionDialogAbortCtrl = setupExhaustionDialogRender({
        el,
        previousAbortController: this._exhaustionDialogAbortCtrl,
        isOpen: this._exhaustionDialogOpen,
        getPendingLevel: () => this._pendingExhaustion,
        setPendingLevel: (level) => { this._pendingExhaustion = level; },
        updateDialogUI: (dialog, level) => this._updateExhaustionDialogUI(dialog, level),
        closeDialog: () => this._closeExhaustionDialog(),
        confirmLevel: async (level) => {
          this._closeExhaustionDialog();
          await this.actor?.update({ "system.attributes.exhaustion": level });
        },
      });

      this._restModalAbortCtrl = setupRestModalRender({
        el,
        previousAbortController: this._restModalAbortCtrl,
        isOpen: this._restModalOpen,
        getLongRestHoldTimer: () => this._longRestHoldTimer,
        setLongRestHoldTimer: (timer) => { this._longRestHoldTimer = timer; },
        closeModal: () => this._closeRestModal(),
        rollHitDie: async (denomination) => {
          await this.actor?.rollHitDie?.({ denomination });
        },
        doLongRest: () => this._doLongRest(),
      });

      // ── Combat info modal ──────────────────────────────────────────
      // Cache VM for action handler lookup (also satisfies TS unused-local check).
      this._lastCombatVM = (context as { vm?: unknown }).vm;
      this._combatInfoModalAbortCtrl = setupClosableModalRender({
        el,
        previousAbortController: this._combatInfoModalAbortCtrl,
        selector: "[data-combat-info-modal]",
        closeSelector: "[data-combat-info-close]",
        isOpen: this._combatInfoModalOpen,
        closeModal: () => this._closeCombatInfoModal(),
      });

      // ── Skill info modal ──────────────────────────────────────────
      this._skillInfoModalAbortCtrl = setupClosableModalRender({
        el,
        previousAbortController: this._skillInfoModalAbortCtrl,
        selector: "[data-skill-info-modal]",
        closeSelector: "[data-skill-info-close]",
        isOpen: this._skillInfoModalOpen,
        closeModal: () => this._closeSkillInfoModal(),
      });

      // ── Item detail modal ──────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vmData = (context as { vm?: any }).vm;
      this._lastInventoryVM = buildInventoryModalItems(vmData) as LPCSInventoryItem[];
      this._itemDetailModalAbortCtrl = setupItemDetailModalRender({
        el,
        previousAbortController: this._itemDetailModalAbortCtrl,
        isOpen: this._itemDetailModalOpen,
        openItemId: this._itemDetailModalItemId,
        inventoryItems: this._lastInventoryVM,
        reopenItem: (item) => this._openItemDetailModal(item),
        closeModal: () => this._closeItemDetailModal(),
      });

      // ── Currency editor modal ────────────────────────────────────
      this._currencyEditorAbortCtrl = setupCurrencyEditorRender({
        el,
        previousAbortController: this._currencyEditorAbortCtrl,
        isOpen: this._currencyEditorOpen,
        currencyKey: this._currencyEditorKey,
        closeModal: () => this._closeCurrencyEditor(),
        adjustCurrency: (delta) => this._adjustCurrency(delta),
        setCurrency: (value) => this._setCurrency(value),
        updateDisplay: () => this._updateCurrencyEditorDisplay(),
      });

      // Ensure TS sees these as used (called via `any`-typed action handlers).
      void this._openCombatInfoModal;
      void this._lastCombatVM;
      void this._openSkillInfoModal;
      void this._lastSkillsVM;
      void this._openItemDetailModal;
      void this._lastInventoryVM;
      void this._openCurrencyEditor;
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

    /**
     * Apply the accumulated HP change via actor.update(), then close the drawer.
     * Damage absorbs existing temp HP before reducing real HP.
     * All dnd5e lifecycle hooks (_onUpdate: scrolling combat text, concentration)
     * fire automatically because we use the standard actor.update() path.
     */
    private async _applyHPChange(mode: "damage" | "heal" | "temp", amount: number): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hp = (this as any).actor?.system?.attributes?.hp;
      if (!hp || !Number.isFinite(amount) || amount <= 0) return;

      const update: Record<string, number> = {};
      if (mode === "damage") {
        const temp     = hp.temp ?? 0;
        const tempDmg  = Math.min(amount, temp);
        const realDmg  = amount - tempDmg;
        update["system.attributes.hp.value"] = Math.max(0, hp.value - realDmg);
        if (tempDmg > 0) update["system.attributes.hp.temp"] = temp - tempDmg;
      } else if (mode === "heal") {
        update["system.attributes.hp.value"] = Math.min(hp.max, hp.value + amount);
      } else {
        // Temp HP: only raises, never lowers (per dnd5e rules)
        update["system.attributes.hp.temp"] = Math.max(hp.temp ?? 0, amount);
      }

      const applyEl  = (this as any).element as HTMLElement | null; // eslint-disable-line @typescript-eslint/no-explicit-any
      const applyBtn = applyEl?.querySelector<HTMLButtonElement>("[data-apply]");
      if (applyBtn) applyBtn.disabled = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this as any).actor.update(update);
        // Close immediately; _onRender will restore _hpDrawerOpen = false on re-render.
        this._closeHPDrawer();
      } catch (err) {
        Log.warn("LPCS: HP update failed", err);
      } finally {
        if (applyBtn) applyBtn.disabled = false;
      }
    }

    /**
     * Close the HP drawer immediately (DOM + state).
     * Called after a successful apply and on outside-click dismiss.
     */
    private _closeHPDrawer(): void {
      this._hpDrawerOpen = false;
      const closeEl = (this as any).element as HTMLElement | null; // eslint-disable-line @typescript-eslint/no-explicit-any
      const drawer  = closeEl?.querySelector<HTMLElement>("[data-hp-drawer]");
      if (!drawer) return;
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
      if (input) input.value = "";
      const preview = drawer.querySelector<HTMLElement>("[data-preview]");
      if (preview) preview.textContent = "";
    }

    /* ── Exhaustion Dialog Helpers ───────────────────────────── */

    /** Update display, hint, and button disabled states in the exhaustion dialog without re-render. */
    private _updateExhaustionDialogUI(dialog: HTMLElement, level: number): void {
      const display = dialog.querySelector<HTMLElement>("[data-exh-display]");
      if (display) display.textContent = String(level);
      const hint = dialog.querySelector<HTMLElement>("[data-exh-hint]");
      if (hint) hint.textContent = level === 0 ? "No exhaustion" : `Level ${level} — penalties apply`;
      dialog.dataset.exhLevel = String(level);
      const dec = dialog.querySelector<HTMLButtonElement>("[data-exh-dec]");
      const inc = dialog.querySelector<HTMLButtonElement>("[data-exh-inc]");
      if (dec) dec.disabled = level <= 0;
      if (inc) inc.disabled = level >= 6;
    }

    /** Close the exhaustion dialog immediately (DOM + state). */
    private _closeExhaustionDialog(): void {
      this._exhaustionDialogOpen = false;
      const closeEl = (this as any).element as HTMLElement | null; // eslint-disable-line @typescript-eslint/no-explicit-any
      const dialog = closeEl?.querySelector<HTMLElement>("[data-exhaustion-dialog]");
      if (!dialog) return;
      dialog.classList.remove("open");
      dialog.setAttribute("aria-hidden", "true");
    }

    /* ── Rest Modal Helpers ──────────────────────────────────── */

    /** Close the rest modal immediately (DOM + state), cancelling any pending hold timer. */
    private _closeRestModal(): void {
      this._restModalOpen = false;
      if (this._longRestHoldTimer !== null) {
        clearTimeout(this._longRestHoldTimer);
        this._longRestHoldTimer = null;
      }
      const closeEl = (this as any).element as HTMLElement | null; // eslint-disable-line @typescript-eslint/no-explicit-any
      const modal = closeEl?.querySelector<HTMLElement>("[data-rest-modal]");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    /* ── Combat Info Modal Helpers ──────────────────────────── */

    /** Open the combat info modal with the given title and description. */
    private _openCombatInfoModal(title: string, description: string): void {
      this._combatInfoModalOpen = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-combat-info-modal]");
      if (!modal) return;
      const titleEl = modal.querySelector<HTMLElement>("[data-combat-info-title]");
      const descEl = modal.querySelector<HTMLElement>("[data-combat-info-desc]");
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = description;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    /** Close the combat info modal immediately (DOM + state). */
    private _closeCombatInfoModal(): void {
      this._combatInfoModalOpen = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-combat-info-modal]");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    /* ── Skill Info Modal Helpers ─────────────────────────────── */

    private _openSkillInfoModal(skill: LPCSSkill): void {
      this._skillInfoModalOpen = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-skill-info-modal]");
      if (!modal) return;
      const titleEl = modal.querySelector<HTMLElement>("[data-skill-info-title]");
      const descEl = modal.querySelector<HTMLElement>("[data-skill-info-desc]");
      const exList = modal.querySelector<HTMLElement>("[data-skill-info-examples]");
      if (titleEl) titleEl.textContent = skill.label;
      if (descEl) descEl.textContent = skill.description;
      if (exList) {
        exList.replaceChildren();
        for (const ex of skill.examples) {
          const li = document.createElement("li");
          li.textContent = ex;
          exList.appendChild(li);
        }
      }
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    private _closeSkillInfoModal(): void {
      this._skillInfoModalOpen = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-skill-info-modal]");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    /* ── Item Detail Modal ────────────────────────────────────── */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _openItemDetailModal(item: LPCSInventoryItem): void {
      this._itemDetailModalOpen = true;
      this._itemDetailModalItemId = item.id ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-item-detail-modal]");
      if (!modal) return;

      populateItemDetailModal(modal, item, {
        equipSignal: this._itemDetailModalAbortCtrl?.signal,
        onToggleEquip: (itemId, equip) => this._toggleEquipItem(itemId, equip),
        onOpenChildItem: (child) => this._openItemDetailModal(child),
      });

      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    /**
     * Toggle the equipped state of an item on the actor.
     * Persists via Foundry's item update (synced to all clients).
     */
    private async _toggleEquipItem(itemId: string, equip: boolean): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actor = (this as any).actor as Record<string, unknown> | undefined;
      if (!actor) return;
      const items = actor.items as { get(id: string): Record<string, unknown> | undefined } | undefined;
      const item = items?.get(itemId);
      if (!item) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update = (item as any).update as ((data: Record<string, unknown>) => Promise<void>) | undefined;
      if (update) {
        await update.call(item, { "system.equipped": equip });
      }
    }

    private _closeItemDetailModal(): void {
      this._itemDetailModalOpen = false;
      this._itemDetailModalItemId = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-item-detail-modal]");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    /* ── Currency Editor ─────────────────────────────────────── */

    private _openCurrencyEditor(key: string): void {
      this._currencyEditorOpen = true;
      this._currencyEditorKey = key;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-currency-editor]");
      if (!modal) return;

      populateCurrencyEditorModal(modal, key, this._getCurrencyValue());
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    private _closeCurrencyEditor(): void {
      this._currencyEditorOpen = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-currency-editor]");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    private _getCurrencyValue(): number {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currency = (this as any).actor?.system?.currency as Record<string, number> | undefined;
      return (currency?.[this._currencyEditorKey] as number) ?? 0;
    }

    private _updateCurrencyEditorDisplay(): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-currency-editor]") ?? null;
      updateCurrencyEditorDisplayValue(modal, this._getCurrencyValue());
    }

    private _adjustCurrency(delta: number): void {
      const current = this._getCurrencyValue();
      const newVal = Math.max(0, current + delta);
      this._setCurrency(newVal);
    }

    private _setCurrency(value: number): void {
      const key = this._currencyEditorKey;
      if (!key) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).actor?.update({ [`system.currency.${key}`]: value });
      // Optimistic UI update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (this as any).element as HTMLElement | null;
      const modal = el?.querySelector<HTMLElement>("[data-currency-editor]") ?? null;
      updateCurrencyEditorDisplayValue(modal, value);
    }

    /** Execute a long rest via the dnd5e actor method, bypassing dnd5e's own dialog. */
    private async _doLongRest(): Promise<void> {
      this._closeRestModal();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this as any).actor?.longRest?.({ dialog: false });
    }
  }

  return LPCSSheet as unknown as new (...args: unknown[]) => unknown;
}

/* ── Registration ─────────────────────────────────────────── */

/** Cached reference to the dynamically-built sheet class */
let _LPCSSheetClass: (new (...args: unknown[]) => unknown) | null = null;

/** Expose the cached LPCSSheet class for subclassing (e.g. KioskLPCSSheet). */
export function getLPCSSheetClass() { return _LPCSSheetClass; }

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

  // Ensure the class name survives minification — Foundry uses
  // sheetClass.name to build the identifier ("scope.ClassName").
  if (_LPCSSheetClass.name !== "LPCSSheet") {
    Object.defineProperty(_LPCSSheetClass, "name", { value: "LPCSSheet" });
  }

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
  // Partials — registered under a short name so {{> name}} resolves.
  const partials: Record<string, string> = {
    "lpcs-drawer":      `modules/${MOD}/templates/lpcs/lpcs-drawer.hbs`,
    "lpcs-portrait":    `modules/${MOD}/templates/lpcs/lpcs-portrait.hbs`,
    "lpcs-identity":    `modules/${MOD}/templates/lpcs/lpcs-identity.hbs`,
    "lpcs-inspiration": `modules/${MOD}/templates/lpcs/lpcs-inspiration.hbs`,
    "lpcs-quick-stats": `modules/${MOD}/templates/lpcs/lpcs-quick-stats.hbs`,
    "lpcs-xp":          `modules/${MOD}/templates/lpcs/lpcs-xp.hbs`,
    "lpcs-hp":          `modules/${MOD}/templates/lpcs/lpcs-hp.hbs`,
    "lpcs-hp-drawer":          `modules/${MOD}/templates/lpcs/lpcs-hp-drawer.hbs`,
    "lpcs-exhaustion-dialog":  `modules/${MOD}/templates/lpcs/lpcs-exhaustion-dialog.hbs`,
    "lpcs-rest-modal":         `modules/${MOD}/templates/lpcs/lpcs-rest-modal.hbs`,
    "lpcs-combat-info-modal":    `modules/${MOD}/templates/lpcs/lpcs-combat-info-modal.hbs`,
    "lpcs-combat-weapons-block": `modules/${MOD}/templates/lpcs/lpcs-combat-weapons-block.hbs`,
    "lpcs-combat-spells-block":  `modules/${MOD}/templates/lpcs/lpcs-combat-spells-block.hbs`,
    "lpcs-item-detail-modal":    `modules/${MOD}/templates/lpcs/lpcs-item-detail-modal.hbs`,
    "lpcs-currency-editor":      `modules/${MOD}/templates/lpcs/lpcs-currency-editor.hbs`,
  };

  // Non-partial PARTS templates — cached but not referenced by short name.
  const parts: string[] = [
    `modules/${MOD}/templates/lpcs/lpcs-system-bar.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-header.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-ability-scores.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-combat.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-spells.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-skills.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-journal.hbs`,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  // Prefer v13 namespaced path to avoid deprecation warning
  const load = (g.foundry?.applications?.handlebars?.loadTemplates ?? g.loadTemplates) as
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
