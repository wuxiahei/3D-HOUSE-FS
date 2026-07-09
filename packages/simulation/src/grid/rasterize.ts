import type { HouseLayout, LayoutPoint, Opening, WallSegment } from "@fengshui/core";
import { wallLength } from "@fengshui/core";
import type { SimGrid } from "../types";

const WALL_CONDUCTIVITY = 0.02;
const OUTDOOR_CONDUCTIVITY = 0.04;
const WALL_PERMEABILITY = 0;
const OUTDOOR_PERMEABILITY = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gridIndex(grid: Pick<SimGrid, "cols">, column: number, row: number) {
  return row * grid.cols + column;
}

export function cellCenter(grid: SimGrid, column: number, row: number): LayoutPoint {
  return {
    x: grid.originX + (column + 0.5) * grid.cellSize,
    y: grid.originY + (row + 0.5) * grid.cellSize
  };
}

function pointInRoom(layout: HouseLayout, point: LayoutPoint) {
  return (
    layout.rooms.find(
      (room) =>
        point.x >= room.origin.x &&
        point.x <= room.origin.x + room.width &&
        point.y >= room.origin.y &&
        point.y <= room.origin.y + room.depth
    ) ?? null
  );
}

function projectOnWall(wall: WallSegment, point: LayoutPoint) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.000001) {
    return { distance: Number.POSITIVE_INFINITY, offset: 0 };
  }

  const t = clamp(((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSq, 0, 1);
  const closest = {
    x: wall.start.x + dx * t,
    y: wall.start.y + dy * t
  };

  return {
    distance: Math.hypot(point.x - closest.x, point.y - closest.y),
    offset: Math.sqrt(lengthSq) * t
  };
}

function openingAt(openings: Opening[], wall: WallSegment, offset: number) {
  return (
    openings.find(
      (opening) =>
        opening.wallId === wall.id &&
        offset >= opening.offset - 0.04 &&
        offset <= opening.offset + opening.width + 0.04
    ) ?? null
  );
}

function wallAt(layout: HouseLayout, point: LayoutPoint) {
  let best:
    | {
        wall: WallSegment;
        opening: Opening | null;
        distance: number;
      }
    | null = null;

  for (const wall of layout.walls) {
    const length = wallLength(wall);
    if (length <= 0.000001) {
      continue;
    }
    const projection = projectOnWall(wall, point);
    const tolerance = Math.max(wall.thickness * 0.58, 0.08);
    if (projection.distance > tolerance || projection.offset < -0.01 || projection.offset > length + 0.01) {
      continue;
    }

    if (!best || projection.distance < best.distance) {
      best = {
        wall,
        opening: openingAt(layout.openings, wall, projection.offset),
        distance: projection.distance
      };
    }
  }

  return best;
}

function harmonicMean(a: number, b: number) {
  if (a <= 0 || b <= 0) {
    return 0;
  }
  return (2 * a * b) / (a + b);
}

function openingConductivity(opening: Opening) {
  return opening.type === "door" ? 1 : 0.5;
}

function openingPermeability(opening: Opening) {
  return opening.type === "door" ? 1 : 0.78;
}

function faceConductance(
  layout: HouseLayout,
  point: LayoutPoint,
  cellA: number,
  cellB: number,
  values: Float32Array,
  openingValue: (opening: Opening) => number,
  blockedValue: number
) {
  const hit = wallAt(layout, point);
  if (hit?.opening) {
    return openingValue(hit.opening);
  }
  if (hit) {
    return blockedValue;
  }
  return harmonicMean(values[cellA], values[cellB]);
}

export function rasterizeLayout(layout: HouseLayout): SimGrid {
  const cellSize = clamp(Math.max(layout.bounds.width, layout.bounds.depth) / 96, 0.08, 0.2);
  const cols = Math.max(2, Math.ceil(layout.bounds.width / cellSize));
  const rows = Math.max(2, Math.ceil(layout.bounds.depth / cellSize));
  const count = cols * rows;
  const grid: SimGrid = {
    cols,
    rows,
    cellSize,
    originX: 0,
    originY: 0,
    interior: new Uint8Array(count),
    conductivity: new Float32Array(count),
    permeability: new Float32Array(count),
    edgeConductivityX: new Float32Array(rows * Math.max(0, cols - 1)),
    edgeConductivityY: new Float32Array(Math.max(0, rows - 1) * cols),
    edgePermeabilityX: new Float32Array(rows * Math.max(0, cols - 1)),
    edgePermeabilityY: new Float32Array(Math.max(0, rows - 1) * cols),
    roomIds: Array.from({ length: count }, () => null)
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      const index = gridIndex(grid, column, row);
      const center = cellCenter(grid, column, row);
      const room = pointInRoom(layout, center);
      const hit = wallAt(layout, center);

      grid.interior[index] = room ? 1 : 0;
      grid.roomIds[index] = room?.id ?? null;

      if (hit?.opening) {
        grid.conductivity[index] = openingConductivity(hit.opening);
        grid.permeability[index] = openingPermeability(hit.opening);
      } else if (hit) {
        grid.conductivity[index] = WALL_CONDUCTIVITY;
        grid.permeability[index] = WALL_PERMEABILITY;
      } else if (room) {
        grid.conductivity[index] = 1;
        grid.permeability[index] = 1;
      } else {
        grid.conductivity[index] = OUTDOOR_CONDUCTIVITY;
        grid.permeability[index] = OUTDOOR_PERMEABILITY;
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols - 1; column += 1) {
      const left = gridIndex(grid, column, row);
      const right = gridIndex(grid, column + 1, row);
      const face = {
        x: grid.originX + (column + 1) * grid.cellSize,
        y: grid.originY + (row + 0.5) * grid.cellSize
      };
      const edgeIndex = row * (cols - 1) + column;
      grid.edgeConductivityX[edgeIndex] = faceConductance(
        layout,
        face,
        left,
        right,
        grid.conductivity,
        openingConductivity,
        WALL_CONDUCTIVITY
      );
      grid.edgePermeabilityX[edgeIndex] = faceConductance(
        layout,
        face,
        left,
        right,
        grid.permeability,
        openingPermeability,
        WALL_PERMEABILITY
      );
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      const top = gridIndex(grid, column, row);
      const bottom = gridIndex(grid, column, row + 1);
      const face = {
        x: grid.originX + (column + 0.5) * grid.cellSize,
        y: grid.originY + (row + 1) * grid.cellSize
      };
      const edgeIndex = row * cols + column;
      grid.edgeConductivityY[edgeIndex] = faceConductance(
        layout,
        face,
        top,
        bottom,
        grid.conductivity,
        openingConductivity,
        WALL_CONDUCTIVITY
      );
      grid.edgePermeabilityY[edgeIndex] = faceConductance(
        layout,
        face,
        top,
        bottom,
        grid.permeability,
        openingPermeability,
        WALL_PERMEABILITY
      );
    }
  }

  return grid;
}
