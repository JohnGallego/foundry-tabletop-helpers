/**
 * Character Creator — Portrait Prompt Builder
 *
 * Converts wizard selections into a descriptive prompt for Gemini image generation.
 * Extracts race, class, background, and any user-provided physical description
 * to produce a focused character portrait prompt.
 */

import type { WizardState } from "../character-creator-types";

/**
 * Build a portrait generation prompt from current wizard state.
 */
export function buildPortraitPrompt(state: WizardState, description?: string): string {
  const sel = state.selections;
  const parts: string[] = [];

  // Character identity
  const race = sel.race?.name;
  const className = sel.class?.name;
  if (race && className) {
    parts.push(`A ${race} ${className}`);
  } else if (race) {
    parts.push(`A ${race} adventurer`);
  } else if (className) {
    parts.push(`A ${className}`);
  } else {
    parts.push("A fantasy adventurer");
  }

  // Background flavor
  if (sel.background?.name) {
    parts.push(`with a ${sel.background.name} background`);
  }

  // User-provided physical description
  if (description?.trim()) {
    parts.push(description.trim());
  }

  // Subclass flavor
  if (sel.subclass?.name) {
    parts.push(`specializing as a ${sel.subclass.name}`);
  }

  return parts.join(", ");
}
