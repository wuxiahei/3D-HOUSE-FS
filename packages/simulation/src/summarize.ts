import type { AirflowVector, HeatmapCell, HouseLayout } from "@fengshui/core";
import { degreesToDirection } from "@fengshui/core";
import type { FlowField, HeatField, RoomFlowSummary, RoomHeatSummary, SimulationResult } from "./types";
import { solveFlow } from "./airflow/solveFlow";
import { solveHeat } from "./heat/solveHeat";

function gridIndex(cols: number, column: number, row: number) {
  return row * cols + column;
}

function roomCells(layout: HouseLayout, field: HeatField | FlowField, roomId: string) {
  const indexes: number[] = [];
  for (let index = 0; index < field.grid.roomIds.length; index += 1) {
    if (field.grid.roomIds[index] === roomId && field.grid.interior[index]) {
      indexes.push(index);
    }
  }

  const room = layout.rooms.find((item) => item.id === roomId);
  if (!room || indexes.length > 0) {
    return indexes;
  }

  for (let row = 0; row < field.grid.rows; row += 1) {
    for (let column = 0; column < field.grid.cols; column += 1) {
      const index = gridIndex(field.grid.cols, column, row);
      const x = (column + 0.5) * field.grid.cellSize;
      const y = (row + 0.5) * field.grid.cellSize;
      if (
        x >= room.origin.x &&
        x <= room.origin.x + room.width &&
        y >= room.origin.y &&
        y <= room.origin.y + room.depth
      ) {
        indexes.push(index);
      }
    }
  }

  return indexes;
}

export function summarizeHeatField(layout: HouseLayout, field: HeatField): RoomHeatSummary[] {
  const span = Math.max(0.001, field.max - field.min);

  return layout.rooms.map((room) => {
    const indexes = roomCells(layout, field, room.id);
    let total = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const index of indexes) {
      const value = field.temperature[index];
      total += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    const temperature = indexes.length > 0 ? total / indexes.length : layout.weather.outdoorTemperature;
    const intensity = Math.min(1, Math.max(0, (temperature - field.min) / span));

    return {
      id: `heat-${room.id}`,
      roomId: room.id,
      roomName: room.name,
      x: room.origin.x,
      y: room.origin.y,
      width: room.width,
      depth: room.depth,
      temperature: Number(temperature.toFixed(1)),
      minTemperature: Number((Number.isFinite(min) ? min : temperature).toFixed(1)),
      maxTemperature: Number((Number.isFinite(max) ? max : temperature).toFixed(1)),
      intensity,
      sampleCount: indexes.length
    };
  });
}

function degreesFromVector(x: number, y: number) {
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function summarizeFlowField(layout: HouseLayout, field: FlowField): RoomFlowSummary[] {
  return layout.rooms.map((room) => {
    const indexes = roomCells(layout, field, room.id);
    let speedTotal = 0;
    let peakSpeed = 0;
    let vxTotal = 0;
    let vyTotal = 0;

    for (const index of indexes) {
      const speed = Math.hypot(field.vx[index], field.vy[index]);
      speedTotal += speed;
      peakSpeed = Math.max(peakSpeed, speed);
      vxTotal += field.vx[index];
      vyTotal += field.vy[index];
    }

    const averageSpeed = indexes.length > 0 ? speedTotal / indexes.length : 0;
    const vectorDegrees = degreesFromVector(vxTotal, vyTotal);
    const openingCount = layout.openings.filter((opening) => opening.wallId.startsWith(room.id)).length;
    const strength = Math.min(1, averageSpeed / Math.max(0.001, field.speedMax));

    return {
      id: `flow-${room.id}`,
      roomId: room.id,
      fromDirection: degreesToDirection(layout.weather.windDirection),
      toDirection: degreesToDirection(vectorDegrees),
      strength: Number(strength.toFixed(2)),
      explanation: `${room.name} uses ${openingCount} opening(s), wind ${layout.weather.windSpeed.toFixed(
        1
      )}m/s and local devices to drive a pressure-lite airflow field.`,
      averageSpeed: Number(averageSpeed.toFixed(3)),
      peakSpeed: Number(peakSpeed.toFixed(3)),
      openingCount
    };
  });
}

export function generateSimulation(layout: HouseLayout): SimulationResult {
  const flowField = solveFlow(layout);
  const heatField = solveHeat(layout, { airflow: flowField });
  return {
    heatField,
    flowField,
    heatmap: summarizeHeatField(layout, heatField),
    airflow: summarizeFlowField(layout, flowField)
  };
}

export function heatFieldToCells(layout: HouseLayout, field: HeatField): HeatmapCell[] {
  return summarizeHeatField(layout, field);
}

export function flowFieldToVectors(layout: HouseLayout, field: FlowField): AirflowVector[] {
  return summarizeFlowField(layout, field);
}
