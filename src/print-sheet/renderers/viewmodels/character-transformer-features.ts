import type { FeatureData, FeatureGroup } from "../../extractors/dnd5e-types";
import { getFeatureSummary, type SummaryContext } from "../../data/feature-summaries";
import type {
  FeatureGroupViewModel,
  FeatureItemViewModel,
  ProficiencyViewModel,
} from "./character-viewmodel";
import { esc, replaceAdvDisText, stripHtml } from "./character-transformer-common";

export function buildFeatureGroups(
  groups: FeatureGroup[],
  actionNames: Set<string>,
  ctx: SummaryContext,
): FeatureGroupViewModel[] {
  return groups
    .map((group) => {
      const filteredFeatures = group.features.filter((feature) => !actionNames.has(feature.name.toLowerCase()));
      if (filteredFeatures.length === 0) return null;

      return {
        category: esc(group.category),
        features: filteredFeatures.map((feature) => buildFeatureItem(feature, ctx)),
      };
    })
    .filter((group): group is FeatureGroupViewModel => group !== null);
}

export function buildProficiencies(
  profs: { armor: string[]; weapons: string[]; tools: string[]; weaponMasteries: string[] },
  languages: string[],
): ProficiencyViewModel {
  const masteryList = profs.weaponMasteries.map((weapon) => `⚔ ${esc(weapon)}`).join(", ");

  return {
    armor: profs.armor.join(", "),
    hasArmor: profs.armor.length > 0,
    weapons: profs.weapons.join(", "),
    hasWeapons: profs.weapons.length > 0,
    weaponMasteries: masteryList,
    hasWeaponMasteries: profs.weaponMasteries.length > 0,
    tools: profs.tools.join(", "),
    hasTools: profs.tools.length > 0,
    languages: languages.map(esc).join(", "),
    hasLanguages: languages.length > 0,
  };
}

function buildFeatureItem(feature: FeatureData, ctx: SummaryContext): FeatureItemViewModel {
  let usesDisplay = "";
  let checkboxes = "";

  if (feature.uses) {
    const recoveryLabel = formatRecoveryPeriod(feature.uses.recovery);
    usesDisplay = `(${feature.uses.max}/${recoveryLabel})`;
    checkboxes = "☐".repeat(feature.uses.max);
  }

  const rawDescription = feature.description ? stripHtml(feature.description) : "";
  const description = replaceAdvDisText(esc(
    getFeatureSummary(feature.name, rawDescription, ctx, feature.description || undefined),
  ));

  return {
    favStar: feature.isFavorite ? "★ " : "",
    name: esc(feature.name),
    usesDisplay,
    checkboxes,
    description,
  };
}

function formatRecoveryPeriod(recovery: string | undefined): string {
  if (!recovery) return "";

  const map: Record<string, string> = {
    day: "Day",
    lr: "Long Rest",
    sr: "Short Rest",
    dawn: "Dawn",
    dusk: "Dusk",
    round: "Round",
    turn: "Turn",
  };

  return map[recovery.toLowerCase()] || recovery;
}
