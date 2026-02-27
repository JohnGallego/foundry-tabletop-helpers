# Foundry Tabletop Helpers

A set of quality-of-life helpers for Foundry VTT, optimized for touchscreen tabletop play and physical printing.

## Features

### 🖨️ Print Character Sheets
Generate print-ready character sheets optimized for physical use at the table.

**Pro Sheet Style** — A premium character sheet designed to look like a high-quality printed RPG product:
- Clean, light-themed layout optimized for printing (saves ink, high readability)
- Organized sections: Header, Combat Stats, Abilities, Senses, Actions, Spellcasting, Skills, Proficiencies, Features, Inventory
- Currency tracking widget with write-in boxes for session use
- **Intelligent feature summaries** — verbose class features and feats are automatically condensed for print:
  - *Curated SRD summaries* — hand-crafted, high-quality summaries for SRD 2024 content (Alert, Grappler, Magic Initiate, Sneak Attack, and more)
  - *Runtime structural parser* — for PHB, DMG, or homebrew content the module hasn't seen before, it reads the description you already own and extracts the bold-headed benefit pattern (`**Benefit Name.** First sentence.`) on the fly — no copyrighted text is ever bundled
  - *Qualified partial matching* — a Cleric's "Spellcasting (Cleric)" correctly matches the Spellcasting summary while unrelated features like "Skilled" are never confused with "Ki"
  - *Live variable resolution* — Foundry's internal `[[lookup @prof]]` placeholders are replaced with real values (e.g. `proficiency bonus 3`) before printing, eliminating `(currently )` artefacts; character-specific tokens like sneak attack dice count, ki points, and lay on hands pool are also resolved against the current character
- Page-break aware layout to keep related sections together

**Supported Print Types:**
- **Characters** — Full character sheets with all details
- **NPCs** — Monster/NPC stat blocks
- **Parties** — Summary of all party members
- **Encounters** — Multiple NPC stat blocks grouped together

**How to Use:**
1. Right-click an Actor in the sidebar → "Print Sheet"
2. Select print options (style, sections to include)
3. Print or save as PDF

### 🔄 Window Rotation
- Adds a Rotate/Flip control to application windows. Default rotates 90° per press; optionally switch to 180° flip in settings.
- Includes prebuilt macros to rotate all open windows (90° clockwise/counterclockwise, and 180°). A world compendium "FTH Macros" is auto-created for drag-and-drop.

## Settings
- Rotation: Choose how much each press rotates
  - Rotate 90° (default): cycles 0 → 90 → 180 → 270 → 0
  - Flip 180°: toggles 0 ↔ 180°
- Animations: Enable or disable snappy rotation animations (default: enabled). Uses a polished easing curve for a professional feel.

- Log Level: Controls console verbosity (set to debug when troubleshooting).
## Macros
- On world load, if you are the GM, the module ensures a world compendium named "FTH Macros" containing:
  - Rotate All 90° (CW)
  - Rotate All 90° (CCW)
  - Rotate All 180°
- Drag any of these macros from the compendium to your hotbar to use them.
- These macros act on all currently displayed windows and persist the new orientation.
- Advanced: you can also call the API from a script macro or console:

```js
window.fth.rotateAll90CW();
window.fth.rotateAll90CCW();
window.fth.rotateAll180();
```

- Add header button to V1 windows (legacy): Only if you need the rotation button on V1 apps (deprecated since V13).


## Install (Stable Manifest URL)
Use the stable manifest URL so Foundry always sees new releases when you click "Check for Updates":

https://raw.githubusercontent.com/JohnGallego/foundry-tabletop-helpers/main/module.json

In Foundry: Add-on Modules → Install Module → paste the URL above.

## Development
### Prerequisites
- Node.js 20+
- npm 10+
- Git

### Setup
- Clone this repository
- Install dependencies:
  - `npm ci`

### Build
- One-off build: `npm run build`
- Watch mode (rebuild on changes): `npm run dev`

### Link into Foundry for local testing
- On Windows, you can create a symlink into your Foundry Data folder:
  - `npm run link:foundry`
  - This links the `dist/` folder to `%USERPROFILE%\AppData\Local\FoundryVTT\Data\modules\foundry-tabletop-helpers`.
- On macOS/Linux, manually symlink `dist/` into your Foundry Data `modules/` directory (path varies by install).

Then, start Foundry → Manage Modules → enable "Foundry Tabletop Helpers".

### Packaging (optional)
- Create a development zip from the built `dist/` contents: `npm run zip`

### Troubleshooting / Debug logs
If you run into issues (e.g., the rotate/flip button not appearing or not rotating/flipping):
- In Foundry, go to Module Settings → Foundry Tabletop Helpers → set "Log Level" to "debug".
- Try the action again, then open your browser console and copy the logs prefixed with "foundry-tabletop-helpers".
- Alternatively, in the console you can run `fth.setLevel('debug')` to enable verbose logs.
- Please include which window you were using (screenshot or name) and the Foundry core version.

> Note: Releases are produced by CI when you push a version tag (e.g., `v0.1.10-alpha`). The published manifest always points to the stable URL above, while downloads point to the exact tagged release.