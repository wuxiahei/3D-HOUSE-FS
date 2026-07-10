import type { EditorMode } from "../lib/editor";

export interface EditorToolDefinition {
  id: EditorMode;
  label: string;
  cursor: "default" | "crosshair" | "grab" | "copy";
}

export const EDITOR_TOOLS: EditorToolDefinition[] = [
  { id: "select", label: "Select", cursor: "default" },
  { id: "draw-wall", label: "Wall", cursor: "crosshair" },
  { id: "move", label: "Move", cursor: "grab" },
  { id: "door", label: "Door", cursor: "copy" },
  { id: "window", label: "Window", cursor: "copy" },
  { id: "device", label: "Device", cursor: "copy" },
  { id: "measure", label: "Measure", cursor: "crosshair" }
];

export function toolLabel(mode: EditorMode) {
  return EDITOR_TOOLS.find((tool) => tool.id === mode)?.label ?? "Tool";
}
