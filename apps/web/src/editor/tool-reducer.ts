import type { LayoutPoint } from "@fengshui/core";
import type { EditorMode } from "../lib/editor";
import type { AxisLock, InferenceResult } from "./inference";

export interface EditorSelection {
  type: "room" | "wall" | "opening" | "device" | "sensor";
  id: string;
}

export interface EditorToolState {
  activeTool: EditorMode;
  axisLock: AxisLock;
  selection: EditorSelection | null;
  hover: EditorSelection | null;
  firstPoint: LayoutPoint | null;
  currentInference: InferenceResult | null;
  typedValue: string;
  status: string;
}

export type EditorToolAction =
  | { type: "set-tool"; tool: EditorMode }
  | { type: "set-axis-lock"; axisLock: AxisLock }
  | { type: "set-selection"; selection: EditorSelection | null }
  | { type: "set-hover"; hover: EditorSelection | null }
  | { type: "start"; point: LayoutPoint; inference: InferenceResult }
  | { type: "preview"; inference: InferenceResult }
  | { type: "type-value"; value: string }
  | { type: "commit" }
  | { type: "cancel" }
  | { type: "status"; status: string };

export const initialEditorToolState: EditorToolState = {
  activeTool: "select",
  axisLock: null,
  selection: null,
  hover: null,
  firstPoint: null,
  currentInference: null,
  typedValue: "",
  status: "Ready"
};

export function editorToolReducer(
  state: EditorToolState,
  action: EditorToolAction
): EditorToolState {
  switch (action.type) {
    case "set-tool":
      return {
        ...state,
        activeTool: action.tool,
        firstPoint: null,
        currentInference: null,
        typedValue: "",
        status: action.tool
      };
    case "set-axis-lock":
      return { ...state, axisLock: action.axisLock };
    case "set-selection":
      return { ...state, selection: action.selection };
    case "set-hover":
      return { ...state, hover: action.hover };
    case "start":
      return { ...state, firstPoint: action.point, currentInference: action.inference, status: action.inference.kind };
    case "preview":
      return { ...state, currentInference: action.inference, status: action.inference.kind };
    case "type-value":
      return { ...state, typedValue: action.value };
    case "commit":
    case "cancel":
      return { ...state, firstPoint: null, currentInference: null, typedValue: "", status: action.type === "commit" ? "Committed" : "Canceled" };
    case "status":
      return { ...state, status: action.status };
    default:
      return state;
  }
}
