import type { ClimateDevice, HouseLayout, LayoutPoint, Opening, WallSegment } from "@fengshui/core";
import { wallCenter, wallLength } from "@fengshui/core";
import { cellCenter, rasterizeLayout } from "../grid/rasterize";
import type { FlowField, SimGrid } from "../types";

interface FlowSolveOptions {
  iterations?: number;
}

interface Vec2 {
  x: number;
  y: number;
}

function gridIndex(grid: SimGrid, column: number, row: number) {
  return row * grid.cols + column;
}

function nearestCell(grid: SimGrid, point: LayoutPoint) {
  const column = Math.min(grid.cols - 1, Math.max(0, Math.floor((point.x - grid.originX) / grid.cellSize)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((point.y - grid.originY) / grid.cellSize)));
  return gridIndex(grid, column, row);
}

function edgePermeability(grid: SimGrid, column: number, row: number, direction: "east" | "west" | "south" | "north") {
  if (direction === "east") {
    return grid.edgePermeabilityX[row * (grid.cols - 1) + column] ?? 0;
  }
  if (direction === "west") {
    return grid.edgePermeabilityX[row * (grid.cols - 1) + column - 1] ?? 0;
  }
  if (direction === "south") {
    return grid.edgePermeabilityY[row * grid.cols + column] ?? 0;
  }
  return grid.edgePermeabilityY[(row - 1) * grid.cols + column] ?? 0;
}

function vectorFromDegrees(degrees: number): Vec2 {
  const radians = (degrees / 180) * Math.PI;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.000001) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function dot(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y;
}

function wallKey(wall: WallSegment) {
  const horizontal = Math.abs(wall.start.y - wall.end.y) < 0.001;
  const vertical = Math.abs(wall.start.x - wall.end.x) < 0.001;
  if (horizontal) {
    const y = Number(wall.start.y.toFixed(3));
    return `h:${y}:${Math.min(wall.start.x, wall.end.x).toFixed(3)}:${Math.max(wall.start.x, wall.end.x).toFixed(3)}`;
  }
  if (vertical) {
    const x = Number(wall.start.x.toFixed(3));
    return `v:${x}:${Math.min(wall.start.y, wall.end.y).toFixed(3)}:${Math.max(wall.start.y, wall.end.y).toFixed(3)}`;
  }
  return `d:${wall.start.x.toFixed(3)}:${wall.start.y.toFixed(3)}:${wall.end.x.toFixed(3)}:${wall.end.y.toFixed(3)}`;
}

function exteriorWallMap(layout: HouseLayout) {
  const counts = new Map<string, number>();
  for (const wall of layout.walls) {
    const key = wall.source === "custom" ? wall.id : wallKey(wall);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function openingCenter(wall: WallSegment, opening: Opening): LayoutPoint {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const offset = opening.offset + opening.width / 2;
  return {
    x: wall.start.x + (dx / length) * offset,
    y: wall.start.y + (dy / length) * offset
  };
}

function outwardNormal(layout: HouseLayout, wall: WallSegment): Vec2 {
  const tangent = normalize({ x: wall.end.x - wall.start.x, y: wall.end.y - wall.start.y });
  const a = { x: -tangent.y, y: tangent.x };
  const b = { x: tangent.y, y: -tangent.x };
  const center = wallCenter(wall);
  const room = wall.roomId ? layout.rooms.find((item) => item.id === wall.roomId) : null;
  if (!room) {
    return a;
  }
  const roomCenterPoint = {
    x: room.origin.x + room.width / 2,
    y: room.origin.y + room.depth / 2
  };
  const away = normalize({ x: center.x - roomCenterPoint.x, y: center.y - roomCenterPoint.y });
  return dot(a, away) >= dot(b, away) ? a : b;
}

function placeSource(
  grid: SimGrid,
  source: Float32Array,
  point: LayoutPoint,
  strength: number,
  inlets: FlowField["inlets"]
) {
  const index = nearestCell(grid, point);
  if (!grid.interior[index]) {
    return;
  }
  source[index] += strength;
  if (strength > 0) {
    inlets.push({ x: point.x, y: point.y, strength });
  }
}

function addOpeningSources(layout: HouseLayout, grid: SimGrid, source: Float32Array) {
  const wallMap = new Map(layout.walls.map((wall) => [wall.id, wall]));
  const counts = exteriorWallMap(layout);
  const wind = vectorFromDegrees(layout.weather.windDirection);
  const inlets: FlowField["inlets"] = [];

  for (const opening of layout.openings) {
    const wall = wallMap.get(opening.wallId);
    if (!wall) {
      continue;
    }

    const key = wall.source === "custom" ? wall.id : wallKey(wall);
    const isExterior = (counts.get(key) ?? 0) <= 1 && wall.source !== "custom";
    const center = openingCenter(wall, opening);
    const normal = outwardNormal(layout, wall);
    const inside = {
      x: center.x - normal.x * Math.max(0.12, grid.cellSize),
      y: center.y - normal.y * Math.max(0.12, grid.cellSize)
    };
    const openingFactor = opening.type === "door" ? 1 : 0.72;
    const windTowardOpening = dot(wind, { x: -normal.x, y: -normal.y });
    const baseStrength = Math.max(0.05, layout.weather.windSpeed) * opening.width * openingFactor * 0.32;

    if (isExterior && windTowardOpening > 0.08) {
      placeSource(grid, source, inside, baseStrength * windTowardOpening, inlets);
    } else if (isExterior && windTowardOpening < -0.08) {
      placeSource(grid, source, inside, baseStrength * windTowardOpening, inlets);
    } else {
      placeSource(grid, source, inside, baseStrength * 0.1, inlets);
    }
  }

  return inlets;
}

function addDeviceSources(layout: HouseLayout, grid: SimGrid, source: Float32Array, inlets: FlowField["inlets"]) {
  for (const device of layout.devices ?? []) {
    const direction = vectorFromDegrees(device.directionDegrees);
    const intake = {
      x: device.x - direction.x * Math.max(0.25, grid.cellSize * 1.2),
      y: device.y - direction.y * Math.max(0.25, grid.cellSize * 1.2)
    };
    const outlet = {
      x: device.x + direction.x * Math.max(0.35, grid.cellSize * 1.8),
      y: device.y + direction.y * Math.max(0.35, grid.cellSize * 1.8)
    };
    const strength = device.strength * (device.type === "ac" ? 0.72 : 0.34);

    if (device.type === "ac") {
      placeSource(grid, source, outlet, strength, inlets);
      placeSource(grid, source, intake, -strength * 0.82, inlets);
    } else {
      placeSource(grid, source, outlet, strength * 0.48, inlets);
    }
  }
}

function neutralizeSource(grid: SimGrid, source: Float32Array) {
  let total = 0;
  let count = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (!grid.interior[index]) {
      continue;
    }
    total += source[index];
    count += 1;
  }
  if (count === 0) {
    return;
  }
  const mean = total / count;
  for (let index = 0; index < source.length; index += 1) {
    if (grid.interior[index]) {
      source[index] -= mean;
    }
  }
}

function solvePressure(grid: SimGrid, source: Float32Array, iterations: number) {
  let current = new Float32Array(grid.cols * grid.rows);
  let next = new Float32Array(current.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.cols; column += 1) {
        const index = gridIndex(grid, column, row);
        if (!grid.interior[index]) {
          next[index] = 0;
          continue;
        }

        let weighted = 0;
        let totalWeight = 0;
        const neighbors: [number, number, "east" | "west" | "south" | "north"][] = [
          [column + 1, row, "east"],
          [column - 1, row, "west"],
          [column, row + 1, "south"],
          [column, row - 1, "north"]
        ];

        for (const [neighborColumn, neighborRow, direction] of neighbors) {
          if (
            neighborColumn < 0 ||
            neighborColumn >= grid.cols ||
            neighborRow < 0 ||
            neighborRow >= grid.rows
          ) {
            continue;
          }
          const neighbor = gridIndex(grid, neighborColumn, neighborRow);
          if (!grid.interior[neighbor]) {
            continue;
          }
          const permeability = edgePermeability(grid, column, row, direction);
          if (permeability <= 0.0001) {
            continue;
          }
          weighted += permeability * current[neighbor];
          totalWeight += permeability;
        }

        next[index] =
          totalWeight > 0.0001
            ? weighted / totalWeight - (source[index] * grid.cellSize * grid.cellSize) / totalWeight
            : current[index];
      }
    }

    const swap = current;
    current = next;
    next = swap;
  }

  return current;
}

function addDeviceVelocity(layout: HouseLayout, grid: SimGrid, vx: Float32Array, vy: Float32Array) {
  for (const device of layout.devices ?? []) {
    const direction = vectorFromDegrees(device.directionDegrees);
    const influenceRadius = device.type === "ac" ? 1.7 : 1.1;
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.cols; column += 1) {
        const index = gridIndex(grid, column, row);
        if (!grid.interior[index]) {
          continue;
        }
        const center = cellCenter(grid, column, row);
        const distance = Math.hypot(center.x - device.x, center.y - device.y);
        const falloff = Math.exp(-(distance * distance) / (influenceRadius * influenceRadius));
        const scale = device.strength * falloff * (device.type === "ac" ? 0.55 : 0.18);
        vx[index] += direction.x * scale;
        vy[index] += direction.y * scale;
      }
    }
  }
}

function velocityFromPressure(layout: HouseLayout, grid: SimGrid, pressure: Float32Array) {
  const vx = new Float32Array(pressure.length);
  const vy = new Float32Array(pressure.length);
  const wind = vectorFromDegrees(layout.weather.windDirection);
  let speedMax = 0;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }
      const west = column > 0 ? gridIndex(grid, column - 1, row) : index;
      const east = column < grid.cols - 1 ? gridIndex(grid, column + 1, row) : index;
      const north = row > 0 ? gridIndex(grid, column, row - 1) : index;
      const south = row < grid.rows - 1 ? gridIndex(grid, column, row + 1) : index;
      const gradientX = (pressure[east] - pressure[west]) / Math.max(grid.cellSize, 0.001);
      const gradientY = (pressure[south] - pressure[north]) / Math.max(grid.cellSize, 0.001);
      const permeability = grid.permeability[index];
      const ambient = Math.min(0.18, layout.weather.windSpeed * 0.018) * permeability;

      vx[index] = -gradientX * permeability + wind.x * ambient;
      vy[index] = -gradientY * permeability + wind.y * ambient;
    }
  }

  addDeviceVelocity(layout, grid, vx, vy);

  for (let index = 0; index < vx.length; index += 1) {
    const speed = Math.hypot(vx[index], vy[index]);
    speedMax = Math.max(speedMax, speed);
  }

  return { vx, vy, speedMax: Math.max(speedMax, 0.001) };
}

function cellAt(grid: SimGrid, x: number, y: number) {
  const column = Math.floor((x - grid.originX) / grid.cellSize);
  const row = Math.floor((y - grid.originY) / grid.cellSize);
  if (column < 0 || column >= grid.cols || row < 0 || row >= grid.rows) {
    return null;
  }
  return { column, row, index: gridIndex(grid, column, row) };
}

export function sampleFlow(field: Pick<FlowField, "grid" | "vx" | "vy">, x: number, y: number): Vec2 {
  const cell = cellAt(field.grid, x, y);
  if (!cell || !field.grid.interior[cell.index]) {
    return { x: 0, y: 0 };
  }
  return { x: field.vx[cell.index], y: field.vy[cell.index] };
}

function buildFallbackSeeds(layout: HouseLayout, grid: SimGrid) {
  const seeds: FlowField["inlets"] = [];
  for (const room of layout.rooms.slice(0, 8)) {
    seeds.push({
      x: room.origin.x + room.width * 0.35,
      y: room.origin.y + room.depth * 0.35,
      strength: 0.22
    });
  }
  for (const device of layout.devices ?? []) {
    seeds.push({ x: device.x, y: device.y, strength: device.strength });
  }
  return seeds.filter((seed) => {
    const cell = cellAt(grid, seed.x, seed.y);
    return Boolean(cell && grid.interior[cell.index]);
  });
}

function traceStreamlines(layout: HouseLayout, field: Omit<FlowField, "streamlines">) {
  const seeds = field.inlets.length > 0 ? field.inlets : buildFallbackSeeds(layout, field.grid);
  const streamlines: FlowField["streamlines"] = [];
  const targetCount = 16;

  for (let seedIndex = 0; seedIndex < targetCount; seedIndex += 1) {
    const seed = seeds[seedIndex % Math.max(1, seeds.length)];
    if (!seed) {
      break;
    }
    const jitter = ((seedIndex % 5) - 2) * field.grid.cellSize * 0.42;
    let x = seed.x + jitter;
    let y = seed.y + ((Math.floor(seedIndex / 5) % 3) - 1) * field.grid.cellSize * 0.34;
    const points: [number, number][] = [[x, y]];
    let speedTotal = 0;

    for (let step = 0; step < 42; step += 1) {
      const velocity = sampleFlow(field, x, y);
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed < field.speedMax * 0.035) {
        break;
      }
      const unit = { x: velocity.x / speed, y: velocity.y / speed };
      const midX = x + unit.x * field.grid.cellSize * 0.35;
      const midY = y + unit.y * field.grid.cellSize * 0.35;
      const midVelocity = sampleFlow(field, midX, midY);
      const midSpeed = Math.max(0.0001, Math.hypot(midVelocity.x, midVelocity.y));
      x += (midVelocity.x / midSpeed) * field.grid.cellSize * 0.68;
      y += (midVelocity.y / midSpeed) * field.grid.cellSize * 0.68;

      const cell = cellAt(field.grid, x, y);
      if (!cell || !field.grid.interior[cell.index]) {
        break;
      }
      speedTotal += speed;
      points.push([x, y]);
    }

    if (points.length > 4) {
      streamlines.push({ points, speed: speedTotal / Math.max(1, points.length - 1) });
    }
  }

  return streamlines;
}

export function solveFlow(layout: HouseLayout, options: FlowSolveOptions = {}): FlowField {
  const grid = rasterizeLayout(layout);
  const source = new Float32Array(grid.cols * grid.rows);
  const inlets = addOpeningSources(layout, grid, source);
  addDeviceSources(layout, grid, source, inlets);
  neutralizeSource(grid, source);

  const pressure = solvePressure(grid, source, options.iterations ?? 180);
  const velocity = velocityFromPressure(layout, grid, pressure);
  const field: Omit<FlowField, "streamlines"> = {
    grid,
    vx: velocity.vx,
    vy: velocity.vy,
    speedMax: velocity.speedMax,
    inlets
  };

  return {
    ...field,
    streamlines: traceStreamlines(layout, field)
  };
}
