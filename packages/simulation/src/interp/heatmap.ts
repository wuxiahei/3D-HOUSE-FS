import type { HeatmapCell, HouseLayout } from "@fengshui/core";
import { solveHeat } from "../heat/solveHeat";
import { summarizeHeatField } from "../summarize";

export function generateHeatmap(layout: HouseLayout): HeatmapCell[] {
  return summarizeHeatField(layout, solveHeat(layout));
}
