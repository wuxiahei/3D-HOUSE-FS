import type { AirflowVector, HeatmapCell } from "@fengshui/core";

export interface SimGrid {
  cols: number;
  rows: number;
  cellSize: number;
  originX: number;
  originY: number;
  interior: Uint8Array;
  conductivity: Float32Array;
  permeability: Float32Array;
  edgeConductivityX: Float32Array;
  edgeConductivityY: Float32Array;
  edgePermeabilityX: Float32Array;
  edgePermeabilityY: Float32Array;
  roomIds: (string | null)[];
}

export interface HeatField {
  grid: SimGrid;
  temperature: Float32Array;
  min: number;
  max: number;
}

export interface FlowField {
  grid: SimGrid;
  vx: Float32Array;
  vy: Float32Array;
  speedMax: number;
  inlets: { x: number; y: number; strength: number }[];
  streamlines: { points: [number, number][]; speed: number }[];
}

export interface RoomHeatSummary extends HeatmapCell {
  roomName?: string;
  minTemperature: number;
  maxTemperature: number;
  sampleCount: number;
}

export interface RoomFlowSummary extends AirflowVector {
  averageSpeed: number;
  peakSpeed: number;
  openingCount: number;
}

export interface SimulationResult {
  heatField: HeatField;
  flowField: FlowField;
  heatmap: RoomHeatSummary[];
  airflow: RoomFlowSummary[];
}
