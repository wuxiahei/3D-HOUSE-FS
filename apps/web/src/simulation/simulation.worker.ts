import type { HouseLayout } from "@fengshui/core";
import { generateSimulation } from "@fengshui/simulation";

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; layout: HouseLayout }>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (event: MessageEvent<{ id: number; layout: HouseLayout }>) => {
  const { id, layout } = event.data;
  const result = generateSimulation(layout);
  ctx.postMessage({ id, result });
};
