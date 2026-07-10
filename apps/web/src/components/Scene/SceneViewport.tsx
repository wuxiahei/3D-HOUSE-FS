"use client";

import type {
  AirflowVector,
  BaguaPalace,
  FengshuiAnalysis,
  HeatmapCell,
  HouseLayout,
  LayoutPoint
} from "@fengshui/core";
import {
  addCustomWall,
  addDevice as addDeviceCommand,
  addOpening as addOpeningCommand,
  findRoomAtPoint,
  findWallAtPoint
} from "@fengshui/core";
import type { FlowField, HeatField } from "@fengshui/simulation";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { AxisLock, InferenceResult } from "../../editor/inference";
import { inferLayoutPoint } from "../../editor/inference";
import { distance, pointFromTopViewport, projectPointToSegment } from "../../editor/scene-coordinates";
import { toolLabel } from "../../editor/tools";
import type { EditorMode } from "../../lib/editor";
import type { AnalysisControls, SceneLayers } from "../AppShell";
import { ThreeSceneCanvas } from "./ThreeSceneCanvas";

interface DraftWall {
  start: LayoutPoint;
  end: LayoutPoint;
}

function draftLength(draft: DraftWall) {
  return distance(draft.start, draft.end);
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function SceneViewport({
  layout,
  selectedRoomId,
  selectedWallId,
  activePalace,
  editorMode,
  draftWall,
  layers,
  onSelectRoom,
  onSelectWall,
  onDraftWallChange,
  onCommitLayout,
  onDeleteSelectedWall,
  heatmap,
  airflow,
  heatField,
  flowField,
  controls,
  fengshui
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  activePalace: BaguaPalace | null;
  editorMode: EditorMode;
  draftWall: DraftWall | null;
  layers: SceneLayers;
  onSetEditorMode: (mode: EditorMode) => void;
  onSelectRoom: (roomId: string) => void;
  onSelectWall: (wallId: string | null) => void;
  onDraftWallChange: (draft: DraftWall | null) => void;
  onCommitLayout: (nextLayout: HouseLayout) => void;
  onDeleteSelectedWall: () => void;
  heatmap: HeatmapCell[];
  airflow: AirflowVector[];
  heatField: HeatField;
  flowField: FlowField;
  controls: AnalysisControls;
  fengshui: FengshuiAnalysis;
}) {
  const drawingRef = useRef<HTMLDivElement | null>(null);
  const [axisLock, setAxisLock] = useState<AxisLock>(null);
  const [inference, setInference] = useState<InferenceResult | null>(null);
  const [measurement, setMeasurement] = useState<DraftWall | null>(null);
  const [toolStatus, setToolStatus] = useState("Ready");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setAxisLock("x");
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setAxisLock("z");
      }
      if (event.key === "Escape") {
        onDraftWallChange(null);
        setMeasurement(null);
        setInference(null);
        setAxisLock(null);
        setToolStatus("Canceled");
      }
      if (event.key.toLowerCase() === "f") {
        setToolStatus("Focus selection");
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key.startsWith("Arrow")) {
        setAxisLock(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onDraftWallChange]);

  function inferFromPointer(event: ReactPointerEvent<HTMLDivElement>, start?: LayoutPoint) {
    if (!drawingRef.current) {
      return null;
    }
    const raw = pointFromTopViewport(event, drawingRef.current, layout);
    const nextInference = inferLayoutPoint(layout, raw, { start, axisLock });
    setInference(nextInference);
    return nextInference;
  }

  function beginTool(event: ReactPointerEvent<HTMLDivElement>) {
    const inferred = inferFromPointer(event);
    if (!inferred) {
      return;
    }

    if (editorMode === "draw-wall") {
      onDraftWallChange({ start: inferred.point, end: inferred.point });
      setToolStatus("Wall start");
      return;
    }

    if (editorMode === "door" || editorMode === "window") {
      const wall = findWallAtPoint(layout, inferred.point, 0.28);
      if (!wall) {
        setToolStatus("Pick a wall");
        return;
      }
      const projected = projectPointToSegment(inferred.point, wall.start, wall.end);
      const result = addOpeningCommand(layout, wall.id, editorMode, projected.offset);
      if (result.ok) {
        onCommitLayout(result.layout);
        onSelectWall(wall.id);
        setToolStatus(`${toolLabel(editorMode)} placed`);
      } else {
        setToolStatus(result.issues[0]?.message ?? "Opening rejected");
      }
      return;
    }

    if (editorMode === "device") {
      const room = findRoomAtPoint(layout, inferred.point);
      if (!room) {
        setToolStatus("Pick inside a room");
        return;
      }
      const result = addDeviceCommand(layout, room.id, "ac", inferred.point);
      if (result.ok) {
        onCommitLayout(result.layout);
        onSelectRoom(room.id);
        setToolStatus("Device placed");
      } else {
        setToolStatus(result.issues[0]?.message ?? "Device rejected");
      }
      return;
    }

    if (editorMode === "measure") {
      if (!measurement) {
        setMeasurement({ start: inferred.point, end: inferred.point });
        setToolStatus("Measure start");
      } else {
        const nextMeasurement = { ...measurement, end: inferred.point };
        setMeasurement(nextMeasurement);
        setToolStatus(`${draftLength(nextMeasurement).toFixed(2)} m`);
      }
    }
  }

  function previewTool(event: ReactPointerEvent<HTMLDivElement>) {
    if (draftWall) {
      const inferred = inferFromPointer(event, draftWall.start);
      if (!inferred) {
        return;
      }
      const nextDraft = { start: draftWall.start, end: inferred.point };
      onDraftWallChange(nextDraft);
      setToolStatus(`${inferred.kind} · ${draftLength(nextDraft).toFixed(2)} m`);
    }

    if (editorMode === "measure" && measurement) {
      const inferred = inferFromPointer(event, measurement.start);
      if (!inferred) {
        return;
      }
      const nextMeasurement = { start: measurement.start, end: inferred.point };
      setMeasurement(nextMeasurement);
      setToolStatus(`${inferred.kind} · ${draftLength(nextMeasurement).toFixed(2)} m`);
    }
  }

  function finishWall() {
    if (!draftWall) {
      return;
    }
    if (draftLength(draftWall) < 0.35) {
      setToolStatus("Wall is too short");
      onDraftWallChange(null);
      return;
    }

    const result = addCustomWall(layout, draftWall.start, draftWall.end);
    if (result.ok) {
      onCommitLayout(result.layout);
      setToolStatus("Wall created");
    } else {
      setToolStatus(result.issues[0]?.message ?? "Wall rejected");
    }
    onDraftWallChange(null);
  }

  const activeDraft = draftWall ?? measurement;

  return (
    <div className="viewport-shell">
      <ThreeSceneCanvas
        layout={layout}
        selectedRoomId={selectedRoomId}
        selectedWallId={selectedWallId}
        heatmap={heatmap}
        airflow={airflow}
        fengshui={fengshui}
        activePalace={activePalace}
        layers={layers}
        onSelectRoom={onSelectRoom}
        onSelectWall={onSelectWall}
        heatField={heatField}
        flowField={flowField}
        controls={controls}
      />

      <div className="viewport-hud top-left">
        <strong>{toolLabel(editorMode)}</strong>
        <span>
          {toolStatus}
          {inference ? ` · ${inference.kind}` : ""}
          {axisLock ? ` · ${axisLock.toUpperCase()} lock` : ""}
        </span>
      </div>

      <div className="viewport-hud bottom-left">
        <span className={layers.heat ? "on" : "off"}>Heat {layers.heat ? "on" : "off"}</span>
        <span className={layers.airflow ? "on" : "off"}>Air {layers.airflow ? "on" : "off"}</span>
        <span className={layers.fengshui ? "on" : "off"}>Compass {layers.fengshui ? "on" : "off"}</span>
      </div>

      <button
        type="button"
        className="floating-delete"
        disabled={!selectedWallId}
        onClick={onDeleteSelectedWall}
      >
        Delete wall
      </button>

      <div
        ref={drawingRef}
        className={`drawing-overlay ${editorMode !== "select" ? "active" : ""}`}
        onPointerDown={beginTool}
        onPointerMove={previewTool}
        onPointerUp={finishWall}
        onPointerLeave={() => {
          if (draftWall) {
            finishWall();
          }
        }}
      >
        {activeDraft ? (
          <svg className="drawing-svg" viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.depth}`} preserveAspectRatio="none">
            <line
              x1={activeDraft.start.x}
              y1={activeDraft.start.y}
              x2={activeDraft.end.x}
              y2={activeDraft.end.y}
              className="draft-line"
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
