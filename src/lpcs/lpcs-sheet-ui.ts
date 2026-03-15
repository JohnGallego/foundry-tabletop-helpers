import type { LPCSSkill, LPCSSkillGroup } from "./lpcs-types";

export type HPDrawerMode = "damage" | "heal" | "temp";

interface HPValueLike {
  value: number;
  max: number;
  temp?: number;
}

export function switchLPCSTab(
  el: HTMLElement,
  tab: string,
  tabGroups: Record<string, string>,
): void {
  tabGroups.primary = tab;

  el.querySelectorAll<HTMLElement>(".lpcs-tab-btn[data-tab]").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  el.querySelectorAll<HTMLElement>(".lpcs-tab[data-tab]").forEach((panel) => {
    const active = panel.dataset.tab === tab;
    panel.classList.toggle("active", active);
    if (active) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  });
}

export function setLPCSVitalsView(
  hpView: HTMLElement,
  dsView: HTMLElement,
  active: "hp" | "ds",
): void {
  hpView.classList.toggle("active", active === "hp");
  hpView.classList.toggle("hidden", active === "ds");
  dsView.classList.toggle("active", active === "ds");
  dsView.classList.toggle("hidden", active === "hp");
}

export function updateHPDrawerModeUI(drawer: HTMLElement, mode: HPDrawerMode): void {
  drawer.dataset.mode = mode;
  drawer.querySelectorAll<HTMLElement>("[data-mode]").forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  const applyBtn = drawer.querySelector<HTMLElement>("[data-apply]");
  if (applyBtn) {
    const labels: Record<HPDrawerMode, string> = {
      damage: "Apply Damage",
      heal: "Apply Heal",
      temp: "Set Temp HP",
    };
    applyBtn.textContent = labels[mode];
  }
}

export function updateHPDrawerPreview(
  drawer: HTMLElement,
  hp: HPValueLike | null | undefined,
  mode: HPDrawerMode,
): void {
  const input = drawer.querySelector<HTMLInputElement>("[data-amount]");
  const preview = drawer.querySelector<HTMLElement>("[data-preview]");
  if (!input || !preview) return;

  const amount = Number(input.value) || 0;
  if (!hp || amount <= 0) {
    preview.textContent = "";
    return;
  }

  const temp = hp.temp ?? 0;
  let text: string;
  if (mode === "damage") {
    const tempDmg = Math.min(amount, temp);
    const realDmg = amount - tempDmg;
    const newHp = Math.max(0, hp.value - realDmg);
    const newTemp = temp - tempDmg;
    if (tempDmg > 0 && realDmg > 0) {
      text = `HP ${hp.value}->${newHp}  ·  Temp ${temp}->${newTemp}`;
    } else if (tempDmg > 0) {
      text = `Temp ${temp} -> ${newTemp}`;
    } else {
      text = `${hp.value} -> ${newHp}`;
    }
  } else if (mode === "heal") {
    text = `${hp.value} -> ${Math.min(hp.max, hp.value + amount)}`;
  } else {
    text = `Temp ${temp} -> ${Math.max(temp, amount)}`;
  }

  preview.textContent = text;
}

export function buildSkillGroups(
  skills: LPCSSkill[],
  mode: "proficiency" | "ability" | "alphabetical",
): LPCSSkillGroup[] {
  if (mode === "alphabetical") {
    return [{ label: "", skills: [...skills].sort((a, b) => a.label.localeCompare(b.label)) }];
  }

  if (mode === "proficiency") {
    const prof = skills.filter((skill) => skill.profLevel > 0).sort((a, b) => a.label.localeCompare(b.label));
    const other = skills.filter((skill) => skill.profLevel === 0).sort((a, b) => a.label.localeCompare(b.label));
    const groups: LPCSSkillGroup[] = [];
    if (prof.length) groups.push({ label: "Proficient", skills: prof });
    if (other.length) groups.push({ label: "Other Skills", skills: other });
    return groups;
  }

  const abilityOrder = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  const groups: LPCSSkillGroup[] = [];
  for (const ability of abilityOrder) {
    const matched = skills.filter((skill) => skill.ability === ability).sort((a, b) => a.label.localeCompare(b.label));
    if (matched.length) groups.push({ label: ability, skills: matched });
  }
  return groups;
}
