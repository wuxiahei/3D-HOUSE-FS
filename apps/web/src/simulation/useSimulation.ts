"use client";

import type { HouseLayout } from "@fengshui/core";
import { SIMULATION_WORKER_PROTOCOL_VERSION, generateSimulation } from "@fengshui/simulation";
import type { SimulationResult, SimulationWorkerResponse } from "@fengshui/simulation";
import { useEffect, useRef, useState } from "react";

const SIMULATION_REQUEST_START_MARK = "simulation-request-start";
const SIMULATION_REQUEST_END_MARK = "simulation-request-end";

function markSimulationRequest(name: typeof SIMULATION_REQUEST_START_MARK | typeof SIMULATION_REQUEST_END_MARK) {
  if (typeof performance !== "undefined" && typeof performance.mark === "function") {
    performance.mark(name);
  }
}

function generateInitialSimulation(layout: HouseLayout) {
  markSimulationRequest(SIMULATION_REQUEST_START_MARK);
  try {
    return generateSimulation(layout);
  } finally {
    markSimulationRequest(SIMULATION_REQUEST_END_MARK);
  }
}

function createSimulationWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }
  try {
    return new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

export function useSimulation(layout: HouseLayout) {
  const [simulation, setSimulation] = useState<SimulationResult>(() => generateInitialSimulation(layout));
  const [pending, setPending] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    workerRef.current = createSimulationWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    setPending(true);

    const timeout = window.setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) {
        setSimulation(generateInitialSimulation(layout));
        setPending(false);
        return;
      }

      markSimulationRequest(SIMULATION_REQUEST_START_MARK);

      const completeWithFallback = () => {
        if (id !== requestIdRef.current) {
          return;
        }
        try {
          setSimulation(generateSimulation(layout));
        } finally {
          markSimulationRequest(SIMULATION_REQUEST_END_MARK);
          setPending(false);
        }
      };

      worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
        if (event.data.id !== requestIdRef.current) {
          return;
        }
        if (!event.data.ok) {
          completeWithFallback();
          return;
        }
        setSimulation(event.data.result);
        markSimulationRequest(SIMULATION_REQUEST_END_MARK);
        setPending(false);
      };
      worker.onerror = completeWithFallback;
      try {
        worker.postMessage({ protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION, id, layout });
      } catch {
        completeWithFallback();
      }
    }, 150);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [layout]);

  return { simulation, pending };
}
