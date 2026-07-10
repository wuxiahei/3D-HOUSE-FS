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
  layers: Float32Array[];
  layerHeights: number[];
  thermalPlumes: { x: number; y: number; radius: number; strength: number; kind: "warm" | "cool" }[];
  min: number;
  max: number;
  diagnostics: {
    iterations: number;
    residual: number;
    meanTemperature: number;
    meanGradient: number;
    peakGradient: number;
    verticalStratification: number;
    sensorCount: number;
    layerCount: number;
    coupledAirflow: boolean;
  };
}

export interface FlowField {
  grid: SimGrid;
  pressure: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  verticalVelocity: Float32Array;
  vorticity: Float32Array;
  divergence: Float32Array;
  speedMax: number;
  inlets: { x: number; y: number; strength: number }[];
  seedPoints: { x: number; y: number; strength: number }[];
  streamlines: { points: [number, number][]; speed: number }[];
  diagnostics: {
    iterations: number;
    meanSpeed: number;
    peakSpeed: number;
    deadZoneRatio: number;
    coverageRatio: number;
    divergenceMean: number;
    divergenceMax: number;
    pressureSpan: number;
    inletCount: number;
    seedCount: number;
    streamlineCount: number;
  };
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

export const SIMULATION_WORKER_PROTOCOL_VERSION = 1 as const;

export interface SimulationWorkerRequest {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  id: number;
  layout: import("@fengshui/core").HouseLayout;
}

export interface SimulationWorkerSuccess {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  id: number;
  ok: true;
  result: SimulationResult;
}

export interface SimulationWorkerFailure {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  id: number;
  ok: false;
  error: string;
}

export type SimulationWorkerResponse = SimulationWorkerSuccess | SimulationWorkerFailure;
