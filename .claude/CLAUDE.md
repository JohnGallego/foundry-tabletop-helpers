# Foundry Tabletop Helpers

A Foundry VTT V13 module providing QoL tools for D&D 5.5e games: print-ready character sheets, live play character sheets, combat command center, asset manager, character creator, and window rotation controls.

**Module ID:** `foundry-tabletop-helpers` | **Foundry:** V13 | **System:** dnd5e 4.x (Activities model) | **License:** MIT

## Architecture

```
src/
├── index.ts                  # Entry point — hook registration (init → setup → ready)
├── settings.ts               # Global module settings registration
├── logger.ts                 # Prefixed console logger (MOD constant lives here)
├── types/                    # Foundry type shims & safe global accessors
│   ├── foundry.d.ts          # Hand-written Foundry VTT type definitions
│   ├── guards.ts             # getGame(), getHooks(), isGM(), getSetting(), etc.
│   └── index.ts              # Re-exports all types and guards
├── print-sheet/              # Print-ready sheets (character, NPC, encounter, party)
│   ├── extractors/           # System data → raw data (dnd5e-extractor)
│   ├── renderers/            # Raw data → HTML via ViewModels + Handlebars
│   │   └── viewmodels/       # Transformer + ViewModel pairs per sheet type
│   └── section-definitions.ts
├── lpcs/                     # Live Play Character Sheet (auto-open, tabs, real-time)
├── combat/                   # Combat Command Center
│   ├── batch-initiative/     # Roll initiative for all combatants at once
│   ├── damage-workflow/      # Apply damage/healing with resistance handling
│   ├── monster-preview/      # Quick monster stat preview in combat tracker
│   ├── party-summary/        # Party overview panel
│   └── token-health/         # Token health indicator overlays
├── rules-reference/          # Quick Rules Reference — digital DM screen
├── asset-manager/            # FilePicker replacement with virtual scroll, thumbnails
├── character-creator/        # Step-based character creation wizard
│   ├── wizard/               # Wizard app + state machine
│   ├── steps/                # Individual wizard steps (race, class, abilities, etc.)
│   ├── level-up/             # Level-up workflow (HP, feats, spells, review)
│   ├── data/                 # Compendium indexer, content filters, constants
│   └── gm-config/            # GM configuration for allowed content
├── initiative/               # Quick initiative roll dialog
├── kiosk/                    # Full-screen kiosk mode for player tablets
├── window-rotation/          # Rotate/flip app windows (socket-based)
└── styles.css                # Global module styles
templates/                    # Handlebars templates (.hbs)
server-companion/             # Node.js sidecar — Sharp/FFmpeg image optimization
  └── src/
      ├── server.ts           # Fastify server
      ├── routes/             # API endpoints (health, generate-portrait, thumbnails)
      └── processors/         # Image processing pipelines
```

### Key Patterns

- **Safe global access:** Never use `game` directly — always use `getGame()`, `getHooks()`, `isGM()` etc. from `src/types/guards.ts`. These return `undefined` before init.
- **ViewModel pattern:** Data extraction (extractor) → transformation (transformer) → typed ViewModel → Handlebars rendering. Used in print-sheet and LPCS.
- **Hook lifecycle:** Register settings in `init`, override pickers in `setup`, attach APIs and auto-open in `ready`. Each feature has its own `*-init.ts` or registration function.
- **Module ID constant:** Import `MOD` from `src/logger.ts` — never hardcode the module ID string.

## Build & Dev

```bash
npm run build          # typecheck + vite build + manifest stamp
npm run dev            # vite build --watch
npm run typecheck      # tsc --noEmit
npm run test           # vitest run
npm run ci             # typecheck + test + build
npm run build:server   # build server-companion
npm run link:foundry   # symlink dist/ into local Foundry data
```

## Deploy

### Dev deploy (rsync to self-hosted Foundry)

```bash
rsync -avz --delete "dist/" deploy@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/
```

### Release (GitHub Actions → Foundry Registry)

Tag a version on main: `git tag v1.2.0 && git push --tags`

The `release.yml` workflow builds, stamps `module.json`, creates a GitHub Release with zip + server companion tarball, and publishes to the Foundry Package Release API.

## Post-Task Workflow

After completing any task:

1. **Build:** `npm run build` — fix any TypeScript errors before proceeding
2. **Deploy:** `rsync -avz --delete "dist/" deploy@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/`
3. **Verify:** Reload Foundry in-browser and confirm the feature works

## Skills

Always invoke when working on this project:

- **forgewright:foundry-vtt-dev** — Foundry VTT V13+ module dev, dnd5e system API, hooks, ApplicationV2, settings, sockets. Use for all code changes.
- **forgewright:ui-ux-engineer** — Dark arcane themed UI, glass-morphism, touch-first design, immersive interfaces. Use for all styling/CSS work.
- **loresmith:rules-sage** — D&D 5e/5.5e rules authority. Use when working with game data, ViewModels, or D&D mechanics.
- **dnd-art-forge:dnd-fantasy-art** — Fantasy art generation. Use when creating artwork, icons, or rasterized UI images.
- **superpowers:brainstorming** — Always use before planning new features or implementation details.

## Planning & Implementation

Always use the **superpowers** plugin to plan new features or implementation details. Invoke `superpowers:brainstorming` before creative work and `superpowers:writing-plans` before multi-step implementations.

## Session Continuity

Read `.claude/status.md` at the start of every session — it tracks what was last worked on, current TODOs, and key insights. **Update it at the end of every session or when the user asks for a handoff.**
