# Foundry Tabletop Helpers

A small set of quality-of-life helpers for touchscreen tabletop play in Foundry VTT.

Current features:
- Adds a "Rotate 90°" control to application windows (handy for rotating the table or switching between portrait/landscape setups).

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

> Note: Releases are produced by CI when you push a version tag (e.g., `v0.1.10-alpha`). The published manifest always points to the stable URL above, while downloads point to the exact tagged release.