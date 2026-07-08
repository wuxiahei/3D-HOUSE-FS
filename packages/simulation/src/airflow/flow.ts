import type { AirflowVector, HouseLayout } from "@fengshui/core";
import { solveFlow } from "./solveFlow";
import { summarizeFlowField } from "../summarize";

export function generateAirflow(layout: HouseLayout): AirflowVector[] {
  return summarizeFlowField(layout, solveFlow(layout));
}
