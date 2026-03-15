import type { CurrencyData, InventoryItem } from "../../extractors/dnd5e-types";
import type {
  CoinViewModel,
  CurrencyViewModel,
  InventoryItemViewModel,
  InventoryViewModel,
} from "./character-viewmodel";
import { esc } from "./character-transformer-common";

/** Coin type definitions with display info */
const COIN_TYPES: Array<{ type: keyof CurrencyData; label: string; abbr: string; icon: string; gpValue: number }> = [
  { type: "pp", label: "Platinum", abbr: "PP", icon: "🪙", gpValue: 10 },
  { type: "gp", label: "Gold", abbr: "GP", icon: "🟡", gpValue: 1 },
  { type: "ep", label: "Electrum", abbr: "EP", icon: "⚪", gpValue: 0.5 },
  { type: "sp", label: "Silver", abbr: "SP", icon: "⚫", gpValue: 0.1 },
  { type: "cp", label: "Copper", abbr: "CP", icon: "🟤", gpValue: 0.01 },
];

export function buildInventory(items: InventoryItem[]): InventoryViewModel {
  const totalWeight = calculateInventoryWeight(items);
  const totalWeightDisplay = totalWeight > 0 ? `${Math.round(totalWeight * 100) / 100} lb` : "—";

  const viewItems: InventoryItemViewModel[] = [];
  for (const item of items) {
    if (item.type === "container" && item.contents && item.contents.length > 0) {
      viewItems.push({
        ...buildInventoryItem(item, false),
        isContainerGroup: true,
        containerItems: item.contents.map((content) => buildInventoryItem(content, true)),
      });
    } else {
      viewItems.push({
        ...buildInventoryItem(item, false),
        isContainerGroup: false,
        containerItems: [],
      });
    }
  }

  return { totalWeight: totalWeightDisplay, items: viewItems };
}

export function buildCurrency(data: CurrencyData): CurrencyViewModel {
  const coins: CoinViewModel[] = COIN_TYPES.map(({ type, label, abbr, icon, gpValue }) => {
    const amount = data[type] ?? 0;
    return {
      type,
      label,
      abbr,
      icon,
      amount,
      amountDisplay: amount.toLocaleString(),
      hasCoins: amount > 0,
      gpValue,
    };
  });

  const totalGp = coins.reduce((sum, coin) => {
    const coinDef = COIN_TYPES.find((coinType) => coinType.type === coin.type);
    return sum + (coin.amount * (coinDef?.gpValue ?? 0));
  }, 0);

  return {
    coins,
    totalGpValue: totalGp > 0 ? `${totalGp.toLocaleString()} gp` : "0 gp",
  };
}

function calculateInventoryWeight(items: InventoryItem[]): number {
  return items.reduce((sum, item) => {
    const itemWeight = item.quantity * (item.weight ?? 0);
    const contentsWeight = item.contents ? calculateInventoryWeight(item.contents) : 0;
    return sum + itemWeight + contentsWeight;
  }, 0);
}

function buildInventoryItem(item: InventoryItem, isIndented: boolean): InventoryItemViewModel {
  const usesDisplay = item.uses ? `(${item.uses.value}/${item.uses.max})` : "";
  const qty = item.quantity > 1 ? `×${item.quantity}` : "";
  const wt = item.weight ? `${item.weight}lb` : "";
  const meta = [qty, wt].filter(Boolean).join(" ");

  const cost = item.price ? `${item.price.value} ${item.price.denomination}` : "";
  const totalWeight = item.weight ? item.quantity * item.weight : 0;
  const weight = totalWeight > 0 ? `${Math.round(totalWeight * 100) / 100} lb` : "";

  return {
    eqIndicator: item.equipped ? "■" : "—",
    imgUrl: item.img || "",
    hasImg: !!item.img,
    favStar: item.isFavorite ? "★ " : "",
    name: esc(item.name),
    usesDisplay,
    meta,
    isIndented,
    cssClass: isIndented ? "fth-inv-item fth-inv-indented" : "fth-inv-item",
    quantity: item.quantity,
    quantityDisplay: item.quantity > 1 ? `×${item.quantity}` : "",
    cost,
    hasCost: !!cost,
    weight,
    hasWeight: !!weight,
    isContainerGroup: false,
    containerItems: [],
  };
}
