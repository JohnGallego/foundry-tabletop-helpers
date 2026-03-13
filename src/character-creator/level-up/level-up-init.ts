/**
 * Level-Up Manager — Init Orchestrator
 *
 * Registers hooks for level-up button injection and template preloading.
 */

import { MOD } from "../../logger";
import { getGame, getHooks, isDnd5eWorld, loadTemplates } from "../../types";
import { ccEnabled } from "../character-creator-settings";
import { buildLevelUpAppClass, openLevelUpWizard } from "./level-up-app";
import { shouldShowLevelUp } from "./level-up-detection";

export { openLevelUpWizard } from "./level-up-app";

/* ── Hook Registration ───────────────────────────────────── */

export function registerLevelUpHooks(): void {
  // Build the LevelUpApp class
  buildLevelUpAppClass();

  // Preload level-up templates
  loadTemplates([
    `modules/${MOD}/templates/character-creator/lu-step-class-choice.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-hp.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-features.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-spells.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-review.hbs`,
  ]);

  // Inject level-up button into dnd5e default character sheets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getHooks()?.on?.("renderActorSheet", (app: any, html: any) => {
    if (!ccEnabled() || !isDnd5eWorld()) return;

    const actor = app?.document ?? app?.actor;
    if (!actor || actor.type !== "character") return;
    if (!shouldShowLevelUp(actor)) return;

    // Inject level-up button into the sheet header
    const header = typeof html?.querySelector === "function"
      ? html.querySelector(".window-header, header")
      : html?.[0]?.querySelector?.(".window-header, header");

    if (!header) return;

    // Don't inject if already present
    if (header.querySelector(".fth-level-up-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fth-level-up-btn";
    btn.title = "Level Up!";
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Level Up!';
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLevelUpWizard(actor.id);
    });

    // Insert before the close button
    const closeBtn = header.querySelector(".header-control.close, [data-action='close']");
    if (closeBtn) {
      header.insertBefore(btn, closeBtn);
    } else {
      header.appendChild(btn);
    }
  });

  // Actor directory context menu entry (GM only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getHooks()?.on?.("getActorDirectoryEntryContext", (_html: any, options: any[]) => {
    if (!ccEnabled() || !isDnd5eWorld()) return;

    options.push({
      name: "Level Up",
      icon: '<i class="fa-solid fa-arrow-up"></i>',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      condition: (li: any) => {
        const actorId = li?.dataset?.documentId ?? li?.[0]?.dataset?.documentId;
        if (!actorId) return false;
        const game = getGame();
        const actor = game?.actors?.get(actorId);
        if (!actor) return false;
        return shouldShowLevelUp(actor);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (li: any) => {
        const actorId = li?.dataset?.documentId ?? li?.[0]?.dataset?.documentId;
        if (actorId) openLevelUpWizard(actorId);
      },
    });
  });
}

/* ── Ready Phase ─────────────────────────────────────────── */

export function initLevelUpReady(): void {
  // Nothing needed at ready time currently
}
