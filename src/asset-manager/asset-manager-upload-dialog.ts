import { Log, MOD } from "../logger";
import { getGame } from "../types";
import { classifyExt, extname } from "./asset-manager-types";
import { formatBytes } from "./asset-manager-preview";
import { AM_SETTINGS } from "./asset-manager-settings";
import {
  type OptPreset,
  type UploadDialogResult,
  type CustomOptSettings,
  type OptPresetConfig,
  PRESETS,
  sanitizeFilename,
  autoDetectPreset,
} from "./asset-manager-upload";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DialogFileEntry {
  file: File;
  outputName: string;
  preset: OptPreset;
  custom?: CustomOptSettings;
  type: string;
  ext: string;
  isOptimizable: boolean;
  dimensions?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PRESET_CYCLE: Exclude<OptPreset, "auto">[] = [
  "token",
  "portrait",
  "map",
  "icon",
  "none",
];

const OPTIMIZABLE_IMAGE_TYPES = new Set(["image"]);
const OPTIMIZABLE_AUDIO_TYPES = new Set(["audio"]);

function isOptimizableFile(type: string): boolean {
  return OPTIMIZABLE_IMAGE_TYPES.has(type) || OPTIMIZABLE_AUDIO_TYPES.has(type);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/*  1. buildInitialEntries                                            */
/* ------------------------------------------------------------------ */

function buildInitialEntries(
  files: File[],
  defaultNone: boolean,
): DialogFileEntry[] {
  return files.map((file) => {
    const ext = extname(file.name);
    const type = classifyExt(ext);
    const optimizable = isOptimizableFile(type);

    let preset: OptPreset = "none";
    if (!defaultNone && optimizable) {
      preset = autoDetectPreset(file, type);
    }

    const outputName = computeOutputName(file.name, preset, ext, type);

    return {
      file,
      outputName,
      preset,
      type,
      ext,
      isOptimizable: optimizable,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  2. computeOutputName                                              */
/* ------------------------------------------------------------------ */

function computeOutputName(
  originalName: string,
  preset: OptPreset,
  ext: string,
  type: string,
): string {
  if (preset !== "none") {
    if (OPTIMIZABLE_IMAGE_TYPES.has(type) && ext.toLowerCase() !== ".webp") {
      const base = originalName.replace(/\.[^.]+$/, "");
      return sanitizeFilename(`${base}.webp`);
    }
    if (OPTIMIZABLE_AUDIO_TYPES.has(type) && ext.toLowerCase() !== ".ogg") {
      const base = originalName.replace(/\.[^.]+$/, "");
      return sanitizeFilename(`${base}.ogg`);
    }
  }
  return sanitizeFilename(originalName);
}

/* ------------------------------------------------------------------ */
/*  3. buildDialogHTML                                                */
/* ------------------------------------------------------------------ */

function buildDialogHTML(entries: DialogFileEntry[], targetPath: string): string {
  const totalSize = entries.reduce((sum, e) => sum + e.file.size, 0);

  const globalPresets: OptPreset[] = [
    "auto",
    "token",
    "portrait",
    "map",
    "icon",
    "none",
  ];

  let html = "";

  // Header
  html += `<div class="am-ud-header">`;
  html += `<strong>${entries.length} file${entries.length !== 1 ? "s" : ""}</strong>`;
  html += ` &middot; ${esc(formatBytes(totalSize))}`;
  html += ` &rarr; <code>${esc(targetPath)}</code>`;
  html += `</div>`;

  // Global preset bar
  html += `<div class="am-ud-global-bar">`;
  for (const p of globalPresets) {
    html += `<button type="button" class="am-ud-global" data-ud-global="${p}">${esc(capitalize(p))}</button>`;
  }
  html += `</div>`;

  // Tags input
  html += `<div class="am-ud-tags">`;
  html += `<div class="am-ud-tags__label">`;
  html += `<i class="fa-solid fa-tags"></i> Tags`;
  html += `<span class="am-ud-tags__hint">Applied to all uploaded files</span>`;
  html += `</div>`;
  html += `<div class="am-ud-tags__list" data-ud-tag-list></div>`;
  html += `<div class="am-ud-tags__input-wrap">`;
  html += `<input type="text" class="am-ud-tags__input" data-ud-tag-input placeholder="Add tag..." autocomplete="off" />`;
  html += `</div>`;
  html += `</div>`;

  // File list
  html += `<div class="am-ud-list">`;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const badgeLabel = e.custom ? "Custom" : capitalize(e.preset);
    const badgeClass = e.custom
      ? "am-ud-preset am-ud-preset--custom"
      : `am-ud-preset am-ud-preset--${e.preset}`;
    const isImage = OPTIMIZABLE_IMAGE_TYPES.has(e.type);
    const showGear = isImage && e.isOptimizable && e.preset !== "none";

    html += `<div class="am-ud-row" data-ud-index="${i}">`;
    html += `<span class="am-ud-name" data-ud-name>${esc(e.outputName)}</span>`;
    html += `<span class="am-ud-size">${esc(formatBytes(e.file.size))}</span>`;
    html += `<span class="am-ud-dims" data-ud-dims></span>`;
    html += `<button type="button" class="${badgeClass}" data-ud-preset data-ud-index="${i}"`;
    if (!e.isOptimizable) html += ` disabled`;
    html += `>${esc(badgeLabel)}</button>`;
    html += `<button type="button" class="am-ud-gear" data-ud-gear data-ud-index="${i}"`;
    if (!showGear) html += ` style="display:none"`;
    html += `><i class="fas fa-cog"></i></button>`;
    html += `</div>`;
  }
  html += `</div>`;

  return html;
}

/* ------------------------------------------------------------------ */
/*  4. buildCustomPanel                                               */
/* ------------------------------------------------------------------ */

function buildCustomPanel(entry: DialogFileEntry, index: number): string {
  const presetKey = entry.preset as keyof typeof PRESETS;
  const defaults: OptPresetConfig | undefined = PRESETS[presetKey];
  const quality = entry.custom?.quality ?? (defaults ? Math.round(defaults.quality * 100) : 85);
  const maxW = entry.custom?.maxWidth ?? (defaults?.maxWidth ?? 4096);
  const maxH = entry.custom?.maxHeight ?? (defaults?.maxHeight ?? 4096);

  let html = `<div class="am-ud-custom-panel" data-ud-custom-panel="${index}">`;
  html += `<div class="am-ud-custom-row">`;
  html += `<label>Quality: <span data-ud-quality-label>${quality}</span></label>`;
  html += `<input type="range" min="1" max="100" value="${quality}" data-ud-quality="${index}" />`;
  html += `</div>`;
  html += `<div class="am-ud-custom-row">`;
  html += `<label>Max Width</label>`;
  html += `<input type="number" min="1" max="16384" value="${maxW}" data-ud-maxw="${index}" />`;
  html += `</div>`;
  html += `<div class="am-ud-custom-row">`;
  html += `<label>Max Height</label>`;
  html += `<input type="number" min="1" max="16384" value="${maxH}" data-ud-maxh="${index}" />`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

/* ------------------------------------------------------------------ */
/*  6. attachDialogListeners                                          */
/* ------------------------------------------------------------------ */

function attachDialogListeners(
  el: HTMLElement,
  entries: DialogFileEntry[],
): void {
  el.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const globalBtn = target.closest<HTMLElement>("[data-ud-global]");
    if (globalBtn) {
      const preset = globalBtn.dataset.udGlobal as OptPreset;
      applyGlobalPreset(el, entries, preset);
      return;
    }

    const presetBtn = target.closest<HTMLElement>("[data-ud-preset]");
    if (presetBtn && !presetBtn.hasAttribute("disabled")) {
      const idx = Number(presetBtn.dataset.udIndex);
      if (!Number.isNaN(idx)) cyclePreset(el, entries, idx);
      return;
    }

    const gearBtn = target.closest<HTMLElement>("[data-ud-gear]");
    if (gearBtn) {
      const idx = Number(gearBtn.dataset.udIndex);
      if (!Number.isNaN(idx)) toggleCustomPanel(el, entries, idx);
    }
  });
}

/* ------------------------------------------------------------------ */
/*  7. applyGlobalPreset                                              */
/* ------------------------------------------------------------------ */

function applyGlobalPreset(
  el: HTMLElement,
  entries: DialogFileEntry[],
  preset: OptPreset,
): void {
  // Close any open custom panel
  const openPanel = el.querySelector("[data-ud-custom-panel]");
  if (openPanel) openPanel.remove();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.isOptimizable) continue;

    if (preset === "auto") {
      e.preset = autoDetectPreset(e.file, e.type);
    } else {
      e.preset = preset;
    }
    e.custom = undefined;
    e.outputName = computeOutputName(e.file.name, e.preset, e.ext, e.type);
    updateRowDOM(el, entries, i);
  }

  updateGlobalBarHighlight(el, entries);
}

/* ------------------------------------------------------------------ */
/*  8. cyclePreset                                                    */
/* ------------------------------------------------------------------ */

function cyclePreset(
  el: HTMLElement,
  entries: DialogFileEntry[],
  index: number,
): void {
  const entry = entries[index];
  if (!entry.isOptimizable) return;

  const currentIdx = PRESET_CYCLE.indexOf(
    entry.preset === "auto" ? "token" : (entry.preset as Exclude<OptPreset, "auto">),
  );
  const nextIdx = (currentIdx + 1) % PRESET_CYCLE.length;
  entry.preset = PRESET_CYCLE[nextIdx];
  entry.custom = undefined;
  entry.outputName = computeOutputName(
    entry.file.name,
    entry.preset,
    entry.ext,
    entry.type,
  );

  // Close custom panel if open
  const panel = el.querySelector(`[data-ud-custom-panel="${index}"]`);
  if (panel) panel.remove();

  updateRowDOM(el, entries, index);
  updateGlobalBarHighlight(el, entries);
}

/* ------------------------------------------------------------------ */
/*  9. toggleCustomPanel                                              */
/* ------------------------------------------------------------------ */

function toggleCustomPanel(
  el: HTMLElement,
  entries: DialogFileEntry[],
  index: number,
): void {
  const existing = el.querySelector(`[data-ud-custom-panel="${index}"]`);
  if (existing) {
    existing.remove();
    return;
  }

  // Close any other panel
  const otherPanel = el.querySelector("[data-ud-custom-panel]");
  if (otherPanel) otherPanel.remove();

  const row = el.querySelector(`.am-ud-row[data-ud-index="${index}"]`);
  if (!row) return;

  const panelHTML = buildCustomPanel(entries[index], index);
  row.insertAdjacentHTML("afterend", panelHTML);

  const panelEl = el.querySelector(`[data-ud-custom-panel="${index}"]`);
  if (panelEl) {
    attachCustomInputListeners(el, entries, index);
  }
}

/* ------------------------------------------------------------------ */
/*  10. attachCustomInputListeners                                    */
/* ------------------------------------------------------------------ */

function attachCustomInputListeners(
  el: HTMLElement,
  entries: DialogFileEntry[],
  index: number,
): void {
  const entry = entries[index];

  const qualitySlider = el.querySelector<HTMLInputElement>(
    `[data-ud-quality="${index}"]`,
  );
  const maxWInput = el.querySelector<HTMLInputElement>(
    `[data-ud-maxw="${index}"]`,
  );
  const maxHInput = el.querySelector<HTMLInputElement>(
    `[data-ud-maxh="${index}"]`,
  );

  function ensureCustom(): CustomOptSettings {
    if (!entry.custom) {
      const presetKey = entry.preset as keyof typeof PRESETS;
      const defaults = PRESETS[presetKey];
      entry.custom = {
        quality: defaults ? Math.round(defaults.quality * 100) : 85,
        maxWidth: defaults?.maxWidth ?? 4096,
        maxHeight: defaults?.maxHeight ?? 4096,
      };
    }
    return entry.custom;
  }

  qualitySlider?.addEventListener("input", () => {
    const custom = ensureCustom();
    custom.quality = Number(qualitySlider.value);
    const label = el.querySelector(
      `[data-ud-custom-panel="${index}"] [data-ud-quality-label]`,
    );
    if (label) label.textContent = String(custom.quality);
    updateRowDOM(el, entries, index);
  });

  maxWInput?.addEventListener("change", () => {
    const custom = ensureCustom();
    custom.maxWidth = Number(maxWInput.value) || custom.maxWidth;
    updateRowDOM(el, entries, index);
  });

  maxHInput?.addEventListener("change", () => {
    const custom = ensureCustom();
    custom.maxHeight = Number(maxHInput.value) || custom.maxHeight;
    updateRowDOM(el, entries, index);
  });
}

/* ------------------------------------------------------------------ */
/*  11. updateRowDOM                                                  */
/* ------------------------------------------------------------------ */

function updateRowDOM(
  el: HTMLElement,
  entries: DialogFileEntry[],
  index: number,
): void {
  const entry = entries[index];
  const row = el.querySelector(`.am-ud-row[data-ud-index="${index}"]`);
  if (!row) return;

  // Update preset badge
  const badge = row.querySelector<HTMLElement>("[data-ud-preset]");
  if (badge) {
    const badgeLabel = entry.custom ? "Custom" : capitalize(entry.preset);
    badge.textContent = badgeLabel;
    const badgeModifier = entry.custom ? "custom" : entry.preset;
    badge.className = `am-ud-preset am-ud-preset--${badgeModifier}`;
  }

  // Update filename
  const nameEl = row.querySelector<HTMLElement>("[data-ud-name]");
  if (nameEl) {
    nameEl.textContent = entry.outputName;
  }

  // Update gear visibility
  const gearBtn = row.querySelector<HTMLElement>("[data-ud-gear]");
  if (gearBtn) {
    const isImage = OPTIMIZABLE_IMAGE_TYPES.has(entry.type);
    const showGear = isImage && entry.isOptimizable && entry.preset !== "none";
    gearBtn.style.display = showGear ? "" : "none";
  }
}

/* ------------------------------------------------------------------ */
/*  12. updateGlobalBarHighlight                                      */
/* ------------------------------------------------------------------ */

function updateGlobalBarHighlight(
  el: HTMLElement,
  entries: DialogFileEntry[],
): void {
  const optimizable = entries.filter((e) => e.isOptimizable);
  if (optimizable.length === 0) return;

  // Find most common preset
  const counts = new Map<OptPreset, number>();
  for (const e of optimizable) {
    const p = e.preset;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let maxPreset: OptPreset = "none";
  let maxCount = 0;
  for (const [p, c] of counts) {
    if (c > maxCount) {
      maxCount = c;
      maxPreset = p;
    }
  }

  const buttons = el.querySelectorAll<HTMLElement>("[data-ud-global]");
  for (const btn of buttons) {
    const p = btn.dataset.udGlobal;
    if (p === maxPreset && maxCount === optimizable.length) {
      btn.classList.add("am-ud-global--active");
    } else {
      btn.classList.remove("am-ud-global--active");
    }
  }
}

/* ------------------------------------------------------------------ */
/*  13. loadImageDimensions                                           */
/* ------------------------------------------------------------------ */

async function loadImageDimensions(
  el: HTMLElement,
  entries: DialogFileEntry[],
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!OPTIMIZABLE_IMAGE_TYPES.has(entry.type)) continue;

    const idx = i;
    promises.push(
      createImageBitmap(entry.file)
        .then((bmp) => {
          entry.dimensions = `${bmp.width}x${bmp.height}`;
          bmp.close();
          const dimsEl = el.querySelector(
            `.am-ud-row[data-ud-index="${idx}"] [data-ud-dims]`,
          );
          if (dimsEl) dimsEl.textContent = entry.dimensions;
        })
        .catch(() => {
          /* non-decodable image — skip */
        }),
    );
  }

  await Promise.all(promises);
}

/* ------------------------------------------------------------------ */
/*  Tag Input Listeners                                               */
/* ------------------------------------------------------------------ */

function attachTagListeners(el: HTMLElement, tags: string[]): void {
  const input = el.querySelector<HTMLInputElement>("[data-ud-tag-input]");
  const list = el.querySelector<HTMLElement>("[data-ud-tag-list]");
  if (!input || !list) return;

  function addTag(raw: string): void {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    tags.push(tag);

    const chip = document.createElement("span");
    chip.className = "am-ud-tag-chip";
    chip.dataset.udTag = tag;

    const labelNode = document.createTextNode(tag + " ");
    chip.appendChild(labelNode);

    const removeBtn = document.createElement("button");
    removeBtn.className = "am-ud-tag-remove";
    removeBtn.dataset.udRemoveTag = tag;
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-xmark";
    removeBtn.appendChild(icon);
    chip.appendChild(removeBtn);

    list!.appendChild(chip);
  }

  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      addTag(input.value);
      input.value = "";
    }
  });

  list.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-ud-remove-tag]");
    if (!btn) return;
    const tag = btn.dataset.udRemoveTag;
    if (!tag) return;
    const idx = tags.indexOf(tag);
    if (idx !== -1) tags.splice(idx, 1);
    const chip = list!.querySelector(`[data-ud-tag="${tag}"]`);
    if (chip) chip.remove();
  });
}

/* ------------------------------------------------------------------ */
/*  5. showUploadConfirmDialog (main export)                          */
/* ------------------------------------------------------------------ */

export async function showUploadConfirmDialog(
  files: File[],
  targetPath: string,
): Promise<{ files: UploadDialogResult[]; tags: string[] } | null> {
  const g = getGame();
  const optimizeEnabled = g?.settings
    ? (g.settings.get(MOD, AM_SETTINGS.OPTIMIZE_ON_UPLOAD) as boolean)
    : false;

  const entries = buildInitialEntries(files, !optimizeEnabled);
  const tags: string[] = [];
  const dialogBody = buildDialogHTML(entries, targetPath);

  Log.info(`Upload dialog: ${files.length} files → ${targetPath}`);

  return new Promise<{ files: UploadDialogResult[]; tags: string[] } | null>((resolve) => {
    let resolved = false;

    function finish(result: { files: UploadDialogResult[]; tags: string[] } | null) {
      if (resolved) return;
      resolved = true;
      resolve(result);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DialogClass = (globalThis as any).Dialog;

    new DialogClass({
      title: "Upload Files",
      content: dialogBody,
      buttons: {
        upload: {
          icon: '<i class="fas fa-upload"></i>',
          label: "Upload",
          callback: () => {
            const results: UploadDialogResult[] = entries.map((e) => ({
              file: e.file,
              outputName: e.outputName,
              preset: e.preset,
              ...(e.custom ? { custom: e.custom } : {}),
            }));
            finish({ files: results, tags: [...tags] });
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => finish(null),
        },
      },
      default: "upload",
      render: (html: HTMLElement | JQuery) => {
        const el =
          html instanceof HTMLElement
            ? html
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (html as any)[0];
        attachDialogListeners(el, entries);
        attachTagListeners(el, tags);
        updateGlobalBarHighlight(el, entries);
        void loadImageDimensions(el, entries);
      },
      close: () => finish(null),
    }, {
      width: 520,
      classes: ["am-upload-dialog-window"],
    }).render(true);
  });
}
