import type { CompassSector, HouseLayout } from "../types/layout";
import { normalizeDegrees } from "../geometry/layout-helpers";

const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function buildCompass(layout: HouseLayout): CompassSector[] {
  const activeDirection = layout.orientation.facingLabel;
  return labels.map((label, index) => {
    const startAngle = normalizeDegrees(index * 45 - 22.5);
    return {
      id: `compass-${label}`,
      label,
      startAngle,
      endAngle: normalizeDegrees(startAngle + 45),
      active: label === activeDirection
    };
  });
}

