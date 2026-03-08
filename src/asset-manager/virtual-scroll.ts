/**
 * Asset Manager — Virtual Scroller
 *
 * Renders only visible items + overscan for large file lists.
 * Keeps DOM node count under ~100 regardless of folder size.
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
  #visibleStart = 0;
  #visibleEnd = 0;
  #raf = 0;

  constructor(config: VirtualScrollConfig) {
    this.#config = { overscan: 2, ...config };
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
    this.#update();
  }

  /** Force a full re-render of visible items. */
  refresh(): void {
    this.#visibleStart = -1; // Force re-render
    this.#update();
  }

  /** Clean up listeners. */
  destroy(): void {
    this.#container.removeEventListener("scroll", this.#onScroll);
    if (this.#raf) cancelAnimationFrame(this.#raf);
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
    this.#visibleStart = startIndex;
    this.#visibleEnd = endIndex;

    // Build HTML for visible items
    const parts: string[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      parts.push(renderItem(i));
    }

    // Position viewport at the correct offset
    this.#viewport.style.transform = `translateY(${startRow * rowHeight}px)`;
    this.#viewport.innerHTML = parts.join("");
  }

  #updateSpacerHeight(): void {
    const { rowHeight, itemsPerRow, totalItems } = this.#config;
    const totalRows = Math.ceil(totalItems / itemsPerRow);
    this.#spacer.style.height = `${totalRows * rowHeight}px`;
  }
}
