import type { ClimateDevice, HeatmapCell, HouseLayout, SensorPoint } from "@fengshui/core";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(0.25, Math.hypot(a.x - b.x, a.y - b.y));
}

function inferTemperature(
  sensors: SensorPoint[],
  devices: ClimateDevice[],
  point: { x: number; y: number },
  outdoorTemperature: number
): number {
  let weighted = 0;
  let totalWeight = 0;

  sensors.forEach((sensor) => {
    const weight = 1 / distance(sensor, point);
    weighted += sensor.temperature * weight;
    totalWeight += weight;
  });

  const sensorTemperature = totalWeight > 0 ? weighted / totalWeight : outdoorTemperature - 4;
  const deviceDelta = devices.reduce((delta, device) => {
    const falloff = 1 / Math.max(0.35, distance(device, point));
    return delta + device.temperatureDelta * device.strength * falloff * 0.42;
  }, 0);

  return sensorTemperature + deviceDelta;
}

export function generateHeatmap(layout: HouseLayout, gridSize = 6): HeatmapCell[] {
  const cellWidth = layout.bounds.width / gridSize;
  const cellDepth = layout.bounds.depth / gridSize;
  const cells: HeatmapCell[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const center = {
        x: column * cellWidth + cellWidth / 2,
        y: row * cellDepth + cellDepth / 2
      };

      const temperature = inferTemperature(layout.sensors, layout.devices ?? [], center, layout.weather.outdoorTemperature);
      const solarBoost = row > gridSize / 2 ? 0.8 : 0.2;
      const adjustedTemperature = Number((temperature + solarBoost).toFixed(1));
      const intensity = Math.max(0, Math.min(1, (adjustedTemperature - 20) / 12));

      cells.push({
        id: `cell-${row}-${column}`,
        x: column * cellWidth,
        y: row * cellDepth,
        width: cellWidth,
        depth: cellDepth,
        temperature: adjustedTemperature,
        intensity
      });
    }
  }

  return cells;
}
