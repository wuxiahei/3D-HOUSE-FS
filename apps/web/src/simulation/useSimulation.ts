"use client";

import type { HouseLayout } from "@fengshui/core";
import { generateSimulation } from "@fengshui/simulation";
import type { SimulationResult } from "@fengshui/simulation";
import { useEffect, useRef, useState } from "react";

interface WorkerResponse {
  id: number;
  result: SimulationResult;
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
  const [simulation, setSimulation] = useState<SimulationResult>(() => generateSimulation(layout));
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
        setSimulation(generateSimulation(layout));
        setPending(false);
        return;
      }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== requestIdRef.current) {
          return;
        }
        setSimulation(event.data.result);
        setPending(false);
      };
      worker.onerror = () => {
        setSimulation(generateSimulation(layout));
        setPending(false);
      };
      worker.postMessage({ id, layout });
    }, 150);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [layout]);

  return { simulation, pending };
}
