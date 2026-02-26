/**
 * D&D 5e (2024) data extractor.
 * Pulls character, NPC, encounter-group, and party-summary data
 * from dnd5e actor documents.
 */

import { Log } from "../../logger";
import { getGame } from "../../types";
import { BaseExtractor, registerExtractor } from "./base-extractor";
import type { PrintOptions, SectionDef, SheetType } from "../types";
import type {
  CharacterData, NPCData, EncounterGroupData, PartySummaryData,
  PartyMemberSummary, FeatureData, CharacterActions, WeaponActionData,
} from "./dnd5e-types";
import type {
  Dnd5eDamageData, Dnd5eRecoveryData, Dnd5eUsesData,
  Dnd5eSaveActivityData, Dnd5eRangeData,
  Dnd5eEmbedContext, Dnd5eEmbedAction, Dnd5eEmbedActionSections,
} from "./dnd5e-system-types";
import { getFirstFromSetOrArray } from "./dnd5e-system-types";
import {
  buildFavoritesSet, resolveTraitSet,
  extractAbilities, extractSkills, extractCombat, extractDetails,
  extractTraits, extractSpellcasting, extractInventory, extractFeatures,
} from "./dnd5e-extract-helpers";

export class Dnd5eExtractor extends BaseExtractor {
  readonly systemId = "dnd5e";

  getSections(type: SheetType): SectionDef[] {
    switch (type) {
      case "character":
        return [
          { key: "abilities",  label: "Ability Scores & Saves", default: true },
          { key: "skills",     label: "Skills",                 default: true },
          { key: "combat",     label: "Combat Stats",           default: true },
          { key: "actions",    label: "Actions",                default: true },
          { key: "features",   label: "Features & Traits",      default: true },
          { key: "spells",     label: "Spellcasting",           default: true },
          { key: "inventory",  label: "Inventory",              default: true },
          { key: "backstory",  label: "Backstory & Notes",      default: true },
          { key: "reference",  label: "Rules Reference Page",   default: true },
        ];
      case "npc":
        return [
          { key: "stats",      label: "Core Stats",             default: true },
          { key: "traits",     label: "Traits",                 default: true },
          { key: "actions",    label: "Actions",                default: true },
          { key: "legendary",  label: "Legendary Actions",      default: true },
          { key: "lair",       label: "Lair Actions",           default: true },
          { key: "spells",     label: "Spellcasting",           default: true },
        ];
      case "encounter":
        return [
          { key: "statblocks", label: "NPC Stat Blocks",        default: true },
        ];
      case "party":
        return [
          { key: "summary",    label: "Party Summary Table",    default: true },
          { key: "skills",     label: "Top Skills per Member",  default: true },
        ];
    }
  }

  /* ── Character ──────────────────────────────────────────── */

  async extractCharacter(actor: any, _options: PrintOptions): Promise<CharacterData> {
    Log.info("dnd5e: extracting character", { name: actor?.name });
    const favorites = buildFavoritesSet(actor);

    // Try to use embed context for actions (same approach as NPCs)
    const actions = await this.extractCharacterActions(actor, favorites);

    return {
      name: actor.name ?? "Unknown",
      img: actor.img ?? "",
      tokenImg: actor.prototypeToken?.texture?.src ?? "",
      details: extractDetails(actor),
      abilities: extractAbilities(actor),
      skills: extractSkills(actor),
      combat: extractCombat(actor),
      actions,
      spellcasting: extractSpellcasting(actor, favorites),
      inventory: extractInventory(actor, favorites),
      features: extractFeatures(actor, favorites),
      proficiencies: this.extractProficiencies(actor),
      favorites,
      backstory: actor.system?.details?.biography?.value ?? "",
      traits: extractTraits(actor),
    };
  }

  /**
   * Extract character proficiencies (armor, weapons, tools, weapon masteries).
   */
  private extractProficiencies(actor: any): { armor: string[]; weapons: string[]; tools: string[]; weaponMasteries: string[] } {
    const traits = actor.system?.traits ?? {};

    // Armor proficiencies
    const armorProfs = this.resolveProfs(traits.armorProf, "armor");

    // Weapon proficiencies
    const weaponProfs = this.resolveProfs(traits.weaponProf, "weapon");

    // Tool proficiencies - check multiple locations for dnd5e 5.x compatibility
    let toolProfs = this.resolveProfs(traits.toolProf, "tool");

    // dnd5e 5.x may store tool proficiencies in actor.system.tools
    // Format: { jeweler: { value: 1, ability: "..." }, ... }
    if (toolProfs.length === 0 && actor.system?.tools) {
      const toolsObj = actor.system.tools;
      for (const [key, tool] of Object.entries(toolsObj)) {
        const t = tool as any;
        // Only include if proficient (value >= 1)
        if (t?.value >= 1) {
          const fullName = this.getProficiencyFullName(key, "tool");
          toolProfs.push(fullName);
        }
      }
    }

    // Also check for tool items the character is proficient with
    if (toolProfs.length === 0) {
      const toolItems = actor.items?.filter?.((i: any) => i.type === "tool") ?? [];
      for (const item of toolItems) {
        // Check if character is proficient with this tool
        if (item.system?.proficient >= 1 || item.system?.prof?.hasProficiency) {
          toolProfs.push(item.name);
        }
      }
    }

    // Weapon masteries - dnd5e 5.x stores in traits.weaponProf.mastery.value as a Set
    const weaponMasteries: string[] = [];
    const masterySet = traits.weaponProf?.mastery?.value;
    if (masterySet) {
      // Convert Set or array to array of weapon identifiers
      const masteryArr = masterySet instanceof Set ? [...masterySet] :
        Array.isArray(masterySet) ? masterySet : [];
      for (const weaponId of masteryArr) {
        // Convert weapon identifier to display name (e.g., "battleaxe" -> "Battleaxe")
        const displayName = this.capitalizeFirst(String(weaponId).replace(/-/g, " "));
        weaponMasteries.push(displayName);
      }
    }

    return {
      armor: armorProfs,
      weapons: weaponProfs,
      tools: toolProfs,
      weaponMasteries,
    };
  }

  /**
   * Resolve proficiency trait set to array of labels.
   */
  private resolveProfs(traitObj: any, type: "armor" | "weapon" | "tool" = "tool"): string[] {
    if (!traitObj) return [];
    const results: string[] = [];

    // Handle custom entries first
    const custom = traitObj.custom;
    if (custom && typeof custom === "string") {
      const parts = custom.split(";").map((s: string) => s.trim()).filter(Boolean);
      results.push(...parts);
    }

    // Handle value array/Set
    const values = traitObj.value;
    if (values) {
      const arr = values instanceof Set ? Array.from(values) :
                  Array.isArray(values) ? values : [];
      for (const v of arr) {
        if (typeof v === "string" && v) {
          // Map abbreviations to full names
          const fullName = this.getProficiencyFullName(v, type);
          results.push(fullName);
        }
      }
    }

    return results;
  }

  /**
   * Convert proficiency abbreviations to full names.
   */
  private getProficiencyFullName(abbrev: string, type: "armor" | "weapon" | "tool"): string {
    // Armor proficiencies
    const armorMap: Record<string, string> = {
      lgt: "Light Armor",
      med: "Medium Armor",
      hvy: "Heavy Armor",
      shl: "Shields",
    };

    // Weapon proficiencies
    const weaponMap: Record<string, string> = {
      sim: "Simple Weapons",
      mar: "Martial Weapons",
    };

    // Tool proficiencies (most are already full names)
    const toolMap: Record<string, string> = {
      alchemist: "Alchemist's Supplies",
      brewer: "Brewer's Supplies",
      calligrapher: "Calligrapher's Supplies",
      carpenter: "Carpenter's Tools",
      cartographer: "Cartographer's Tools",
      cobbler: "Cobbler's Tools",
      cook: "Cook's Utensils",
      glassblower: "Glassblower's Tools",
      jeweler: "Jeweler's Tools",
      leatherworker: "Leatherworker's Tools",
      mason: "Mason's Tools",
      painter: "Painter's Supplies",
      potter: "Potter's Tools",
      smith: "Smith's Tools",
      tinker: "Tinker's Tools",
      weaver: "Weaver's Tools",
      woodcarver: "Woodcarver's Tools",
      disguise: "Disguise Kit",
      forgery: "Forgery Kit",
      herbalism: "Herbalism Kit",
      poisoner: "Poisoner's Kit",
      navigator: "Navigator's Tools",
      thief: "Thieves' Tools",
      vehicle: "Vehicles",
    };

    const lower = abbrev.toLowerCase();

    if (type === "armor" && armorMap[lower]) {
      return armorMap[lower];
    }
    if (type === "weapon" && weaponMap[lower]) {
      return weaponMap[lower];
    }
    if (type === "tool" && toolMap[lower]) {
      return toolMap[lower];
    }

    // Default: capitalize first letter
    return abbrev.charAt(0).toUpperCase() + abbrev.slice(1);
  }

  /**
   * Extract character actions with structured weapon data for table display.
   */
  private async extractCharacterActions(
    actor: any,
    favorites: Set<string>,
  ): Promise<CharacterActions> {
    const result: CharacterActions = {
      weapons: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      other: [],
    };

    const items = actor.items?.contents ?? [];
    Log.debug("Character actions extraction", {
      name: actor.name,
      itemCount: items.length,
    });

    for (const item of items) {
      // Extract weapons into structured format
      if (item.type === "weapon") {
        const weaponData = this.extractWeaponActionData(item, actor, favorites);
        if (weaponData) {
          result.weapons.push(weaponData);
        }
        continue;
      }

      // Skip non-action items
      if (item.type === "spell" || item.type === "equipment" || item.type === "loot" ||
          item.type === "consumable" || item.type === "backpack" || item.type === "tool") {
        continue;
      }

      // Check for activities or activation type
      const activities = item.system?.activities;
      const hasActivities = activities && (
        (activities instanceof Map && activities.size > 0) ||
        (typeof activities.size === "number" && activities.size > 0) ||
        (typeof activities === "object" && Object.keys(activities).length > 0)
      );
      const activation = item.system?.activation?.type;
      if (!hasActivities && !activation) continue;

      // Determine activation type
      let activationType = "action";
      if (activation) {
        activationType = activation;
      } else if (hasActivities) {
        try {
          const actValues = activities instanceof Map ? [...activities.values()] :
            typeof activities.values === "function" ? [...activities.values()] :
            Object.values(activities);
          if (actValues.length > 0 && actValues[0]?.activation?.type) {
            activationType = actValues[0].activation.type;
          }
        } catch { /* Keep default */ }
      }

      const featureData: FeatureData = {
        name: item.name ?? "",
        description: this.stripEnrichedText(item.system?.description?.value ?? "", actor.name),
        uses: null,
        isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
        itemType: item.type,
      };

      // Add uses if present - extract recovery period from dnd5e 5.x structure
      const uses = item.system?.uses;
      if (uses?.max) {
        featureData.uses = this.extractItemUses(item);
      }

      // Special handling for "other" actions like Sneak Attack (no activation but special)
      const isOther = item.type === "feat" && !activation &&
        (item.name.toLowerCase().includes("sneak attack") ||
         item.system?.type?.value === "class");

      // Categorize by activation type
      if (isOther) {
        result.other.push(featureData);
      } else if (activationType === "action" || activationType === "attack") {
        result.actions.push(featureData);
      } else if (activationType === "bonus") {
        result.bonusActions.push(featureData);
      } else if (activationType === "reaction") {
        result.reactions.push(featureData);
      }
    }

    Log.debug("Character actions extraction results", {
      name: actor.name,
      weapons: result.weapons.length,
      actions: result.actions.length,
      bonusActions: result.bonusActions.length,
      reactions: result.reactions.length,
      other: result.other.length,
    });

    return result;
  }

  /**
   * Extract structured weapon data for table display.
   */
  private extractWeaponActionData(item: any, actor: any, favorites: Set<string>): WeaponActionData | null {
    try {
      const sys = item.system;
      const labels = item.labels ?? {};

      // Determine weapon type
      const attackType = sys?.attackType ?? "melee";
      const isThrown = sys?.properties?.has?.("thr") ?? false;
      let weaponType = attackType === "melee" ? "Melee Weapon" : "Ranged Weapon";
      if (isThrown && attackType === "melee") {
        weaponType = "Melee or Ranged Weapon";
      }

      // Get mastery and check if character has mastered this weapon type
      const mastery = sys?.mastery ? this.formatMastery(sys.mastery) : "";

      // Check if character has mastered this weapon type
      // Character masteries are stored as weapon base item names (e.g., "longsword", "battleaxe")
      let hasMastery = false;
      if (mastery) {
        const baseItem = sys?.type?.baseItem ?? "";
        const masterySet = actor?.system?.traits?.weaponProf?.mastery?.value;
        if (masterySet) {
          const masteryArr = masterySet instanceof Set ? [...masterySet] :
            Array.isArray(masterySet) ? masterySet : [];
          hasMastery = masteryArr.some((w: string) =>
            w.toLowerCase() === baseItem.toLowerCase() ||
            w.toLowerCase().replace(/-/g, " ") === baseItem.toLowerCase().replace(/-/g, " ")
          );
        }
      }

      // Get range/reach
      const range = sys?.range ?? {};
      let rangeStr = "";
      let rangeType = "";
      if (attackType === "melee" && !isThrown) {
        const reach = range.reach ?? 5;
        rangeStr = `${reach} ft.`;
        rangeType = "Reach";
      } else if (isThrown) {
        const short = range.value ?? 20;
        const long = range.long ?? short * 3;
        rangeStr = `${short} (${long})`;
        rangeType = "";
      } else {
        const short = range.value ?? 80;
        const long = range.long ?? short;
        rangeStr = short === long ? `${short}` : `${short} (${long})`;
        rangeType = "";
      }

      // Get to-hit modifier
      let toHit = labels.modifier ?? labels.toHit ?? "";
      if (toHit && !toHit.startsWith("+") && !toHit.startsWith("-")) {
        toHit = "+" + toHit;
      }

      // Get damage formula from activities (dnd5e 5.x)
      // Structure: activity.damage.parts[] = {number, denomination, bonus, types}
      let damageFormula = "";
      let damageTypes = "";
      let hasAbilityMod = false; // Track if @mod is included in formula

      // Try to get damage from activities
      const activities = sys?.activities;
      if (activities) {
        try {
          const actValues = activities instanceof Map ? [...activities.values()] :
            typeof activities.values === "function" ? [...activities.values()] :
            Object.values(activities);

          if (actValues.length > 0) {
            const activity = actValues[0];
            // Get damage parts - can be array or Collection
            let damageParts: any[] = [];
            const rawParts = activity?.damage?.parts;
            if (rawParts) {
              if (Array.isArray(rawParts)) {
                damageParts = rawParts;
              } else if (typeof rawParts.forEach === "function") {
                rawParts.forEach((p: any) => damageParts.push(p));
              } else if (typeof rawParts === "object") {
                damageParts = Object.values(rawParts);
              }
            }

            if (damageParts.length > 0) {
              const firstDamage = damageParts[0];

              // dnd5e 5.x format: {number, denomination, bonus, types}
              if (firstDamage?.number && firstDamage?.denomination) {
                damageFormula = `${firstDamage.number}d${firstDamage.denomination}`;
                if (firstDamage.bonus) {
                  damageFormula += ` + ${firstDamage.bonus}`;
                  hasAbilityMod = firstDamage.bonus.includes("@mod") ||
                                  firstDamage.bonus.includes("@str") ||
                                  firstDamage.bonus.includes("@dex");
                }
              } else if (typeof firstDamage === "string") {
                // Legacy string format
                damageFormula = firstDamage;
                hasAbilityMod = firstDamage.includes("@mod") ||
                                firstDamage.includes("@str") ||
                                firstDamage.includes("@dex");
              } else if (firstDamage?.formula) {
                damageFormula = firstDamage.formula;
                hasAbilityMod = firstDamage.formula.includes("@mod") ||
                                firstDamage.formula.includes("@str") ||
                                firstDamage.formula.includes("@dex");
              } else if (Array.isArray(firstDamage)) {
                // Legacy array format: ["1d8 + @mod", "slashing"]
                damageFormula = firstDamage[0] ?? "";
                hasAbilityMod = damageFormula.includes("@mod") ||
                                damageFormula.includes("@str") ||
                                damageFormula.includes("@dex");
              }

              // Get damage types - can be Set or Array
              const types = firstDamage?.types;
              if (types) {
                const typeArr = types instanceof Set ? [...types] :
                  Array.isArray(types) ? types : [];
                damageTypes = typeArr.map((t: string) => this.capitalizeFirst(t)).join(", ");
              } else if (Array.isArray(firstDamage) && firstDamage[1]) {
                damageTypes = this.capitalizeFirst(firstDamage[1]);
              }
            }
          }
        } catch {
          // Fall back to labels
        }
      }

      // Fallback to labels if activity extraction failed
      if (!damageFormula) {
        damageFormula = labels.damage ?? sys?.damage?.base?.formula ?? "";
        hasAbilityMod = damageFormula.includes("@mod") ||
                        damageFormula.includes("@str") ||
                        damageFormula.includes("@dex");
      }
      if (!damageTypes) {
        const baseTypes = sys?.damage?.base?.types;
        const typesArray: string[] = baseTypes ? Array.from(baseTypes as Iterable<string>) : [];
        damageTypes = labels.damageTypes ??
          typesArray.map((t) => this.capitalizeFirst(t)).join(", ") ?? "";
      }

      // Calculate the ability modifier for this weapon
      const str = actor?.system?.abilities?.str?.mod ?? 0;
      const dex = actor?.system?.abilities?.dex?.mod ?? 0;
      const isFinesse = sys?.properties?.has?.("fin") ?? false;
      const abilityMod = isFinesse ? Math.max(str, dex) : (attackType === "melee" ? str : dex);

      // For weapons, add ability modifier if not already present
      // Weapon attacks in D&D 5e add ability mod to both attack and damage
      if (!hasAbilityMod && damageFormula && abilityMod !== 0) {
        const modStr = abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod);
        damageFormula += modStr;
      }

      // Replace @mod with actual modifier value for cleaner display
      if (damageFormula.includes("@mod") && actor?.system?.abilities) {
        damageFormula = damageFormula.replace(/@mod/g, abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod));
      }
      // Also replace @str, @dex if present
      if (damageFormula.includes("@str") && actor?.system?.abilities?.str) {
        damageFormula = damageFormula.replace(/@str/g, str >= 0 ? `+${str}` : String(str));
      }
      if (damageFormula.includes("@dex") && actor?.system?.abilities?.dex) {
        damageFormula = damageFormula.replace(/@dex/g, dex >= 0 ? `+${dex}` : String(dex));
      }
      // Clean up double plus signs and format
      damageFormula = damageFormula.replace(/\s*\+\s*/g, "+").replace(/\s*-\s*/g, "-");
      damageFormula = damageFormula.replace(/\+\+/g, "+").replace(/\+-/g, "-").replace(/-\+/g, "-");

      // Get weapon properties
      const properties = this.extractWeaponProperties(sys);

      return {
        name: item.name ?? "",
        weaponType,
        mastery,
        hasMastery,
        range: rangeStr,
        rangeType,
        toHit,
        damage: damageFormula,
        damageType: damageTypes,
        properties,
        isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
      };
    } catch (err) {
      Log.warn("Failed to extract weapon action data", { item: item?.name, err: String(err) });
      return null;
    }
  }

  /**
   * Extract weapon properties as a formatted string.
   */
  private extractWeaponProperties(sys: any): string {
    const props: string[] = [];

    // Get weapon type label (Simple/Martial)
    const weaponType = sys?.type?.value ?? "";
    if (weaponType.startsWith("simple")) {
      props.push("Simple");
    } else if (weaponType.startsWith("martial")) {
      props.push("Martial");
    }

    // Get properties from the Set
    const propSet = sys?.properties;
    if (propSet && typeof propSet.has === "function") {
      const propMap: Record<string, string> = {
        amm: "Ammunition",
        fin: "Finesse",
        hvy: "Heavy",
        lgt: "Light",
        lod: "Loading",
        rch: "Reach",
        rel: "Reload",
        ret: "Returning",
        spc: "Special",
        thr: "Thrown",
        two: "Two-Handed",
        ver: "Versatile",
        mgc: "Magical",
      };

      for (const [key, label] of Object.entries(propMap)) {
        if (propSet.has(key)) {
          props.push(label);
        }
      }
    }

    // Add mastery name if present
    if (sys?.mastery) {
      props.push(this.formatMastery(sys.mastery));
    }

    return props.join(", ");
  }

  /**
   * Format mastery name (capitalize first letter).
   */
  private formatMastery(mastery: string): string {
    if (!mastery) return "";
    return mastery.charAt(0).toUpperCase() + mastery.slice(1);
  }

  /**
   * Capitalize first letter of a string.
   */
  private capitalizeFirst(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ── NPC ────────────────────────────────────────────────── */

  async extractNPC(actor: any, options: PrintOptions): Promise<NPCData> {
    Log.info("dnd5e: extracting NPC", { name: actor?.name });
    const favorites = buildFavoritesSet(actor);

    // Use the dnd5e system's built-in embed context preparation
    // This gives us properly formatted descriptions with resolved formulas
    let embedContext: any = null;
    const hasEmbedMethod = typeof actor.system?._prepareEmbedContext === "function";

    if (hasEmbedMethod) {
      try {
        embedContext = await actor.system._prepareEmbedContext("2024");
        Log.debug("Using _prepareEmbedContext for NPC", { name: actor.name });
      } catch (err) {
        Log.warn("Failed to get embed context, using manual extraction", { name: actor.name, err: String(err) });
      }
    }

    // If we have embed context, use it for actions; otherwise fall back to manual extraction
    if (embedContext) {
      return this.extractNPCFromEmbedContext(actor, embedContext, favorites, options);
    } else {
      return this.extractNPCManual(actor, favorites, options);
    }
  }

  /**
   * Extract NPC data using the dnd5e system's _prepareEmbedContext().
   * This provides pre-formatted action descriptions with resolved damage formulas.
   * We trust the embed context completely for action/trait formatting.
   */
  private async extractNPCFromEmbedContext(
    actor: any,
    ctx: Dnd5eEmbedContext,
    favorites: Set<string>,
    _options: PrintOptions,
  ): Promise<NPCData> {
    const details = actor.system?.details ?? {};
    const attrs = actor.system?.attributes ?? {};
    const hp = attrs.hp ?? {};

    // CR and XP from embed context or manual calculation
    const cr = details.cr ?? 0;
    const xp = this.crToXP(cr);
    const proficiencyBonus = attrs.prof ?? Math.floor((cr >= 1 ? cr : 1) / 4) + 2;

    // Use embed context's summary data where available
    const summary = ctx.summary;

    // Speed from embed context - parse summary.speed string like "30 ft., Fly 60 ft."
    const speed: { key: string; value: number }[] = [];
    if (summary?.speed) {
      // Parse speed string - format: "30 ft., Fly 60 ft., Swim 40 ft."
      const speedParts = summary.speed.split(",").map((s: string) => s.trim());
      for (const part of speedParts) {
        const match = part.match(/(?:(\w+)\s+)?(\d+)\s*ft/i);
        if (match) {
          const key = match[1]?.toLowerCase() || "walk";
          speed.push({ key, value: parseInt(match[2]) });
        }
      }
    }
    if (speed.length === 0) speed.push({ key: "walk", value: 30 });

    // Skills from embed context or fallback
    const skills = this.extractSkillsFromContext(ctx, actor);

    // Senses from context
    const senses = this.extractSensesFromContext(ctx, actor);
    const passivePerception = actor.system?.skills?.prc?.passive ?? 10;

    // Gear using built-in system method
    const gear = this.extractGearFromSystem(actor);

    // Convert embed context actions to our FeatureData format
    // actionSections is typed as Dnd5eEmbedActionSections with keys: trait, action, bonus, reaction, legendary, mythic
    const features: FeatureData[] = [];
    const actions: FeatureData[] = [];
    const bonusActions: FeatureData[] = [];
    const reactions: FeatureData[] = [];
    const legendaryActionList: FeatureData[] = [];
    const lairActionList: FeatureData[] = [];

    const actSections: Dnd5eEmbedActionSections = ctx.actionSections ?? {};

    // Process traits from embed context (actionSections.trait)
    if (actSections.trait?.actions) {
      for (const trait of actSections.trait.actions) {
        features.push(this.embedActionToFeatureData(trait, favorites, actor));
      }
    }

    // Process actions from embed context (actionSections.action)
    if (actSections.action?.actions) {
      for (const action of actSections.action.actions) {
        actions.push(this.embedActionToFeatureData(action, favorites, actor));
      }
    }

    // Process bonus actions (actionSections.bonus)
    if (actSections.bonus?.actions) {
      for (const action of actSections.bonus.actions) {
        bonusActions.push(this.embedActionToFeatureData(action, favorites, actor));
      }
    }

    // Process reactions (actionSections.reaction)
    if (actSections.reaction?.actions) {
      for (const action of actSections.reaction.actions) {
        reactions.push(this.embedActionToFeatureData(action, favorites, actor));
      }
    }

    // Process legendary actions (actionSections.legendary)
    if (actSections.legendary?.actions) {
      for (const action of actSections.legendary.actions) {
        legendaryActionList.push(this.embedActionToFeatureData(action, favorites, actor));
      }
    }

    // Note: lair actions are handled via resources.lair, not in actionSections

    // Sort actions: Multiattack first, then weapons, then other abilities
    actions.sort((a, b) => {
      const aIsMultiattack = a.name.toLowerCase().includes("multiattack");
      const bIsMultiattack = b.name.toLowerCase().includes("multiattack");
      if (aIsMultiattack && !bIsMultiattack) return -1;
      if (!aIsMultiattack && bIsMultiattack) return 1;
      if (a.itemType === "weapon" && b.itemType !== "weapon") return -1;
      if (a.itemType !== "weapon" && b.itemType === "weapon") return 1;
      return 0;
    });

    return {
      name: actor.name ?? "Unknown",
      img: actor.img ?? "",
      tokenImg: actor.prototypeToken?.texture?.src ?? "",
      cr: this.formatCR(cr),
      xp,
      proficiencyBonus,
      type: details.type?.value ?? "",
      size: this.sizeCodeToName(actor.system?.traits?.size ?? "med"),
      alignment: details.alignment ?? "",
      ac: attrs.ac?.value ?? 10,
      acFormula: attrs.ac?.formula ?? "",
      hp: { value: hp.value ?? 0, max: hp.max ?? 0, formula: hp.formula ?? "" },
      initiative: summary.initiative ? parseInt(summary.initiative) || 0 : (attrs.init?.total ?? 0),
      speed,
      abilities: extractAbilities(actor),
      skills,
      gear,
      traits: extractTraits(actor),
      senses,
      passivePerception,
      languages: resolveTraitSet(actor.system?.traits?.languages),
      features,
      actions,
      bonusActions,
      reactions,
      legendaryActions: {
        description: actSections.legendary?.description ?? details.legendary?.description ?? "",
        actions: legendaryActionList,
      },
      lairActions: {
        description: details.lair?.description ?? "",
        actions: lairActionList,
      },
      spellcasting: extractSpellcasting(actor, favorites),
    };
  }

  /**
   * Convert an action from embed context to our FeatureData format.
   *
   * The embed context provides pre-enriched data that we trust completely:
   * - name: Already includes uses label like "Multiattack (3/Day)" or "Breath Weapon (Recharge 5-6)"
   * - description: Enriched HTML with resolved damage formulas, attack bonuses, and DC values
   * - dataset: { id, identifier } for looking up the item
   * - openingTag: HTML opening tag if description started with one
   *
   * We do NOT manually calculate attack bonuses or damage - the description already has this.
   */
  private embedActionToFeatureData(action: Dnd5eEmbedAction, favorites: Set<string>, actor?: any): FeatureData {
    // Look up the item from the actor using dataset.id (for favorites tracking only)
    const itemId = action.dataset?.id;
    const item = itemId && actor?.items?.get ? actor.items.get(itemId) : null;

    // Trust the embed context name - it already includes uses labels
    const name = action.name ?? item?.name ?? "";

    // Trust the embed context description - it already has resolved damage formulas
    // Restore the opening tag if it was stripped by the dnd5e system
    let description = action.description ?? "";
    if (action.openingTag && !description.startsWith("<")) {
      description = action.openingTag + description;
    }

    // Strip Foundry-specific enriched text for print (removes inline rolls, UUID links, etc.)
    description = this.stripEnrichedText(description, actor?.name);

    return {
      name,
      description,
      uses: null, // Uses are already in the name from embed context
      isFavorite: favorites.has(itemId) || favorites.has(item?.uuid),
      // No attack property - the description already contains formatted attack text
      // This prevents the renderer from generating duplicate/incorrect attack text
      attack: undefined,
      itemType: item?.type ?? "feat",
    };
  }

  /**
   * Extract item uses data from dnd5e 5.x structure.
   * Handles various recovery formats:
   * - uses.recovery as Array<{period, formula, type}>
   * - uses.recovery as Collection (Map-like)
   * - uses.per as legacy string ("sr", "lr", "day")
   */
  private extractItemUses(item: any): FeatureData["uses"] | null {
    const uses = item?.system?.uses;
    if (!uses?.max) return null;

    let recovery = "";

    // Try to get recovery from the recovery array/collection (dnd5e 5.x)
    let recoveryArr: any[] = [];
    if (uses.recovery) {
      if (Array.isArray(uses.recovery)) {
        recoveryArr = uses.recovery;
      } else if (typeof uses.recovery.forEach === "function") {
        // Handle Collection/Map-like objects
        uses.recovery.forEach((r: any) => recoveryArr.push(r));
      } else if (typeof uses.recovery === "object" && uses.recovery.period) {
        // Single recovery object
        recoveryArr = [uses.recovery];
      } else if (typeof uses.recovery === "string") {
        // Legacy string format
        recovery = uses.recovery;
      }
    }

    // Extract period from recovery array
    if (recoveryArr.length > 0 && !recovery) {
      const rec = recoveryArr[0];
      if (rec?.period === "recharge" && rec?.formula) {
        const rechargeMin = parseInt(rec.formula) || 6;
        recovery = rechargeMin === 6 ? "Recharge 6" : `Recharge ${rechargeMin}–6`;
      } else if (rec?.period) {
        recovery = rec.period;
      }
    }

    // Fallback to uses.per (legacy format)
    if (!recovery && uses.per) {
      recovery = uses.per;
    }

    return {
      value: uses.value ?? 0,
      max: uses.max ?? 0,
      recovery,
    };
  }

  /**
   * Extract skills from embed context or actor.
   * Uses the pre-formatted summary.skills string from embed context when available.
   */
  private extractSkillsFromContext(ctx: Dnd5eEmbedContext, actor: any): { name: string; mod: number }[] {
    // Trust the embed context summary - it has pre-formatted skills
    if (ctx.summary?.skills) {
      // Parse skills string like "Deception +5, Stealth +6"
      const skillsStr = ctx.summary.skills;
      const skills: { name: string; mod: number }[] = [];
      const parts = skillsStr.split(",").map((s: string) => s.trim());
      for (const part of parts) {
        const match = part.match(/(.+?)\s+([+-]?\d+)/);
        if (match) {
          skills.push({ name: match[1].trim(), mod: parseInt(match[2]) });
        }
      }
      if (skills.length > 0) return skills;
    }

    // Fallback to manual extraction
    const skillsObj = actor.system?.skills ?? {};
    const skills: { name: string; mod: number }[] = [];
    for (const [key, skill] of Object.entries(skillsObj)) {
      const s = skill as any;
      if (s.proficient || s.total !== (actor.system?.abilities?.[s.ability]?.mod ?? 0)) {
        skills.push({ name: this.skillKeyToName(key), mod: s.total ?? 0 });
      }
    }
    return skills;
  }

  /**
   * Extract senses from embed context or actor.
   * Falls back to actor.system.attributes.senses if needed.
   */
  private extractSensesFromContext(_ctx: Dnd5eEmbedContext, actor: any): { key: string; value: number | string }[] {
    const senses: { key: string; value: number | string }[] = [];
    const attrSenses = actor.system?.attributes?.senses ?? {};

    for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
      const val = attrSenses[key];
      if (val && val > 0) senses.push({ key, value: val });
    }
    if (attrSenses.special) senses.push({ key: "special", value: attrSenses.special });

    return senses;
  }

  /**
   * Extract gear using the dnd5e system's built-in getGear() method.
   */
  private extractGearFromSystem(actor: any): string[] {
    try {
      if (typeof actor.system?.getGear === "function") {
        const gearItems = actor.system.getGear();
        if (Array.isArray(gearItems)) {
          return gearItems.map((i: any) => {
            let name = i.name ?? "";
            if (i.system?.quantity > 1) {
              name += ` (${i.system.quantity})`;
            }
            return name;
          }).filter((n: string) => n);
        }
      }
    } catch (err) {
      Log.debug("getGear() failed, using manual extraction", { err: String(err) });
    }

    // Fallback to manual gear extraction
    const items = actor.items ?? [];
    const weaponItems = items.filter?.((i: any) => i.type === "weapon") ?? [];
    const equipmentItems = items.filter?.((i: any) => i.type === "equipment") ?? [];
    return this.extractGear(weaponItems, equipmentItems);
  }

  /**
   * Fallback: Manual NPC extraction (when _prepareEmbedContext is not available).
   */
  private async extractNPCManual(actor: any, favorites: Set<string>, _options: PrintOptions): Promise<NPCData> {
    Log.debug("Using manual NPC extraction", { name: actor.name });
    const items = actor.items ?? [];

    // NPC-specific fields
    const details = actor.system?.details ?? {};
    const attrs = actor.system?.attributes ?? {};
    const movement = attrs.movement ?? {};
    const senses = attrs.senses ?? {};
    const hp = attrs.hp ?? {};

    // CR and XP lookup
    const cr = details.cr ?? 0;
    const xp = this.crToXP(cr);
    const proficiencyBonus = attrs.prof ?? Math.floor((cr >= 1 ? cr : 1) / 4) + 2;

    // Initiative (DEX mod by default for NPCs)
    const dexMod = actor.system?.abilities?.dex?.mod ?? 0;
    const initiative = attrs.init?.total ?? dexMod;

    // Skills - only include those with proficiency or bonuses
    const skillsObj = actor.system?.skills ?? {};
    const skills: { name: string; mod: number }[] = [];
    for (const [key, skill] of Object.entries(skillsObj)) {
      const s = skill as any;
      if (s.proficient || s.total !== (actor.system?.abilities?.[s.ability]?.mod ?? 0)) {
        skills.push({ name: this.skillKeyToName(key), mod: s.total ?? 0 });
      }
    }

    // Passive perception
    const prcSkill = skillsObj.prc as any;
    const passivePerception = senses.passive ?? (10 + (prcSkill?.total ?? 0));

    // Speed
    const speed: { key: string; value: number }[] = [];
    for (const key of ["walk", "fly", "swim", "climb", "burrow"]) {
      const val = movement[key];
      if (val && val > 0) speed.push({ key, value: val });
    }
    if (speed.length === 0) speed.push({ key: "walk", value: 30 });

    // Senses
    const senseEntries: { key: string; value: number | string }[] = [];
    for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
      const val = senses[key];
      if (val && val > 0) senseEntries.push({ key, value: val });
    }
    if (senses.special) senseEntries.push({ key: "special", value: senses.special });

    // Categorize items by activation type for NPC actions
    const featItems = items.filter?.((i: any) => i.type === "feat") ?? [];
    const weaponItems = items.filter?.((i: any) => i.type === "weapon") ?? [];
    const equipmentItems = items.filter?.((i: any) => i.type === "equipment") ?? [];
    const actionItems = [...featItems, ...weaponItems];

    const features: FeatureData[] = [];
    const actions: FeatureData[] = [];
    const bonusActions: FeatureData[] = [];
    const reactions: FeatureData[] = [];
    const legendaryActionList: FeatureData[] = [];
    const lairActionList: FeatureData[] = [];

    for (const item of actionItems) {
      const fd = this.itemToFeatureData(item, favorites, actor);
      const activationType = this.getActivationType(item);

      switch (activationType) {
        case "legendary": legendaryActionList.push(fd); break;
        case "lair":      lairActionList.push(fd); break;
        case "bonus":     bonusActions.push(fd); break;
        case "reaction":  reactions.push(fd); break;
        case "action":
        case "attack":    actions.push(fd); break;
        default:          features.push(fd); break;
      }
    }

    // Sort actions: Multiattack first, then weapons, then other abilities
    actions.sort((a, b) => {
      const aIsMultiattack = a.name.toLowerCase().includes("multiattack");
      const bIsMultiattack = b.name.toLowerCase().includes("multiattack");
      if (aIsMultiattack && !bIsMultiattack) return -1;
      if (!aIsMultiattack && bIsMultiattack) return 1;
      if (a.itemType === "weapon" && b.itemType !== "weapon") return -1;
      if (a.itemType !== "weapon" && b.itemType === "weapon") return 1;
      return 0;
    });

    return {
      name: actor.name ?? "Unknown",
      img: actor.img ?? "",
      tokenImg: actor.prototypeToken?.texture?.src ?? "",
      cr: this.formatCR(cr),
      xp,
      proficiencyBonus,
      type: details.type?.value ?? "",
      size: this.sizeCodeToName(actor.system?.traits?.size ?? "med"),
      alignment: details.alignment ?? "",
      ac: attrs.ac?.value ?? 10,
      acFormula: attrs.ac?.formula ?? "",
      hp: { value: hp.value ?? 0, max: hp.max ?? 0, formula: hp.formula ?? "" },
      initiative,
      speed,
      abilities: extractAbilities(actor),
      skills,
      gear: this.extractGear(weaponItems, equipmentItems),
      traits: extractTraits(actor),
      senses: senseEntries,
      passivePerception,
      languages: resolveTraitSet(actor.system?.traits?.languages),
      features,
      actions,
      bonusActions,
      reactions,
      legendaryActions: {
        description: details.legendary?.description ?? "",
        actions: legendaryActionList,
      },
      lairActions: {
        description: details.lair?.description ?? "",
        actions: lairActionList,
      },
      spellcasting: extractSpellcasting(actor, favorites),
    };
  }

  /** Convert CR to XP (2014/2024 table) */
  private crToXP(cr: number): number {
    const xpTable: Record<number, number> = {
      0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
      1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
      9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
      16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000,
      22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000,
      28: 120000, 29: 135000, 30: 155000,
    };
    return xpTable[cr] ?? 0;
  }

  /** Convert skill key to display name */
  private skillKeyToName(key: string): string {
    const names: Record<string, string> = {
      acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics",
      dec: "Deception", his: "History", ins: "Insight", itm: "Intimidation",
      inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception",
      prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand",
      ste: "Stealth", sur: "Survival",
    };
    return names[key] ?? key;
  }

  /** Convert size code to full display name */
  private sizeCodeToName(code: string): string {
    const sizes: Record<string, string> = {
      tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan",
    };
    return sizes[code.toLowerCase()] ?? code;
  }

  /** Format CR as fraction or integer */
  private formatCR(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return cr.toString();
  }

  /** Extract gear names: physical weapons and armor */
  private extractGear(weaponItems: any[], equipmentItems: any[]): string[] {
    const gearNames: string[] = [];

    // Add physical weapons (exclude spell-like abilities that only do magical damage)
    const physicalDamageTypes = new Set(["bludgeoning", "piercing", "slashing"]);

    for (const item of weaponItems) {
      let hasPhysicalDamage = false;

      const activities = item.system?.activities;
      if (activities) {
        const actList = activities instanceof Map ? [...activities.values()] :
                        (typeof activities.values === "function" ? [...activities.values()] : Object.values(activities));

        for (const act of actList) {
          const damageParts = act.damage?.parts ?? [];
          for (const part of damageParts) {
            const types = part.types instanceof Set ? [...part.types] :
                          (Array.isArray(part.types) ? part.types : []);
            for (const t of types) {
              if (physicalDamageTypes.has(t.toLowerCase())) {
                hasPhysicalDamage = true;
                break;
              }
            }
            if (hasPhysicalDamage) break;
          }
          if (hasPhysicalDamage) break;
        }
      }

      // Fallback: check item.system.damage if no activities
      if (!hasPhysicalDamage && item.system?.damage?.parts) {
        for (const part of item.system.damage.parts) {
          const damageType = Array.isArray(part) ? part[1] : part.types?.[0];
          if (damageType && physicalDamageTypes.has(damageType.toLowerCase())) {
            hasPhysicalDamage = true;
            break;
          }
        }
      }

      if (hasPhysicalDamage && item.name) {
        gearNames.push(item.name);
      }
    }

    // Add armor (equipment with armor type or AC value)
    const armorTypes = new Set(["light", "medium", "heavy", "shield", "natural", "bonus"]);
    for (const item of equipmentItems) {
      const equipType = item.system?.type?.value?.toLowerCase() ?? "";
      const hasArmor = item.system?.armor?.value > 0;

      if ((armorTypes.has(equipType) || hasArmor) && item.name) {
        gearNames.push(item.name);
      }
    }

    return gearNames;
  }

  /* ── Encounter Group ────────────────────────────────────── */

  async extractEncounterGroup(group: any, options: PrintOptions): Promise<EncounterGroupData> {
    Log.info("dnd5e: extracting encounter group", { name: group?.name, type: group?.type });

    // dnd5e 5.x has TWO actor types that can be encounter groups:
    // 1. "encounter" actor type - uses system.getMembers() async method
    // 2. "group" actor type with system.type.value = "encounter" - uses system.members array
    const actors: NPCData[] = [];
    const seenUUIDs = new Set<string>(); // Track unique actors to avoid duplicates

    // Check if this is the dedicated "encounter" actor type with getMembers() method
    if (group.type === "encounter" && typeof group.system?.getMembers === "function") {
      try {
        // getMembers() returns { actor, quantity }[] where actor is the resolved Actor document
        const members = await group.system.getMembers();
        Log.debug("encounter getMembers() returned", { count: members?.length });

        for (const { actor } of members) {
          if (!actor) continue;

          // Deduplicate by UUID - we only want one stat block per creature type
          const uuid = actor.uuid ?? actor.id ?? actor.name;
          if (seenUUIDs.has(uuid)) {
            Log.debug("skipping duplicate actor", { name: actor.name, uuid });
            continue;
          }
          seenUUIDs.add(uuid);

          try {
            actors.push(await this.extractNPC(actor, options));
          } catch (err) {
            Log.warn("failed to extract NPC for encounter", { name: actor?.name, err });
          }
        }
      } catch (err) {
        Log.warn("getMembers() failed, falling back to manual extraction", { err: String(err) });
      }
    }

    // Fallback: use the old getGroupMembers for "group" actor type
    if (actors.length === 0) {
      const members = this.getGroupMembers(group);
      for (const member of members) {
        // Deduplicate by UUID or name
        const uuid = member.uuid ?? member.id ?? member.name;
        if (seenUUIDs.has(uuid)) continue;
        seenUUIDs.add(uuid);

        try {
          actors.push(await this.extractNPC(member, options));
        } catch (err) {
          Log.warn("failed to extract NPC for encounter group", { name: member?.name, err });
        }
      }
    }

    return { name: group.name ?? "Encounter", actors };
  }

  /* ── Party Summary ──────────────────────────────────────── */

  async extractPartySummary(group: any, _options: PrintOptions): Promise<PartySummaryData> {
    Log.info("dnd5e: extracting party summary", { name: group?.name });

    const members = this.getGroupMembers(group);
    const summaries: PartyMemberSummary[] = [];

    // Skill abbreviations for compact display
    const skillAbbr: Record<string, string> = {
      acr: "Acro", ani: "Anim", arc: "Arca", ath: "Athl", dec: "Dece",
      his: "Hist", ins: "Insi", itm: "Intm", inv: "Inve", med: "Medi",
      nat: "Natu", prc: "Perc", prf: "Perf", per: "Pers", rel: "Reli",
      slt: "Slei", ste: "Stea", sur: "Surv",
    };

    for (const actor of members) {
      try {
        const details = extractDetails(actor);
        const combat = extractCombat(actor);
        const skills = extractSkills(actor);
        const abilities = extractAbilities(actor);
        const attrs = actor.system?.attributes ?? {};

        // Spell DC
        const spellAbility = attrs.spellcasting;
        let spellDC: number | null = null;
        if (spellAbility) {
          const mod = actor.system?.abilities?.[spellAbility]?.mod ?? 0;
          spellDC = 8 + (attrs.prof ?? 0) + mod;
        }

        // Build class string (abbreviated for space)
        const classStr = details.classes
          .map((c) => `${c.name} ${c.level}`)
          .join("/") || "—";

        // Senses string
        const sensesStr = combat.senses
          .map(s => `${s.key} ${s.value}${typeof s.value === "number" ? "ft" : ""}`)
          .join(", ") || "—";

        // Passives
        const passives = {
          perception: skills.find((s) => s.key === "prc")?.passive ?? 10,
          insight: skills.find((s) => s.key === "ins")?.passive ?? 10,
          investigation: skills.find((s) => s.key === "inv")?.passive ?? 10,
        };

        // Save modifiers (all 6)
        const saves = abilities.map(a => ({
          key: a.key.toUpperCase().slice(0, 3),
          mod: a.save,
          proficient: a.saveProficient ?? false,
        }));

        // Proficient skills only, sorted by mod
        const proficientSkills = skills
          .filter((s) => s.proficiency >= 1)
          .sort((a, b) => b.total - a.total)
          .map((s) => ({
            name: s.label,
            abbr: skillAbbr[s.key] ?? s.label.slice(0, 4),
            mod: s.total,
            ability: s.ability.toUpperCase().slice(0, 3),
          }));

        // Extract spell slots (levels 1-9)
        const spellsData = actor.system?.spells ?? {};
        const spellSlots: { level: number; max: number }[] = [];
        for (let lvl = 1; lvl <= 9; lvl++) {
          const slotData = spellsData[`spell${lvl}`];
          if (slotData?.max > 0) {
            spellSlots.push({ level: lvl, max: slotData.max });
          }
        }

        // Pact magic (warlock)
        let pactSlots: { max: number; level: number } | null = null;
        const pactData = spellsData.pact;
        if (pactData?.max > 0) {
          pactSlots = { max: pactData.max, level: pactData.level ?? 1 };
        }

        summaries.push({
          name: actor.name ?? "Unknown",
          classes: classStr,
          level: details.level,
          species: details.race || "—",
          background: details.background || "—",
          senses: sensesStr,
          ac: combat.ac,
          hp: { max: combat.hp.max },
          proficiency: combat.proficiency,
          initiative: combat.initiative,
          passives,
          spellDC,
          saves,
          proficientSkills,
          spellSlots,
          pactSlots,
        });
      } catch (err) {
        Log.warn("failed to extract party member", { name: actor?.name, err });
      }
    }

    return { name: group.name ?? "Party", members: summaries };
  }

  /* ── Private helpers ────────────────────────────────────── */

  /** Retrieve actual Actor documents from a dnd5e Group actor */
  private getGroupMembers(group: any): any[] {
    // dnd5e groups store members in system.members as an array of { actor } references
    const membersData = group.system?.members ?? [];
    const actors: any[] = [];

    if (Array.isArray(membersData)) {
      for (const m of membersData) {
        // Each member entry may be { actor: ActorDocument } or just an actor reference
        const actor = m.actor ?? m;
        if (actor && actor.name) actors.push(actor);
      }
    }

    // Fallback: if the group has an items collection with actor links
    if (actors.length === 0 && group.system?.members) {
      const game = getGame();
      if (Array.isArray(group.system.members)) {
        for (const ref of group.system.members) {
          const id = ref.actor ?? ref;
          if (typeof id === "string") {
            const actor = game?.actors?.get?.(id);
            if (actor) actors.push(actor);
          }
        }
      }
    }

    return actors;
  }

  /** Convert an item to a FeatureData entry (for NPC stat blocks) */
  private itemToFeatureData(item: any, favorites: Set<string>, actor?: any): FeatureData {
    const uses = item.system?.uses;
    const attack = this.extractAttackData(item, actor);

    // Debug: log item structure for breath weapons
    if (item.name?.toLowerCase().includes("breath")) {
      Log.debug("Breath weapon item structure", {
        name: item.name,
        uses: JSON.parse(JSON.stringify(item.system?.uses ?? {})),
        activities: item.system?.activities ? "present" : "none",
        type: item.type,
        descriptionLength: (item.system?.description?.value ?? "").length,
      });
    }

    // Strip Foundry enriched text placeholders from description
    // Pass actor name to resolve [[lookup @name]] placeholders
    let description = item.system?.description?.value ?? "";
    description = this.stripEnrichedText(description, actor?.name);

    // Check for empty damage placeholders like "7 ()" and fill them with damage from activities
    if (description.includes("()") || /\d+\s*\(\s*\)/.test(description)) {
      const dmgInfo = this.extractAnyDamageFromActivities(item, actor);

      // Debug: Log item structure for features with empty damage placeholders
      Log.debug("Feature with empty damage placeholder", {
        name: item.name,
        hasActivities: !!item.system?.activities,
        activitiesType: item.system?.activities ? typeof item.system.activities : "none",
        activitiesKeys: item.system?.activities ?
          (item.system.activities instanceof Map ? [...item.system.activities.keys()] :
           typeof item.system.activities.keys === "function" ? [...item.system.activities.keys()] :
           Object.keys(item.system.activities)) : [],
        dmgInfoFound: !!dmgInfo,
        dmgInfo: dmgInfo ? JSON.stringify(dmgInfo) : null,
        itemSystemKeys: item.system ? Object.keys(item.system) : [],
      });

      if (dmgInfo) {
        // Replace patterns like "7 ()" or "7()" with "7 (2d6)"
        description = description.replace(/(\d+)\s*\(\s*\)/g, (_match: string, avg: string) => {
          // Use the formula we found, or just the damage dice part
          return `${avg} (${dmgInfo.formula})`;
        });
      }
    }

    // Build uses/recovery string using Dnd5eUsesData types
    let usesData: { value: number; max: number; recovery: string } | null = null;
    const typedUses = uses as Partial<Dnd5eUsesData> | undefined;
    if (typedUses && typedUses.max) {
      // dnd5e 5.x: uses.recovery is array of Dnd5eRecoveryData
      // {period: "recharge", formula: "5", type: "recoverAll"}
      let recovery = typedUses.per ?? "";

      // Handle uses.recovery as Collection, Array, or object
      let recoveryArr: Partial<Dnd5eRecoveryData>[] = [];
      if (typedUses.recovery) {
        if (Array.isArray(typedUses.recovery)) {
          recoveryArr = typedUses.recovery;
        } else if (typeof (typedUses.recovery as any).forEach === "function") {
          (typedUses.recovery as any).forEach((r: any) => recoveryArr.push(r));
        } else if (typeof typedUses.recovery === "object" && (typedUses.recovery as any).period) {
          recoveryArr = [typedUses.recovery as any];
        }
      }

      // Check for recharge - in dnd5e 5.x, period is "recharge" and formula contains the min value
      if (recoveryArr.length > 0) {
        const rec = recoveryArr[0];
        if (rec?.period === "recharge" && rec?.formula) {
          // formula contains the minimum value (e.g., "5" for Recharge 5-6)
          const rechargeMin = parseInt(rec.formula) || 6;
          recovery = rechargeMin === 6 ? "Recharge 6" : `Recharge ${rechargeMin}–6`;
        } else if (!recovery) {
          recovery = rec?.period ?? "";
          // Legacy format: period might be "recharge5", "recharge6", etc.
          if (recovery.startsWith("recharge")) {
            const rechargeNum = parseInt(recovery.replace("recharge", "")) || 6;
            recovery = rechargeNum === 6 ? "Recharge 6" : `Recharge ${rechargeNum}–6`;
          }
        }
      }

      usesData = {
        value: typedUses.value ?? 0,
        max: typedUses.max ?? 0,
        recovery,
      };
    }

    // Also check activities for recharge info if not found in uses
    if (usesData && !usesData.recovery) {
      const activities = item.system?.activities;
      if (activities) {
        try {
          const actList = activities instanceof Map ? [...activities.values()] :
                         (typeof activities.values === "function" ? [...activities.values()] : Object.values(activities));
          for (const act of actList) {
            const consumption = act.consumption;
            if (consumption?.targets) {
              for (const target of consumption.targets) {
                if (target.type === "itemUses" && target.target === "") {
                  // This activity consumes item uses - check for recharge
                  const actUses = act.uses;
                  const actRec = actUses?.recovery?.[0];
                  if (actRec?.period === "recharge" && actRec?.formula) {
                    // dnd5e 5.x format: period is "recharge", formula is the min value
                    const rechargeMin = parseInt(actRec.formula) || 6;
                    usesData.recovery = rechargeMin === 6 ? "Recharge 6" : `Recharge ${rechargeMin}–6`;
                    break;
                  } else if (actRec?.period?.startsWith("recharge")) {
                    // Legacy format
                    const rechargeNum = parseInt(actRec.period.replace("recharge", "")) || 6;
                    usesData.recovery = rechargeNum === 6 ? "Recharge 6" : `Recharge ${rechargeNum}–6`;
                    break;
                  }
                }
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    return {
      name: item.name ?? "",
      description,
      uses: usesData,
      isFavorite: favorites.has(item.id) || favorites.has(item.uuid),
      attack,
      itemType: item.type ?? "feat",
    };
  }

  /** Extract attack/damage data from an item's activities */
  private extractAttackData(item: any, actor?: any): FeatureData["attack"] | undefined {
    // Handle weapons and feats with damage activities
    const activities = item.system?.activities;
    if (!activities) return undefined;

    try {
      let activityValues: any[] = [];
      if (activities instanceof Map) {
        activityValues = Array.from(activities.values());
      } else if (typeof activities.values === "function") {
        activityValues = Array.from(activities.values());
      } else if (typeof activities === "object" && activities !== null) {
        activityValues = Object.values(activities);
      }

      // Find an attack activity or save activity with damage
      const attackActivity = activityValues.find((a: any) =>
        a.type === "attack" || a.attack?.ability
      );

      // For feats/abilities, also look for save activities with damage
      const saveActivity = activityValues.find((a: any) =>
        a.type === "save" && a.damage?.parts?.length > 0
      );

      // If no attack activity and no save activity, nothing to extract
      if (!attackActivity && !saveActivity) return undefined;

      // For save-based abilities (like breath weapons), handle separately
      if (!attackActivity && saveActivity) {
        return this.extractSaveActivityData(saveActivity, actor);
      }

      // Determine attack type - check multiple possible locations
      // In dnd5e 5.x, properties is a Set<string>
      const weaponProps = item.system?.properties as Set<string> | undefined ?? new Set<string>();
      const hasThrown = weaponProps.has?.("thr") || (weaponProps as any).thr;

      // Get action type from item or activity
      let actionType = item.system?.actionType ??
                       attackActivity.attack?.type?.value ??
                       attackActivity.attack?.type ??
                       "";

      // If no specific type, determine from weapon type
      if (!actionType || actionType === "melee" || actionType === "ranged") {
        const weaponType = item.system?.type?.value ?? item.system?.weaponType ?? "";
        const isRangedWeapon = weaponType.includes("ranged") ||
                              weaponType === "simpleR" ||
                              weaponType === "martialR";
        actionType = isRangedWeapon ? "rwak" : "mwak";
      }

      const isRanged = actionType === "rwak" || actionType === "rsak";
      const isMelee = actionType === "mwak" || actionType === "msak";

      // Determine the attack ability
      let abilityKey = attackActivity.attack?.ability;
      if (!abilityKey) {
        // Default: STR for melee, DEX for ranged
        // Finesse weapons can use either (NPCs typically use the higher)
        const hasFinesse = weaponProps.has?.("fin") || (weaponProps as any).fin;
        if (hasFinesse) {
          const strMod = actor?.system?.abilities?.str?.mod ?? 0;
          const dexMod = actor?.system?.abilities?.dex?.mod ?? 0;
          abilityKey = dexMod > strMod ? "dex" : "str";
        } else {
          abilityKey = isRanged ? "dex" : "str";
        }
      }

      const abilityMod = actor?.system?.abilities?.[abilityKey]?.mod ?? 0;
      const prof = actor?.system?.attributes?.prof ?? 2;

      // Get to-hit bonus - prefer calculated value for accuracy
      const flatBonus = attackActivity.attack?.flat ?? attackActivity.attack?.bonus ?? 0;
      const totalToHit = abilityMod + prof + (typeof flatBonus === "number" ? flatBonus : 0);
      const toHit = totalToHit >= 0 ? `+${totalToHit}` : `${totalToHit}`;

      // Get reach/range - handle thrown weapons specially
      // In dnd5e 5.x, range is Dnd5eRangeData
      let reach = "";
      const range = (item.system?.range ?? {}) as Partial<Dnd5eRangeData>;
      if (hasThrown && isMelee) {
        // Thrown melee weapon - show both reach and range
        const reachVal = range.reach ?? 5;
        const rangeShort = range.value ?? 20;
        const rangeLong = range.long ?? 60;
        reach = `reach ${reachVal} ft or range ${rangeShort}/${rangeLong} ft`;
      } else if (isRanged) {
        if (range.value && range.long) {
          reach = `range ${range.value}/${range.long} ft`;
        } else if (range.value) {
          reach = `range ${range.value} ft`;
        }
      } else {
        const reachVal = range.reach ?? 5;
        reach = `reach ${reachVal} ft`;
      }

      // Get weapon base damage type from the item (multiple possible locations)
      // In dnd5e 5.x, damage.base.types is a Set<string>
      const baseDamageTypes = item.system?.damage?.base?.types;
      const weaponDamageType = getFirstFromSetOrArray(baseDamageTypes) ??
                               item.system?.damage?.base?.damageType ??
                               item.system?.damage?.parts?.[0]?.[1] ??
                               "";

      // Get damage - try multiple sources
      const damage: { avg: number; formula: string; type: string }[] = [];

      // First try activity damage parts
      let damageData = attackActivity.damage?.parts ?? [];

      // If no activity damage, try item's base damage
      if (damageData.length === 0) {
        const baseDamage = item.system?.damage?.base;
        if (baseDamage) {
          const baseDice = baseDamage.number ?? 1;
          const baseDie = baseDamage.denomination ?? 8;
          const baseType = baseDamage.types?.[0] ?? baseDamage.damageType ?? weaponDamageType;
          // Build formula with ability mod
          const formula = `${baseDice}d${baseDie} + @mod`;
          damageData = [{ formula, types: [baseType] }];
        }
      }

      // Log damage data for debugging
      Log.debug("Weapon damage extraction", {
        itemName: item.name,
        damageDataLength: damageData.length,
        firstPart: damageData[0] ? JSON.parse(JSON.stringify(damageData[0])) : null,
        weaponDamageType,
      });

      for (let i = 0; i < damageData.length; i++) {
        const part = damageData[i];
        // dnd5e 5.x structure: part is Dnd5eDamageData
        // {number: 1, denomination: 8, bonus: "@mod", types: Set(["slashing"])}
        // Legacy format: ["1d4 + @mod", "slashing"]
        let formula = "";
        let dmgType = "";

        if (Array.isArray(part)) {
          // Legacy array format
          formula = part[0] ?? "";
          dmgType = part[1] ?? "";
        } else if (typeof part === "object" && part !== null) {
          const dmgPart = part as Partial<Dnd5eDamageData>;
          // dnd5e 5.x format with number/denomination
          if (dmgPart.number && dmgPart.denomination) {
            formula = `${dmgPart.number}d${dmgPart.denomination}`;
            if (dmgPart.bonus) formula += ` + ${dmgPart.bonus}`;
          } else if (dmgPart.custom?.enabled && dmgPart.custom.formula) {
            formula = dmgPart.custom.formula;
          } else {
            formula = (part as any).formula ?? "";
          }
          // Use helper to get first damage type from Set or Array
          dmgType = getFirstFromSetOrArray(dmgPart.types) ?? (part as any).type ?? "";
        }

        // If no damage type specified, use the weapon's base damage type for first entry
        if (!dmgType && damage.length === 0) {
          dmgType = weaponDamageType;
        }

        // For the first damage entry (main weapon damage), add ability mod if not present
        if (formula && i === 0 && !formula.includes("@mod") && !formula.includes("@str") &&
            !formula.includes("@dex") && !/[+-]\s*\d+\s*$/.test(formula)) {
          // Formula has no modifier - add the ability modifier
          formula = `${formula} + @mod`;
        }

        if (formula) {
          const avg = this.estimateDamageAverage(formula, actor, abilityKey);
          damage.push({
            avg,
            formula: this.resolveFormula(formula, actor, abilityKey),
            type: this.capitalize(dmgType),
          });
        }
      }

      return {
        type: actionType,
        toHit,
        reach,
        damage,
        save: "",
        thrown: hasThrown && isMelee,
      };
    } catch (err) {
      Log.warn("Failed to extract attack data", { item: item.name, err });
      return undefined;
    }
  }

  /**
   * Extract data from a save-based activity (like breath weapons).
   * Uses Dnd5eSaveActivityData types for proper handling of dnd5e 5.x structures.
   */
  private extractSaveActivityData(activity: Partial<Dnd5eSaveActivityData>, actor?: any): FeatureData["attack"] | undefined {
    try {
      const damage: { avg: number; formula: string; type: string }[] = [];
      const rawParts = activity.damage?.parts;

      // Convert to array safely - rawParts can be Array, Collection, or object
      let damageParts: Partial<Dnd5eDamageData>[] = [];
      if (Array.isArray(rawParts)) {
        damageParts = rawParts;
      } else if (rawParts && typeof (rawParts as any).forEach === "function") {
        // Handle Collection/Map-like objects
        (rawParts as any).forEach((part: any) => damageParts.push(part));
      } else if (rawParts && typeof rawParts === "object") {
        damageParts = Object.values(rawParts);
      }

      for (const part of damageParts) {
        let formula = "";
        let dmgType = "";

        if (Array.isArray(part)) {
          // Legacy array format
          formula = (part as any)[0] ?? "";
          dmgType = (part as any)[1] ?? "";
        } else if (typeof part === "object" && part !== null) {
          // dnd5e 5.x format: Dnd5eDamageData
          // {number: 4, denomination: 10, bonus: "", types: Set(["lightning"])}
          if (part.number && part.denomination) {
            formula = `${part.number}d${part.denomination}`;
            if (part.bonus) formula += ` + ${part.bonus}`;
          } else if (part.custom?.enabled && part.custom.formula) {
            formula = part.custom.formula;
          } else {
            formula = (part as any).formula ?? "";
          }
          // Use helper to get first damage type from Set or Array
          dmgType = getFirstFromSetOrArray(part.types) ?? (part as any).type ?? "";
        }

        if (formula && typeof formula === "string") {
          const avg = this.estimateDamageAverage(formula, actor);
          const safeType = typeof dmgType === "string" ? dmgType : String(dmgType ?? "");
          damage.push({
            avg,
            formula: this.resolveFormula(formula, actor),
            type: safeType ? this.capitalize(safeType) : "",
          });
        }
      }

      // Build save DC string - activity.save.ability is a Set<string> in dnd5e 5.x
      const saveAbility = getFirstFromSetOrArray(activity.save?.ability) ?? "";
      const saveDC = activity.save?.dc?.formula ?? activity.save?.dc?.value ?? "";
      const saveStr = saveAbility && saveDC ? `DC ${saveDC} ${saveAbility.toUpperCase()}` : "";

      return {
        type: "save",
        toHit: "",
        reach: "",
        damage,
        save: saveStr,
      };
    } catch (err) {
      Log.warn("Failed to extract save activity data", { activity, err: String(err) });
      return undefined;
    }
  }

  /**
   * Extract damage info from any activity (for filling in empty placeholders).
   * This is used for passive features like "Fanatic Advantage" where the description
   * has "7 ()" but the damage formula is stored in an activity.
   */
  private extractAnyDamageFromActivities(item: any, actor?: any): { formula: string; avg: number } | null {
    const activities = item.system?.activities;
    if (!activities) return null;

    try {
      let activityValues: any[] = [];
      if (activities instanceof Map) {
        activityValues = Array.from(activities.values());
      } else if (typeof activities.values === "function") {
        activityValues = Array.from(activities.values());
      } else if (typeof activities === "object" && activities !== null) {
        activityValues = Object.values(activities);
      }

      // Debug: Log activity structure
      Log.debug("extractAnyDamageFromActivities - activities found", {
        itemName: item.name,
        activityCount: activityValues.length,
        activities: activityValues.map((a: any) => ({
          type: a.type,
          name: a.name,
          hasDamage: !!a.damage,
          damageKeys: a.damage ? Object.keys(a.damage) : [],
          damageParts: a.damage?.parts ?
            (Array.isArray(a.damage.parts) ? a.damage.parts.length :
             typeof a.damage.parts.size === "number" ? a.damage.parts.size :
             Object.keys(a.damage.parts).length) : 0,
          rawDamage: a.damage ? JSON.stringify(a.damage).slice(0, 500) : null,
        })),
      });

      // Look for any activity with damage parts
      for (const activity of activityValues) {
        const rawParts = activity.damage?.parts;
        if (!rawParts) continue;

        // Convert to array safely
        let damageParts: any[] = [];
        if (Array.isArray(rawParts)) {
          damageParts = rawParts;
        } else if (typeof (rawParts as any).forEach === "function") {
          (rawParts as any).forEach((part: any) => damageParts.push(part));
        } else if (typeof rawParts === "object") {
          damageParts = Object.values(rawParts);
        }

        Log.debug("extractAnyDamageFromActivities - damage parts", {
          itemName: item.name,
          activityType: activity.type,
          partsCount: damageParts.length,
          parts: damageParts.map((p: any) => JSON.stringify(p).slice(0, 200)),
        });

        // Extract the first damage formula
        for (const part of damageParts) {
          let formula = "";
          if (Array.isArray(part)) {
            formula = part[0] ?? "";
          } else if (typeof part === "object" && part !== null) {
            if (part.number && part.denomination) {
              formula = `${part.number}d${part.denomination}`;
              if (part.bonus) formula += ` + ${part.bonus}`;
            } else if (part.custom?.enabled && part.custom.formula) {
              formula = part.custom.formula;
            } else {
              formula = part.formula ?? "";
            }
          }

          if (formula && typeof formula === "string") {
            const resolved = this.resolveFormula(formula, actor);
            const avg = this.estimateDamageAverage(formula, actor);
            Log.debug("extractAnyDamageFromActivities - found formula", {
              itemName: item.name,
              formula,
              resolved,
              avg,
            });
            return { formula: resolved, avg };
          }
        }
      }
    } catch (err) {
      Log.warn("extractAnyDamageFromActivities error", { itemName: item.name, err: String(err) });
    }

    return null;
  }

  /** Estimate average damage from a formula like "1d8 + @mod" */
  private estimateDamageAverage(formula: string, actor?: any, abilityKey?: string): number {
    try {
      // First resolve the formula to get actual numbers
      const resolved = this.resolveFormula(formula, actor, abilityKey);

      // Replace dice with averages: 1d8 -> 4.5, 2d6 -> 7, etc.
      let avgFormula = resolved.replace(/(\d+)d(\d+)/gi, (_, count, sides) => {
        const n = parseInt(count);
        const s = parseInt(sides);
        return String(n * (s + 1) / 2);
      });

      // Simple evaluation (only +, -, and numbers)
      avgFormula = avgFormula.replace(/[^0-9.+\-\s]/g, "");
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${avgFormula})`)();
      return Math.floor(result);
    } catch {
      return 0;
    }
  }

  /** Resolve @mod and similar placeholders in a formula */
  private resolveFormula(formula: string, actor?: any, abilityKey?: string): string {
    if (!actor) return formula;

    let resolved = formula;

    // Replace @mod with the specified ability modifier
    const defaultMod = actor.system?.abilities?.[abilityKey ?? "str"]?.mod ?? 0;
    resolved = resolved.replace(/@mod/gi, String(defaultMod));

    // Replace @str.mod, @dex.mod, etc.
    resolved = resolved.replace(/@(\w+)\.mod/gi, (_, ability) => {
      return String(actor.system?.abilities?.[ability.toLowerCase()]?.mod ?? 0);
    });

    // Replace @prof with proficiency bonus
    const prof = actor.system?.attributes?.prof ?? 2;
    resolved = resolved.replace(/@prof/gi, String(prof));

    return resolved;
  }

  /**
   * Strip Foundry enriched text placeholders and resolve UUID references.
   * Converts @UUID[...]{DisplayName} to just "DisplayName"
   * Converts [[lookup @name lowercase]] to "the creature" (generic fallback)
   */
  private stripEnrichedText(html: string, actorName?: string): string {
    return html
      // @UUID[Compendium.xxx.xxx]{DisplayName} -> "DisplayName"
      .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
      // [[lookup @name lowercase]] -> actor name or "the creature"
      .replace(/\[\[lookup\s+@name\s+lowercase\]\]/gi, actorName?.toLowerCase() ?? "the creature")
      // [[lookup @name]] -> actor name or "The creature"
      .replace(/\[\[lookup\s+@name\]\]/gi, actorName ?? "The creature")
      // [[/item Name]] -> "Name" (preserve the item name)
      .replace(/\[\[\/item\s+([^\]]+)\]\]/gi, "$1")
      // Remove other placeholders like [[/attack]], [[/damage average]], etc.
      .replace(/\[\[\/[^\]]+\]\]/g, "")
      // Remove remaining [[...]] placeholders
      .replace(/\[\[[^\]]*\]\]/g, "")
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /** Determine the activation type category for an NPC item */
  private getActivationType(item: any): string {
    // Check activities first (dnd5e 2024 style)
    const activities = item.system?.activities;
    if (activities) {
      try {
        // dnd5e activities can be a Map, Collection, or plain object
        let activityValues: any[] = [];
        if (activities instanceof Map) {
          activityValues = Array.from(activities.values());
        } else if (typeof activities.values === "function") {
          // Collection or Map-like object
          activityValues = Array.from(activities.values());
        } else if (typeof activities === "object" && activities !== null) {
          // Plain object
          activityValues = Object.values(activities);
        }

        for (const activity of activityValues) {
          const type = activity?.activation?.type;
          if (type) return type;
        }
      } catch {
        // If activities iteration fails, fall through to legacy activation
      }
    }
    // Fallback to legacy activation
    return item.system?.activation?.type ?? "none";
  }
}

// Auto-register when this module is imported
registerExtractor(new Dnd5eExtractor());

