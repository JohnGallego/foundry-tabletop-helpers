# Character Creator — 2024 PHB Rules Rework

**Date:** 2026-03-13
**Status:** Approved design, pending implementation plan
**Scope:** Clean rewrite of all wizard step definitions, types, templates, and actor creation engine. Infrastructure (shell, state machine, indexer, settings) is preserved.

---

## Context

The character creator wizard was built with a generic step flow. It needs to follow the 2024 Player's Handbook character creation rules exactly. No users are on this feature yet, so we can do a clean rewrite without migration concerns.

**System targets:** Foundry VTT V13, dnd5e system 5.x.

## Step Order

```
species → background → originFeat → class → subclass → abilities → skills → feats → spells → equipment → portrait → review
```

| Step | Condition | Cascades To |
|------|-----------|-------------|
| species | Always | — |
| background | Always | originFeat, skills, abilities |
| originFeat | Has origin feat from background | — |
| class | Always | subclass, skills, feats, spells, equipment |
| subclass | Starting level >= 3 | spells |
| abilities | Always | feats |
| skills | Always | — |
| feats | ASI level (4, 8, 12, 16, 19) | — |
| spells | Always (may be empty for non-casters) | — |
| equipment | Always | — |
| portrait | Always (optional, always complete) | — |
| review | Always | — |

### Key rename: `race` → `species`

The step ID changes from `"race"` to `"species"`. This requires a coordinated update across:
- `STEP_ORDER` in step-registry
- `DEPENDENCY_CASCADE` in state-machine
- `STEP_ATMOSPHERES` in step-registry
- `WizardSelections` key (`species` replaces `race`)
- Review step ViewModel (`sel.species` replaces `sel.race`)
- Actor creation engine (all `sel.race` references)

This rename is done as the first step of implementation before any step rewrite.

## Data Source: Advancement Parsing

All background grants, class skill lists, and species traits come from dnd5e 5.x `system.advancement` data on compendium documents. **No hardcoded lookup tables.** The wizard fetches the full document on selection (via `CompendiumIndexer.fetchDocument()`) and parses the advancement array.

A new utility `data/advancement-parser.ts` provides typed extraction functions that return nullable results for defensive handling of homebrew/legacy content.

### Background Advancement Structure

Official 2024 backgrounds (SRD, PHB, Heroes of Faerun) contain 4 advancement entries:

| Advancement Type | Title | Data |
|---|---|---|
| `AbilityScoreImprovement` | "Background Ability Score Improvement" | `configuration.points` (3), `configuration.cap` (2), `configuration.locked` (abilities the PHB does NOT suggest — advisory only, not enforced) |
| `Trait` | "Background Proficiencies" | `configuration.grants`: `"skills:ins"`, `"skills:rel"`, `"tool:art:calligrapher"` etc. |
| `ItemGrant` | "Background Feat" | `configuration.items[0].uuid` → origin feat UUID |
| `Trait` | "Choose Languages" | `configuration.grants`: `["languages:standard:common"]`, `configuration.choices[0]`: `{ count: 2, pool: ["languages:standard:*"] }` |

**Homebrew/legacy fallback:** The parser returns `null` for any missing advancement type. Steps handle `null` gracefully — if no origin feat is found, the `originFeat` step is skipped (`isApplicable` returns false). If no ASI advancement exists, the background step omits the ASI picker. If no language trait exists, the language picker is hidden.

### Class Advancement Structure

Classes contain a `Trait` advancement titled "Skill Proficiencies":
- `configuration.choices[0].count` — number of skills to pick (2 for most, 3 for Bard/Ranger, 4 for Rogue)
- `configuration.choices[0].pool` — available skill keys (`"skills:ath"`, `"skills:*"` for any)

**Fallback:** If no "Skill Proficiencies" trait advancement is found, default to 2 picks from all 18 skills.

### Species Advancement Structure

Species contain `ItemGrant` and `Trait` advancements for traits, resistances, and features. Parsed and displayed as read-only summary.

## Step Behaviors

### 1. Species

Card grid of `race`-type compendium entries (dnd5e item type is still `"race"` internally). On selection, shows species traits as a read-only summary panel (parsed from advancement `ItemGrant` and `Trait` entries). No ASI — that moved to Background in 2024.

### 2. Background

Card grid of `background`-type entries. On selection, a grants summary panel appears showing:
- **Fixed skill proficiencies** — read-only chips (e.g., "Insight", "Religion")
- **Tool proficiency** — read-only (e.g., "Calligrapher's Supplies")
- **Origin feat name** — read-only chip with feat name (clickable to preview)
- **ASI picker** — player distributes `points` (typically 3) with a cap of `cap` (typically 2) per ability. UI shows +2/+1 or +1/+1/+1 toggle, then dropdown assignment to abilities. The `locked` field from advancement data drives **pre-selection only** (highlights suggested abilities), **not validation**. Players may assign ASI to any abilities.
- **Language picker** — Common (locked chip) + choice slots from standard language list (count and pool from advancement data)

Each sub-section only appears if the advancement parser found the corresponding entry. A background with no ASI advancement simply skips the ASI picker.

Step is complete when: background is selected AND ASI is fully assigned (if ASI advancement exists) AND languages are fully chosen (if language advancement exists).

### 3. Origin Feat

Shows the origin feat granted by background with full details (name, description, mechanical effects). By default read-only/informational — the player just reviews what they're getting.

**Applicability:** `isApplicable` returns `!!state.selections.background?.grants.originFeatUuid`. If the background has no origin feat (homebrew/legacy), this step is skipped entirely.

**GM toggle:** "Allow custom backgrounds" in CC settings. When enabled, shows a card grid of all origin-category feats, with the background's feat pre-selected. Player can swap.

### 4. Class

Card grid of `class`-type entries. On selection, shows class summary:
- Hit die
- Saving throw proficiencies
- Armor/weapon proficiencies
- Skill pick count and available skills (from advancement data)

The class selection object stores `skillPool` and `skillCount` parsed from advancement data at selection time. These are consumed by the Skills step.

Uses enhanced shell header with selection preview badge (existing pattern).

### 5. Subclass

Card grid filtered by class identifier. Conditional at starting level >= 3. Unchanged from current pattern.

### 6. Abilities

Point buy / 4d6 / Standard array (existing methods, existing DOM patching). New: a "Background Bonuses" row under each ability score showing the ASI from step 2 as a read-only modifier. Display shows `base + bonus = total`.

Methods available are GM-configurable (existing setting). Reroll limit (existing setting) applies to 4d6.

### 7. Skills

**Class skill choices only.** Background-granted skills shown as locked chips at the top ("From your background: Insight, Religion"). These are derived from `state.selections.background.grants.skillProficiencies` and are not stored in `skills.chosen`.

Below that, checkboxes for class-available skills with `X / Y` counter. The count and available list come from `state.selections.class.skillCount` and `state.selections.class.skillPool`.

If class pool is `"skills:*"`, all 18 skills are available (Bard). Otherwise, only the listed skills are checkable — the rest are disabled.

**Completion:** `isComplete` requires `data.chosen.length === state.selections.class.skillCount` (exact count, not "at least one"). Fallback to `DEFAULT_SKILL_PICKS = 2` if class data is missing.

### 8. Feats (ASI/Feat at level 4+)

Conditional step, appears at starting levels 4, 8, 12, 16, 19. Unchanged from current behavior — choose ASI or a feat.

### 9. Spells

Cantrip and leveled spell selection. Available spells filtered by class. Unchanged behavior.

### 10. Equipment

Equipment packs or starting gold. Unchanged behavior.

### 11. Portrait

AI generation via server companion or manual upload. Optional, always complete. Unchanged.

### 12. Review

Full character summary with all sections. Updated to show:
- Species name + traits summary
- Background name + granted skills, tool, languages, origin feat
- Class name + chosen skills
- Ability scores with background bonuses breakdown
- All other existing sections

Edit buttons jump back to relevant steps.

## Type System

```typescript
/** Step IDs in canonical order */
type StepId =
  | "species" | "background" | "originFeat" | "class"
  | "subclass" | "abilities" | "skills" | "feats"
  | "spells" | "equipment" | "portrait" | "review";

interface WizardSelections {
  species?: SpeciesSelection;
  background?: BackgroundSelection;
  originFeat?: OriginFeatSelection;
  class?: ClassSelection;
  subclass?: SubclassSelection;
  abilities?: AbilityScoreState;  // existing type, unchanged
  skills?: SkillSelection;        // class-chosen skills only
  feats?: FeatSelection;          // existing type
  spells?: SpellSelection;        // existing type
  equipment?: EquipmentSelection; // existing type
  portrait?: PortraitSelection;   // existing type
  review?: { characterName: string };
  [key: string]: unknown;         // index signature for state machine
}

interface SpeciesSelection {
  uuid: string;
  name: string;
  img: string;
  traits?: string[];  // display-only summaries parsed from advancement
}

interface BackgroundSelection {
  uuid: string;
  name: string;
  img: string;
  grants: BackgroundGrants;
  asi: BackgroundASI;
  languages: LanguageSelection;
}

interface BackgroundGrants {
  skillProficiencies: string[];     // ["ins", "rel"] — dnd5e skill keys
  toolProficiency: string | null;   // "art:calligrapher" or null
  originFeatUuid: string | null;    // null if background has no feat (homebrew/legacy)
  originFeatName: string | null;
  originFeatImg: string | null;
  asiPoints: number;                // typically 3; 0 if no ASI advancement found
  asiCap: number;                   // typically 2; 0 if no ASI advancement found
  asiSuggested: string[];           // abilities the PHB suggests — UI hint only, not enforced
  languageGrants: string[];         // ["common"] — auto-granted
  languageChoiceCount: number;      // typically 2; 0 if no language advancement found
  languageChoicePool: string[];     // ["languages:standard:*"]
}

interface BackgroundASI {
  assignments: Partial<Record<AbilityKey, number>>;
  // e.g., { wis: 2, cha: 1 } — must sum to grants.asiPoints, each <= grants.asiCap
}

interface LanguageSelection {
  fixed: string[];    // ["common"] — auto-granted from advancement
  chosen: string[];   // player picks (count from grants.languageChoiceCount)
}

interface OriginFeatSelection {
  uuid: string;
  name: string;
  img: string;
  isCustom: boolean;  // true if GM allowed swap and player changed feat
}

interface ClassSelection {
  uuid: string;
  name: string;
  img: string;
  identifier: string;
  skillPool: string[];  // available skill keys from advancement, or all 18 if "skills:*"
  skillCount: number;   // how many to pick (from advancement, fallback 2)
}

interface SubclassSelection {
  uuid: string;
  name: string;
  img: string;
}

interface SkillSelection {
  chosen: string[];  // class-chosen skill keys only (NOT background skills)
}
```

## Compendium Selector Improvements

The module settings compendium selector becomes smarter:

- **Rich previews:** Shows actual entry names per pack (first 3-5 with "+N more"), not just raw counts
- **Source attribution:** Clear labels — "SRD (dnd5e)", "Player's Handbook (dnd-players-handbook)", "Heroes of Faerun (dnd-heroes-faerun)"
- **Overlap detection:** Notes when entries with the same name exist across multiple selected packs
- **Advancement-aware counts:** For backgrounds, shows "N backgrounds (with origin feats)". For classes, shows skill pick counts.

Scanning happens on-demand when the form opens. Lazy document fetch for a sample of entries per pack.

## Actor Creation Engine

Rewritten to orchestrate dnd5e 5.x advancement where possible:

1. Create base Actor (name, type "character")
2. Apply base ability scores from `sel.abilities.scores`
3. Apply background ASI bonuses from `sel.background.asi.assignments` — add to base scores via `actor.update({ "system.abilities.<key>.value": base + bonus })`
4. Embed species item (from `sel.species.uuid`) → dnd5e advancement applies traits
5. Embed background item (from `sel.background.uuid`) — attempt to feed ASI/proficiency/language choices into advancement API; fall back to direct `actor.update()` for:
   - `system.traits.languages.value` — merge fixed + chosen languages
   - `system.skills.<key>.proficient` — set background skill proficiencies
   - Tool proficiency via appropriate trait path
6. Embed origin feat item (from `sel.originFeat.uuid`) — **only if `originFeatUuid` is non-null**
7. Embed class item (from `sel.class.uuid`) → attempt advancement for skill choices; fall back to setting `system.skills.<key>.proficient` for class-chosen skills
8. Embed subclass item (if applicable)
9. Embed additional feat items (ASI level)
10. Embed spell items
11. Apply equipment (items or gold)
12. Upload portrait
13. Set ownership, notify GM via socket

**Key rule for skills:** The engine merges proficiencies from two sources:
- `sel.background.grants.skillProficiencies` (background-granted, fixed)
- `sel.skills.chosen` (class-chosen by player)
Both are set as proficient on the actor. They are tracked separately in wizard state but combined at actor creation time.

**Fallback strategy:** If programmatic advancement application fails (some advancement types expect UI interaction), fall back to direct `actor.update()` calls with computed values. Test advancement API during implementation to determine which path works reliably.

## What We Keep (No Changes)

- `WizardStateMachine` — navigation, cascade, step indicators
- `CompendiumIndexer` — pack loading, caching, item-type filtering, document fetching
- `CharacterCreatorApp` — ApplicationV2 shell, `setDataSilent` / `setData` callbacks, enhanced header
- `cc-shell.hbs` — step indicator bar, nav bar, status hints
- Card-select template + `patchCardSelection` utility
- Settings infrastructure — CC settings popup, compendium selector (enhanced)
- CSS token system, base wizard/step styles, selection preview component
- All existing DOM patching patterns (`setDataSilent`, targeted updates)

## What We Rewrite

- `STEP_ORDER` and `DEPENDENCY_CASCADE` in step-registry / state-machine
- All step files in `steps/*.ts` — new implementations following 2024 flow
- All step templates in `templates/character-creator/cc-step-*.hbs`
- `WizardSelections` and related types in `character-creator-types.ts`
- `ActorCreationEngine` in `engine/actor-creation-engine.ts`
- `dnd5e-constants.ts` — add standard language list, remove hardcoded class skill data

## What We Add

- Advancement parser utility (`data/advancement-parser.ts`) — extracts grants from advancement arrays, returns nullable results for every field
- Background grants panel component (inline ASI picker, language picker)
- Origin feat step definition and template
- Enhanced compendium selector with advancement-aware previews
