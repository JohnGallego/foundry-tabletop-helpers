import { buildPreviewHTML, extractMetadata, type FileMetadata } from "./asset-manager-preview";
import { getMetadataStore } from "./asset-manager-metadata";
import { type AssetEntry } from "./asset-manager-types";

interface AssetManagerPreviewControllerDeps {
  findEntry: (path: string) => AssetEntry | undefined;
  getPreviewPath: () => string | null;
  setPreviewPath: (path: string | null) => void;
  setPreviewMeta: (meta: FileMetadata | null) => void;
  refreshSidebar: (root: HTMLElement) => void;
  esc: (value: string) => string;
}

export class AssetManagerPreviewController {
  constructor(private readonly deps: AssetManagerPreviewControllerDeps) {}

  showPreview(path: string, root: HTMLElement): void {
    const entry = this.deps.findEntry(path);
    if (!entry || entry.isDir) return;

    this.deps.setPreviewPath(path);
    this.deps.setPreviewMeta(null);

    const preview = root.querySelector<HTMLElement>(".am-preview");
    const wrap = root.querySelector<HTMLElement>(".am-content-wrap");
    if (!preview || !wrap) return;

    const renderPreview = (meta: FileMetadata | null) => {
      const baseHTML = buildPreviewHTML(entry, meta, this.deps.esc);
      const tagHTML = this.buildPreviewTags(path);
      return baseHTML.replace(
        `<div class="am-preview-actions">`,
        `${tagHTML}<div class="am-preview-actions">`,
      );
    };

    preview.innerHTML = renderPreview(null);
    preview.classList.add("am-preview-open");
    wrap.classList.add("am-has-preview");

    this.attachPreviewTagListeners(preview, path, root);

    extractMetadata(path, entry.type, entry.ext).then((meta) => {
      if (this.deps.getPreviewPath() !== path) return;
      this.deps.setPreviewMeta(meta);
      preview.innerHTML = renderPreview(meta);
      this.attachPreviewTagListeners(preview, path, root);
    }).catch(() => { /* ignore */ });
  }

  buildPreviewTags(path: string): string {
    const meta = getMetadataStore();
    const tags = meta.getAllTags();
    const fileTags = new Set<string>();

    for (const tag of tags) {
      if (meta.getFilesByTag(tag).includes(path)) fileTags.add(tag);
    }

    const pills = tags.map((tag) => {
      const color = meta.getTagColor(tag);
      const active = fileTags.has(tag);
      return `<button class="am-ptag${active ? " am-ptag-active" : ""}" data-am-ptag="${this.deps.esc(tag)}" type="button" style="--am-tag-color: ${color};">${this.deps.esc(tag)}</button>`;
    }).join("");

    return `
      <div class="am-preview-tags">
        <div class="am-preview-tags-label">Tags</div>
        <div class="am-preview-tags-list">
          ${pills || `<span class="am-sb-empty">No tags</span>`}
          <button class="am-ptag-add" type="button" title="Add new tag"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
    `;
  }

  attachPreviewTagListeners(preview: HTMLElement, path: string, root: HTMLElement): void {
    preview.querySelectorAll<HTMLElement>("[data-am-ptag]").forEach((pill) => {
      pill.addEventListener("click", async () => {
        const tag = pill.dataset.amPtag;
        if (!tag) return;
        const meta = getMetadataStore();
        const tags = await meta.getTags(path);
        if (tags.includes(tag)) {
          await meta.removeTag(path, tag);
        } else {
          await meta.addTag(path, tag);
        }
        if (this.deps.getPreviewPath() === path) {
          this.showPreview(path, root);
        }
      });
    });

    preview.querySelector(".am-ptag-add")?.addEventListener("click", async () => {
      const name = prompt("Enter tag name:");
      if (!name?.trim()) return;
      const tag = name.trim().toLowerCase();
      const meta = getMetadataStore();
      await meta.addTag(path, tag);
      if (!meta.getTagColor(tag) || meta.getTagColor(tag) === "#9a9590") {
        await meta.setTagColor(tag, this.getNextTagColor());
      }
      if (this.deps.getPreviewPath() === path) {
        this.showPreview(path, root);
      }
      this.deps.refreshSidebar(root);
    });
  }

  closePreview(root: HTMLElement): void {
    this.deps.setPreviewPath(null);
    this.deps.setPreviewMeta(null);

    const preview = root.querySelector<HTMLElement>(".am-preview");
    const wrap = root.querySelector<HTMLElement>(".am-content-wrap");
    if (preview) {
      preview.classList.remove("am-preview-open");
      setTimeout(() => {
        if (!this.deps.getPreviewPath()) preview.innerHTML = "";
      }, 200);
    }
    if (wrap) wrap.classList.remove("am-has-preview");
  }

  private getNextTagColor(): string {
    const palette = ["#42a5f5", "#66bb6a", "#ffa000", "#ab47bc", "#ef5350", "#26c6da", "#7e57c2", "#78909c", "#ec407a", "#8d6e63"];
    const meta = getMetadataStore();
    const used = new Set(meta.getAllTags().map((tag) => meta.getTagColor(tag)));
    return palette.find((color) => !used.has(color)) ?? palette[Math.floor(Math.random() * palette.length)]!;
  }
}
