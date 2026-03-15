import type {
  FeatureEntryViewModel,
  FeatureSectionViewModel,
  NPCViewModel,
} from "../../print-sheet/renderers/viewmodels/npc-viewmodel";

export interface UpNextInfo {
  name: string;
  isNPC: boolean;
  ac?: number;
  hpMax?: number;
  cr?: string;
}

export function buildMonsterPreviewContentHTML(vm: NPCViewModel, upNext: UpNextInfo | null): string {
  return `
    ${buildMonsterPreviewStatBlockHTML(vm)}
    <div class="mp-up-next">${buildMonsterPreviewUpNextHTML(upNext)}</div>
  `;
}

export function buildMonsterPreviewInlineHTML(content: string): string {
  return `
    <div class="mp-header">
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      <button class="mp-popout" type="button" aria-label="Pop out" data-tooltip="Pop Out">
        <i class="fa-solid fa-up-right-from-square"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

export function buildMonsterPreviewPanelHTML(content: string): string {
  return `
    <div class="mp-header" data-mp-drag>
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      <button class="mp-dock" type="button" aria-label="Dock to sidebar" data-tooltip="Dock to Sidebar">
        <i class="fa-solid fa-right-to-bracket"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

export function buildMonsterPreviewStatBlockHTML(vm: NPCViewModel): string {
  const parts: string[] = [];
  parts.push(`<div class="mp-identity">`);
  if (vm.hasPortrait) {
    parts.push(`<img class="mp-portrait" src="${vm.portraitUrl}" alt="" />`);
  }
  parts.push(`<div class="mp-name-block">`);
  parts.push(`<div class="mp-name">${vm.name}</div>`);
  parts.push(`<div class="mp-meta">${vm.meta}</div>`);
  parts.push(`</div></div>`);

  if (vm.showStats) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-core-stats">`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">AC</span> <span class="mp-stat-value">${vm.ac}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">HP</span> <span class="mp-stat-value">${vm.hp}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Speed</span> <span class="mp-stat-value">${vm.speed}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Init</span> <span class="mp-stat-value">${vm.initiative}</span></div>`);
    parts.push(`</div>`);
  }

  if (vm.showAbilities && vm.abilityRows.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-abilities">`);
    for (const row of vm.abilityRows) {
      if (row.left) parts.push(buildMonsterPreviewAbilityCell(row.left));
      if (row.right) parts.push(buildMonsterPreviewAbilityCell(row.right));
    }
    parts.push(`</div>`);
  }

  if (vm.showTraits && vm.traitLines.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-traits">`);
    for (const trait of vm.traitLines) {
      parts.push(`<div class="mp-trait"><strong class="mp-trait-label">${trait.label}</strong> ${trait.value}</div>`);
    }
    parts.push(`</div>`);
  }

  if (vm.featureSections.length > 0) {
    for (const section of vm.featureSections) {
      if (!section.hasEntries) continue;
      parts.push(buildMonsterPreviewFeatureSection(section));
    }
  }

  return parts.join("");
}

export function buildMonsterPreviewAbilityCell(cell: { key: string; value: number; mod: string; save: string }): string {
  return `
    <div class="mp-ability">
      <span class="mp-ability-key">${cell.key}</span>
      <span class="mp-ability-score">${cell.value} <span class="mp-ability-mod">(${cell.mod})</span></span>
      <span class="mp-ability-save">Save ${cell.save}</span>
    </div>
  `;
}

export function buildMonsterPreviewFeatureSection(section: FeatureSectionViewModel): string {
  const parts: string[] = [];
  parts.push(`<div class="mp-divider"></div>`);
  parts.push(`<div class="mp-feature-section">`);
  parts.push(`<div class="mp-section-title">${section.title}</div>`);
  if (section.intro) {
    parts.push(`<div class="mp-section-intro">${section.intro}</div>`);
  }
  for (const entry of section.entries) {
    parts.push(buildMonsterPreviewFeatureEntry(entry));
  }
  parts.push(`</div>`);
  return parts.join("");
}

export function buildMonsterPreviewFeatureEntry(entry: FeatureEntryViewModel): string {
  return `
    <div class="mp-feature">
      <span class="mp-feature-name">${entry.nameWithUses}.</span>
      <span class="mp-feature-desc">${entry.description}</span>
    </div>
  `;
}

export function buildMonsterPreviewUpNextHTML(upNext: UpNextInfo | null): string {
  if (!upNext) return "";

  let statsHtml = "";
  if (upNext.isNPC) {
    const statParts: string[] = [];
    if (upNext.cr !== undefined) statParts.push(`CR ${upNext.cr}`);
    if (upNext.ac !== undefined) statParts.push(`AC ${upNext.ac}`);
    if (upNext.hpMax !== undefined) statParts.push(`HP ${upNext.hpMax}`);
    statsHtml = statParts.length > 0
      ? `<span class="mp-upnext-stats">${statParts.join(" · ")}</span>`
      : "";
  }

  const icon = upNext.isNPC
    ? `<i class="fa-solid fa-skull"></i>`
    : `<i class="fa-solid fa-user"></i>`;

  return `
    <div class="mp-upnext-divider"></div>
    <div class="mp-upnext-row">
      <span class="mp-upnext-label">Up Next</span>
      <span class="mp-upnext-name">${icon} ${upNext.name}</span>
      ${statsHtml}
    </div>
  `;
}
