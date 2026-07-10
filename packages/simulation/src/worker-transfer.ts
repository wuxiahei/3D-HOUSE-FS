import type { FlowField, HeatField, SimGrid, SimulationResult } from "./types";

function addArrayBuffer(buffers: Transferable[], value: ArrayBufferLike) {
  if (value instanceof ArrayBuffer && !buffers.includes(value)) {
    buffers.push(value);
  }
}

function collectGridBuffers(grid: SimGrid, buffers: Transferable[]) {
  addArrayBuffer(buffers, grid.interior.buffer);
  addArrayBuffer(buffers, grid.conductivity.buffer);
  addArrayBuffer(buffers, grid.permeability.buffer);
  addArrayBuffer(buffers, grid.edgeConductivityX.buffer);
  addArrayBuffer(buffers, grid.edgeConductivityY.buffer);
  addArrayBuffer(buffers, grid.edgePermeabilityX.buffer);
  addArrayBuffer(buffers, grid.edgePermeabilityY.buffer);
}

function collectHeatBuffers(field: HeatField, buffers: Transferable[]) {
  collectGridBuffers(field.grid, buffers);
  addArrayBuffer(buffers, field.temperature.buffer);
  field.layers.forEach((layer) => addArrayBuffer(buffers, layer.buffer));
}

function collectFlowBuffers(field: FlowField, buffers: Transferable[]) {
  collectGridBuffers(field.grid, buffers);
  addArrayBuffer(buffers, field.pressure.buffer);
  addArrayBuffer(buffers, field.vx.buffer);
  addArrayBuffer(buffers, field.vy.buffer);
  addArrayBuffer(buffers, field.verticalVelocity.buffer);
  addArrayBuffer(buffers, field.vorticity.buffer);
  addArrayBuffer(buffers, field.divergence.buffer);
}

export function collectSimulationTransferables(result: SimulationResult): Transferable[] {
  const buffers: Transferable[] = [];
  collectHeatBuffers(result.heatField, buffers);
  collectFlowBuffers(result.flowField, buffers);
  return buffers;
}
