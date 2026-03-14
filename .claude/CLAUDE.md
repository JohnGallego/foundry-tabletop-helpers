# Foundry Tabletop Helpers

**Foundry VTT V13** module for **D&D 5.5e** (2024 rules) — QoL tools for GMs and players.

**Module ID:** `foundry-tabletop-helpers` | **System:** dnd5e 5.x | **License:** MIT

## Required Skills

**Invoke these skills BEFORE writing code or making decisions.** They are finely tuned to this project and dramatically improve outcomes.

| Skill | When to invoke |
|-------|----------------|
| **forgewright:foundry-vtt-dev** | ALL code changes — V13 APIs, ApplicationV2, hooks, settings, sockets, dnd5e 5.x system integration |
| **forgewright:ui-ux-engineer** | ALL CSS/styling — dark arcane theme, glass-morphism, touch-first (44px targets), container queries |
| **loresmith:rules-sage** | ANY D&D mechanics — game data, ViewModels, spells, classes, advancement, 2024 PHB rules |
| **dnd-art-forge:dnd-fantasy-art** | Creating artwork, icons, portraits, or rasterized UI assets |
| **frontend-design** | Building new UI components, pages, or visual design work |
| **superpowers:brainstorming** | BEFORE planning any new feature or implementation approach |
| **superpowers:dispatching-parallel-agents** | When facing 2+ independent tasks that can be parallelized |

## Build & Deploy

```bash
npm run build          # typecheck + vite build + manifest stamp
npm run dev            # vite build --watch
npm run typecheck      # tsc --noEmit
npm run test           # vitest run
```

### Dev deploy

```bash
rsync -avz --delete "dist/" root@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/
```

### Release

Tag on main: `git tag v1.2.0 && git push --tags` — GitHub Actions builds, stamps `module.json`, creates a release, and publishes to the Foundry Package Registry.

## Post-Task Workflow

After completing any task:

1. **Build:** `npm run build` — fix TypeScript errors before proceeding
2. **Deploy:** rsync to Foundry server (see above)
3. **Update status:** Update `.claude/status.md` with what was done

## Architecture

```
src/
├── index.ts                  # Entry — hook registration (init → setup → ready)
├── settings.ts               # Global module settings
├── logger.ts                 # Prefixed logger (MOD constant lives here)
├── types/                    # Foundry type shims & safe global accessors
│   ├── foundry.d.ts          # Hand-written Foundry VTT V13 type definitions
│   ├── guards.ts             # getGame(), getHooks(), isGM(), getSetting(), etc.
│   └── index.ts              # Re-exports
├── print-sheet/              # Print-ready sheets (character, NPC, encounter, party)
├── lpcs/                     # Live Play Character Sheet (auto-open, tabs, real-time)
├── combat/                   # Combat Command Center
├── rules-reference/          # Quick Rules Reference (digital DM screen)
├── asset-manager/            # FilePicker replacement with virtual scroll, thumbnails
├── character-creator/        # Step-based character creation wizard
│   ├── wizard/               # App shell + state machine
│   ├── steps/                # Individual wizard steps
│   ├── level-up/             # Level-up workflow
│   ├── data/                 # Compendium indexer, advancement parser, constants
│   └── gm-config/            # GM content filtering
├── initiative/               # Quick initiative roll dialog
├── kiosk/                    # Full-screen kiosk mode for player tablets
├── window-rotation/          # Rotate/flip app windows (socket-based)
└── styles.css                # Global module styles
templates/                    # Handlebars templates (.hbs)
server-companion/             # Optional Node.js sidecar (Sharp/FFmpeg)
```

### Key Patterns

- **Safe globals:** Never use `game` directly — use `getGame()`, `getHooks()`, `isGM()` from `src/types/guards.ts`
- **Module ID:** Import `MOD` from `src/logger.ts` — never hardcode `"foundry-tabletop-helpers"`
- **ViewModel pattern:** Extractor → Transformer → typed ViewModel → Handlebars. Never pass Foundry documents to templates.
- **Hook lifecycle:** `init` (settings, hooks) → `setup` (user-dependent, override pickers) → `ready` (APIs, auto-open, sockets)
- **ApplicationV2** for all new UI. V1 FormApplication only for settings submenus (Foundry limitation).
- **Feature isolation:** Each feature has its own directory, settings registration function, and CSS file wired through `src/index.ts`.

## Session Continuity

Read `.claude/status.md` at the start of every session. Update it at the end or when the user asks for a handoff.

## Additional Context

- `.claude/rules/project-spec.md` — product spec, feature table, roadmap
- `.claude/rules/code-style.md` — naming conventions, patterns, anti-patterns, build config
- `.claude/rules/foundry-api.md` — V13 + dnd5e 5.x API gotchas (path-scoped to `src/**`)
