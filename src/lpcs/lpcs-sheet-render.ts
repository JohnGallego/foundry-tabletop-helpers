import { switchLPCSTab, updateHPDrawerModeUI, updateHPDrawerPreview, type HPDrawerMode } from "./lpcs-sheet-ui";

interface HPValueLike {
  value: number;
  max: number;
  temp?: number;
}

export function attachLPCSBaseRenderListeners(options: {
  el: HTMLElement;
  tabGroups: Record<string, string>;
  onHPInputChange: (event: Event) => void;
}): void {
  const { el, tabGroups, onHPInputChange } = options;

  el.querySelectorAll<HTMLInputElement>(".lpcs-hp-input").forEach((input) => {
    input.addEventListener("change", onHPInputChange);
    input.addEventListener("focus", () => input.select());
  });

  el.querySelectorAll<HTMLElement>(".lpcs-tab-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) switchLPCSTab(el, tab, tabGroups);
    });
  });

  const hpBar = el.querySelector<HTMLElement>(".lpcs-hp-bar-widget[data-action]");
  hpBar?.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hpBar.click();
    }
  });
}

export function setupHPDrawerRender(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  drawerOpen: boolean;
  getMode: () => HPDrawerMode;
  hp: HPValueLike | null | undefined;
  setMode: (mode: HPDrawerMode) => void;
  applyHPChange: (mode: HPDrawerMode, amount: number) => Promise<void>;
  closeHPDrawer: () => void;
}): AbortController {
  const {
    el,
    previousAbortController,
    drawerOpen,
    getMode,
    hp,
    setMode,
    applyHPChange,
    closeHPDrawer,
  } = options;

  previousAbortController?.abort();
  const abortController = new AbortController();
  const { signal } = abortController;

  const drawer = el.querySelector<HTMLElement>("[data-hp-drawer]");
  if (!drawer) return abortController;

  drawer.classList.toggle("open", drawerOpen);
  drawer.setAttribute("aria-hidden", String(!drawerOpen));
  updateHPDrawerModeUI(drawer, getMode());
  updateHPDrawerPreview(drawer, hp, getMode());

  drawer.querySelectorAll<HTMLElement>("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.mode as HPDrawerMode;
      if (!nextMode) return;
      setMode(nextMode);
      updateHPDrawerModeUI(drawer, nextMode);
      updateHPDrawerPreview(drawer, hp, nextMode);
    }, { signal });
  });

  drawer.querySelectorAll<HTMLElement>("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = Number(btn.dataset.preset);
      const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
      if (input && Number.isFinite(preset)) {
        input.value = String((Number(input.value) || 0) + preset);
        updateHPDrawerPreview(drawer, hp, getMode());
      }
    }, { signal });
  });

  drawer.querySelector<HTMLElement>("[data-clear]")?.addEventListener("click", () => {
    const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
    if (input) input.value = "";
    updateHPDrawerPreview(drawer, hp, getMode());
  }, { signal });

  drawer.querySelector<HTMLInputElement>("[data-amount]")
    ?.addEventListener("input", () => updateHPDrawerPreview(drawer, hp, getMode()), { signal });

  drawer.querySelector<HTMLElement>("[data-apply]")?.addEventListener("click", async () => {
    const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
    const amount = Number(input?.value) || 0;
    if (amount <= 0) return;
    await applyHPChange(getMode(), amount);
  }, { signal });

  globalThis.document?.addEventListener("click", (event: MouseEvent) => {
    if (!drawerOpen) return;
    const outer = el.querySelector<HTMLElement>(".lpcs-hp-outer");
    if (outer && !outer.contains(event.target as Node)) closeHPDrawer();
  }, { signal });

  return abortController;
}

export function setupExhaustionDialogRender(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  isOpen: boolean;
  getPendingLevel: () => number;
  setPendingLevel: (level: number) => void;
  updateDialogUI: (dialog: HTMLElement, level: number) => void;
  closeDialog: () => void;
  confirmLevel: (level: number) => Promise<void>;
}): AbortController {
  const {
    el,
    previousAbortController,
    isOpen,
    getPendingLevel,
    setPendingLevel,
    updateDialogUI,
    closeDialog,
    confirmLevel,
  } = options;

  previousAbortController?.abort();
  const abortController = new AbortController();
  const { signal } = abortController;

  const dialog = el.querySelector<HTMLElement>("[data-exhaustion-dialog]");
  if (!dialog) return abortController;

  dialog.classList.toggle("open", isOpen);
  dialog.setAttribute("aria-hidden", String(!isOpen));
  if (isOpen) updateDialogUI(dialog, getPendingLevel());

  dialog.querySelector<HTMLElement>("[data-exh-dec]")?.addEventListener("click", () => {
    const next = Math.max(0, getPendingLevel() - 1);
    setPendingLevel(next);
    updateDialogUI(dialog, next);
  }, { signal });

  dialog.querySelector<HTMLElement>("[data-exh-inc]")?.addEventListener("click", () => {
    const next = Math.min(6, getPendingLevel() + 1);
    setPendingLevel(next);
    updateDialogUI(dialog, next);
  }, { signal });

  dialog.querySelector<HTMLElement>("[data-exh-confirm]")?.addEventListener("click", async () => {
    await confirmLevel(getPendingLevel());
  }, { signal });

  globalThis.document?.addEventListener("click", (event: MouseEvent) => {
    if (!isOpen) return;
    const qstatRow = el.querySelector<HTMLElement>(".lpcs-qstat-row");
    if (qstatRow && !qstatRow.contains(event.target as Node)) closeDialog();
  }, { signal });

  return abortController;
}

export function setupRestModalRender(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  isOpen: boolean;
  getLongRestHoldTimer: () => ReturnType<typeof setTimeout> | null;
  setLongRestHoldTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
  closeModal: () => void;
  rollHitDie: (denomination: string) => Promise<void>;
  doLongRest: () => Promise<void>;
}): AbortController {
  const {
    el,
    previousAbortController,
    isOpen,
    getLongRestHoldTimer,
    setLongRestHoldTimer,
    closeModal,
    rollHitDie,
    doLongRest,
  } = options;

  previousAbortController?.abort();
  const abortController = new AbortController();
  const { signal } = abortController;

  const modal = el.querySelector<HTMLElement>("[data-rest-modal]");
  if (!modal) return abortController;

  modal.classList.toggle("open", isOpen);
  modal.setAttribute("aria-hidden", String(!isOpen));

  modal.querySelectorAll<HTMLElement>("[data-rest-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(), { signal });
  });

  globalThis.document?.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen) closeModal();
  }, { signal });

  modal.querySelectorAll<HTMLButtonElement>("[data-hd-roll]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const denomination = btn.dataset.denomination;
      if (!denomination) return;
      btn.disabled = true;
      await rollHitDie(denomination);
    }, { signal });
  });

  const longBtn = modal.querySelector<HTMLElement>("[data-long-rest]");
  if (!longBtn) return abortController;

  const startHold = (event: Event) => {
    event.preventDefault();
    longBtn.classList.add("is-holding");
    setLongRestHoldTimer(setTimeout(async () => {
      setLongRestHoldTimer(null);
      longBtn.classList.remove("is-holding");
      longBtn.classList.add("confirmed");
      await doLongRest();
    }, 2000));
  };

  const cancelHold = () => {
    const timer = getLongRestHoldTimer();
    if (timer !== null) {
      clearTimeout(timer);
      setLongRestHoldTimer(null);
    }
    longBtn.classList.remove("is-holding");
  };

  longBtn.addEventListener("mousedown", startHold, { signal });
  longBtn.addEventListener("touchstart", startHold, { signal });
  longBtn.addEventListener("mouseup", cancelHold, { signal });
  longBtn.addEventListener("mouseleave", cancelHold, { signal });
  longBtn.addEventListener("touchend", cancelHold, { signal });
  longBtn.addEventListener("touchcancel", cancelHold, { signal });

  return abortController;
}

export function setupClosableModalRender(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  selector: string;
  closeSelector: string;
  isOpen: boolean;
  closeModal: () => void;
}): AbortController {
  const {
    el,
    previousAbortController,
    selector,
    closeSelector,
    isOpen,
    closeModal,
  } = options;

  previousAbortController?.abort();
  const abortController = new AbortController();
  const { signal } = abortController;

  const modal = el.querySelector<HTMLElement>(selector);
  if (!modal) return abortController;

  modal.classList.toggle("open", isOpen);
  modal.setAttribute("aria-hidden", String(!isOpen));
  modal.querySelectorAll<HTMLElement>(closeSelector).forEach((btn) => {
    btn.addEventListener("click", () => closeModal(), { signal });
  });
  globalThis.document?.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen) closeModal();
  }, { signal });

  return abortController;
}

export function buildInventoryModalItems(vmData: {
  inventory?: unknown[];
  containers?: Array<{ contents?: unknown[] }>;
} | null | undefined): unknown[] {
  const containers = vmData?.containers ?? [];
  const containerContents = containers.flatMap((container) => container.contents ?? []);
  return [...(vmData?.inventory ?? []), ...containers, ...containerContents];
}

export function setupItemDetailModalRender<T extends { id: string }>(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  isOpen: boolean;
  openItemId: string | null;
  inventoryItems: T[];
  reopenItem: (item: T) => void;
  closeModal: () => void;
}): AbortController {
  const {
    el,
    previousAbortController,
    isOpen,
    openItemId,
    inventoryItems,
    reopenItem,
    closeModal,
  } = options;

  const abortController = setupClosableModalRender({
    el,
    previousAbortController,
    selector: "[data-item-detail-modal]",
    closeSelector: "[data-item-detail-close]",
    isOpen,
    closeModal,
  });

  const modal = el.querySelector<HTMLElement>("[data-item-detail-modal]");
  if (!modal) return abortController;

  if (isOpen && openItemId) {
    const openItem = inventoryItems.find((item) => item.id === openItemId);
    if (openItem) reopenItem(openItem);
    else closeModal();
  }

  return abortController;
}

export function setupCurrencyEditorRender(options: {
  el: HTMLElement;
  previousAbortController: AbortController | null;
  isOpen: boolean;
  currencyKey: string;
  closeModal: () => void;
  adjustCurrency: (delta: number) => void;
  setCurrency: (value: number) => void;
  updateDisplay: () => void;
}): AbortController {
  const {
    el,
    previousAbortController,
    isOpen,
    currencyKey,
    closeModal,
    adjustCurrency,
    setCurrency,
    updateDisplay,
  } = options;

  const abortController = setupClosableModalRender({
    el,
    previousAbortController,
    selector: "[data-currency-editor]",
    closeSelector: "[data-currency-editor-close]",
    isOpen,
    closeModal,
  });
  const { signal } = abortController;

  const editor = el.querySelector<HTMLElement>("[data-currency-editor]");
  if (!editor) return abortController;

  editor.querySelectorAll<HTMLElement>("[data-currency-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.currencyDelta);
      if (!Number.isFinite(delta)) return;
      adjustCurrency(delta);
    }, { signal });
  });

  const input = editor.querySelector<HTMLInputElement>("[data-currency-editor-input]");
  if (input) {
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (Number.isFinite(value) && value >= 0) setCurrency(Math.floor(value));
      input.value = "";
    }, { signal });
  }

  if (isOpen && currencyKey) updateDisplay();

  return abortController;
}
