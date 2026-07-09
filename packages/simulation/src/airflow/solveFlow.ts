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

function balanceSourceTerms(grid: SimGrid, source: Float32Array) {
  let positive = 0;
  let negative = 0;
  let count = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (!grid.interior[index]) {
      continue;
    }
    if (source[index] > 0) {
      positive += source[index];
    } else {
      negative += source[index];
    }
    count += 1;
  }
  if (count === 0) {
    return;
  }

  if (positive > 0.0001 && negative < -0.0001) {
    const negativeScale = positive / Math.abs(negative);
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] < 0) {
        source[index] *= negativeScale;
      }
    }
    return;
  }

  const mean = (positive + negative) / count;
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
            ? weighted / totalWeight + (source[index] * grid.cellSize * grid.cellSize) / totalWeight
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
        if (grid.roomIds[index] && grid.roomIds[index] !== device.roomId) {
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

function speedMax(vx: Float32Array, vy: Float32Array) {
  let max = 0;
  for (let index = 0; index < vx.length; index += 1) {
    max = Math.max(max, Math.hypot(vx[index], vy[index]));
  }
  return Math.max(max, 0.001);
}

function velocityFromPressure(layout: HouseLayout, grid: SimGrid, pressure: Float32Array) {
  const vx = new Float32Array(pressure.length);
  const vy = new Float32Array(pressure.length);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }

      let faceVx = 0;
      let faceVy = 0;
      let faceXCount = 0;
      let faceYCount = 0;

      if (column < grid.cols - 1) {
        const east = gridIndex(grid, column + 1, row);
        const permeability = edgePermeability(grid, column, row, "east");
        if (grid.interior[east] && permeability > 0.0001) {
          faceVx += ((pressure[index] - pressure[east]) / Math.max(grid.cellSize, 0.001)) * permeability;
          faceXCount += 1;
        }
      }
      if (column > 0) {
        const west = gridIndex(grid, column - 1, row);
        const permeability = edgePermeability(grid, column, row, "west");
        if (grid.interior[west] && permeability > 0.0001) {
          faceVx += ((pressure[west] - pressure[index]) / Math.max(grid.cellSize, 0.001)) * permeability;
          faceXCount += 1;
        }
      }
      if (row < grid.rows - 1) {
        const south = gridIndex(grid, column, row + 1);
        const permeability = edgePermeability(grid, column, row, "south");
        if (grid.interior[south] && permeability > 0.0001) {
          faceVy += ((pressure[index] - pressure[south]) / Math.max(grid.cellSize, 0.001)) * permeability;
          faceYCount += 1;
        }
      }
      if (row > 0) {
        const north = gridIndex(grid, column, row - 1);
        const permeability = edgePermeability(grid, column, row, "north");
        if (grid.interior[north] && permeability > 0.0001) {
          faceVy += ((pressure[north] - pressure[index]) / Math.max(grid.cellSize, 0.001)) * permeability;
          faceYCount += 1;
        }
      }

      vx[index] = faceXCount > 0 ? faceVx / faceXCount : 0;
      vy[index] = faceYCount > 0 ? faceVy / faceYCount : 0;
    }
  }

  addDeviceVelocity(layout, grid, vx, vy);

  return { vx, vy, speedMax: speedMax(vx, vy) };
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
  const gx = (x - field.grid.originX) / field.grid.cellSize - 0.5;
  const gy = (y - field.grid.originY) / field.grid.cellSize - 0.5;
  const column0 = Math.floor(gx);
  const row0 = Math.floor(gy);
  const tx = gx - column0;
  const ty = gy - row0;
  let vxTotal = 0;
  let vyTotal = 0;
  let weightTotal = 0;

  for (let rowOffset = 0; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset <= 1; columnOffset += 1) {
      const column = column0 + columnOffset;
      const row = row0 + rowOffset;
      if (column < 0 || column >= field.grid.cols || row < 0 || row >= field.grid.rows) {
        continue;
      }
      const index = gridIndex(field.grid, column, row);
      if (!field.grid.interior[index]) {
        continue;
      }
      const wx = columnOffset === 0 ? 1 - tx : tx;
      const wy = rowOffset === 0 ? 1 - ty : ty;
      const weight = wx * wy;
      vxTotal += field.vx[index] * weight;
      vyTotal += field.vy[index] * weight;
      weightTotal += weight;
    }
  }

  if (weightTotal <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: vxTotal / weightTotal, y: vyTotal / weightTotal };
}

function computeDivergence(grid: SimGrid, vx: Float32Array, vy: Float32Array) {
  const divergence = new Float32Array(vx.length);
  const dx = Math.max(grid.cellSize, 0.001);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }

      let eastFlux = 0;
      let westFlux = 0;
      let southFlux = 0;
      let northFlux = 0;

      if (column < grid.cols - 1) {
        const east = gridIndex(grid, column + 1, row);
        const permeability = edgePermeability(grid, column, row, "east");
        if (grid.interior[east] && permeability > 0.0001) {
          eastFlux = ((vx[index] + vx[east]) * 0.5) * permeability;
        }
      }
      if (column > 0) {
        const west = gridIndex(grid, column - 1, row);
        const permeability = edgePermeability(grid, column, row, "west");
        if (grid.interior[west] && permeability > 0.0001) {
          westFlux = ((vx[index] + vx[west]) * 0.5) * permeability;
        }
      }
      if (row < grid.rows - 1) {
        const south = gridIndex(grid, column, row + 1);
        const permeability = edgePermeability(grid, column, row, "south");
        if (grid.interior[south] && permeability > 0.0001) {
          southFlux = ((vy[index] + vy[south]) * 0.5) * permeability;
        }
      }
      if (row > 0) {
        const north = gridIndex(grid, column, row - 1);
        const permeability = edgePermeability(grid, column, row, "north");
        if (grid.interior[north] && permeability > 0.0001) {
          northFlux = ((vy[index] + vy[north]) * 0.5) * permeability;
        }
      }

      divergence[index] = (eastFlux - westFlux + southFlux - northFlux) / dx;
    }
  }

  return divergence;
}

function subtractPressureGradient(grid: SimGrid, pressure: Float32Array, vx: Float32Array, vy: Float32Array, scale: number) {
  const dx = Math.max(grid.cellSize, 0.001);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        vx[index] = 0;
        vy[index] = 0;
        continue;
      }

      let gradientX = 0;
      let gradientY = 0;
      let countX = 0;
      let countY = 0;

      if (column < grid.cols - 1) {
        const east = gridIndex(grid, column + 1, row);
        const permeability = edgePermeability(grid, column, row, "east");
        if (grid.interior[east] && permeability > 0.0001) {
          gradientX += (permeability * (pressure[east] - pressure[index])) / dx;
          countX += 1;
        }
      }
      if (column > 0) {
        const west = gridIndex(grid, column - 1, row);
        const permeability = edgePermeability(grid, column, row, "west");
        if (grid.interior[west] && permeability > 0.0001) {
          gradientX += (permeability * (pressure[index] - pressure[west])) / dx;
          countX += 1;
        }
      }
      if (row < grid.rows - 1) {
        const south = gridIndex(grid, column, row + 1);
        const permeability = edgePermeability(grid, column, row, "south");
        if (grid.interior[south] && permeability > 0.0001) {
          gradientY += (permeability * (pressure[south] - pressure[index])) / dx;
          countY += 1;
        }
      }
      if (row > 0) {
        const north = gridIndex(grid, column, row - 1);
        const permeability = edgePermeability(grid, column, row, "north");
        if (grid.interior[north] && permeability > 0.0001) {
          gradientY += (permeability * (pressure[index] - pressure[north])) / dx;
          countY += 1;
        }
      }

      if (countX > 0) {
        vx[index] -= (gradientX / countX) * scale;
      }
      if (countY > 0) {
        vy[index] -= (gradientY / countY) * scale;
      }
    }
  }
}

function projectVelocity(grid: SimGrid, vx: Float32Array, vy: Float32Array) {
  let divergence = computeDivergence(grid, vx, vy);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const correction = solvePressure(grid, divergence, 110);
    subtractPressureGradient(grid, correction, vx, vy, cycle === 0 ? 0.72 : 0.56);
    divergence = computeDivergence(grid, vx, vy);
  }
  return divergence;
}

function computeVorticity(grid: SimGrid, vx: Float32Array, vy: Float32Array) {
  const vorticity = new Float32Array(vx.length);
  const dx = Math.max(grid.cellSize, 0.001);

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
      const dvyDx = (vy[east] - vy[west]) / (dx * (east === west ? 1 : 2));
      const dvxDy = (vx[south] - vx[north]) / (dx * (south === north ? 1 : 2));
      vorticity[index] = dvyDx - dvxDy;
    }
  }

  return vorticity;
}

function computeVerticalVelocity(layout: HouseLayout, grid: SimGrid) {
  const vertical = new Float32Array(grid.cols * grid.rows);
  const roomPurpose = new Map(layout.rooms.map((room) => [room.id, room.purpose]));

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }

      const center = cellCenter(grid, column, row);
      let value = roomPurpose.get(grid.roomIds[index] ?? "") === "kitchen" ? 0.045 : 0;
      for (const device of layout.devices ?? []) {
        if (grid.roomIds[index] && grid.roomIds[index] !== device.roomId) {
          continue;
        }
        const radius = device.type === "ac" ? 1.8 : 1.45;
        const distance = Math.hypot(center.x - device.x, center.y - device.y);
        const falloff = Math.exp(-(distance * distance) / (radius * radius));
        value += falloff * device.strength * (device.type === "ac" ? -0.12 : 0.18);
      }
      vertical[index] = value;
    }
  }

  return vertical;
}

function buildFallbackSeeds(layout: HouseLayout, grid: SimGrid) {
  const seeds: FlowField["inlets"] = [];
  for (const room of layout.rooms.slice(0, 8)) {
    seeds.push({
      x: room.origin.x + room.width * 0.35,
      y: room.origin.y + room.depth * 0.35,
      strength: 0.22
    });
    seeds.push({
      x: room.origin.x + room.width * 0.68,
      y: room.origin.y + room.depth * 0.62,
      strength: 0.16
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

function buildCoverageSeeds(grid: SimGrid, maxSeeds = 220): FlowField["seedPoints"] {
  const interiorCount = grid.interior.reduce((total, value) => total + value, 0);
  const stride = Math.max(1, Math.floor(Math.sqrt(Math.max(1, interiorCount) / maxSeeds)));
  const seeds: FlowField["seedPoints"] = [];

  for (let row = 0; row < grid.rows; row += stride) {
    for (let column = 0; column < grid.cols; column += stride) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }
      const center = cellCenter(grid, column, row);
      seeds.push({ x: center.x, y: center.y, strength: 0.08 });
    }
  }

  return seeds;
}

function buildFieldSeeds(layout: HouseLayout, field: Pick<FlowField, "grid" | "vx" | "vy" | "speedMax" | "inlets">) {
  const seeds: FlowField["seedPoints"] = [...field.inlets];
  const stride = Math.max(1, Math.floor(Math.sqrt((field.grid.cols * field.grid.rows) / 220)));

  for (let row = Math.floor(stride / 2); row < field.grid.rows; row += stride) {
    for (let column = Math.floor(stride / 2); column < field.grid.cols; column += stride) {
      const index = gridIndex(field.grid, column, row);
      if (!field.grid.interior[index]) {
        continue;
      }
      const center = cellCenter(field.grid, column, row);
      const speed = Math.hypot(field.vx[index], field.vy[index]);
      seeds.push({
        x: center.x,
        y: center.y,
        strength: Math.max(0.08, Math.min(1, 0.18 + speed / Math.max(0.001, field.speedMax)))
      });
    }
  }

  for (const room of layout.rooms) {
    const x = room.origin.x + room.width * 0.5;
    const y = room.origin.y + room.depth * 0.5;
    const cell = cellAt(field.grid, x, y);
    if (!cell || !field.grid.interior[cell.index]) {
      continue;
    }
    const speed = Math.hypot(field.vx[cell.index], field.vy[cell.index]);
    seeds.push({
      x,
      y,
      strength: Math.max(0.1, Math.min(1, 0.22 + speed / Math.max(0.001, field.speedMax)))
    });
  }

  const validSeeds = seeds
    .filter((seed) => {
      const cell = cellAt(field.grid, seed.x, seed.y);
      return Boolean(cell && field.grid.interior[cell.index]);
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 240);

  return validSeeds.length > 0 ? validSeeds : buildFallbackSeeds(layout, field.grid);
}

function traceStreamlines(layout: HouseLayout, field: Omit<FlowField, "streamlines" | "diagnostics">) {
  const seeds =
    field.seedPoints.length > 0
      ? field.seedPoints
      : field.inlets.length > 0
        ? field.inlets
        : buildFallbackSeeds(layout, field.grid);
  const streamlines: FlowField["streamlines"] = [];
  const targetCount = Math.min(172, Math.max(72, seeds.length));

  for (let seedIndex = 0; seedIndex < targetCount; seedIndex += 1) {
    const seed = seeds[seedIndex % Math.max(1, seeds.length)];
    if (!seed) {
      break;
    }
    const jitter = ((seedIndex % 5) - 2) * field.grid.cellSize * 0.28;
    let x = seed.x + jitter;
    let y = seed.y + ((Math.floor(seedIndex / 5) % 3) - 1) * field.grid.cellSize * 0.26;
    const points: [number, number][] = [[x, y]];
    let speedTotal = 0;

    for (let step = 0; step < 92; step += 1) {
      const velocity = sampleFlow(field, x, y);
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed < field.speedMax * 0.018) {
        break;
      }
      const unit = { x: velocity.x / speed, y: velocity.y / speed };
      const midX = x + unit.x * field.grid.cellSize * 0.35;
      const midY = y + unit.y * field.grid.cellSize * 0.35;
      const midVelocity = sampleFlow(field, midX, midY);
      const midSpeed = Math.max(0.0001, Math.hypot(midVelocity.x, midVelocity.y));
      x += (midVelocity.x / midSpeed) * field.grid.cellSize * 0.58;
      y += (midVelocity.y / midSpeed) * field.grid.cellSize * 0.58;

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

function computeFlowDiagnostics(
  field: Omit<FlowField, "diagnostics">,
  iterations: number
): FlowField["diagnostics"] {
  let cellCount = 0;
  let meanSpeedTotal = 0;
  let peakSpeed = 0;
  let deadZoneCount = 0;
  let divergenceTotal = 0;
  let divergenceMax = 0;
  let pressureMin = Number.POSITIVE_INFINITY;
  let pressureMax = Number.NEGATIVE_INFINITY;
  const covered = new Uint8Array(field.grid.interior.length);

  for (let index = 0; index < field.grid.interior.length; index += 1) {
    if (!field.grid.interior[index]) {
      continue;
    }

    const speed = Math.hypot(field.vx[index], field.vy[index]);
    const divergence = Math.abs(field.divergence[index]);
    cellCount += 1;
    meanSpeedTotal += speed;
    peakSpeed = Math.max(peakSpeed, speed);
    divergenceTotal += divergence;
    divergenceMax = Math.max(divergenceMax, divergence);
    pressureMin = Math.min(pressureMin, field.pressure[index]);
    pressureMax = Math.max(pressureMax, field.pressure[index]);
    if (speed / Math.max(0.001, field.speedMax) < 0.16) {
      deadZoneCount += 1;
    }
  }

  for (const streamline of field.streamlines) {
    for (const [x, y] of streamline.points) {
      const cell = cellAt(field.grid, x, y);
      if (!cell || !field.grid.interior[cell.index]) {
        continue;
      }
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          const column = cell.column + columnOffset;
          const row = cell.row + rowOffset;
          if (column < 0 || column >= field.grid.cols || row < 0 || row >= field.grid.rows) {
            continue;
          }
          const index = gridIndex(field.grid, column, row);
          if (field.grid.interior[index]) {
            covered[index] = 1;
          }
        }
      }
    }
  }

  let coveredCount = 0;
  for (let index = 0; index < covered.length; index += 1) {
    coveredCount += covered[index];
  }

  return {
    iterations,
    meanSpeed: Number((cellCount > 0 ? meanSpeedTotal / cellCount : 0).toFixed(3)),
    peakSpeed: Number(peakSpeed.toFixed(3)),
    deadZoneRatio: Number((cellCount > 0 ? deadZoneCount / cellCount : 0).toFixed(3)),
    coverageRatio: Number((cellCount > 0 ? coveredCount / cellCount : 0).toFixed(3)),
    divergenceMean: Number((cellCount > 0 ? divergenceTotal / cellCount : 0).toFixed(5)),
    divergenceMax: Number(divergenceMax.toFixed(5)),
    pressureSpan: Number((Number.isFinite(pressureMin) && Number.isFinite(pressureMax) ? pressureMax - pressureMin : 0).toFixed(3)),
    inletCount: field.inlets.length,
    seedCount: field.seedPoints.length,
    streamlineCount: field.streamlines.length
  };
}

export function solveFlow(layout: HouseLayout, options: FlowSolveOptions = {}): FlowField {
  const grid = rasterizeLayout(layout);
  const source = new Float32Array(grid.cols * grid.rows);
  const inlets = addOpeningSources(layout, grid, source);
  addDeviceSources(layout, grid, source, inlets);
  balanceSourceTerms(grid, source);

  const iterations = options.iterations ?? 240;
  const pressure = solvePressure(grid, source, iterations);
  const velocity = velocityFromPressure(layout, grid, pressure);
  const divergence = projectVelocity(grid, velocity.vx, velocity.vy);
  const verticalVelocity = computeVerticalVelocity(layout, grid);
  const vorticity = computeVorticity(grid, velocity.vx, velocity.vy);
  const field: Omit<FlowField, "streamlines" | "diagnostics"> = {
    grid,
    pressure,
    vx: velocity.vx,
    vy: velocity.vy,
    verticalVelocity,
    vorticity,
    divergence,
    speedMax: speedMax(velocity.vx, velocity.vy),
    inlets,
    seedPoints: []
  };
  field.seedPoints = buildFieldSeeds(layout, field);
  const streamlines = traceStreamlines(layout, field);
  const completedField: Omit<FlowField, "diagnostics"> = {
    ...field,
    streamlines
  };

  return {
    ...completedField,
    diagnostics: computeFlowDiagnostics(completedField, iterations)
  };
}
