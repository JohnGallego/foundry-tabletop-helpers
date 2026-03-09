/**
 * Asset Manager — Context Menu
 *
 * Right-click / long-press context menu for file entries.
 * Provides quick actions: Preview, Copy Path, Select.
 */

/* ── Types ────────────────────────────────────────────────── */

export interface ContextMenuAction {
  label: string;
  icon: string;
  action: string;
}

/* ── Menu Definition ──────────────────────────────────────── */

const FILE_ACTIONS: ContextMenuAction[] = [
  { label: "Preview", icon: "fa-solid fa-eye", action: "preview" },
  { label: "Copy Path", icon: "fa-solid fa-copy", action: "copy-path" },
  { label: "Select", icon: "fa-solid fa-check", action: "select" },
  { label: "Delete", icon: "fa-solid fa-trash", action: "delete" },
];

/* ── Context Menu Manager ─────────────────────────────────── */

let activeMenu: HTMLElement | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show the context menu at the given position for a file entry.
 * Returns the action string if the user picks one, or null if dismissed.
 */
export function showContextMenu(
  x: number,
  y: number,
  filePath: string,
  onAction: (action: string, path: string) => void,
): void {
  dismissContextMenu();

  const menu = document.createElement("div");
  menu.className = "am-context-menu";

  for (const item of FILE_ACTIONS) {
    const btn = document.createElement("button");
    btn.className = "am-ctx-item";
    btn.type = "button";
    btn.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissContextMenu();
      onAction(item.action, filePath);
    });
    menu.appendChild(btn);
  }

  // Position (keep within viewport)
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  document.body.appendChild(menu);
  activeMenu = menu;

  // Adjust if menu overflows viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
  });

  // Dismiss on outside click (next tick to avoid same-event dismiss)
  requestAnimationFrame(() => {
    document.addEventListener("click", onOutsideClick, { once: true });
    document.addEventListener("contextmenu", onOutsideClick, { once: true });
  });
}

/** Dismiss any active context menu. */
export function dismissContextMenu(): void {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  document.removeEventListener("click", onOutsideClick);
  document.removeEventListener("contextmenu", onOutsideClick);
}

function onOutsideClick(e: Event): void {
  if (activeMenu && !activeMenu.contains(e.target as Node)) {
    dismissContextMenu();
  }
}

/**
 * Setup long-press detection for touch devices.
 * Call this on `touchstart` of a file card.
 * Returns a cleanup function to call on `touchend`/`touchmove`.
 */
export function startLongPress(
  x: number,
  y: number,
  filePath: string,
  onAction: (action: string, path: string) => void,
): () => void {
  cancelLongPress();
  longPressTimer = setTimeout(() => {
    showContextMenu(x, y, filePath, onAction);
  }, 500);

  return cancelLongPress;
}

function cancelLongPress(): void {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}
