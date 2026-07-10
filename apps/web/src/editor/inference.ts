import type { HouseLayout, LayoutPoint } from "@fengshui/core";
import { clampPointToBounds } from "@fengshui/core";
import { distance, projectPointToSegment } from "./scene-coordinates";

export type AxisLock = "x" | "z" | null;

export interface InferenceResult {
  point: LayoutPoint;
  kind: "endpoint" | "midpoint" | "edge" | "parallel" | "perpendicular" | "axis-x" | "axis-z" | "grid" | "free";
  sourceId?: string;
}

export interface InferenceOptions {
  start?: LayoutPoint;
  axisLock?: AxisLock;
  tolerance?: number;
  gridSize?: number;
}

function midpoint(a: LayoutPoint, b: LayoutPoint): LayoutPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function snapGrid(point: LayoutPoint, gridSize: number): LayoutPoint {
  return {
    x: Number((Math.round(point.x / gridSize) * gridSize).toFixed(2)),
    y: Number((Math.round(point.y / gridSize) * gridSize).toFixed(2))
  };
}

export function inferLayoutPoint(
  layout: HouseLayout,
  rawPoint: LayoutPoint,
  options: InferenceOptions = {}
): InferenceResult {
  const tolerance = options.tolerance ?? 0.18;
  const gridSize = options.gridSize ?? 0.25;
  const point = clampPointToBounds(rawPoint, layout);

  if (options.start && options.axisLock) {
    return {
      point:
        options.axisLock === "x"
          ? clampPointToBounds({ x: point.x, y: options.start.y }, layout)
          : clampPointToBounds({ x: options.start.x, y: point.y }, layout),
      kind: options.axisLock === "x" ? "axis-x" : "axis-z"
    };
  }

  for (const wall of layout.walls) {
    if (distance(point, wall.start) <= tolerance) {
      return { point: wall.start, kind: "endpoint", sourceId: wall.id };
    }
    if (distance(point, wall.end) <= tolerance) {
      return { point: wall.end, kind: "endpoint", sourceId: wall.id };
    }
  }

  for (const wall of layout.walls) {
    const center = midpoint(wall.start, wall.end);
    if (distance(point, center) <= tolerance) {
      return { point: center, kind: "midpoint", sourceId: wall.id };
    }
  }

  for (const wall of layout.walls) {
    const projected = projectPointToSegment(point, wall.start, wall.end);
    if (distance(point, projected.point) <= tolerance) {
      return { point: projected.point, kind: "edge", sourceId: wall.id };
    }
  }

  if (options.start) {
    const dx = Math.abs(point.x - options.start.x);
    const dy = Math.abs(point.y - options.start.y);
    if (Math.abs(dx - dy) <= tolerance) {
      return { point, kind: "parallel" };
    }
  }

  const gridPoint = clampPointToBounds(snapGrid(point, gridSize), layout);
  if (distance(point, gridPoint) <= tolerance) {
    return { point: gridPoint, kind: "grid" };
  }

  return { point, kind: "free" };
}
