/**
 * Character Creator — Main Wizard Application
 *
 * ApplicationV2 (HandlebarsApplicationMixin) that renders the
 * wizard shell: step indicator, step content area, and navigation.
 *
 * Built via runtime class factory pattern (same as GMConfigApp).
 */

import { MOD, Log } from "../../logger";
import { renderTemplate } from "../../types";
import type { WizardShellContext, GMConfig } from "../character-creator-types";
import { WizardStateMachine } from "./wizard-state-machine";
import { getOrderedSteps, getStepAtmosphere } from "./step-registry";
import { createCharacterFromWizard } from "../engine/actor-creation-engine";
import {
  getPackSources,
  getDisabledContentUUIDs,
  getAllowedAbilityMethods,
  getStartingLevel,
  allowMulticlass,
  getEquipmentMethod,
  getLevel1HpMethod,
  allowCustomBackgrounds,
  getMaxRerolls,
} from "../character-creator-settings";

/* ── Runtime Foundry Class Resolution ────────────────────── */

const getFoundryAppClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: (api?.api as Record<string, unknown> | undefined)
      ?.HandlebarsApplicationMixin as ((...args: unknown[]) => unknown) | undefined,
    ApplicationV2: (api?.api as Record<string, unknown> | undefined)
      ?.ApplicationV2 as (new (...args: unknown[]) => unknown) | undefined,
  };
};

/* ── Module-Level State ──────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _CharacterCreatorAppClass: (new () => any) | null = null;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Build the CharacterCreatorApp class at runtime once Foundry globals are available.
 * Call during the `init` hook.
 */
export function buildCharacterCreatorAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();

  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Character Creator: ApplicationV2 not available — Wizard disabled");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Base = (HandlebarsApplicationMixin as any)(ApplicationV2);

  class CharacterCreatorApp extends Base {

    /* ── Instance State ────────────────────────────────── */

    /** The wizard state machine. Created fresh each time the wizard opens. */
    private _machine: WizardStateMachine | null = null;

    // Future: track previous step element for deactivation lifecycle

    /* ── Static Configuration ──────────────────────────── */

    static DEFAULT_OPTIONS = {
      id: "fth-character-creator-wizard",
      classes: ["fth-character-creator", "fth-cc-wizard"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-hat-wizard",
        title: "Character Creator",
      },
      position: { width: 860, height: 640 },
      actions: {
        goNext: CharacterCreatorApp._onGoNext,
        goBack: CharacterCreatorApp._onGoBack,
        jumpToStep: CharacterCreatorApp._onJumpToStep,
        createCharacter: CharacterCreatorApp._onCreateCharacter,
      },
    };

    static PARTS = {
      shell: {
        template: `modules/${MOD}/templates/character-creator/cc-shell.hbs`,
        scrollable: [".cc-step-content"],
      },
    };

    /* ── Lifecycle ─────────────────────────────────────── */

    /** Initialize the state machine with a frozen config snapshot. */
    private _ensureMachine(): WizardStateMachine {
      if (!this._machine) {
        const config = this._snapshotGMConfig();
        const steps = getOrderedSteps();
        this._machine = new WizardStateMachine(config, steps);
        Log.debug("Character Creator: wizard state machine initialized", {
          steps: this._machine.state.applicableSteps,
        });
      }
      return this._machine;
    }

    /** Take a frozen snapshot of GM config at wizard open time. */
    private _snapshotGMConfig(): GMConfig {
      const disabledArr = getDisabledContentUUIDs();
      return {
        packSources: getPackSources(),
        disabledUUIDs: new Set(disabledArr),
        allowedAbilityMethods: getAllowedAbilityMethods(),
        maxRerolls: getMaxRerolls(),
        startingLevel: getStartingLevel(),
        allowMulticlass: allowMulticlass(),
        equipmentMethod: getEquipmentMethod(),
        level1HpMethod: getLevel1HpMethod(),
        allowCustomBackgrounds: allowCustomBackgrounds(),
      };
    }

    /* ── Rendering ─────────────────────────────────────── */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _prepareContext(_options: any): Promise<WizardShellContext> {
      const machine = this._ensureMachine();
      const stepDef = machine.currentStepDef;

      // Build step ViewModel and render its template to HTML
      let stepContentHtml = "";
      if (stepDef) {
        const vmData = await stepDef.buildViewModel(machine.state);
        stepContentHtml = await renderTemplate(stepDef.templatePath, vmData);
      }

      return {
        steps: machine.buildStepIndicatorData(),
        stepContentHtml,
        currentStepId: machine.currentStepId,
        currentStepLabel: stepDef?.label ?? "",
        currentStepIcon: stepDef?.icon ?? "",
        canGoBack: machine.canGoBack,
        canGoNext: machine.canGoNext,
        isReviewStep: machine.isReviewStep,
        atmosphereClass: getStepAtmosphere(machine.currentStepId),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _preparePartContext(partId: string, context: any, options: any): Promise<any> {
      const base = await super._preparePartContext(partId, context, options);
      return { ...base, ...context };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _onRender(_context: any, _options: any): Promise<void> {
      const machine = this._ensureMachine();
      const stepDef = machine.currentStepDef;

      // Build callbacks for step interaction
      const callbacks = {
        setData: (value: unknown) => {
          machine.setStepData(machine.currentStepId, value);
          this.render({ force: true });
        },
        rerender: () => {
          this.render({ force: true });
        },
      };

      // Call onActivate for the current step
      if (stepDef?.onActivate) {
        const stepEl = this.element?.querySelector(".cc-step-content");
        if (stepEl) {
          stepDef.onActivate(machine.state, stepEl as HTMLElement, callbacks);
        }
      }

      // Apply atmospheric background class
      const shell = this.element?.querySelector(".cc-wizard-shell");
      if (shell) {
        // Remove all atmosphere classes
        shell.classList.forEach((cls: string) => {
          if (cls.startsWith("cc-atmosphere--")) shell.classList.remove(cls);
        });
        // Add current atmosphere
        const atmosphere = getStepAtmosphere(machine.currentStepId);
        shell.classList.add(atmosphere);
      }
    }

    /* ── Action Handlers ───────────────────────────────── */

    static _onGoNext(this: InstanceType<typeof CharacterCreatorApp>): void {
      const machine = this._ensureMachine();
      const prevDef = machine.currentStepDef;

      // Deactivate current step
      if (prevDef?.onDeactivate) {
        const stepEl = this.element?.querySelector(".cc-step-content");
        if (stepEl) prevDef.onDeactivate(machine.state, stepEl as HTMLElement);
      }

      if (machine.goNext()) {
        this.render({ force: true });
      }
    }

    static _onGoBack(this: InstanceType<typeof CharacterCreatorApp>): void {
      const machine = this._ensureMachine();
      const prevDef = machine.currentStepDef;

      // Deactivate current step
      if (prevDef?.onDeactivate) {
        const stepEl = this.element?.querySelector(".cc-step-content");
        if (stepEl) prevDef.onDeactivate(machine.state, stepEl as HTMLElement);
      }

      if (machine.goBack()) {
        this.render({ force: true });
      }
    }

    static _onJumpToStep(this: InstanceType<typeof CharacterCreatorApp>, _event: Event, target: HTMLElement): void {
      const stepId = target.dataset.stepId;
      if (!stepId) return;

      const machine = this._ensureMachine();

      // Only allow jumping from the review step
      if (!machine.isReviewStep) return;

      const prevDef = machine.currentStepDef;
      if (prevDef?.onDeactivate) {
        const stepEl = this.element?.querySelector(".cc-step-content");
        if (stepEl) prevDef.onDeactivate(machine.state, stepEl as HTMLElement);
      }

      if (machine.jumpTo(stepId)) {
        this.render({ force: true });
      }
    }

    /* ── Create Character ────────────────────────────── */

    static async _onCreateCharacter(this: InstanceType<typeof CharacterCreatorApp>): Promise<void> {
      const machine = this._ensureMachine();

      // Validate review step has a name
      const reviewData = machine.state.selections.review as { characterName?: string } | undefined;
      const name = reviewData?.characterName?.trim();
      if (!name) {
        Log.warn("Character Creator: Please enter a character name");
        return;
      }

      // Disable button to prevent double-click
      const btn = this.element?.querySelector("[data-action='createCharacter']") as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Creating...</span>';
      }

      try {
        const actor = await createCharacterFromWizard(machine.state);
        if (actor) {
          Log.info(`Character Creator: Successfully created "${name}"`);
          // Show the actor sheet
          actor.sheet?.render({ force: true });
          // Close the wizard
          await this.close();
        } else {
          Log.error("Character Creator: Failed to create character");
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create Character</span>';
          }
        }
      } catch (err) {
        Log.error("Character Creator: Error creating character", err);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create Character</span>';
        }
      }
    }

    /* ── Close Guard ───────────────────────────────────── */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async close(options?: any): Promise<void> {
      // Reset state machine on close
      this._machine = null;
      return super.close(options);
    }
  }

  _CharacterCreatorAppClass = CharacterCreatorApp;
  Log.debug("Character Creator: CharacterCreatorApp class built");
}

/**
 * Open the Character Creator wizard.
 * Safe to call at any time — silently no-ops if the class isn't built yet.
 */
export function openCharacterCreatorWizard(): void {
  if (!_CharacterCreatorAppClass) {
    Log.warn("Character Creator: CharacterCreatorApp not available");
    return;
  }
  new _CharacterCreatorAppClass().render({ force: true });
}
