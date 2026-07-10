import type { BaguaPalace, CompassDirection } from "@fengshui/core";

export type EditorMode = "select" | "draw-wall" | "move" | "door" | "window" | "device" | "measure";

export const directionLabelMap: Record<CompassDirection, string> = {
  N: "北",
  NE: "东北",
  E: "东",
  SE: "东南",
  S: "南",
  SW: "西南",
  W: "西",
  NW: "西北"
};

export const palaceToneMap: Record<BaguaPalace, string> = {
  north: "tone-north",
  northeast: "tone-northeast",
  east: "tone-east",
  southeast: "tone-southeast",
  south: "tone-south",
  southwest: "tone-southwest",
  west: "tone-west",
  northwest: "tone-northwest",
  center: "tone-center"
};

export function formatDirectionLabel(direction: CompassDirection): string {
  return directionLabelMap[direction];
}
