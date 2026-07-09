import type { ClimateDevice, HouseLayout, SensorPoint } from "@fengshui/core";
import { rasterizeLayout, cellCenter } from "../grid/rasterize";
import type { FlowField, HeatField, SimGrid } from "../types";

interface HeatSolveOptions {
  iterations?: number;
  epsilon?: number;
  airflow?: Pick<FlowField, "grid" | "vx" | "vy" | "speedMax">;
}

const HEAT_LAYER_HEIGHTS = [0.08, 0.28, 0.5, 0.72, 0.92];

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

function layerDeviceInfluence(device: ClimateDevice, x: number, y: number, heightRatio: number) {
  const distance = Math.hypot(device.x - x, device.y - y);
  const radius = device.type === "ac" ? 2.4 : 1.65;
  const falloff = Math.exp(-(distance * distance) / (radius * radius));

  if (device.type === "ac") {
    const highJet = Math.exp(-((heightRatio - 0.66) * (heightRatio - 0.66)) / 0.035);
    const floorWash = Math.exp(-((heightRatio - 0.26) * (heightRatio - 0.26)) / 0.09);
    return -Math.abs(device.temperatureDelta) * device.strength * falloff * (0.07 + highJet * 0.15 + floorWash * 0.06);
  }

  const buoyantLift = 0.35 + heightRatio * 1.25;
  return Math.abs(device.temperatureDelta) * device.strength * falloff * buoyantLift * 0.08;
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
      const devices = (layout.devices ?? []).reduce((total, device) => {
        if (grid.roomIds[index] !== device.roomId) {
          return total;
        }
        return total + deviceInfluence(device, center.x, center.y);
      }, 0);

      source[index] = solarGain + kitchenGain + devices;
    }
  }

  return source;
}

function thermalPlumes(layout: HouseLayout): HeatField["thermalPlumes"] {
  const plumes = (layout.devices ?? []).map((device) => ({
    x: device.x,
    y: device.y,
    radius: device.type === "ac" ? 0.72 + device.strength * 0.38 : 0.62 + device.strength * 0.42,
    strength: Math.max(0.15, Math.abs(device.temperatureDelta) * device.strength * 0.08),
    kind: device.type === "ac" ? ("cool" as const) : ("warm" as const)
  }));

  const kitchenHasDevice = new Set((layout.devices ?? []).filter((device) => device.type === "kitchen-heat").map((device) => device.roomId));
  for (const room of layout.rooms) {
    if (room.purpose !== "kitchen" || kitchenHasDevice.has(room.id)) {
      continue;
    }
    plumes.push({
      x: room.origin.x + room.width * 0.5,
      y: room.origin.y + room.depth * 0.5,
      radius: Math.max(0.55, Math.min(room.width, room.depth) * 0.18),
      strength: 0.42,
      kind: "warm"
    });
  }

  return plumes;
}

function buildHeatLayers(layout: HouseLayout, grid: SimGrid, baseTemperature: Float32Array, sources: Float32Array) {
  return HEAT_LAYER_HEIGHTS.map((heightRatio) => {
    const layer = new Float32Array(baseTemperature.length);
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.cols; column += 1) {
        const index = gridIndex(grid, column, row);
        if (!grid.interior[index]) {
          layer[index] = layout.weather.outdoorTemperature;
          continue;
        }

        const center = cellCenter(grid, column, row);
        const warmSource = Math.max(0, sources[index]);
        const coolSource = Math.min(0, sources[index]);
        const stableStratification = (heightRatio - 0.42) * 0.58;
        const buoyantStack = warmSource * (heightRatio - 0.32) * 0.48;
        const coolPool = coolSource * Math.max(0, 0.55 - heightRatio) * 0.42;
        const deviceStack = (layout.devices ?? []).reduce((total, device) => {
          if (grid.roomIds[index] !== device.roomId) {
            return total;
          }
          return total + layerDeviceInfluence(device, center.x, center.y, heightRatio);
        }, 0);

        layer[index] = baseTemperature[index] + stableStratification + buoyantStack + coolPool + deviceStack;
      }
    }
    return layer;
  });
}

function computeHeatDiagnostics({
  grid,
  temperature,
  layers,
  sensorCount,
  iterations,
  residual,
  coupledAirflow
}: {
  grid: SimGrid;
  temperature: Float32Array;
  layers: Float32Array[];
  sensorCount: number;
  iterations: number;
  residual: number;
  coupledAirflow: boolean;
}): HeatField["diagnostics"] {
  let cellCount = 0;
  let temperatureTotal = 0;
  let gradientTotal = 0;
  let gradientCount = 0;
  let peakGradient = 0;
  let bottomTotal = 0;
  let topTotal = 0;
  const bottom = layers[0] ?? temperature;
  const top = layers[layers.length - 1] ?? temperature;
  const dx = Math.max(grid.cellSize, 0.001);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.cols; column += 1) {
      const index = gridIndex(grid, column, row);
      if (!grid.interior[index]) {
        continue;
      }

      cellCount += 1;
      temperatureTotal += temperature[index];
      bottomTotal += bottom[index];
      topTotal += top[index];

      const west = column > 0 ? gridIndex(grid, column - 1, row) : index;
      const east = column < grid.cols - 1 ? gridIndex(grid, column + 1, row) : index;
      const north = row > 0 ? gridIndex(grid, column, row - 1) : index;
      const south = row < grid.rows - 1 ? gridIndex(grid, column, row + 1) : index;
      const gx =
        grid.interior[east] && grid.interior[west]
          ? (temperature[east] - temperature[west]) / (dx * (east === west ? 1 : 2))
          : 0;
      const gy =
        grid.interior[south] && grid.interior[north]
          ? (temperature[south] - temperature[north]) / (dx * (south === north ? 1 : 2))
          : 0;
      const gradient = Math.hypot(gx, gy);
      if (gradient > 0) {
        gradientTotal += gradient;
        gradientCount += 1;
        peakGradient = Math.max(peakGradient, gradient);
      }
    }
  }

  const meanTemperature = cellCount > 0 ? temperatureTotal / cellCount : 0;
  const verticalStratification = cellCount > 0 ? (topTotal - bottomTotal) / cellCount : 0;

  return {
    iterations,
    residual: Number((Number.isFinite(residual) ? residual : 0).toFixed(4)),
    meanTemperature: Number(meanTemperature.toFixed(2)),
    meanGradient: Number((gradientCount > 0 ? gradientTotal / gradientCount : 0).toFixed(3)),
    peakGradient: Number(peakGradient.toFixed(3)),
    verticalStratification: Number(verticalStratification.toFixed(2)),
    sensorCount,
    layerCount: layers.length,
    coupledAirflow
  };
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

function matchingFlow(grid: SimGrid, airflow: HeatSolveOptions["airflow"] | undefined) {
  return airflow &&
    airflow.grid.cols === grid.cols &&
    airflow.grid.rows === grid.rows &&
    Math.abs(airflow.grid.cellSize - grid.cellSize) < 0.0001
    ? airflow
    : null;
}

function airflowHeatExchange(
  layout: HouseLayout,
  grid: SimGrid,
  flow: Pick<FlowField, "grid" | "vx" | "vy" | "speedMax"> | null,
  temperature: Float32Array,
  column: number,
  row: number,
  index: number
) {
  if (!flow) {
    return 0;
  }

  const vx = flow.vx[index] ?? 0;
  const vy = flow.vy[index] ?? 0;
  const speedNorm = Math.min(1, Math.hypot(vx, vy) / Math.max(0.001, flow.speedMax));
  if (speedNorm <= 0.002) {
    return 0;
  }

  const upwindColumn = Math.min(grid.cols - 1, Math.max(0, column - Math.sign(vx)));
  const upwindRow = Math.min(grid.rows - 1, Math.max(0, row - Math.sign(vy)));
  const upwind = gridIndex(grid, upwindColumn, upwindRow);
  const upwindTemperature = grid.interior[upwind] ? temperature[upwind] : layout.weather.outdoorTemperature;
  const advectiveMix = (upwindTemperature - temperature[index]) * speedNorm * 0.22;
  const outdoorExchange = (layout.weather.outdoorTemperature - temperature[index]) * speedNorm * 0.035;

  return advectiveMix + outdoorExchange;
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
  const flow = matchingFlow(grid, options.airflow);
  let residual = Number.POSITIVE_INFINITY;
  let completedIterations = 0;

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

        const target =
          weighted / totalWeight +
          sources[index] +
          airflowHeatExchange(layout, grid, flow, current, column, row, index);
        const relaxed = current[index] + (target - current[index]) * 0.72;
        deltaMax = Math.max(deltaMax, Math.abs(relaxed - current[index]));
        next[index] = relaxed;
      }
    }

    resetConstraints(next, constraints);
    const swap = current;
    current = next;
    next = swap;
    residual = deltaMax;
    completedIterations = iteration + 1;

    if (deltaMax < epsilon) {
      break;
    }
  }

  const layers = buildHeatLayers(layout, grid, current, sources);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const layer of layers) {
    for (let index = 0; index < layer.length; index += 1) {
      if (!grid.interior[index]) {
        continue;
      }
      min = Math.min(min, layer[index]);
      max = Math.max(max, layer[index]);
    }
  }

  return {
    grid,
    temperature: current,
    layers,
    layerHeights: HEAT_LAYER_HEIGHTS.map((heightRatio) => heightRatio * layout.bounds.height),
    thermalPlumes: thermalPlumes(layout),
    min: Number.isFinite(min) ? min : outdoor,
    max: Number.isFinite(max) ? max : outdoor,
    diagnostics: computeHeatDiagnostics({
      grid,
      temperature: current,
      layers,
      sensorCount: layout.sensors.length,
      iterations: completedIterations,
      residual,
      coupledAirflow: Boolean(flow)
    })
  };
}
