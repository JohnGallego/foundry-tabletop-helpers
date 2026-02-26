### Project: foundry-tabletop-helpers (Foundry VTT v13)

This document defines the engineering standards and workflow for making changes to this module. Follow it strictly.

---

# 0) Targets and Compatibility Contract

## Runtime Targets
- **Foundry VTT:** v13.x
- **System focus:** dnd5e (supporting the *official* dnd5e system)
- **Code style:** modern ES modules + TypeScript
- **Bundler:** Vite (see `vite.config.ts`)
- **Templates:** Handlebars (`.hbs`) via Foundry’s built-in template pipeline

## Backwards Compatibility
- Do **not** add new code paths for older Foundry versions unless explicitly requested.
- Avoid system internals unless required; prefer official Foundry APIs and dnd5e public surface patterns.

---

# 1) Golden Rule: Source-First Implementation

Before implementing or fixing anything, **find the closest analogue** in official sources and explicitly reference it in your plan.

## Required References (Use in every feature/bugfix plan)
- dnd5e system source: https://github.com/foundryvtt/dnd5e
- dnd5e system wiki: https://github.com/foundryvtt/dnd5e/wiki
- Foundry VTT API: https://foundryvtt.com/api/
- Foundry system/module docs:
  - https://foundryvtt.com/article/system-development/
  - https://foundryvtt.com/article/module-development/

## “Source-first” deliverable (mandatory)
For every change, write:
1. **Relevant API pages** (exact class/function docs)
2. **Relevant dnd5e source files** (exact file paths + what you’re patterning after)
3. A short list of **hooks/classes** you will touch and why

---

# 2) Architecture and Project Conventions

## Current structure (do not fight it)
- `src/`
  - `index.ts` # init/ready hooks + module entry
  - `logger.ts` # centralized logging
  - `settings.ts` # module settings registration + accessors
  - `print-sheet/` # feature area: printing/exporting sheets
  - `templates/` # Handlebars templates (.hbs)
  - `src/styles.css` # module styles
  -  `src/types/` # local type shims and project-specific types

  
## Architectural rules
- Keep Foundry hook wiring in **one place** (`src/index.ts`) and call feature initializers from there.
- Feature logic lives in feature folders (like `src/print-sheet/`).
- Prefer **composition + small focused modules** over inheritance-heavy designs.
- Keep “Foundry adapters” (Hooks, UI notifications, game/settings access) thin and separate from pure logic.

## Naming and file rules
- Prefer `kebab-case` for filenames (current project style).
- Keep files small; if a file exceeds ~250 lines, consider splitting.

---

# 3) UI and Templating Rules (Foundry v13)

## Default UI approach
- Use **Foundry’s Handlebars templates** (`templates/*.hbs`) and `renderTemplate`/`loadTemplates` patterns.
- Do not introduce React/Vue/Svelte unless explicitly requested.

## Template practices
- Preload templates where appropriate.
- Use partials for repeated markup.
- Keep templates “dumb”: logic goes in TS, templates render data.

## Visual design expectations
- UI should feel **premium**, **fantasy RPG themed**, and **dnd5e-compatible**.
- Prefer consistency with dnd5e sheet styling patterns.
- Avoid inline styles except for truly dynamic values.
- Accessibility: labels for inputs, readable contrast, keyboard focus.

---

# 4) TypeScript and Typing Standards (Strict)

## General TypeScript rules
- **No `any`** unless it is inside a clearly labeled escape hatch file (e.g. `src/types/unsafe.ts`) with justification.
- Prefer `unknown` + type guards to unsafe casts.
- Do not rely on deprecated/community type packages that conflict with Foundry v13.

## Foundry and dnd5e types
- Prefer types and structures derived from:
  1) Foundry v13 API docs  
  2) dnd5e system source types/patterns  
- If the correct type is unclear:
  - Validate at runtime (type guards)
  - Document assumptions in comments
  - Prefer optional chaining and defensive code

## Data shape safety
Foundry document data can be absent/partial depending on context:
- Always treat nested properties as optional unless the API guarantees otherwise.
- Never assume system-specific fields exist on non-dnd5e worlds (guard by system id).

---

# 5) Logging, Errors, and Notifications

## Logging policy
- Use `src/logger.ts` for all logs.
- Logs must be:
  - quiet by default
  - verbose only in debug mode (if supported)
- No spammy `console.log`.

## Error handling
- Fail gracefully; show actionable messages only when necessary.
- Use `ui.notifications.error/warn/info` for user-facing messages sparingly.
- When catching errors, log details for debugging.

---

# 6) Foundry Lifecycle and Hooks

## Hook boundaries
- `Hooks.once("init")`: register settings, templates, base configuration, API exposure
- `Hooks.once("ready")`: world-dependent logic, compendiums, game-ready interactions
- Other hooks: only when required, and kept minimal

## No leaky listeners
- If you attach DOM listeners inside render hooks, ensure they do not multiply across rerenders.
- Prefer Foundry Application lifecycle patterns where possible.

---

# 7) Settings, Persistence, and Migrations

## Persistence rules
- Decide explicitly where data lives:
  - module settings (stable config)
  - document flags (per-entity)
- Never silently delete user data.
- Any shape change requires:
  - a version bump strategy (at least internal schema version)
  - a migration path or safe fallback behavior

## Module settings
- All settings access goes through `src/settings.ts` (no scattered `game.settings.get`).

---

# 8) Interoperability and Safety

## Compatibility rules
- Do not monkeypatch Foundry core or dnd5e prototypes unless absolutely necessary.
- Avoid fragile selectors and DOM scraping; prefer APIs and hooks.
- Assume other modules can be installed; avoid global side effects.

## Security/safety
- Never execute arbitrary user-provided strings as code.
- Sanitize any HTML you inject if it can contain user content.

---

# 9) Mandatory Workflow for Any Change

## Step A — Plain English Plan (required before code)
Write:
- What is changing and why
- Exact API references (Foundry docs pages)
- Exact dnd5e source references (file paths)
- Edge cases + failure modes
- What you will *not* do (scope boundaries)

## Step B — Implementation rules
- Implement the smallest useful slice first.
- Keep PRs/changesets focused.
- Refactor opportunistically only adjacent to the change.

## Step C — Verification checklist (required after code)
Provide manual test steps:
- Fresh world + existing world
- dnd5e world (and what should happen in non-dnd5e worlds)
- Confirm no console errors on init/ready/render
- Confirm no duplicated listeners on repeated open/close
- Confirm settings persist and behave correctly

---

# 10) “Do / Don’t” Summary

## DO
- Use Foundry v13 APIs and patterns.
- Reference dnd5e source + wiki for workflows and UI conventions.
- Strongly type everything; validate unknown shapes defensively.
- Prefer templates + data prep in TS, minimal template logic.
- Keep code clean, readable, modular, and well-commented **where intent matters**.
- Improve quality incrementally as you touch related code.

## DON’T
- Don’t use deprecated Foundry APIs or outdated community `@types` that contradict v13.
- Don’t over-engineer; split complex features into smaller deliverables.
- Don’t assume how Foundry/dnd5e works—verify with official docs/source.
- Don’t duplicate logic; extract helpers.
- Don’t prematurely optimize; make it correct and readable first.

---

# 11) Project-Specific Notes

- Templates live in `templates/` (`*.hbs`).
- Print feature lives under `src/print-sheet/`.
- Custom type shims live under `src/types/` (keep them minimal and well documented).