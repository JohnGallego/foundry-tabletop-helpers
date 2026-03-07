# Foundry Tabletop Helpers — Claude Instructions

## Project Vault

The Obsidian vault at `~/Documents/Vaults/Claude Brain/Foundry VTT/Foundry Tabletop Helpers/` contains project documentation that should be consulted and maintained:

| Document | Purpose |
|----------|---------|
| **Goals & Tasks.md** | Living task tracker — current goals, active tasks, backlog, and completed work. **Always check this first** to understand what we're working on. |
| **Architecture & Code Patterns.md** | Project structure, build pipeline, TypeScript conventions, Foundry V13 patterns, CSS architecture, ViewModel pattern, settings/state management. **Consult before writing code** to follow established patterns. |
| **Design & Style Guide.md** | Visual design reference — color palette, typography scale, spacing, depth/atmosphere, touch UI standards, component patterns. **Consult before writing CSS** to maintain visual consistency. |

## Skills

Always invoke these skills when working on this project:

- **foundry-vtt-dev** — Foundry VTT V13+ module development, dnd5e system API, hooks, ApplicationV2, settings, sockets. Use for all code changes.
- **ui-ux-engineer** — Dark arcane themed UI, glass-morphism, touch-first design, immersive interfaces. Use for all styling and visual work.
- **dnd-dm-expert** — D&D 5e rules, character sheet data, spell/combat mechanics. Use when working with game data, ViewModels, or feature design decisions.

## Post-Task Workflow

After completing any task, **always** run through these steps in order:

### 1. Build the project

```bash
cd ~/Documents/Code\ Projects/foundry-tabletop-helpers && npm run build
```

Verify the build succeeds with no TypeScript errors. Fix any issues before proceeding.

### 2. Update Goals & Tasks

Update `~/Documents/Vaults/Claude Brain/Foundry VTT/Foundry Tabletop Helpers/Goals & Tasks.md`:
- Mark completed tasks as `[x]`
- Add brief completion notes if the task involved notable decisions
- Move newly identified work into the Backlog section

### 3. Update architecture/design docs (if warranted)

If the task introduced new patterns, changed project structure, added new conventions, or modified visual design:
- Update `Architecture & Code Patterns.md` for structural/code changes
- Update `Design & Style Guide.md` for visual/CSS changes

Skip this step if the task was a straightforward implementation within existing patterns.

### 4. Deploy to Foundry server

```bash
rsync -avz --delete "dist/" root@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/
```

- SSH host: `root@foundry.digitalframeworks.org`
- Module path on server: `/var/foundrydata/Data/modules/foundry-tabletop-helpers`
- The `--delete` flag ensures removed files are cleaned up on the server
