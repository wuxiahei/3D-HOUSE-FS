import { clampPointToBounds } from "@fengshui/core";
import type { HouseLayout, LayoutPoint } from "@fengshui/core";

export interface ViewportPointInput {
  clientX: number;
  clientY: number;
}

export function pointFromTopViewport(
  event: ViewportPointInput,
  container: HTMLElement,
  layout: HouseLayout
): LayoutPoint {
  const bounds = container.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * layout.bounds.width;
  const y = ((event.clientY - bounds.top) / bounds.height) * layout.bounds.depth;
  return clampPointToBounds({ x, y }, layout);
}

export function distance(a: LayoutPoint, b: LayoutPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function projectPointToSegment(point: LayoutPoint, start: LayoutPoint, end: LayoutPoint) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) {
    return { point: start, t: 0, offset: 0 };
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared)
  );
  const projected = {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };

  return {
    point: projected,
    t,
    offset: Math.sqrt(lengthSquared) * t
  };
}
