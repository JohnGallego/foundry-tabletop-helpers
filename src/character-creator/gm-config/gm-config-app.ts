/**
 * Character Creator — GM Configuration Panel
 *
 * ApplicationV2 (HandlebarsApplicationMixin) with three tabs:
 * Sources, Content Curation, and Rules Configuration.
 *
 * Built via runtime class factory pattern (same as LPCS).
 */

import { MOD, Log } from "../../logger";
import { getUI } from "../../types";
import type { FoundryCompendiumCollection } from "../../types";
import { getGame } from "../../types";
import type {
  PackSourceConfig,
  CreatorContentType,
  PackEntry,
  SourcesTabViewModel,
  CurationTabViewModel,
  CurationEntry,
  RulesConfigViewModel,
  GMConfigAppContext,
} from "../character-creator-types";
import { CONTENT_TYPE_LABELS } from "../character-creator-types";
import {
  getPackSources,
  setPackSources,
  setDisabledContentUUIDs,
  getAllowedAbilityMethods,
  setAllowedAbilityMethods,
  getStartingLevel,
  allowMulticlass,
  getEquipmentMethod,
  getLevel1HpMethod,
  CC_SETTINGS,
} from "../character-creator-settings";
import { setSetting } from "../../types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { ContentFilter } from "../data/content-filter";

/* ── Runtime Foundry Class Resolution ────────────────────── */

const getFoundryAppClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: (api?.api as Record<string, unknown> | undefined)
      ?.HandlebarsApplicationMixin as ((...args: unknown[]) => unknown) | undefined,
    ApplicationV2: (api?.api as Record<string, unknown> | undefined)
      ?.ApplicationV2 as (new (...args: unknown[]) => unknown) | undefined,
  };
};

/* ── Module-Level State ──────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _GMConfigAppClass: (new () => any) | null = null;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Build the GMConfigApp class at runtime once Foundry globals are available.
 * Call during the `init` hook.
 */
export function buildGMConfigAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();

  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Character Creator: ApplicationV2 not available — GM Config disabled");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Base = (HandlebarsApplicationMixin as any)(ApplicationV2);

  class GMConfigApp extends Base {

    /* ── Instance State ────────────────────────────────────── */

    /** Whether compendium data for the curation tab has been loaded. */
    private _curationLoaded = false;

    /** In-memory content filter (mutated by toggle actions, saved explicitly). */
    private _filter: ContentFilter | null = null;

    /** Current search text for curation filtering. */
    private _searchText = "";

    /* ── Static Configuration ──────────────────────────────── */

    static DEFAULT_OPTIONS = {
      id: "fth-gm-config",
      classes: ["fth-character-creator", "fth-gm-config"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-hat-wizard",
        title: "Character Creator — GM Configuration",
      },
      position: { width: 720, height: 580 },
      actions: {
        togglePack: GMConfigApp._onTogglePack,
        toggleContent: GMConfigApp._onToggleContent,
        enableAll: GMConfigApp._onEnableAll,
        disableAll: GMConfigApp._onDisableAll,
        saveRules: GMConfigApp._onSaveRules,
        searchContent: GMConfigApp._onSearchContent,
      },
    };

    static PARTS = {
      tabs: { template: `modules/${MOD}/templates/character-creator/cc-gm-tabs.hbs` },
      sources: { template: `modules/${MOD}/templates/character-creator/cc-gm-sources.hbs`, scrollable: [".cc-gm-sources-list"] },
      curation: { template: `modules/${MOD}/templates/character-creator/cc-gm-curation.hbs`, scrollable: [".cc-gm-curation-list"] },
      rules: { template: `modules/${MOD}/templates/character-creator/cc-gm-rules.hbs` },
    };

    tabGroups = { main: "sources" };

    /* ── Rendering ─────────────────────────────────────────── */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _prepareContext(_options: any): Promise<GMConfigAppContext> {
      const activeTab = this.tabGroups["main"] ?? "sources";

      const tabs: GMConfigAppContext["tabs"] = {
        sources: {
          id: "sources",
          label: "Content Sources",
          icon: "fa-solid fa-books",
          active: activeTab === "sources",
        },
        curation: {
          id: "curation",
          label: "Content Curation",
          icon: "fa-solid fa-filter",
          active: activeTab === "curation",
        },
        rules: {
          id: "rules",
          label: "Rules Config",
          icon: "fa-solid fa-gavel",
          active: activeTab === "rules",
        },
      };

      const context: GMConfigAppContext = { tabs, activeTab };

      // Build only the active tab's data
      if (activeTab === "sources") {
        context.sources = this._buildSourcesViewModel();
      } else if (activeTab === "curation") {
        context.curation = this._buildCurationViewModel();
      } else if (activeTab === "rules") {
        context.rules = this._buildRulesViewModel();
      }

      return context;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _preparePartContext(partId: string, context: any, options: any): Promise<any> {
      const base = await super._preparePartContext(partId, context, options);
      const activeTab = context.activeTab;

      // Only pass data for the active tab's part
      if (partId === "tabs") return { ...base, tabs: context.tabs, activeTab };
      if (partId === "sources") return { ...base, active: activeTab === "sources", ...context.sources };
      if (partId === "curation") return { ...base, active: activeTab === "curation", ...context.curation };
      if (partId === "rules") return { ...base, active: activeTab === "rules", ...context.rules };

      return base;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _onRender(_context: any, _options: any): Promise<void> {
      // Bind tab click handlers
      const tabButtons = this.element?.querySelectorAll("[data-tab]");
      tabButtons?.forEach((btn: Element) => {
        btn.addEventListener("click", () => {
          const tab = (btn as HTMLElement).dataset.tab;
          if (!tab) return;
          this.tabGroups["main"] = tab;

          // Lazy-load curation data on first activation
          if (tab === "curation" && !this._curationLoaded) {
            this._loadCurationData();
          } else {
            this.render({ force: false });
          }
        });
      });
    }

    /* ── Tab Data Builders ─────────────────────────────────── */

    private _buildSourcesViewModel(): SourcesTabViewModel {
      const game = getGame();
      const currentSources = getPackSources();
      const allEnabledPacks = new Set<string>();

      // Collect all currently enabled pack IDs
      for (const packIds of Object.values(currentSources)) {
        for (const id of packIds) allEnabledPacks.add(id);
      }

      // Build pack entries from available packs
      const packsByType = new Map<CreatorContentType, PackEntry[]>();

      if (game?.packs) {
        for (const pack of game.packs) {
          const cc = pack as FoundryCompendiumCollection;
          if (cc.documentName !== "Item") continue;

          const collection = cc.collection;
          const contentTypes = this._detectContentTypes(cc);
          if (contentTypes.length === 0) continue;

          const entry: PackEntry = {
            collection,
            label: cc.metadata?.label ?? cc.metadata?.name ?? collection,
            packageName: cc.metadata?.packageName ?? cc.metadata?.package ?? "",
            itemCount: cc.size ?? 0,
            enabled: allEnabledPacks.has(collection),
            contentTypes,
          };

          // Group by primary content type
          const primaryType = contentTypes[0];
          const group = packsByType.get(primaryType) ?? [];
          group.push(entry);
          packsByType.set(primaryType, group);
        }
      }

      // Build ordered groups
      const typeOrder: CreatorContentType[] = ["class", "subclass", "race", "background", "feat", "spell", "item"];
      const groups = typeOrder
        .filter((t) => packsByType.has(t))
        .map((t) => ({
          type: t,
          label: CONTENT_TYPE_LABELS[t],
          packs: packsByType.get(t) ?? [],
        }));

      return { groups };
    }

    private _buildCurationViewModel(): CurationTabViewModel {
      if (!this._curationLoaded) {
        return { loaded: false, groups: [] };
      }

      if (!this._filter) {
        this._filter = ContentFilter.fromSettings();
      }

      const sources = getPackSources();
      const typeOrder: CreatorContentType[] = ["class", "subclass", "race", "background", "feat", "spell", "item"];
      const searchLower = this._searchText.toLowerCase();

      const groups = typeOrder.map((type) => {
        let entries = compendiumIndexer.getIndexedEntries(type, sources);

        // Apply search filter
        if (searchLower) {
          entries = entries.filter((e) =>
            e.name.toLowerCase().includes(searchLower) ||
            e.packLabel.toLowerCase().includes(searchLower),
          );
        }

        const curationEntries: CurationEntry[] = entries.map((e) => ({
          ...e,
          enabled: this._filter!.isEnabled(e.uuid),
        }));

        return {
          type,
          label: CONTENT_TYPE_LABELS[type],
          entries: curationEntries,
          enabledCount: curationEntries.filter((e) => e.enabled).length,
          totalCount: curationEntries.length,
        };
      }).filter((g) => g.totalCount > 0);

      return { loaded: true, groups };
    }

    private _buildRulesViewModel(): RulesConfigViewModel {
      const methods = getAllowedAbilityMethods();
      return {
        allowedAbilityMethods: {
          "4d6": methods.includes("4d6"),
          pointBuy: methods.includes("pointBuy"),
          standardArray: methods.includes("standardArray"),
        },
        startingLevel: getStartingLevel(),
        allowMulticlass: allowMulticlass(),
        equipmentMethod: getEquipmentMethod(),
        level1HpMethod: getLevel1HpMethod(),
      };
    }

    /* ── Helpers ────────────────────────────────────────────── */

    private _detectContentTypes(pack: FoundryCompendiumCollection): CreatorContentType[] {
      const types: CreatorContentType[] = [];
      const packType = pack.metadata?.type;

      // Use metadata type hint if available
      if (packType === "Item") {
        // Check pack name/label for hints
        const label = (pack.metadata?.label ?? "").toLowerCase();
        const name = (pack.metadata?.name ?? "").toLowerCase();
        const combined = `${label} ${name}`;

        if (combined.includes("class") && !combined.includes("subclass")) types.push("class");
        if (combined.includes("subclass")) types.push("subclass");
        if (combined.includes("race") || combined.includes("species")) types.push("race");
        if (combined.includes("background")) types.push("background");
        if (combined.includes("feat")) types.push("feat");
        if (combined.includes("spell")) types.push("spell");
        if (combined.includes("item") || combined.includes("equipment")) types.push("item");

        // If no specific match, mark as general item pack
        if (types.length === 0) types.push("item");
      }

      return types;
    }

    private async _loadCurationData(): Promise<void> {
      const sources = getPackSources();
      await compendiumIndexer.loadPacks(sources);
      this._curationLoaded = true;
      this._filter = ContentFilter.fromSettings();
      this.render({ force: false });
    }

    /* ── Action Handlers ───────────────────────────────────── */

    static async _onTogglePack(this: InstanceType<typeof GMConfigApp>, _event: Event, target: HTMLElement): Promise<void> {
      const packId = target.dataset.packId;
      const typeKey = target.dataset.typeKey as keyof PackSourceConfig | undefined;
      if (!packId || !typeKey) return;

      const sources = getPackSources();
      const current = sources[typeKey] ?? [];
      const isChecked = (target as HTMLInputElement).checked;

      if (isChecked && !current.includes(packId)) {
        sources[typeKey] = [...current, packId];
      } else if (!isChecked) {
        sources[typeKey] = current.filter((id) => id !== packId);
      }

      await setPackSources(sources);
      compendiumIndexer.invalidate();
      this._curationLoaded = false;
      this.render({ force: false });
    }

    static async _onToggleContent(this: InstanceType<typeof GMConfigApp>, _event: Event, target: HTMLElement): Promise<void> {
      const uuid = target.dataset.uuid;
      if (!uuid || !this._filter) return;

      const isChecked = (target as HTMLInputElement).checked;
      this._filter.toggle(uuid, isChecked);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onEnableAll(this: InstanceType<typeof GMConfigApp>, _event: Event, target: HTMLElement): Promise<void> {
      const type = target.dataset.type as CreatorContentType | undefined;
      if (!type || !this._filter) return;

      const sources = getPackSources();
      const entries = compendiumIndexer.getIndexedEntries(type, sources);
      this._filter.enableAll(entries);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onDisableAll(this: InstanceType<typeof GMConfigApp>, _event: Event, target: HTMLElement): Promise<void> {
      const type = target.dataset.type as CreatorContentType | undefined;
      if (!type || !this._filter) return;

      const sources = getPackSources();
      const entries = compendiumIndexer.getIndexedEntries(type, sources);
      this._filter.disableAll(entries);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onSaveRules(this: InstanceType<typeof GMConfigApp>, _event: Event, _target: HTMLElement): Promise<void> {
      const form = this.element?.querySelector(".cc-rules-form") as HTMLFormElement | null;
      if (!form) return;

      // Ability methods
      const methods: string[] = [];
      if ((form.querySelector('[name="method-4d6"]') as HTMLInputElement)?.checked) methods.push("4d6");
      if ((form.querySelector('[name="method-pointBuy"]') as HTMLInputElement)?.checked) methods.push("pointBuy");
      if ((form.querySelector('[name="method-standardArray"]') as HTMLInputElement)?.checked) methods.push("standardArray");
      await setAllowedAbilityMethods(methods as import("../character-creator-types").AbilityScoreMethod[]);

      // Scalar settings
      const level = Number((form.querySelector('[name="startingLevel"]') as HTMLInputElement)?.value) || 1;
      await setSetting(MOD, CC_SETTINGS.STARTING_LEVEL, Math.max(1, Math.min(20, level)));

      const multiclass = (form.querySelector('[name="allowMulticlass"]') as HTMLInputElement)?.checked ?? false;
      await setSetting(MOD, CC_SETTINGS.ALLOW_MULTICLASS, multiclass);

      const equipMethod = (form.querySelector('[name="equipmentMethod"]:checked') as HTMLInputElement)?.value ?? "both";
      await setSetting(MOD, CC_SETTINGS.EQUIPMENT_METHOD, equipMethod);

      const hpMethod = (form.querySelector('[name="level1HpMethod"]:checked') as HTMLInputElement)?.value ?? "max";
      await setSetting(MOD, CC_SETTINGS.LEVEL1_HP_METHOD, hpMethod);

      getUI()?.notifications?.info("Character Creator configuration saved.");
    }

    static _onSearchContent(this: InstanceType<typeof GMConfigApp>, _event: Event, target: HTMLElement): void {
      const input = target as HTMLInputElement;
      this._searchText = input.value ?? "";
      this.render({ parts: ["curation"] });
    }
  }

  _GMConfigAppClass = GMConfigApp;
  Log.debug("Character Creator: GMConfigApp class built");
}

/**
 * Open the GM Configuration panel.
 * Safe to call at any time — silently no-ops if the class isn't built yet.
 */
export function openGMConfigApp(): void {
  if (!_GMConfigAppClass) {
    Log.warn("Character Creator: GMConfigApp not available");
    return;
  }
  new _GMConfigAppClass().render({ force: true });
}
