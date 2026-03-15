import type { LPCSInventoryItem } from "./lpcs-types";

const DENOM_CLASSES: Record<string, string> = {
  pp: "lpcs-coin-icon--pp",
  gp: "lpcs-coin-icon--gp",
  ep: "lpcs-coin-icon--ep",
  sp: "lpcs-coin-icon--sp",
  cp: "lpcs-coin-icon--cp",
};

const CURRENCY_LABELS: Record<string, string> = {
  pp: "Platinum",
  gp: "Gold",
  ep: "Electrum",
  sp: "Silver",
  cp: "Copper",
};

export function populateItemDetailModal(
  modal: HTMLElement,
  item: LPCSInventoryItem,
  options: {
    equipSignal?: AbortSignal;
    onToggleEquip: (itemId: string, equip: boolean) => Promise<void>;
    onOpenChildItem: (item: LPCSInventoryItem) => void;
  },
): void {
  const { equipSignal, onToggleEquip, onOpenChildItem } = options;

  const img = modal.querySelector<HTMLImageElement>("[data-item-detail-img]");
  const nameEl = modal.querySelector<HTMLElement>("[data-item-detail-name]");
  const typeEl = modal.querySelector<HTMLElement>("[data-item-detail-type]");
  const descEl = modal.querySelector<HTMLElement>("[data-item-detail-desc]");
  const qtyEl = modal.querySelector<HTMLElement>("[data-item-detail-qty]");
  const rarityEl = modal.querySelector<HTMLElement>("[data-item-detail-rarity]");
  const weightEl = modal.querySelector<HTMLElement>("[data-item-detail-weight]");
  const priceEl = modal.querySelector<HTMLElement>("[data-item-detail-price]");
  const statsEl = modal.querySelector<HTMLElement>("[data-item-detail-stats]");
  const containerInfoEl = modal.querySelector<HTMLElement>("[data-item-detail-container-info]");
  const capacityEl = modal.querySelector<HTMLElement>("[data-item-detail-capacity]");
  const containerCurrencyEl = modal.querySelector<HTMLElement>("[data-item-detail-container-currency]");
  const contentsEl = modal.querySelector<HTMLElement>("[data-item-detail-contents]");
  const contentsGridEl = modal.querySelector<HTMLElement>("[data-item-detail-contents-grid]");

  if (img) img.src = item.img || "";
  if (nameEl) nameEl.textContent = item.name || "";
  if (typeEl) typeEl.textContent = item.typeLabel || item.type || "";
  if (descEl) descEl.textContent = item.description || "No description available.";

  if (statsEl) {
    statsEl.textContent = item.statsBlock;
    statsEl.hidden = !item.statsBlock;
  }

  if (qtyEl) {
    qtyEl.hidden = item.quantity <= 1;
    if (item.quantity > 1) qtyEl.textContent = `x${item.quantity}`;
  }

  if (rarityEl) {
    rarityEl.hidden = !item.rarityLabel;
    if (item.rarityLabel) {
      rarityEl.textContent = item.rarityLabel;
      rarityEl.className = `lpcs-item-detail-rarity rarity--${item.rarity}`;
    }
  }

  if (containerInfoEl) {
    containerInfoEl.hidden = !item.isContainer;
    if (item.isContainer) {
      if (capacityEl) capacityEl.textContent = item.capacityLabel || "";
      if (containerCurrencyEl) {
        containerCurrencyEl.replaceChildren();
        for (const coin of item.containerCurrency || []) {
          const span = document.createElement("span");
          span.className = "lpcs-container-coin";
          const icon = document.createElement("i");
          icon.className = `fas fa-coins ${DENOM_CLASSES[coin.key] ?? DENOM_CLASSES.gp}`;
          span.appendChild(icon);
          const value = document.createElement("span");
          value.textContent = ` ${coin.amount}`;
          span.appendChild(value);
          containerCurrencyEl.appendChild(span);
        }
      }
    }
  }

  if (contentsEl && contentsGridEl) {
    if (item.isContainer && item.contents?.length > 0) {
      contentsEl.hidden = false;
      contentsGridEl.replaceChildren();
      for (const child of item.contents) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lpcs-container-content-item";
        button.title = child.name;

        const childImg = document.createElement("img");
        childImg.src = child.img || "";
        childImg.alt = "";
        childImg.className = "lpcs-container-content-img";
        childImg.loading = "lazy";
        button.appendChild(childImg);

        const nameSpan = document.createElement("span");
        nameSpan.className = "lpcs-container-content-name";
        nameSpan.textContent = child.name;
        button.appendChild(nameSpan);

        if (child.quantity > 1) {
          const qtySpan = document.createElement("span");
          qtySpan.className = "lpcs-container-content-qty";
          qtySpan.textContent = `x${child.quantity}`;
          button.appendChild(qtySpan);
        }

        button.addEventListener("click", () => onOpenChildItem(child));
        contentsGridEl.appendChild(button);
      }
    } else {
      contentsEl.hidden = true;
    }
  }

  if (weightEl) weightEl.textContent = item.weight ? `${item.weight} lb` : "";

  if (priceEl) {
    priceEl.replaceChildren();
    if (item.price) {
      const icon = document.createElement("i");
      icon.className = `fas fa-coins ${DENOM_CLASSES[item.price.denomination] ?? DENOM_CLASSES.gp}`;
      priceEl.appendChild(icon);
      const value = document.createElement("span");
      value.textContent = ` ${item.price.value}`;
      priceEl.appendChild(value);
    }
  }

  const equipBtn = modal.querySelector<HTMLElement>("[data-item-detail-equip]");
  if (equipBtn) {
    const labelEl = equipBtn.querySelector<HTMLElement>("[data-item-detail-equip-label]");
    const iconEl = equipBtn.querySelector<HTMLElement>("[data-item-detail-equip-icon]");
    if (item.isEquippable) {
      equipBtn.hidden = false;
      if (labelEl) labelEl.textContent = item.equipped ? "Unequip" : "Equip";
      if (iconEl) iconEl.className = item.equipped ? "fas fa-shield-xmark" : "fas fa-shield-halved";
      equipBtn.classList.toggle("is-equipped", item.equipped);
      equipBtn.addEventListener("click", async () => {
        await onToggleEquip(item.id, !item.equipped);
      }, equipSignal ? { signal: equipSignal } : undefined);
    } else {
      equipBtn.hidden = true;
    }
  }
}

export function populateCurrencyEditorModal(
  modal: HTMLElement,
  key: string,
  currentValue: number,
): void {
  const titleEl = modal.querySelector<HTMLElement>("[data-currency-editor-title]");
  if (titleEl) titleEl.textContent = CURRENCY_LABELS[key] ?? key.toUpperCase();

  const displayEl = modal.querySelector<HTMLElement>("[data-currency-editor-display]");
  if (displayEl) displayEl.textContent = String(currentValue);

  const input = modal.querySelector<HTMLInputElement>("[data-currency-editor-input]");
  if (input) {
    input.value = "";
    input.focus();
  }
}

export function updateCurrencyEditorDisplayValue(
  modal: HTMLElement | null,
  currentValue: number,
): void {
  const display = modal?.querySelector<HTMLElement>("[data-currency-editor-display]");
  if (display) display.textContent = String(currentValue);
}
