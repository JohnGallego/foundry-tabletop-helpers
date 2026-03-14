---
paths:
  - "src/**/*.ts"
  - "templates/**/*.hbs"
---

# Foundry VTT V13 & dnd5e 5.x API Rules

Hard-won knowledge specific to this codebase. Each rule prevents a real debugging session.

## Foundry V13 API

### Scene control buttons are object-keyed, not array-based

V13 changed `getSceneControlButtons` — `controls` is a `Record<string, ControlGroup>` where each group's `tools` is also a `Record<string, Tool>`. Don't push to arrays.

```ts
// CORRECT (V13)
controls.tokens.tools["my-tool"] = { name: "my-tool", ... };

// WRONG (V12 pattern)
controls.find(c => c.name === "token").tools.push({ ... });
```

### ApplicationV2 vs V1 FormApplication

New UI should use ApplicationV2 with HandlebarsApplicationMixin. However, **settings submenus (`registerMenu`) still require V1 FormApplication** — Foundry's settings system hasn't migrated yet. The codebase uses `getFormApplicationClass()` for these.

### `foundry.utils.mergeObject` with `inplace: false`

Always pass `{inplace: false}` when merging `defaultOptions` to avoid mutating the parent class options object.

### Template paths

Templates must be referenced as `modules/${MOD}/templates/...` at runtime. The `templates/` directory is copied to `dist/` via Vite's `publicDir` setting.

### Hook timing

- `init`: Settings, hooks, templates. `game.user` is NOT available.
- `setup`: `game.user` IS available. Override pickers here.
- `ready`: Everything available. Attach socket listeners, auto-open UIs, expose API.

## dnd5e 5.x System

### Activities model (dnd5e >= 4.0.0)

Items use `item.system.activities` (a Collection) instead of `item.system.activation` + `item.system.damage.parts`. Always guard with `isDnd5eActivitiesSupported()` from guards.

### Compendium access

Use `game.packs.get("dnd5e.spells")` etc. Index entries have `system` data only if you call `getIndex({ fields: [...] })` with the fields you need.

### Actor data paths

- HP: `actor.system.attributes.hp.value` / `.max` / `.temp`
- AC: `actor.system.attributes.ac.value`
- Abilities: `actor.system.abilities[key].value` (key: str, dex, con, int, wis, cha)
- Skills: `actor.system.skills[key].total`
- Spell slots: `actor.system.spells[`spell${level}`].value` / `.max`

### Item types in dnd5e

`weapon`, `equipment`, `consumable`, `tool`, `loot`, `background`, `class`, `subclass`, `spell`, `feat`, `race` (species in 5.5e but type is still `race`)
