# Product Specification

## What It Is

Foundry Tabletop Helpers is a Foundry VTT V13 module that enhances D&D 5.5e gameplay with quality-of-life tools for both GMs and players. It provides print-ready character sheets with intelligent feature summaries, a live play character sheet for tablet use at the table, a comprehensive combat command center, an asset manager replacing Foundry's built-in file picker, and a guided character creation wizard — all designed for touch-first, immersive dark-fantasy UI.

## Features

| Feature | Description | Design Intent |
|---------|-------------|---------------|
| **Print Sheets** | Generate print-ready PDFs for characters, NPCs, encounters, and party summaries with configurable sections and live variable resolution | Replace manual sheet prep; intelligent feature summaries parse PHB/homebrew content at runtime |
| **Live Play Character Sheet (LPCS)** | Full-screen character sheet with tabs, auto-open on login, real-time updates | Tablet players at the table get an optimized, always-visible sheet |
| **Combat Command Center** | Batch initiative, damage workflow with resistance/vulnerability, monster preview, party summary, token health indicators | GM combat efficiency — reduce clicks and bookkeeping during encounters |
| **Quick Rules Reference** | Searchable rules panel (digital DM screen) | Instant rule lookups without leaving Foundry |
| **Asset Manager** | FilePicker replacement with virtual scrolling, thumbnail cache, server-side optimization, context menus, upload | Handle large asset libraries (1000+ images) that Foundry's native picker can't |
| **Character Creator** | Step-by-step wizard (race, class, background, abilities, skills, feats, spells, equipment, review) with GM content filtering | Guide new players through D&D 5.5e character creation using official rules |
| **Level-Up Manager** | Guided level-up workflow (HP, feats, spells, review) | Automate the tedious parts of leveling up while teaching the rules |
| **Window Rotation** | Rotate/flip any application window 90°/180° with socket sync | Flip a sheet to face a player across the table |
| **Kiosk Mode** | Full-screen, chrome-less mode for designated player accounts | Dedicated player tablets show only their character sheet |
| **Server Companion** | Node.js sidecar with Sharp/FFmpeg for image optimization, thumbnail generation | Offload heavy image processing from the browser |

## Constraints

- **Foundry VTT V13 only** — uses V13 APIs (object-keyed scene controls, ApplicationV2, etc.)
- **dnd5e system 4.x+** — requires Activities model support (dnd5e >= 4.0.0)
- **Touch-first UI** — all interactive elements must be at least 44px tap targets
- **No external runtime dependencies** — the module is a single ES module + CSS file
- **Server companion is optional** — asset manager degrades gracefully without it
- **Published to official Foundry registry** via GitHub Actions on tagged releases

## Roadmap

| Phase | Status |
|-------|--------|
| ~~Print sheets (character, NPC, encounter, party)~~ | Complete |
| ~~Live Play Character Sheet~~ | Complete |
| ~~Window rotation with socket sync~~ | Complete |
| ~~Kiosk mode~~ | Complete |
| ~~Quick initiative dialog~~ | Complete |
| ~~Combat Command Center~~ | Complete |
| ~~Quick Rules Reference~~ | Complete |
| ~~Asset Manager with server companion~~ | Complete |
| Character Creator wizard | In progress |
| Level-Up Manager | In progress |
| GM content filter configuration | In progress |
