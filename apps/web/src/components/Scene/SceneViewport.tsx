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
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo, useRef } from "react";
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

function lineLength(line: DraftWall) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

export function SceneViewport({
  layout,
  selectedRoomId,
  selectedWallId,
  activePalace,
  editorMode,
  draftWall,
  onSetEditorMode,
  onSelectRoom,
  onSelectWall,
  onDraftWallChange,
  onCommitLayout,
  onDeleteSelectedWall,
  heatmap,
  airflow,
  fengshui
}: {
  layout: HouseLayout;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  activePalace: BaguaPalace | null;
  editorMode: EditorMode;
  draftWall: DraftWall | null;
  onSetEditorMode: (mode: EditorMode) => void;
  onSelectRoom: (roomId: string) => void;
  onSelectWall: (wallId: string | null) => void;
  onDraftWallChange: (draft: DraftWall | null) => void;
  onCommitLayout: (nextLayout: HouseLayout) => void;
  onDeleteSelectedWall: () => void;
  heatmap: HeatmapCell[];
  airflow: AirflowVector[];
  fengshui: FengshuiAnalysis;
}) {
  const planRef = useRef<HTMLDivElement | null>(null);

  const draftLine = useMemo(() => {
    if (!draftWall) {
      return null;
    }
    return {
      x1: (draftWall.start.x / layout.bounds.width) * 100,
      y1: (draftWall.start.y / layout.bounds.depth) * 100,
      x2: (draftWall.end.x / layout.bounds.width) * 100,
      y2: (draftWall.end.y / layout.bounds.depth) * 100
    };
  }, [draftWall, layout.bounds.depth, layout.bounds.width]);

  function beginWall(event: ReactPointerEvent<HTMLDivElement>) {
    if (editorMode !== "draw-wall" || !planRef.current) {
      return;
    }
    const start = pointFromPointer(event, planRef.current, layout);
    onDraftWallChange({ start, end: start });
  }

  function moveWall(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draftWall || !planRef.current) {
      return;
    }
    const current = pointFromPointer(event, planRef.current, layout);
    onDraftWallChange({
      start: draftWall.start,
      end: snapOrthogonal(draftWall.start, current)
    });
  }

  function finishWall() {
    if (!draftWall) {
      return;
    }
    if (lineLength(draftWall) >= 0.35) {
      const nextLayout = syncDerivedLayoutData({
        ...layout,
        walls: [...layout.walls, createCustomWall(layout, draftWall.start, draftWall.end)]
      });
      onCommitLayout(nextLayout);
    }
    onDraftWallChange(null);
  }

  return (
    <div className="panel stack gap-xl">
      <div className="subpanel-header">
        <div>
          <h2>场景总览</h2>
          <p className="muted">顶视图负责精准输入，3D 场景负责空间理解，风水罗盘负责方向分析。</p>
        </div>
        <span className="badge">真实 3D + 鼠标画墙</span>
      </div>

      <div className="scene-toolbar">
        <button
          type="button"
          className={`tool-button ${editorMode === "select" ? "active" : ""}`}
          onClick={() => onSetEditorMode("select")}
        >
          选择
        </button>
        <button
          type="button"
          className={`tool-button ${editorMode === "draw-wall" ? "active" : ""}`}
          onClick={() => onSetEditorMode("draw-wall")}
        >
          画墙
        </button>
        <button
          type="button"
          className="tool-button"
          disabled={!selectedWallId}
          onClick={onDeleteSelectedWall}
        >
          删除选中墙
        </button>
      </div>

      <div className="scene-split">
        <div className="subpanel">
          <div className="subpanel-header">
            <h3>顶视图编辑器</h3>
            <span className="badge">{editorMode === "draw-wall" ? "拖拽画墙" : "点选查看"}</span>
          </div>
          <div
            ref={planRef}
            className={`plan-canvas ${editorMode === "draw-wall" ? "draw-mode" : ""}`}
            onPointerDown={beginWall}
            onPointerMove={moveWall}
            onPointerUp={finishWall}
            onPointerLeave={() => {
              if (draftWall) {
                finishWall();
              }
            }}
          >
            {heatmap.map((cell) => (
              <div
                key={cell.id}
                className="heat-cell"
                style={{
                  left: `${(cell.x / layout.bounds.width) * 100}%`,
                  top: `${(cell.y / layout.bounds.depth) * 100}%`,
                  width: `${(cell.width / layout.bounds.width) * 100}%`,
                  height: `${(cell.depth / layout.bounds.depth) * 100}%`,
                  background: `hsl(${210 - cell.intensity * 180} 80% 62%)`
                }}
              />
            ))}
            {layout.rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={`room-block ${selectedRoomId === room.id ? "active" : ""}`}
                style={{
                  left: `${(room.origin.x / layout.bounds.width) * 100}%`,
                  top: `${(room.origin.y / layout.bounds.depth) * 100}%`,
                  width: `${(room.width / layout.bounds.width) * 100}%`,
                  height: `${(room.depth / layout.bounds.depth) * 100}%`
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (editorMode === "select") {
                    onSelectWall(null);
                    onSelectRoom(room.id);
                  }
                }}
              >
                <strong>{room.name}</strong>
                <span>{room.width.toFixed(1)}m × {room.depth.toFixed(1)}m</span>
              </button>
            ))}
            <svg className="plan-svg" viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.depth}`} preserveAspectRatio="none">
              {layout.walls
                .filter((wall) => wall.source === "room")
                .map((wall) => (
                  <line
                    key={wall.id}
                    x1={wall.start.x}
                    y1={wall.start.y}
                    x2={wall.end.x}
                    y2={wall.end.y}
                    className="wall-line room-wall"
                  />
                ))}
              {layout.walls
                .filter((wall) => wall.source === "custom")
                .map((wall) => (
                  <line
                    key={wall.id}
                    x1={wall.start.x}
                    y1={wall.start.y}
                    x2={wall.end.x}
                    y2={wall.end.y}
                    className={`wall-line custom-wall ${selectedWallId === wall.id ? "active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectWall(wall.id);
                    }}
                  />
                ))}
              {draftLine ? (
                <line
                  x1={draftWall?.start.x}
                  y1={draftWall?.start.y}
                  x2={draftWall?.end.x}
                  y2={draftWall?.end.y}
                  className="wall-line draft-wall"
                />
              ) : null}
            </svg>
          </div>
          <p className="muted">
            小白模式下，画墙会自动吸附成横向或纵向。分析仍然会以房间 + 墙体共同显示，方便你做结构观察。
          </p>
        </div>

        <div className="subpanel">
          <div className="subpanel-header">
            <h3>真实 3D 场景</h3>
            <span className="badge">Three.js</span>
          </div>
          <ThreeSceneCanvas
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            heatmap={heatmap}
            airflow={airflow}
            fengshui={fengshui}
            activePalace={activePalace}
            onSelectRoom={onSelectRoom}
            onSelectWall={onSelectWall}
          />
        </div>
      </div>
    </div>
  );
}
