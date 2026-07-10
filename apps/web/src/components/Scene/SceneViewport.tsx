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
  clampPointToBounds,
  createCustomWall,
  snapOrthogonal,
  syncDerivedLayoutData
} from "@fengshui/core";
import type { FlowField, HeatField } from "@fengshui/simulation";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import type { AnalysisControls, SceneLayers } from "../AppShell";
import type { EditorMode } from "../../lib/editor";
import { ThreeSceneCanvas } from "./ThreeSceneCanvas";

interface DraftWall {
  start: LayoutPoint;
  end: LayoutPoint;
}

function pointFromPointer(
  event: ReactPointerEvent<HTMLDivElement>,
  container: HTMLDivElement,
  layout: HouseLayout
) {
  const bounds = container.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * layout.bounds.width;
  const y = ((event.clientY - bounds.top) / bounds.height) * layout.bounds.depth;
  return clampPointToBounds({ x, y }, layout);
}

function draftLength(draftWall: DraftWall) {
  return Math.hypot(draftWall.end.x - draftWall.start.x, draftWall.end.y - draftWall.start.y);
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

  function beginWall(event: ReactPointerEvent<HTMLDivElement>) {
    if (editorMode !== "draw-wall" || !drawingRef.current) {
      return;
    }
    const start = pointFromPointer(event, drawingRef.current, layout);
    onDraftWallChange({ start, end: start });
  }

  function moveWall(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draftWall || !drawingRef.current) {
      return;
    }
    const current = pointFromPointer(event, drawingRef.current, layout);
    onDraftWallChange({
      start: draftWall.start,
      end: snapOrthogonal(draftWall.start, current)
    });
  }

  function finishWall() {
    if (!draftWall) {
      return;
    }
    if (draftLength(draftWall) >= 0.35) {
      onCommitLayout(
        syncDerivedLayoutData({
          ...layout,
          walls: [...layout.walls, createCustomWall(layout, draftWall.start, draftWall.end)]
        })
      );
    }
    onDraftWallChange(null);
  }

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
        <strong>{editorMode === "draw-wall" ? "画墙模式" : "三维分析"}</strong>
        <span>{editorMode === "draw-wall" ? "在场景上拖拽生成墙体" : "旋转、缩放、选择房间查看信息"}</span>
      </div>

      <div className="viewport-hud bottom-left">
        <span className={layers.heat ? "on" : "off"}>热力 {layers.heat ? "开" : "关"}</span>
        <span className={layers.airflow ? "on" : "off"}>气流 {layers.airflow ? "开" : "关"}</span>
        <span className={layers.fengshui ? "on" : "off"}>罗盘风水 {layers.fengshui ? "开" : "关"}</span>
      </div>

      <button
        type="button"
        className="floating-delete"
        disabled={!selectedWallId}
        onClick={onDeleteSelectedWall}
      >
        删除墙体
      </button>

      <div
        ref={drawingRef}
        className={`drawing-overlay ${editorMode === "draw-wall" ? "active" : ""}`}
        onPointerDown={beginWall}
        onPointerMove={moveWall}
        onPointerUp={finishWall}
        onPointerLeave={() => {
          if (draftWall) {
            finishWall();
          }
        }}
      >
        {draftWall ? (
          <svg className="drawing-svg" viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.depth}`} preserveAspectRatio="none">
            <line
              x1={draftWall.start.x}
              y1={draftWall.start.y}
              x2={draftWall.end.x}
              y2={draftWall.end.y}
              className="draft-line"
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
