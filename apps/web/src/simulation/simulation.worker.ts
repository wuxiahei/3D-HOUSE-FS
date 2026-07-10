import {
  SIMULATION_WORKER_PROTOCOL_VERSION,
  collectSimulationTransferables,
  generateSimulation
} from "@fengshui/simulation";
import type { SimulationWorkerRequest, SimulationWorkerResponse } from "@fengshui/simulation";

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<SimulationWorkerRequest>) => void) | null;
  postMessage: (message: SimulationWorkerResponse, transfer?: Transferable[]) => void;
};

ctx.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { id, layout, protocolVersion } = event.data;
  if (protocolVersion !== SIMULATION_WORKER_PROTOCOL_VERSION) {
    ctx.postMessage({
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      id,
      ok: false,
      error: "Unsupported simulation worker protocol"
    });
    return;
  }

  try {
    const result = generateSimulation(layout);
    ctx.postMessage(
      {
        protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
        id,
        ok: true,
        result
      },
      collectSimulationTransferables(result)
    );
  } catch (error) {
    ctx.postMessage({
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Simulation failed"
    });
  }
};
