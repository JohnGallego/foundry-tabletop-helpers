# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Foundry Tabletop Helpers is a **Foundry VTT v13** module for in-person tabletop gaming, targeting the **D&D 5e v5.x** system. It provides four features: a touch-optimized Live Play Character Sheet (LPCS), print/preview character sheets, window rotation for table sharing, and a quick initiative dialog.

## Build & Dev Commands

```bash
npm run build          # Typecheck + Vite bundle + manifest generation → dist/
npm run dev            # Vite watch mode (rebuilds on save)
npm run typecheck      # TypeScript strict check (tsc --noEmit)
npm run test           # Vitest run (single pass)
npm run test:watch     # Vitest watch mode
npm run ci             # Full pipeline: typecheck + test + build
npm run zip            # Build + zip dist/ for release
```

Tests live alongside source files as `*.test.ts` in `src/`. Run a single test file with:
```bash
npx vitest run src/print-sheet/extractors/dnd5e-extract-helpers.test.ts
```

## Architecture

### Module Init Flow
`src/index.ts` registers all features at the Foundry `init` hook and activates them at `ready`. Each feature follows the same pattern: register settings → register hooks → initialize at ready.

### Feature Modules

| Feature | Directory | Description |
|---------|-----------|-------------|
| **LPCS** | `src/lpcs/` | Touch-optimized ActorSheetV2 (520×780px) using HandlebarsApplicationMixin. View model pattern: `lpcs-view-model.ts` transforms actor data into template-friendly `LPCSViewModel`. |
| **Print Sheet** | `src/print-sheet/` | Extractor→ViewModel→Renderer pipeline. Abstract `BaseExtractor`/`BaseRenderer` allow multi-system support; currently implements dnd5e. Self-registers via `registerExtractor()`/`registerRenderer()`. |
| **Window Rotation** | `src/window-rotation/` | Rotates Foundry windows 90°/180° for table sharing. Supports both V1 and V2 application frameworks. |
| **Initiative** | `src/initiative/` | Replaces dnd5e initiative dialog with a 3-button Normal/Advantage/Disadvantage picker. |

### Key Patterns

- **View Model separation**: Templates never access `actor.system` directly. Data flows through pure transformer functions (`buildLPCSViewModel`, extractor classes) into typed view model interfaces, then into Handlebars templates.
- **Foundry global wrappers**: `src/types/guards.ts` provides `getGame()`, `getHooks()`, etc. — type-safe accessors that avoid direct `globalThis` references and enable testing without full Foundry mocking.
- **Safe hook callbacks**: `safe(fn, where)` in `src/utils.ts` wraps hook handlers with try/catch so one error doesn't break other hooks.
- **Settings per feature**: Each feature registers its own settings. Module-level settings are in `src/settings.ts`, LPCS-specific in `src/lpcs/lpcs-settings.ts`.

### Templates

Handlebars templates live in `templates/` and are copied to `dist/templates/` at build time by `scripts/build-manifest.mjs`. LPCS uses partial templates (`templates/lpcs/lpcs-*.hbs`), print sheets use per-type templates (`templates/print/{character,npc,encounter,party}/`).

### CSS

All CSS is bundled by Vite into a single `dist/styles.css`. LPCS component styles are in `src/lpcs/styles/lpcs-*.css`. No CSS modules or code splitting.

### Type System

- **Foundry types**: `@league-of-foundry-developers/foundry-vtt-types` (v13) + local augmentations in `src/types/foundry.d.ts` and `src/types/fvtt-augment.d.ts`
- **TypeScript strict mode** is enabled (noImplicitAny, noUnusedLocals, noUnusedParameters)

## Agent Roles

Three specialized sub-agents handle different domains (defined in `.claude/agents/`):

- **touch-ui-engineer**: HTML/CSS, responsive layout, touch interactions. 44×44px min touch targets. No Foundry API code.
- **foundry-vtt-backend**: Foundry v13 API, actor updates, websocket payloads, roll mechanics. Must research APIs via grep/read before coding.
- **dnd-rules-validator**: D&D 5e 2024 rules accuracy, action economy, rest mechanics, mathematical verification. No CSS or websocket code.

## Conventions

- Module ID: `foundry-tabletop-helpers`
- Commit messages: `type(scope): description` (e.g., `feat(lpcs): add rest modal`)
- LPCS design targets iPad/mobile — dark theme, touch-first, optimistic UI updates
- Animations use `opacity`/`transform` transitions (hardware-accelerated), never `display: none` toggling
- Rolls from iPad must use `fastForward: true` to suppress native Foundry dialogs
- Physical rolls framework: check `game.settings.get('foundry-tabletop-helpers', 'rollModes')` before executing digital rolls
