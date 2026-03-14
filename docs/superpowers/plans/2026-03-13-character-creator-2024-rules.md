# Character Creator 2024 Rules Rework — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the character creator wizard steps to follow the 2024 D&D Player's Handbook character creation rules, sourcing all grants from dnd5e 5.x advancement data.

**Architecture:** Clean rewrite of step definitions, types, templates, and actor creation engine. The wizard shell, state machine, compendium indexer, and settings infrastructure are preserved. A new advancement parser utility extracts background grants, class skill lists, and species traits from compendium documents at runtime.

**Tech Stack:** TypeScript (strict), Foundry VTT V13 ApplicationV2, dnd5e 5.x, Handlebars templates, Vite build.

**Spec:** `docs/superpowers/specs/2026-03-13-character-creator-2024-rules-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/character-creator/data/advancement-parser.ts` | Parse dnd5e advancement arrays → typed grant objects (background grants, class skills, species traits) |
| `src/character-creator/steps/step-species.ts` | Species selection step (replaces step-race.ts) |
| `src/character-creator/steps/step-origin-feat.ts` | Origin feat review/swap step |
| `templates/character-creator/cc-step-background-grants.hbs` | Background grants panel (ASI picker, language picker, skill/tool chips) |
| `templates/character-creator/cc-step-origin-feat.hbs` | Origin feat detail/swap template |

### Rewritten Files (delete old, write new)

| File | What Changes |
|------|-------------|
| `src/character-creator/character-creator-types.ts` | All selection interfaces rewritten per spec type system |
| `src/character-creator/wizard/step-registry.ts` | New STEP_ORDER, STEP_ATMOSPHERES, registerAllSteps() |
| `src/character-creator/wizard/wizard-state-machine.ts` | New DEPENDENCY_CASCADE with `species` key, `originFeat` in background cascade |
| `src/character-creator/steps/step-background.ts` | Card-select + grants panel with ASI picker, language picker |
| `src/character-creator/steps/step-class.ts` | Card-select + advancement parsing for skillPool/skillCount |
| `src/character-creator/steps/step-subclass.ts` | Minor — type updates only |
| `src/character-creator/steps/step-abilities.ts` | Add background ASI bonus display row |
| `src/character-creator/steps/step-skills.ts` | Class pool filtering, background locked chips, exact count completion |
| `src/character-creator/steps/step-feats.ts` | Type updates |
| `src/character-creator/steps/step-spells.ts` | Type updates |
| `src/character-creator/steps/step-equipment.ts` | Type updates |
| `src/character-creator/steps/step-portrait.ts` | Type updates + `race` → `species` rename |
| `src/character-creator/portrait/portrait-prompt-builder.ts` | `race` → `species` rename in prompt building |
| `src/character-creator/steps/step-review.ts` | Show species, background grants, languages, origin feat |
| `src/character-creator/engine/actor-creation-engine.ts` | Full rewrite — background ASI, languages, origin feat, skill merge |
| `src/character-creator/data/dnd5e-constants.ts` | Add STANDARD_LANGUAGES list, remove CLASS_SKILL_PICKS |
| `src/character-creator/character-creator-settings.ts` | Add "Allow custom backgrounds" toggle, enhanced compendium selector |
| `templates/character-creator/cc-step-abilities.hbs` | Add background bonus row |
| `templates/character-creator/cc-step-skills.hbs` | Background locked chips, class pool filtering |
| `templates/character-creator/cc-step-review.hbs` | New sections for languages, origin feat, background grants |

### Deleted Files

| File | Replaced By |
|------|-------------|
| `src/character-creator/steps/step-race.ts` | `step-species.ts` |

### Unchanged Files (infrastructure)

- `src/character-creator/character-creator-init.ts` — minor wiring updates only
- `src/character-creator/wizard/character-creator-app.ts` — minor update in Task 14 to add `allowCustomBackgrounds` to `_snapshotGMConfig()`
- `src/character-creator/data/compendium-indexer.ts` — no changes needed
- `src/character-creator/data/content-filter.ts` — no changes needed
- `src/character-creator/steps/card-select-utils.ts` — no changes needed
- `templates/character-creator/cc-shell.hbs` — no changes needed
- `templates/character-creator/cc-step-card-select.hbs` — no changes needed

---

## Chunk 1: Foundation — Types, Advancement Parser, Infrastructure

### Task 1: Rewrite type definitions

**Files:**
- Rewrite: `src/character-creator/character-creator-types.ts`

- [ ] **Step 1:** Replace all selection interfaces (`RaceSelection`, `BackgroundSelection`, `ClassSelection`, etc.) with the new types from the spec: `SpeciesSelection`, `BackgroundSelection` (with `grants`, `asi`, `languages`), `OriginFeatSelection`, `ClassSelection` (with `skillPool`, `skillCount`), `SkillSelection` (class-chosen only). Keep `AbilityScoreState`, `FeatSelection`, `SpellSelection`, `EquipmentSelection`, `PortraitSelection`, `StepCallbacks`, `WizardStepDefinition`, `WizardShellContext` unchanged. Add `BackgroundGrants`, `BackgroundASI`, `LanguageSelection` interfaces. Update `WizardSelections` to use `species` key instead of `race`. **IMPORTANT:** `CreatorContentType` keeps `"race"` (not renamed to `"species"`) because dnd5e's internal item type is still `"race"`. Only the `WizardSelections` property key changes. `CONTENT_TYPE_LABELS`, `SOURCE_KEY_TO_TYPE`, `ACCEPTED_ITEM_TYPES` in the indexer all keep `"race"` as the content type. Add `allowCustomBackgrounds?: boolean` to `GMConfig` as an optional field so the existing `_snapshotGMConfig()` doesn't break until Task 14.

- [ ] **Step 2:** Run `npm run typecheck`. Expect many errors in step files and engine — that's correct, we'll fix them in subsequent tasks.

- [ ] **Step 3:** Commit: `"refactor(creator): rewrite type definitions for 2024 rules"`

### Task 2: Create advancement parser

**Files:**
- Create: `src/character-creator/data/advancement-parser.ts`

- [ ] **Step 1:** Write `parseBackgroundGrants(doc: FoundryDocument): BackgroundGrants` — extracts all 4 advancement types from the document's `system.advancement` array. Returns nullable fields for missing advancements. Parses `"skills:ins"` → `"ins"`, `"tool:art:calligrapher"` → `"art:calligrapher"`, `"languages:standard:common"` → `"common"`. Fetches origin feat name/img via `fromUuid()`.

- [ ] **Step 2:** Write `parseClassSkillAdvancement(doc: FoundryDocument): { skillPool: string[]; skillCount: number }` — finds the `Trait` advancement titled "Skill Proficiencies" with `mode: "default"`. Extracts `choices[0].count` and `choices[0].pool`. Converts `"skills:ath"` → `"ath"`, handles `"skills:*"` as all 18 skills. Falls back to `{ skillPool: allSkillKeys, skillCount: 2 }`.

- [ ] **Step 3:** Write `parseSpeciesTraits(doc: FoundryDocument): string[]` — extracts trait names from `ItemGrant` advancements (their `title` fields) for display.

- [ ] **Step 4:** Run `npm run typecheck`. Parser should compile clean.

- [ ] **Step 5:** Commit: `"feat(creator): add advancement parser for dnd5e 5.x"`

### Task 3: Update step registry, state machine, and constants

**Files:**
- Modify: `src/character-creator/wizard/step-registry.ts`
- Modify: `src/character-creator/wizard/wizard-state-machine.ts`
- Modify: `src/character-creator/data/dnd5e-constants.ts`

- [ ] **Step 1:** In `step-registry.ts`, update `STEP_ORDER` to the new 12-step order: `["species", "background", "originFeat", "class", "subclass", "abilities", "skills", "feats", "spells", "equipment", "portrait", "review"]`. Update `STEP_ATMOSPHERES` to include `species` (replacing `race`), `originFeat`, and remove `race`. **Do NOT update `registerAllSteps()` imports yet** — the new step files don't exist. Keep the existing imports but comment them out. The imports will be wired in Tasks 4–7 as each step file is created.

- [ ] **Step 2:** In `wizard-state-machine.ts`, update `DEPENDENCY_CASCADE`: `species: []`, `background: ["originFeat", "skills", "abilities"]`, `class: ["subclass", "skills", "feats", "spells", "equipment"]`, `subclass: ["spells"]`, `abilities: ["feats"]`. Remove old `race` key.

- [ ] **Step 3:** In `dnd5e-constants.ts`, add `STANDARD_LANGUAGES` array: `["common", "common-sign", "draconic", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc"]` and `RARE_LANGUAGES`: `["abyssal", "celestial", "deep-speech", "infernal", "primordial", "sylvan", "thieves-cant", "undercommon"]` with display label maps. Remove `CLASS_SKILL_PICKS` if it exists (it's now dynamic from advancement).

- [ ] **Step 4:** Commit: `"refactor(creator): update step order, cascade, and constants for 2024 rules"`

---

## Chunk 2: Card-Select Steps — Species, Background, Origin Feat, Class

### Task 4: Species step (replaces Race)

**Files:**
- Create: `src/character-creator/steps/step-species.ts`
- Delete: `src/character-creator/steps/step-race.ts`

- [ ] **Step 1:** Create `step-species.ts`. Copy the card-select pattern from the old `step-race.ts`. Change step ID to `"species"`, label to `"Character Origins"`. Use `compendiumIndexer.getIndexedEntries("race", ...)` (dnd5e item type is still `"race"`). On selection, fetch the full document and call `parseSpeciesTraits()` to populate `traits` on the selection. Pass `stepTitle: "Character Origins:"`, `stepLabel: "Species"`, `stepIcon: "fa-solid fa-dna"` to the ViewModel. Use `setDataSilent` + `patchCardSelection` for flicker-free selection. Include `getStatusHint`.

- [ ] **Step 2:** Delete `step-race.ts`.

- [ ] **Step 3:** Update `step-registry.ts` to import `createSpeciesStep` instead of `createRaceStep`.

- [ ] **Step 4:** Run `npm run build`. Fix any import errors.

- [ ] **Step 5:** Commit: `"feat(creator): add species step replacing race step"`

### Task 5: Background step with grants panel

**Files:**
- Rewrite: `src/character-creator/steps/step-background.ts`
- Create: `templates/character-creator/cc-step-background.hbs` (combined card grid + grants panel — does NOT use shared `cc-step-card-select.hbs` since it needs the inline grants panel)
- Create: `templates/character-creator/cc-step-background-grants.hbs` (partial for the grants panel, included in `cc-step-background.hbs`)

- [ ] **Step 1:** Rewrite `step-background.ts`. Uses its own template (`cc-step-background.hbs`) instead of the shared card-select template, because it needs the grants panel inline below the card grid. On card selection: fetch full document via `compendiumIndexer.fetchDocument()`, call `parseBackgroundGrants()`, store grants on the selection object. The `buildViewModel` renders the card grid AND the grants panel (ASI picker, language picker, skill/tool chips). Pass `stepTitle: "Character Origins:"`, `stepLabel: "Background"`, `stepIcon: "fa-solid fa-scroll"`.

- [ ] **Step 2:** Create `cc-step-background-grants.hbs` template. Layout:
  - Grants summary chips (skills, tool, origin feat name) — read-only
  - ASI picker: 6 ability dropdowns (0/+1/+2), showing `asiSuggested` as highlighted defaults. Validation: sum must equal `asiPoints`, each <= `asiCap`.
  - Language picker: Common (locked chip) + dropdowns for `languageChoiceCount` picks from standard language list.
  - Each section conditionally rendered based on grants data being non-null.

- [ ] **Step 3:** Wire `onActivate` handlers for ASI dropdowns and language dropdowns using `setDataSilent` + targeted DOM patching (same pattern as abilities step). Update completion state: background selected AND ASI fully assigned AND languages fully chosen.

- [ ] **Step 4:** Implement `isComplete`: check `background?.uuid` AND `asi.assignments` sums to `grants.asiPoints` AND `languages.chosen.length === grants.languageChoiceCount`.

- [ ] **Step 5:** Implement `getStatusHint`: progression through "Select a background" → "Assign ability score increases" → "Choose 2 languages" → "".

- [ ] **Step 6:** Run `npm run build`. Fix errors.

- [ ] **Step 7:** Commit: `"feat(creator): add background step with grants panel, ASI picker, language picker"`

### Task 6: Origin feat step

**Files:**
- Create: `src/character-creator/steps/step-origin-feat.ts`
- Create: `templates/character-creator/cc-step-origin-feat.hbs`

- [ ] **Step 1:** Create `step-origin-feat.ts`. `isApplicable`: returns `!!state.selections.background?.grants.originFeatUuid`. `isComplete`: always true (informational step). `buildViewModel`: fetch feat document from `originFeatUuid`, extract name, description, img. If GM setting "Allow custom backgrounds" is enabled AND `isCustom` is supported, show a card grid of origin-category feats with the background's feat pre-selected.

- [ ] **Step 2:** Create `cc-step-origin-feat.hbs`. Default: feat detail card showing name, image, description text. Custom mode: card grid (reuse cc-step-card-select.hbs pattern).

- [ ] **Step 3:** Add `getStatusHint`: "Review your origin feat" when default, "Select an origin feat" when custom mode.

- [ ] **Step 4:** Run `npm run build`. Fix errors.

- [ ] **Step 5:** Commit: `"feat(creator): add origin feat step"`

### Task 7: Class step with advancement parsing

**Files:**
- Rewrite: `src/character-creator/steps/step-class.ts`

- [ ] **Step 1:** Rewrite `step-class.ts`. Card-select grid for classes. On selection: fetch full document, call `parseClassSkillAdvancement()`, store `skillPool` and `skillCount` on the `ClassSelection` object. Use `setDataSilent` + `patchCardSelection`. Pass `stepTitle: "Class"`, `stepIcon: "fa-solid fa-shield-halved"`.

- [ ] **Step 2:** Implement `getStatusHint`.

- [ ] **Step 3:** Run `npm run build`.

- [ ] **Step 4:** Commit: `"feat(creator): rewrite class step with advancement-based skill data"`

---

## Chunk 3: Abilities, Skills, and Remaining Steps

### Task 8: Subclass step — type updates

**Files:**
- Modify: `src/character-creator/steps/step-subclass.ts`

- [ ] **Step 1:** Update imports to use new `SubclassSelection` type. Verify `setDataSilent` + `patchCardSelection` pattern is in place. No behavioral changes needed.

- [ ] **Step 2:** Run `npm run build`. Commit: `"refactor(creator): update subclass step types"`

### Task 9: Abilities step — add background ASI display

**Files:**
- Modify: `src/character-creator/steps/step-abilities.ts`
- Modify: `templates/character-creator/cc-step-abilities.hbs`

- [ ] **Step 1:** In `buildAbilitiesVM`, read `state.selections.background?.asi?.assignments` and compute per-ability bonuses. Add `backgroundBonus` (number) and `total` (base + bonus) to each ability card in the ViewModel.

- [ ] **Step 2:** Update `cc-step-abilities.hbs` ability card to show a bonus row when `backgroundBonus > 0`: display `base + bonus = total` under each score.

- [ ] **Step 3:** Update `patchPointBuyDOM` and `patchAbilityCards` to also patch the bonus/total display.

- [ ] **Step 4:** Run `npm run build`. Commit: `"feat(creator): show background ASI bonuses in abilities step"`

### Task 10: Skills step — class pool filtering and background locked chips

**Files:**
- Rewrite: `src/character-creator/steps/step-skills.ts`
- Rewrite: `templates/character-creator/cc-step-skills.hbs`

- [ ] **Step 1:** Rewrite `step-skills.ts`. Read `state.selections.class?.skillPool` and `state.selections.class?.skillCount` (fall back to all skills / 2). Read `state.selections.background?.grants.skillProficiencies` for locked chips. Build ViewModel with: `backgroundSkills` (locked chip data), `availableSkills` (class pool, excluding background skills), `chosenCount`, `maxPicks`, `atMax`.

- [ ] **Step 2:** Rewrite `cc-step-skills.hbs`. Top section: "From your background:" with locked skill chips. Below: checkboxes for class-available skills only, with `X / Y` counter. Skills outside the class pool are not shown.

- [ ] **Step 3:** `isComplete`: `data.chosen.length === skillCount`. `getStatusHint`: "Choose N skill proficiencies" → "Choose N more" → "".

- [ ] **Step 4:** `onActivate`: `setDataSilent` + `patchSkillsDOM` for flicker-free toggling.

- [ ] **Step 5:** Run `npm run build`. Commit: `"feat(creator): rewrite skills step with class pool filtering and background chips"`

### Task 11: Feats, Spells, Equipment, Portrait — type updates

**Files:**
- Modify: `src/character-creator/steps/step-feats.ts`
- Modify: `src/character-creator/steps/step-spells.ts`
- Modify: `src/character-creator/steps/step-equipment.ts`
- Modify: `src/character-creator/steps/step-portrait.ts`
- Modify: `src/character-creator/portrait/portrait-prompt-builder.ts`

- [ ] **Step 1:** Update imports in each file to use new type names. Fix any references to `state.selections.race` → `state.selections.species` in all files, **including `portrait-prompt-builder.ts`** which reads `sel.race?.name` for generating portrait prompts. Verify `setDataSilent` patterns are in place where applicable.

- [ ] **Step 2:** Run `npm run build`. Fix any remaining type errors.

- [ ] **Step 3:** Commit: `"refactor(creator): update feats, spells, equipment, portrait step types"`

### Task 12: Review step — show new data

**Files:**
- Rewrite: `src/character-creator/steps/step-review.ts`
- Rewrite: `templates/character-creator/cc-step-review.hbs`

- [ ] **Step 1:** Rewrite `step-review.ts` ViewModel to include all new sections: species (name + traits), background (name + granted skills + tool + languages + origin feat), class (name + chosen skills), ability scores (with background bonus breakdown). Update all `sel.race` references to `sel.species`. **Update the background `complete` boolean** to check not just `!!sel.background?.uuid` but also that ASI is fully assigned (`asi.assignments` sums to `grants.asiPoints`) and languages are chosen (`languages.chosen.length === grants.languageChoiceCount`) — matching the background step's `isComplete` logic.

- [ ] **Step 2:** Update `cc-step-review.hbs` to render new sections: languages list, origin feat name/img, background skills vs class skills distinction, ability score bonus breakdown.

- [ ] **Step 3:** Verify `setDataSilent` for name input (already done).

- [ ] **Step 4:** Run `npm run build`. Commit: `"feat(creator): update review step for 2024 rules data"`

---

## Chunk 4: Actor Creation Engine and Settings

### Task 13: Rewrite actor creation engine

**Files:**
- Rewrite: `src/character-creator/engine/actor-creation-engine.ts`

- [ ] **Step 1:** Rewrite `buildActorData()`: apply base ability scores from `sel.abilities.scores`, then add background ASI from `sel.background.asi.assignments`.

- [ ] **Step 2:** Rewrite `collectItems()`: collect species UUID, background UUID, origin feat UUID (if non-null), class UUID, subclass UUID (if applicable), feat items, spell items. Each fetched via `fromUuid()` and embedded via `createEmbeddedDocuments`.

- [ ] **Step 3:** Add `applyProficiencies()`: merge background skill proficiencies + class-chosen skills → set `system.skills.<key>.proficient`. Apply tool proficiency from background grants. Apply languages (fixed + chosen) to `system.traits.languages.value`.

- [ ] **Step 4:** Keep existing `applyPortrait()`, `assignOwnership()`, `notifyGMCharacterCreated()` logic.

- [ ] **Step 5:** Run `npm run build`. Commit: `"feat(creator): rewrite actor creation engine for 2024 rules"`

### Task 14: Add "Allow custom backgrounds" setting

**Files:**
- Modify: `src/character-creator/character-creator-settings.ts`
- Modify: `templates/character-creator/cc-settings.hbs`
- Modify: `src/character-creator/character-creator-types.ts` (make `allowCustomBackgrounds` required on `GMConfig`)
- Modify: `src/character-creator/wizard/character-creator-app.ts` (add to `_snapshotGMConfig()`)

- [ ] **Step 1:** Add `CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS` setting (Boolean, default false, world scope, restricted). Add to settings registration, add typed accessor `allowCustomBackgrounds(): boolean`.

- [ ] **Step 2:** Add to the CC settings popup template and `getData()`/`_updateObject()`.

- [ ] **Step 3:** In `character-creator-types.ts`, change `allowCustomBackgrounds` from optional to required on `GMConfig`. In `character-creator-app.ts`, add `allowCustomBackgrounds: allowCustomBackgrounds()` to `_snapshotGMConfig()`. Import the accessor.

- [ ] **Step 4:** Run `npm run build`. Commit: `"feat(creator): add allow custom backgrounds setting"`

### Task 15: Enhanced compendium selector

**Files:**
- Modify: `src/character-creator/character-creator-settings.ts` (the `CompendiumSelectForm` class)
- Modify: `templates/character-creator/cc-compendium-select.hbs`

- [ ] **Step 1:** Update `detectPacks()` to lazy-fetch a sample of 3-5 entries per pack and extract names. For backgrounds: note if they have origin feats (check for `ItemGrant` advancement). For classes: extract skill pick counts.

- [ ] **Step 2:** Update template to show entry name previews ("Acolyte, Criminal, Sage +13 more"), source attribution labels, and advancement-aware descriptions.

- [ ] **Step 3:** Add overlap detection: when the same entry name exists in multiple selected packs for the same content type, show a note.

- [ ] **Step 4:** Run `npm run build`. Commit: `"feat(creator): enhance compendium selector with advancement previews"`

---

## Chunk 5: Integration, Wiring, and Verification

### Task 16: Wire everything in init orchestrator

**Files:**
- Modify: `src/character-creator/character-creator-init.ts`

- [ ] **Step 1:** Update template preload list: add `cc-step-background-grants.hbs`, `cc-step-origin-feat.hbs`. Remove any old template paths that no longer exist.

- [ ] **Step 2:** Verify `registerCharacterCreatorHooks()` calls `registerAllSteps()` which now registers the new step set.

- [ ] **Step 3:** Run `npm run build`. Commit: `"chore(creator): update init wiring for new steps"`

### Task 17: Full build and deploy verification

- [ ] **Step 1:** Run `npm run build` — must pass with zero TypeScript errors.

- [ ] **Step 2:** Deploy: `rsync -avz --delete "dist/" root@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/`

- [ ] **Step 3:** Reload Foundry in browser. Open character creator. Walk through all 12 steps verifying:
  - Species shows species cards, no feats/traits mixed in
  - Background shows grants panel with ASI picker and language picker
  - Origin feat shows correct feat from background
  - Class shows class cards with skill info
  - Abilities shows background bonus row
  - Skills shows background locked chips and class pool only
  - Review shows all new data sections
  - Create character produces a valid actor with correct proficiencies, languages, and items

- [ ] **Step 4:** Commit any fixes found during verification.

- [ ] **Step 5:** Final commit: `"feat(creator): character creator 2024 PHB rules — complete"`
