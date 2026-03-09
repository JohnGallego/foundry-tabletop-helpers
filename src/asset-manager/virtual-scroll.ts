/**
 * Asset Manager — Virtual Scroller
 *
 * Renders only visible items + overscan for large file lists.
 * Uses DOM recycling to preserve loaded images across scroll updates,
 * preventing thumbnail flicker and unnecessary re-requests.
 * Uses transform: translateY() positioning for zero-reflow scrolling.
 */

export interface VirtualScrollConfig {
  /** Scrollable container element. */
  container: HTMLElement;
  /** Height of each row in px (for grid: row height including gap). */
  rowHeight: number;
  /** Number of items per row (1 for list view, N for grid). */
  itemsPerRow: number;
  /** Total number of items. */
  totalItems: number;
  /** Render callback — returns HTML string for a single item at index. */
  renderItem: (index: number) => string;
  /** Extra rows above/below viewport. */
  overscan?: number;
}

export class VirtualScroller {
  #container: HTMLElement;
  #spacer: HTMLElement;
  #viewport: HTMLElement;
  #config: Required<VirtualScrollConfig>;
  #visibleStart = -1;
  #visibleEnd = -1;
  #raf = 0;
  /** Map of currently rendered item index → DOM element. */
  #rendered = new Map<number, HTMLElement>();

  constructor(config: VirtualScrollConfig) {
    this.#config = { overscan: 4, ...config };
    this.#container = config.container;

    // Create inner structure
    this.#spacer = document.createElement("div");
    this.#spacer.className = "am-vs-spacer";
    this.#spacer.style.position = "relative";

    this.#viewport = document.createElement("div");
    this.#viewport.className = "am-vs-viewport";

    this.#spacer.appendChild(this.#viewport);
    this.#container.appendChild(this.#spacer);

    this.#updateSpacerHeight();
    this.#container.addEventListener("scroll", this.#onScroll, { passive: true });

    // Initial render
    this.#update();
  }

  /** Update config (e.g., after density or total items change). */
  reconfigure(partial: Partial<Omit<VirtualScrollConfig, "container">>): void {
    Object.assign(this.#config, partial);
    this.#updateSpacerHeight();
    // Force full re-render on config change
    this.#clearRendered();
    this.#visibleStart = -1;
    this.#visibleEnd = -1;
    this.#update();
  }

  /** Force a full re-render of visible items. */
  refresh(): void {
    this.#clearRendered();
    this.#visibleStart = -1;
    this.#visibleEnd = -1;
    this.#update();
  }

  /** Clean up listeners. */
  destroy(): void {
    this.#container.removeEventListener("scroll", this.#onScroll);
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#clearRendered();
    this.#spacer.remove();
  }

  /* ── Internal ──────────────────────────────────────────── */

  #onScroll = (): void => {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => this.#update());
  };

  #update(): void {
    const { rowHeight, itemsPerRow, totalItems, overscan, renderItem } = this.#config;
    const scrollTop = this.#container.scrollTop;
    const viewportHeight = this.#container.clientHeight;

    const totalRows = Math.ceil(totalItems / itemsPerRow);

    // Calculate visible row range
    const firstVisibleRow = Math.floor(scrollTop / rowHeight);
    const lastVisibleRow = Math.ceil((scrollTop + viewportHeight) / rowHeight);

    const startRow = Math.max(0, firstVisibleRow - overscan);
    const endRow = Math.min(totalRows, lastVisibleRow + overscan);

    const startIndex = startRow * itemsPerRow;
    const endIndex = Math.min(endRow * itemsPerRow, totalItems);

    // Skip if range hasn't changed
    if (startIndex === this.#visibleStart && endIndex === this.#visibleEnd) return;

    const prevStart = this.#visibleStart;
    const prevEnd = this.#visibleEnd;
    this.#visibleStart = startIndex;
    this.#visibleEnd = endIndex;

    // Remove items no longer in range
    for (const [idx, el] of this.#rendered) {
      if (idx < startIndex || idx >= endIndex) {
        el.remove();
        this.#rendered.delete(idx);
      }
    }

    // Add new items that aren't already rendered
    // Build a document fragment for batch insertion
    const newIndices: number[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.#rendered.has(i)) {
        newIndices.push(i);
      }
    }

    if (newIndices.length > 0) {
      // Create new elements
      const frag = document.createDocumentFragment();
      for (const i of newIndices) {
        const html = renderItem(i);
        if (!html) continue;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = html;
        const el = wrapper.firstElementChild as HTMLElement;
        if (el) {
          this.#rendered.set(i, el);
          frag.appendChild(el);
        }
      }
      this.#viewport.appendChild(frag);
    }

    // Re-order DOM children to match index order (ensures correct visual order)
    // Only needed if we added items before existing ones
    if (newIndices.length > 0 && (prevStart < 0 || startIndex < prevStart || endIndex > prevEnd)) {
      const sorted = [...this.#rendered.entries()].sort((a, b) => a[0] - b[0]);
      for (const [, el] of sorted) {
        this.#viewport.appendChild(el);
      }
    }

    // Position viewport at the correct offset
    this.#viewport.style.transform = `translateY(${startRow * rowHeight}px)`;
  }

  #updateSpacerHeight(): void {
    const { rowHeight, itemsPerRow, totalItems } = this.#config;
    const totalRows = Math.ceil(totalItems / itemsPerRow);
    this.#spacer.style.height = `${totalRows * rowHeight}px`;
  }

  #clearRendered(): void {
    this.#viewport.innerHTML = "";
    this.#rendered.clear();
  }
}
