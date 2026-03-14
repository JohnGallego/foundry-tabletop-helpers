/**
 * Character Creator — Step 10: Portrait
 *
 * AI portrait generation via companion server Gemini integration.
 * Falls back to upload-only when server is unavailable.
 * Always skippable — portrait can be added later.
 */

import { MOD } from "../../logger";
import type { WizardStepDefinition, WizardState, PortraitSelection, StepCallbacks } from "../character-creator-types";
import { isPortraitAvailable, generatePortraits } from "../portrait/portrait-client";
import type { GeneratedPortrait } from "../portrait/portrait-client";
import { buildPortraitPrompt } from "../portrait/portrait-prompt-builder";

/* ── Step Definition ─────────────────────────────────────── */

export function createPortraitStep(): WizardStepDefinition {
  return {
    id: "portrait",
    label: "Portrait",
    icon: "fa-solid fa-image-portrait",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-portrait.hbs`,
    dependencies: [],

    isApplicable: () => true,
    isComplete: () => true, // Always complete — portrait is optional

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const sel = state.selections.portrait;
      const serverAvailable = await isPortraitAvailable();

      // Auto-generate prompt from wizard selections
      const autoPrompt = buildPortraitPrompt(state);

      return {
        stepId: "portrait",
        serverAvailable,
        autoPrompt,
        hasPortrait: !!sel?.portraitDataUrl,
        portraitDataUrl: sel?.portraitDataUrl ?? "",
        tokenDataUrl: sel?.tokenDataUrl ?? "",
        source: sel?.source ?? "none",
        raceName: state.selections.species?.name ?? "",
        className: state.selections.class?.name ?? "",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      const gallery = el.querySelector(".cc-portrait-gallery") as HTMLElement | null;
      const preview = el.querySelector(".cc-portrait-preview") as HTMLElement | null;
      const generateBtn = el.querySelector("[data-action='generatePortrait']") as HTMLButtonElement | null;
      const uploadBtn = el.querySelector("[data-action='uploadPortrait']") as HTMLButtonElement | null;
      const clearBtn = el.querySelector("[data-action='clearPortrait']") as HTMLButtonElement | null;
      const descInput = el.querySelector("[data-portrait-description]") as HTMLTextAreaElement | null;
      const styleSelect = el.querySelector("[data-portrait-style]") as HTMLSelectElement | null;

      // Track generated images for gallery selection
      let generatedImages: GeneratedPortrait[] = [];

      // Generate button
      generateBtn?.addEventListener("click", async () => {
        if (!generateBtn) return;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

        // Clear gallery
        if (gallery) gallery.innerHTML = "";

        try {
          const description = descInput?.value?.trim() ?? "";
          const style = (styleSelect?.value ?? "fantasy") as "fantasy" | "realistic" | "painterly";
          const prompt = buildPortraitPrompt(state, description);

          generatedImages = await generatePortraits({
            prompt,
            style,
            count: 4,
          });

          if (generatedImages.length > 0 && gallery) {
            renderGallery(gallery, generatedImages, (img) => {
              selectPortrait(img.dataUrl, state, callbacks, preview);
            });
          } else if (gallery) {
            gallery.innerHTML = '<p class="cc-portrait-empty">No images were generated. Try adjusting your description or try again.</p>';
          }
        } catch {
          if (gallery) {
            gallery.innerHTML = '<p class="cc-portrait-empty">Generation failed. Please try again.</p>';
          }
        } finally {
          generateBtn.disabled = false;
          generateBtn.innerHTML = '<i class="fa-solid fa-wand-sparkles"></i> Generate Portraits';
        }
      });

      // Upload button — use Foundry's FilePicker
      uploadBtn?.addEventListener("click", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FP = (globalThis as any).FilePicker;
        if (!FP) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const picker = new FP({
          type: "image",
          current: "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (path: string) => {
            selectPortrait(path, state, callbacks, preview);
          },
        });
        picker.render(true);
      });

      // Clear button
      clearBtn?.addEventListener("click", () => {
        callbacks.setData({
          portraitDataUrl: undefined,
          tokenDataUrl: undefined,
          source: "none",
        } as PortraitSelection);
        if (preview) {
          preview.innerHTML = "";
          preview.classList.remove("cc-portrait-preview--active");
        }
      });

      // If portrait already selected, show it
      const currentPortrait = state.selections.portrait?.portraitDataUrl;
      if (currentPortrait && preview) {
        showPreview(preview, currentPortrait);
      }
    },
  };
}

/* ── Helpers ──────────────────────────────────────────────── */

function renderGallery(
  container: HTMLElement,
  images: GeneratedPortrait[],
  onSelect: (img: GeneratedPortrait) => void,
): void {
  container.innerHTML = "";
  for (const img of images) {
    const card = document.createElement("div");
    card.className = "cc-portrait-card";
    card.innerHTML = `<img src="${img.dataUrl}" alt="Generated portrait" />`;
    card.addEventListener("click", () => {
      // Mark selected
      container.querySelectorAll(".cc-portrait-card").forEach((c) =>
        c.classList.remove("cc-portrait-card--selected"),
      );
      card.classList.add("cc-portrait-card--selected");
      onSelect(img);
    });
    container.appendChild(card);
  }
}

function selectPortrait(
  dataUrl: string,
  _state: WizardState,
  callbacks: StepCallbacks,
  preview: HTMLElement | null,
): void {
  const isDataUrl = dataUrl.startsWith("data:");
  const source: PortraitSelection["source"] = isDataUrl ? "generated" : "uploaded";

  callbacks.setData({
    portraitDataUrl: dataUrl,
    tokenDataUrl: dataUrl, // Token uses same image; cropping handled at actor creation
    source,
  } as PortraitSelection);

  if (preview) {
    showPreview(preview, dataUrl);
  }
}

function showPreview(container: HTMLElement, src: string): void {
  container.innerHTML = `<img src="${src}" alt="Selected portrait" class="cc-portrait-preview__img" />`;
  container.classList.add("cc-portrait-preview--active");
}
