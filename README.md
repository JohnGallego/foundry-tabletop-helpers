# Foundry Tabletop Helpers

A set of quality-of-life helpers for Foundry VTT, optimized for touchscreen tabletop play and physical printing.

## Features

### 📱 Live Play Character Sheets
Touch-optimized character sheets designed for tablets and phones, making Foundry VTT practical for in-person play. Players can view and interact with their characters directly on mobile devices without needing a full desktop setup.

- **Touch-first design** — large tap targets (44×44px minimum) and a dark theme built for tablet and phone screens
- **Compact layout** — everything fits in a 520×780px window optimized for portrait-mode tablets
- **Live updates** — changes sync in real time across all connected devices
- **Full character interaction** — ability checks, saving throws, skill rolls, hit point tracking, rests, and more — all from a streamlined mobile interface
- **Complements print sheets** — use live sheets for players going digital and print sheets for players who prefer paper

### 🖨️ Print & Preview Sheets
Generate print-ready sheets for your characters, NPCs, encounters, and party — optimized for physical use at the table or as a digital PDF reference.

- **Premium layout** — clean, light-themed design that saves ink and stays readable at the table
- **Everything in one place** — ability scores, saves, combat stats, actions, spellcasting, skills, features, inventory, and backstory all on a single organized sheet
- **Smart feature summaries** — class features and feats are automatically condensed into concise, table-ready descriptions that show your character's actual values (e.g. "Sneak Attack: 3d6", "Ki Points: 5")
- **Currency tracking widget** — write-in boxes for tracking gold, silver, and copper during a session
- **Configurable sections** — choose exactly which sections to include each time you print

**Supported sheet types:**
- **Characters** — full character sheets with all details
- **NPCs** — monster/NPC stat blocks
- **Parties** — a summary table of all party members
- **Encounters** — multiple NPC stat blocks grouped on one sheet

**How to use:**
1. Right-click any Actor in the sidebar → **"FTTH - Print"** or **"FTTH - Preview"**
2. Select which sections to include and your paper size
3. Print, or save as PDF from your browser's print dialog

### 🔄 Window Rotation
- Adds a Rotate/Flip control to application windows. Default rotates 90° per press; optionally switch to 180° flip in settings.
- Includes prebuilt macros to rotate all open windows (90° clockwise/counterclockwise, and 180°). A world compendium "FTH Macros" is auto-created for drag-and-drop.

## Settings
- **Live Play Character Sheet** *(GM only)* — Enable the touch-optimized character sheet for in-person play on tablets and phones.
- **Print Access** *(GM only)* — Control who can use the print and preview features: everyone (default) or GM only.
- **Print Defaults** — Set default paper size and which sections are pre-selected for each sheet type.
- **Rotation** — Choose how much each press rotates: 90° steps (default) or 180° flip.
- **Animations** — Enable or disable snappy rotation animations (default: enabled).
- **Log Level** — Controls console verbosity (set to "debug" when troubleshooting).
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