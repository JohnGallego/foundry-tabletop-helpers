export function saveMonsterPreviewPosition(
  floatingEl: HTMLElement | null,
  key: string,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  if (!floatingEl) return;
  const pos = { left: floatingEl.style.left, top: floatingEl.style.top };
  try {
    storage.setItem(key, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function restoreMonsterPreviewPosition(
  floatingEl: HTMLElement | null,
  key: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): void {
  if (!floatingEl) return;
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const pos = JSON.parse(raw) as { left?: string; top?: string };
      if (pos.left && pos.top) {
        floatingEl.style.left = pos.left;
        floatingEl.style.top = pos.top;
        floatingEl.style.right = "auto";
        floatingEl.style.bottom = "auto";
        return;
      }
    }
  } catch {
    /* ignore */
  }

  floatingEl.style.right = "320px";
  floatingEl.style.top = "80px";
}

export function makeMonsterPreviewDraggable(
  el: HTMLElement,
  onSavePosition: () => void,
): void {
  const handle = el.querySelector<HTMLElement>("[data-mp-drag]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".mp-close, .mp-dock")) return;
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    handle.style.cursor = "grabbing";
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e: PointerEvent) => {
    if (!dragging) return;
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    onSavePosition();
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}
