interface MonsterPreviewInlineListenerOptions {
  onDismiss: () => void;
  onPopout: () => void;
}

interface MonsterPreviewFloatingListenerOptions {
  onDismiss: () => void;
  onDock: () => void;
}

export function attachMonsterPreviewInlineListeners(
  el: HTMLElement,
  options: MonsterPreviewInlineListenerOptions,
): void {
  el.querySelector(".mp-close")?.addEventListener("click", options.onDismiss);
  el.querySelector(".mp-popout")?.addEventListener("click", options.onPopout);
}

export function attachMonsterPreviewFloatingListeners(
  el: HTMLElement,
  options: MonsterPreviewFloatingListenerOptions,
): void {
  el.querySelector(".mp-close")?.addEventListener("click", options.onDismiss);
  el.querySelector(".mp-dock")?.addEventListener("click", options.onDock);
}
