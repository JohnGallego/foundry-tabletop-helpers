import { isPhysicalMode } from "./lpcs-settings";
import type { LPCSSkill, LPCSInventoryItem } from "./lpcs-types";
import { updateHPDrawerModeUI, updateHPDrawerPreview } from "./lpcs-sheet-ui";

type ActionContext = {
  actor?: Record<string, unknown> & {
    system?: Record<string, unknown>;
    items?: { get(id: string): { use?: (options?: Record<string, unknown>) => void } | undefined };
    update?: (data: Record<string, unknown>) => Promise<void> | void;
    rollAbilityCheck?: (options: Record<string, unknown>) => void;
    rollSavingThrow?: (options: Record<string, unknown>) => void;
    rollSkill?: (options: Record<string, unknown>) => void;
    rollInitiativeDialog?: (options: Record<string, unknown>) => void;
    rollDeathSave?: (options: Record<string, unknown>) => void;
    isOwner?: boolean;
  };
  element?: HTMLElement | null;
  render?: (options?: Record<string, unknown>) => void;
  _expandedDrawers?: Set<string>;
  _lastCombatVM?: { combatGroups?: Array<{ standardActions?: Array<{ key: string; name: string; description: string }> }> };
  _openCombatInfoModal?: (title: string, description: string) => void;
  _skillSortMode?: "proficiency" | "ability" | "alphabetical";
  _lastSkillsVM?: LPCSSkill[];
  _openSkillInfoModal?: (skill: LPCSSkill) => void;
  _restModalOpen?: boolean;
  _exhaustionDialogOpen?: boolean;
  _pendingExhaustion?: number;
  _updateExhaustionDialogUI?: (dialog: HTMLElement, level: number) => void;
  _openCurrencyEditor?: (key: string) => void;
  _lastInventoryVM?: LPCSInventoryItem[];
  _openItemDetailModal?: (item: LPCSInventoryItem) => void;
  _hpDrawerOpen?: boolean;
  _hpDrawerMode?: "damage" | "heal" | "temp";
};

export function buildLPCSSheetActions(): Record<string, (this: ActionContext, event: Event, target: HTMLElement) => unknown> {
  return {
    adjustHP(this: ActionContext, _event: Event, target: HTMLElement): void {
      const delta = Number(target.dataset.delta);
      const hp = ((this.actor?.system as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
        ?.hp as { value: number; max: number } | undefined;
      if (!Number.isFinite(delta) || !hp || !this.actor?.update) return;
      const clamped = Math.max(0, Math.min(hp.value + delta, hp.max));
      void this.actor.update({ "system.attributes.hp.value": clamped });
    },
    rollAbility(this: ActionContext, event: Event, target: HTMLElement): void {
      const ability = (target.closest("[data-ability]") as HTMLElement | null)?.dataset.ability;
      if (ability) this.actor?.rollAbilityCheck?.({ ability, event });
    },
    rollSave(this: ActionContext, event: Event, target: HTMLElement): void {
      const ability = (target.closest("[data-ability]") as HTMLElement | null)?.dataset.ability;
      if (ability) this.actor?.rollSavingThrow?.({ ability, event });
    },
    rollSkill(this: ActionContext, event: Event, target: HTMLElement): void {
      const skill = (target.closest("[data-skill]") as HTMLElement | null)?.dataset.skill;
      if (skill) this.actor?.rollSkill?.({ event, skill });
    },
    rollInitiative(this: ActionContext, event: Event): void {
      this.actor?.rollInitiativeDialog?.({ event });
    },
    rollDeathSave(this: ActionContext, event: Event): void {
      this.actor?.rollDeathSave?.({ event, legacy: false });
    },
    async incrementDeathSave(this: ActionContext, _event: Event, target: HTMLElement): Promise<void> {
      if (!isPhysicalMode("deathSaves") || !this.actor?.isOwner || !this.actor.update) return;
      const saveType = (target.closest("[data-save-type]") as HTMLElement | null)?.dataset.saveType;
      if (saveType !== "success" && saveType !== "failure") return;

      const death = ((this.actor.system as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
        ?.death as Record<string, number> | undefined;
      if (!death) return;

      const isSuccess = saveType === "success";
      const path = isSuccess ? "system.attributes.death.success" : "system.attributes.death.failure";
      const current = isSuccess ? (death.success ?? 0) : (death.failure ?? 0);
      if (current >= 3) return;

      const next = current + 1;
      const update: Record<string, number> = { [path]: next };
      if (isSuccess && next === 3) {
        update["system.attributes.hp.value"] = 1;
        update["system.attributes.death.success"] = 0;
        update["system.attributes.death.failure"] = 0;
      }
      await this.actor.update(update);
    },
    useItem(this: ActionContext, event: Event, target: HTMLElement): void {
      const itemId = (target.closest("[data-item-id]") as HTMLElement | null)?.dataset.itemId;
      const item = this.actor?.items?.get(itemId ?? "");
      item?.use?.({ event });
    },
    toggleDrawer(this: ActionContext, _event: Event, target: HTMLElement): void {
      const drawerId = (target.closest("[data-drawer-id]") as HTMLElement | null)?.dataset.drawerId;
      if (!drawerId) return;
      this._expandedDrawers ??= new Set<string>();
      if (this._expandedDrawers.has(drawerId)) this._expandedDrawers.delete(drawerId);
      else this._expandedDrawers.add(drawerId);
      this.element?.querySelector(`[data-drawer-id="${drawerId}"] .lpcs-drawer-body`)?.classList.toggle("expanded");
      this.element?.querySelector(`[data-drawer-id="${drawerId}"] .lpcs-drawer-chevron`)?.classList.toggle("rotated");
    },
    toggleSpellDetail(this: ActionContext, event: Event, target: HTMLElement): void {
      if ((event.target as HTMLElement).closest("[data-action='useItem']")) return;
      const row = target.closest(".lpcs-spell-row") as HTMLElement | null;
      const itemId = row?.dataset.itemId;
      if (!itemId) return;
      const detailRow = this.element?.querySelector(`[data-spell-detail="${itemId}"]`) as HTMLElement | null;
      if (!detailRow) return;
      if (detailRow.hasAttribute("hidden")) detailRow.removeAttribute("hidden");
      else detailRow.setAttribute("hidden", "");
    },
    toggleInspiration(this: ActionContext): void {
      const current = ((this.actor?.system as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
        ?.inspiration;
      void this.actor?.update?.({ "system.attributes.inspiration": !current });
    },
    toggleSpellSlot(this: ActionContext, _event: Event, target: HTMLElement): void {
      const prop = target.dataset.prop;
      const n = Number(target.dataset.n);
      if (!prop || !Number.isFinite(n) || !this.actor?.update) return;
      const current = (globalThis as { foundry?: { utils?: { getProperty?: (obj: unknown, path: string) => unknown } } })
        .foundry?.utils?.getProperty?.(this.actor, prop) ?? 0;
      void this.actor.update({ [prop]: current === n ? n - 1 : n });
    },
    showCombatActionInfo(this: ActionContext, _event: Event, target: HTMLElement): void {
      const actionKey = target.dataset.actionKey;
      if (!actionKey || !this._lastCombatVM?.combatGroups || !this._openCombatInfoModal) return;
      for (const group of this._lastCombatVM.combatGroups) {
        const action = group.standardActions?.find((entry) => entry.key === actionKey);
        if (action) {
          this._openCombatInfoModal(action.name, action.description);
          return;
        }
      }
    },
    showDamageType(this: ActionContext, _event: Event, target: HTMLElement): void {
      const damageType = target.dataset.damageType;
      if (!damageType || !this._openCombatInfoModal) return;
      const title = damageType.charAt(0).toUpperCase() + damageType.slice(1);
      this._openCombatInfoModal(title, `${title} damage`);
    },
    cycleSkillSort(this: ActionContext): void {
      const modes = ["proficiency", "ability", "alphabetical"] as const;
      const idx = modes.indexOf(this._skillSortMode ?? "proficiency");
      this._skillSortMode = modes[(idx + 1) % modes.length];
      this.render?.({ parts: ["skills"] });
    },
    showSkillInfo(this: ActionContext, event: Event, target: HTMLElement): void {
      event.stopPropagation();
      const skillKey = (target.closest("[data-skill]") as HTMLElement | null)?.dataset.skill;
      if (!skillKey || !this._lastSkillsVM || !this._openSkillInfoModal) return;
      const skill = this._lastSkillsVM.find((entry) => entry.key === skillKey);
      if (skill) this._openSkillInfoModal(skill);
    },
    openRestModal(this: ActionContext): void {
      if (!this.actor?.isOwner) return;
      this._restModalOpen = true;
      const modal = this.element?.querySelector<HTMLElement>("[data-rest-modal]");
      if (!modal) return;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    },
    openExhaustionDialog(this: ActionContext): void {
      if (!this.actor?.isOwner) return;
      const level = ((((this.actor.system as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
        ?.exhaustion) as number | undefined) ?? 0;
      this._pendingExhaustion = level;
      this._exhaustionDialogOpen = true;
      const dialog = this.element?.querySelector<HTMLElement>("[data-exhaustion-dialog]");
      if (!dialog) return;
      dialog.classList.add("open");
      dialog.setAttribute("aria-hidden", "false");
      this._updateExhaustionDialogUI?.(dialog, level);
    },
    editCurrency(this: ActionContext, _event: Event, target: HTMLElement): void {
      if (!this.actor?.isOwner) return;
      const key = (target.closest("[data-currency-key]") as HTMLElement | null)?.dataset.currencyKey;
      if (key) this._openCurrencyEditor?.(key);
    },
    showItemDetail(this: ActionContext, _event: Event, target: HTMLElement): void {
      const itemId = (target.closest("[data-item-id]") as HTMLElement | null)?.dataset.itemId;
      if (!itemId || !this._lastInventoryVM || !this._openItemDetailModal) return;
      const item = this._lastInventoryVM.find((entry) => entry.id === itemId);
      if (item) this._openItemDetailModal(item);
    },
    openHPDrawer(this: ActionContext): void {
      if (!this.actor?.isOwner) return;
      const hp = ((this.actor.system as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)
        ?.hp as { value: number; max: number; temp?: number } | undefined;
      if (!hp || (hp.value ?? 0) === 0) return;
      this._hpDrawerOpen = !this._hpDrawerOpen;
      const drawer = this.element?.querySelector<HTMLElement>("[data-hp-drawer]");
      if (!drawer) return;
      drawer.classList.toggle("open", this._hpDrawerOpen);
      drawer.setAttribute("aria-hidden", String(!this._hpDrawerOpen));
      if (!this._hpDrawerOpen) {
        const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
        if (input) input.value = "";
        return;
      }
      this._hpDrawerMode = "damage";
      updateHPDrawerModeUI(drawer, "damage");
      updateHPDrawerPreview(drawer, hp, this._hpDrawerMode);
      drawer.querySelector<HTMLInputElement>("[data-amount]")?.focus();
    },
  };
}
