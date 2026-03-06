/**
 * Damage type → FontAwesome icon + CSS color class mapping.
 * Used by the combat tab to display damage type icons next to damage formulas.
 */

export interface DamageTypeInfo {
  icon: string;
  cssClass: string;
}

export const DAMAGE_TYPE_ICONS: Record<string, DamageTypeInfo> = {
  bludgeoning: { icon: "fas fa-hammer",           cssClass: "lpcs-dmg--bludgeoning" },
  piercing:    { icon: "fas fa-crosshairs",        cssClass: "lpcs-dmg--piercing" },
  slashing:    { icon: "fas fa-slash",             cssClass: "lpcs-dmg--slashing" },
  fire:        { icon: "fas fa-fire",              cssClass: "lpcs-dmg--fire" },
  cold:        { icon: "fas fa-snowflake",         cssClass: "lpcs-dmg--cold" },
  lightning:   { icon: "fas fa-bolt-lightning",     cssClass: "lpcs-dmg--lightning" },
  thunder:     { icon: "fas fa-hurricane",         cssClass: "lpcs-dmg--thunder" },
  acid:        { icon: "fas fa-droplet",           cssClass: "lpcs-dmg--acid" },
  poison:      { icon: "fas fa-skull-crossbones",  cssClass: "lpcs-dmg--poison" },
  necrotic:    { icon: "fas fa-skull",             cssClass: "lpcs-dmg--necrotic" },
  radiant:     { icon: "fas fa-sun",               cssClass: "lpcs-dmg--radiant" },
  psychic:     { icon: "fas fa-brain",             cssClass: "lpcs-dmg--psychic" },
  force:       { icon: "fas fa-burst",             cssClass: "lpcs-dmg--force" },
};

const FALLBACK: DamageTypeInfo = { icon: "fas fa-circle", cssClass: "lpcs-dmg--generic" };

export function getDamageTypeInfo(type: string): DamageTypeInfo {
  return DAMAGE_TYPE_ICONS[type.toLowerCase()] ?? FALLBACK;
}
