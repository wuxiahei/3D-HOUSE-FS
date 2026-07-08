import type { ClimateDevice, HouseLayout, SensorPoint } from "@fengshui/core";
import { rasterizeLayout, cellCenter } from "../grid/rasterize";
import type { HeatField, SimGrid } from "../types";

interface HeatSolveOptions {
  iterations?: number;
  epsilon?: number;
}

function gridIndex(grid: SimGrid, column: number, row: number) {
  return row * grid.cols + column;
}

function nearestCell(grid: SimGrid, point: { x: number; y: number }) {
  const column = Math.min(grid.cols - 1, Math.max(0, Math.floor((point.x - grid.originX) / grid.cellSize)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((point.y - grid.originY) / grid.cellSize)));
  return gridIndex(grid, column, row);
}

function edgeConductivity(grid: SimGrid, column: number, row: number, direction: "east" | "west" | "south" | "north") {
  if (direction === "east") {
    return grid.edgeConductivityX[row * (grid.cols - 1) + column] ?? 0;
  }
  if (direction === "west") {
    return grid.edgeConductivityX[row * (grid.cols - 1) + column - 1] ?? 0;
  }
  if (direction === "south") {
    return grid.edgeConductivityY[row * grid.cols + column] ?? 0;
  }
  return grid.edgeConductivityY[(row - 1) * grid.cols + column] ?? 0;
}

function sensorConstraints(grid: SimGrid, sensors: SensorPoint[]) {
  const fixed = new Float32Array(grid.cols * grid.rows);
  const values = new Float32Array(grid.cols * grid.rows);

  for (const sensor of sensors) {
    const index = nearestCell(grid, sensor);
    fixed[index] = 1;
    values[index] = sensor.temperature;
  }

  return { fixed, values };
}

function roomSolarGain(layout: HouseLayout, x: number, y: number) {
  const center = { x: layout.bounds.width / 2, y: layout.bounds.depth / 2 };
  const facing = (layout.orientation.facingDegrees / 180) * Math.PI;
  const facingVector = { x: Math.cos(facing), y: Math.sin(facing) };
  const dx = x - center.x;
  const dy = y - center.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const exposure = Math.max(0, (dx / length) * facingVector.x + (dy / length) * facingVector.y);
  return 0.12 + exposure * 0.55;
}

function deviceInfluence(device: ClimateDevice, x: number, y: number) {
  const distance = Math.hypot(device.x - x, device.y - y);
  const falloff = Math.exp(-(distance * distance) / 5.8);
  return device.temperatureDelta * device.strength * falloff * 0.2;
}

function heatSources(layout: HouseLayout, grid: SimGrid) {
  const source = new Float32Array(grid.cols * grid.rows);
  const roomPurpose = new Map(layout.rooms.map((room) => [room.id, room.purpose]));

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }

      const center = cellCenter(grid, column, row);
      const purpose = grid.roomIds[index] ? roomPurpose.get(grid.roomIds[index] ?? "") : null;
      const kitchenGain = purpose === "kitchen" ? 0.38 : 0;
      const solarGain = roomSolarGain(layout, center.x, center.y);
      const devices = (layout.devices ?? []).reduce(
        (total, device) => total + deviceInfluence(device, center.x, center.y),
        0
      );

      source[index] = solarGain + kitchenGain + devices;
    }
  }

  return source;
}

function initialTemperature(layout: HouseLayout, grid: SimGrid, constraints: ReturnType<typeof sensorConstraints>) {
  const temperature = new Float32Array(grid.cols * grid.rows);
  const sensorAverage =
    layout.sensors.length > 0
      ? layout.sensors.reduce((total, sensor) => total + sensor.temperature, 0) / layout.sensors.length
      : layout.weather.outdoorTemperature - 3;

  for (let index = 0; index < temperature.length; index += 1) {
    temperature[index] = grid.interior[index] ? sensorAverage : layout.weather.outdoorTemperature;
    if (constraints.fixed[index]) {
      temperature[index] = constraints.values[index];
    }
  }

  return temperature;
}

function resetConstraints(temperature: Float32Array, constraints: ReturnType<typeof sensorConstraints>) {
  for (let index = 0; index < temperature.length; index += 1) {
    if (constraints.fixed[index]) {
      temperature[index] = constraints.values[index];
    }
  }
}

export function solveHeat(layout: HouseLayout, options: HeatSolveOptions = {}): HeatField {
  const grid = rasterizeLayout(layout);
  const constraints = sensorConstraints(grid, layout.sensors);
  let current = initialTemperature(layout, grid, constraints);
  let next = new Float32Array(current);
  const sources = heatSources(layout, grid);
  const iterations = options.iterations ?? 160;
  const epsilon = options.epsilon ?? 0.006;
  const outdoor = layout.weather.outdoorTemperature;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let deltaMax = 0;

    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.cols; column += 1) {
        const index = gridIndex(grid, column, row);
        if (!grid.interior[index]) {
          next[index] = outdoor;
          continue;
        }
        if (constraints.fixed[index]) {
          next[index] = constraints.values[index];
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
          const conductance = edgeConductivity(grid, column, row, direction);
          if (conductance <= 0.0001) {
            continue;
          }

          weighted += conductance * (grid.interior[neighbor] ? current[neighbor] : outdoor);
          totalWeight += conductance;
        }

        if (totalWeight <= 0.0001) {
          next[index] = current[index];
          continue;
        }

        const target = weighted / totalWeight + sources[index];
        const relaxed = current[index] + (target - current[index]) * 0.72;
        deltaMax = Math.max(deltaMax, Math.abs(relaxed - current[index]));
        next[index] = relaxed;
      }
    }

    resetConstraints(next, constraints);
    const swap = current;
    current = next;
    next = swap;

    if (deltaMax < epsilon) {
      break;
    }
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < current.length; index += 1) {
    if (!grid.interior[index]) {
      continue;
    }
    min = Math.min(min, current[index]);
    max = Math.max(max, current[index]);
  }

  return {
    grid,
    temperature: current,
    min: Number.isFinite(min) ? min : outdoor,
    max: Number.isFinite(max) ? max : outdoor
  };
}
