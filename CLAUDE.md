# Foundry Tabletop Helpers

Foundry VTT V13 module for D&D 5.5e — QoL tools for GMs and players.

Full project context lives in `.claude/`:
- `.claude/CLAUDE.md` — architecture, build/deploy commands, skills, post-task workflow
- `.claude/rules/project-spec.md` — product spec, features, roadmap
- `.claude/rules/code-style.md` — naming, patterns, anti-patterns, build details
- `.claude/rules/foundry-api.md` — V13 + dnd5e 4.x API gotchas (path-scoped to `src/**`)
- `.claude/status.md` — session continuity (read at start, update at end)

## Skills

Always invoke when working on this project:

- **forgewright:foundry-vtt-dev** — Foundry VTT V13+ module dev. Use for all code changes.
- **forgewright:ui-ux-engineer** — Dark arcane UI, glass-morphism, touch-first. Use for all CSS.
- **loresmith:rules-sage** — D&D 5e/5.5e rules. Use for game data and mechanics decisions.
- **dnd-art-forge:dnd-fantasy-art** — Fantasy art generation. Use when creating artwork or icons.
- **superpowers:brainstorming** — Always use before planning new features or implementations.

## Post-Task Workflow

1. **Build:** `npm run build` — fix TypeScript errors before proceeding
2. **Deploy:** `rsync -avz --delete "dist/" deploy@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/`
3. **Update status:** Update `.claude/status.md` with what was done
