/**
 * AoE target type → FontAwesome icon mapping.
 * Used by the combat tab spell table to display area of effect shape icons.
 */

export interface AoeTypeInfo {
  icon: string;
  label: string;
}

export const AOE_TYPE_ICONS: Record<string, AoeTypeInfo> = {
  sphere:    { icon: "fas fa-circle",          label: "Sphere" },
  cone:      { icon: "fas fa-chevron-right",   label: "Cone" },
  line:      { icon: "fas fa-arrows-alt-h",    label: "Line" },
  cube:      { icon: "fas fa-square",          label: "Cube" },
  cylinder:  { icon: "fas fa-circle",          label: "Cylinder" },
  emanation: { icon: "fas fa-circle-radiation", label: "Emanation" },
  wall:      { icon: "fas fa-grip-lines",      label: "Wall" },
  radius:    { icon: "fas fa-circle-dot",      label: "Radius" },
};

const FALLBACK: AoeTypeInfo = { icon: "", label: "" };

export function getAoeTypeInfo(type: string): AoeTypeInfo {
  return AOE_TYPE_ICONS[type.toLowerCase()] ?? FALLBACK;
}
