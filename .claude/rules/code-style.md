# Code Style & Conventions

## Language

- **TypeScript** — strict mode with all strictness flags enabled
- **Target:** ES2022, ESNext modules, Bundler module resolution
- **`noUnusedLocals` / `noUnusedParameters`:** enabled — no dead code
- **`skipLibCheck`:** true (Foundry types are beta-quality)
- **Types:** `fvtt-types` (community Foundry VTT types) + `vite/client`

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `damage-workflow-engine.ts` |
| Feature dirs | kebab-case matching feature | `src/combat/damage-workflow/` |
| CSS files | kebab-case, feature-scoped | `combat-damage-workflow.css` |
| Classes | PascalCase | `DamageWorkflowDialog` |
| Interfaces/Types | PascalCase | `PartyViewModel`, `SheetType` |
| Functions | camelCase | `registerCombatHooks()` |
| Constants | UPPER_SNAKE or camelCase | `MOD`, `SECTION_DEFINITIONS` |
| Settings keys | camelCase | `"rotationMode"`, `"kioskPlayerIds"` |
| Module ID | Always use `MOD` constant from logger | `import { MOD } from "./logger"` |
| CSS custom props | `--fth-*` prefix | `--fth-accent-glow` |

## Patterns

- **Safe global accessors:** Import from `src/types/guards.ts`. Use `getGame()`, `getHooks()`, `getUI()`, `isGM()`, `getSetting()`, `setSetting()`. Never access `game`, `Hooks`, `ui` directly.
- **Feature isolation:** Each feature lives in its own directory under `src/`. Each feature has its own settings registration function, init function, and CSS file. Features are wired into the module in `src/index.ts`.
- **Hook lifecycle order:** `init` (register settings, hooks, templates) → `setup` (override pickers, user-dependent setup) → `ready` (attach APIs, auto-open, socket listeners).
- **ViewModel pattern:** Extractor pulls raw data from Foundry documents → Transformer converts to typed ViewModel → Renderer uses ViewModel + Handlebars template. Never pass Foundry documents directly to templates.
- **Settings registration:** Each feature exports a `register*Settings(settings)` function called from `index.ts` during `init`. Settings use the `MOD` constant as namespace.
- **CSS imports:** All CSS is imported in `src/index.ts` so Vite bundles it into a single `styles.css`. Feature CSS files are scoped with feature-specific selectors.
- **Handlebars templates:** Live in `templates/` directory (copied to `dist/` via Vite `publicDir`). Referenced as `modules/${MOD}/templates/...`.

## Anti-Patterns

- **Never hardcode `"foundry-tabletop-helpers"`** — always use `MOD` from `src/logger.ts`.
- **Never use `game` directly** — it's `undefined` during `init`. Use `getGame()` from guards.
- **Never pass Foundry documents to templates** — extract data into a ViewModel first.
- **Never use `any` without `// eslint-disable-next-line`** — the codebase avoids `any` except where Foundry's types force it (FormApplication inheritance).
- **Never use V1 Application patterns for new UI** — use ApplicationV2 / HandlebarsApplicationMixin for new windows. V1 FormApplication is only used for settings submenus (Foundry limitation).
- **Never add runtime dependencies** — the module ships as a single ES module. All code is bundled by Vite.
- **Never use `find` with `-uall` flag** — can cause memory issues on large repos.
- **Don't create separate CSS files without importing them in index.ts** — they won't be bundled.
- **Don't register settings outside of `init` hook** — Foundry requires all settings registered during init.

## Build

- **Vite** — library mode, single ES module output (`dist/index.js`)
- **CSS:** `cssCodeSplit: false` → single `dist/styles.css`
- **No hashing:** All output filenames are stable (no content hashes) for Foundry compatibility
- **`public/` dir** copies verbatim to `dist/` (templates live here as well as `templates/` for HBS)
- **Manifest stamping:** `scripts/build-manifest.mjs` generates `dist/module.json` from `module.template.json`
- **Tests:** Vitest — colocated test files (`*.test.ts`) next to source
