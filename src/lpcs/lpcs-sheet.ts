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
import { lpcsEnabled, lpcsDefaultTab, isPhysicalMode } from "./lpcs-settings";
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
        async incrementDeathSave(this: any, _event: Event, target: HTMLElement): Promise<void> {
          // Defense-in-depth: only execute in physical mode (CSS also suppresses in digital mode).
          if (!isPhysicalMode("deathSaves")) return;
          if (!this.actor?.isOwner) return;

          const saveType = (target.closest("[data-save-type]") as HTMLElement | null)?.dataset.saveType;
          if (saveType !== "success" && saveType !== "failure") return;

          const death = this.actor.system?.attributes?.death as Record<string, number> | undefined;
          if (!death) return;

          const isSuccess = saveType === "success";
          const path = isSuccess ? "system.attributes.death.success" : "system.attributes.death.failure";
          const current = isSuccess ? (death.success ?? 0) : (death.failure ?? 0);

          // Cap at 3 per D&D 5e rules
          if (current >= 3) return;

          const next = current + 1;
          const update: Record<string, number> = { [path]: next };

          // On 3rd success: auto-heal to 1 HP, which triggers the existing cross-fade animation.
          if (isSuccess && next === 3) {
            update["system.attributes.hp.value"] = 1;
            update["system.attributes.death.success"] = 0;
            update["system.attributes.death.failure"] = 0;
          }

          await this.actor.update(update);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openHPDrawer(this: any, _event: Event): void {
          if (!this.actor?.isOwner) return;
          // Death saves are showing at HP 0 — suppress the drawer.
          const hp = this.actor?.system?.attributes?.hp;
          if ((hp?.value ?? 0) === 0) return;
          this._hpDrawerOpen = !this._hpDrawerOpen;
          // Cast through HTMLElement so generic querySelector calls are valid.
          const sheetEl = this.element as HTMLElement | null;
          const drawer  = sheetEl?.querySelector<HTMLElement>("[data-hp-drawer]");
          if (!drawer) return;
          drawer.classList.toggle("open", this._hpDrawerOpen);
          drawer.setAttribute("aria-hidden", String(!this._hpDrawerOpen));
          if (!this._hpDrawerOpen) {
            const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
            if (input) input.value = "";
          } else {
            // Reset to damage mode on open and refresh UI
            this._hpDrawerMode = "damage";
            this._updateHPDrawerModeUI(drawer, "damage");
            this._updateHPDrawerPreview(drawer);
            // Focus the amount input for immediate keyboard entry
            drawer.querySelector<HTMLInputElement>("[data-amount]")?.focus();
          }
        },
      },
    };

    static PARTS = {
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
      abilities: {
        container: { classes: ["lpcs-tab-body"], id: "lpcs-tabs" },
        template: `modules/${MOD}/templates/lpcs/lpcs-tab-abilities.hbs`,
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
      { tab: "abilities", label: "Abilities",  icon: "fas fa-fist-raised" },
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
      if (partId !== "header" && partId !== "abilityScores" && partId !== "statsBar" && partId !== "tabNav") {
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

      // Tab navigation — pure DOM switching for instant feedback (no re-render needed).
      // Toggles .active / [hidden] on panels and updates nav-button ARIA state.
      el.querySelectorAll<HTMLElement>(".lpcs-tab-btn[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;
          if (tab) this._switchTab(el, tab);
        });
      });

      // HP bar keyboard activation (data-action handles click; we add keyboard here).
      const hpBar = el.querySelector<HTMLElement>(".lpcs-hp-bar-widget[data-action]");
      hpBar?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hpBar.click(); }
      });

      // ── HP Drawer listeners ───────────────────────────────────
      // Abort previous listeners so they never accumulate across re-renders.
      this._hpDrawerAbortCtrl?.abort();
      this._hpDrawerAbortCtrl = new AbortController();
      const { signal } = this._hpDrawerAbortCtrl;

      const drawer = el.querySelector<HTMLElement>("[data-hp-drawer]");
      if (drawer) {
        // Restore open/mode state after a re-render caused by actor.update().
        drawer.classList.toggle("open", this._hpDrawerOpen);
        drawer.setAttribute("aria-hidden", String(!this._hpDrawerOpen));
        this._updateHPDrawerModeUI(drawer, this._hpDrawerMode);
        this._updateHPDrawerPreview(drawer);

        // Mode toggle pills
        drawer.querySelectorAll<HTMLElement>("[data-mode]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const mode = btn.dataset.mode as "damage" | "heal" | "temp";
            if (!mode) return;
            this._hpDrawerMode = mode;
            this._updateHPDrawerModeUI(drawer, mode);
            this._updateHPDrawerPreview(drawer);
          }, { signal });
        });

        // Preset quick-tap buttons — accumulate into the amount input
        drawer.querySelectorAll<HTMLElement>("[data-preset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const preset = Number(btn.dataset.preset);
            const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
            if (input && Number.isFinite(preset)) {
              input.value = String((Number(input.value) || 0) + preset);
              this._updateHPDrawerPreview(drawer);
            }
          }, { signal });
        });

        // Clear button — resets the accumulator
        drawer.querySelector<HTMLElement>("[data-clear]")?.addEventListener("click", () => {
          const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
          if (input) { input.value = ""; }
          this._updateHPDrawerPreview(drawer);
        }, { signal });

        // Amount input — updates live preview on every keystroke
        drawer.querySelector<HTMLInputElement>("[data-amount]")
          ?.addEventListener("input", () => this._updateHPDrawerPreview(drawer), { signal });

        // Apply button
        drawer.querySelector<HTMLElement>("[data-apply]")?.addEventListener("click", async () => {
          const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
          const amount = Number(input?.value) || 0;
          if (amount <= 0) return;
          await this._applyHPChange(this._hpDrawerMode, amount);
        }, { signal });

        // Outside-click dismiss — closes the drawer if user taps elsewhere
        document.addEventListener("click", (e: MouseEvent) => {
          if (!this._hpDrawerOpen) return;
          const outer = el.querySelector<HTMLElement>(".lpcs-hp-outer");
          if (outer && !outer.contains(e.target as Node)) {
            this._closeHPDrawer();
          }
        }, { signal });
      }

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
          this._setVitalsView(hpView, dsView, "ds");
          dsView.style.pointerEvents = "none";

          window.setTimeout(() => {
            if (!this._deathSaveAnimating) return; // aborted by a re-render
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sheetEl = (this as any).element as HTMLElement | null;
            const hv = sheetEl?.querySelector<HTMLElement>("[data-vitals='hp']");
            const dv = sheetEl?.querySelector<HTMLElement>("[data-vitals='ds']");
            if (!hv || !dv) { this._deathSaveAnimating = false; return; }

            // Cross-fade to HP view and play healing-surge glow.
            this._setVitalsView(hv, dv, "hp");
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
          this._setVitalsView(hpView, dsView, deathSavesShow ? "ds" : "hp");

        } else {
          // Normal sync — apply the correct active/hidden state immediately.
          this._setVitalsView(hpView, dsView, deathSavesShow ? "ds" : "hp");
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
    }

    /**
     * Toggle the active/hidden CSS classes on both vitals view elements.
     * The active element is in-flow (position: static); the hidden element is
     * absolutely positioned over the container so it does not affect layout.
     */
    private _setVitalsView(
      hpView: HTMLElement,
      dsView: HTMLElement,
      active: "hp" | "ds"
    ): void {
      hpView.classList.toggle("active", active === "hp");
      hpView.classList.toggle("hidden", active === "ds");
      dsView.classList.toggle("active", active === "ds");
      dsView.classList.toggle("hidden", active === "hp");
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
     * Switch the visible tab without triggering a full re-render.
     * Updates internal state, nav-button active/ARIA markers, and shows/hides
     * the matching panel — all synchronously so the response feels instant on
     * touch devices during live play.
     */
    private _switchTab(el: HTMLElement, tab: string): void {
      // Persist selection so future partial re-renders use the correct tab.
      this.tabGroups.primary = tab;

      // Nav buttons — toggle .active + aria-selected
      el.querySelectorAll<HTMLElement>(".lpcs-tab-btn[data-tab]").forEach((btn) => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      });

      // Tab panels — toggle .active and the HTML [hidden] attribute
      el.querySelectorAll<HTMLElement>(".lpcs-tab[data-tab]").forEach((panel) => {
        const active = panel.dataset.tab === tab;
        panel.classList.toggle("active", active);
        if (active) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "");
        }
      });
    }

    /* ── HP Drawer Helpers ───────────────────────────────────── */

    /**
     * Update mode toggle pill active states, the drawer's data-mode attribute
     * (used by CSS for contextual colours on presets/apply), and the apply
     * button label — all without a re-render.
     */
    private _updateHPDrawerModeUI(drawer: HTMLElement, mode: "damage" | "heal" | "temp"): void {
      drawer.dataset.mode = mode;
      drawer.querySelectorAll<HTMLElement>("[data-mode]").forEach((btn) => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });
      const applyBtn = drawer.querySelector<HTMLElement>("[data-apply]");
      if (applyBtn) {
        const labels: Record<string, string> = {
          damage: "Apply Damage",
          heal:   "Apply Heal",
          temp:   "Set Temp HP",
        };
        applyBtn.textContent = labels[mode] ?? "Apply";
      }
    }

    /**
     * Recompute and display the live preview line showing current HP → result
     * based on the active mode and the current accumulator value.
     */
    private _updateHPDrawerPreview(drawer: HTMLElement): void {
      const input   = drawer.querySelector<HTMLInputElement>("[data-amount]");
      const preview = drawer.querySelector<HTMLElement>("[data-preview]");
      if (!input || !preview) return;

      const amount = Number(input.value) || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hp = (this as any).actor?.system?.attributes?.hp;
      if (!hp || amount <= 0) { preview.textContent = ""; return; }

      const temp = hp.temp ?? 0;
      let text: string;
      if (this._hpDrawerMode === "damage") {
        const tempDmg  = Math.min(amount, temp);
        const realDmg  = amount - tempDmg;
        const newHp    = Math.max(0, hp.value - realDmg);
        const newTemp  = temp - tempDmg;
        if (tempDmg > 0 && realDmg > 0) {
          text = `HP ${hp.value}→${newHp}  ·  Temp ${temp}→${newTemp}`;
        } else if (tempDmg > 0) {
          text = `Temp ${temp} → ${newTemp}`;
        } else {
          text = `${hp.value} → ${newHp}`;
        }
      } else if (this._hpDrawerMode === "heal") {
        text = `${hp.value} → ${Math.min(hp.max, hp.value + amount)}`;
      } else {
        text = `Temp ${temp} → ${Math.max(temp, amount)}`;
      }
      preview.textContent = text;
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
  // Partials — registered under a short name so {{> name}} resolves.
  const partials: Record<string, string> = {
    "lpcs-drawer":      `modules/${MOD}/templates/lpcs/lpcs-drawer.hbs`,
    "lpcs-portrait":    `modules/${MOD}/templates/lpcs/lpcs-portrait.hbs`,
    "lpcs-identity":    `modules/${MOD}/templates/lpcs/lpcs-identity.hbs`,
    "lpcs-inspiration": `modules/${MOD}/templates/lpcs/lpcs-inspiration.hbs`,
    "lpcs-quick-stats": `modules/${MOD}/templates/lpcs/lpcs-quick-stats.hbs`,
    "lpcs-xp":          `modules/${MOD}/templates/lpcs/lpcs-xp.hbs`,
    "lpcs-hp":          `modules/${MOD}/templates/lpcs/lpcs-hp.hbs`,
    "lpcs-hp-drawer":   `modules/${MOD}/templates/lpcs/lpcs-hp-drawer.hbs`,
  };

  // Non-partial PARTS templates — cached but not referenced by short name.
  const parts: string[] = [
    `modules/${MOD}/templates/lpcs/lpcs-header.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-ability-scores.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-stats-bar.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-nav.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-combat.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-spells.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-abilities.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-features.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-inventory.hbs`,
    `modules/${MOD}/templates/lpcs/lpcs-tab-journal.hbs`,
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

