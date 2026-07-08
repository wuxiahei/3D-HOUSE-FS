"use client";

import {
  analyzeFengshui,
  createTemplateLayout,
  syncDerivedLayoutData,
  validateLayout
} from "@fengshui/core";
import type { HouseLayout, LayoutPoint, SensorPoint, TemplateId } from "@fengshui/core";
import { generateAirflow, generateHeatmap } from "@fengshui/simulation";
import { useMemo, useState } from "react";
import type { EditorMode } from "../lib/editor";
import { AirflowPanel } from "./Analysis/AirflowPanel";
import { FengshuiPanel } from "./Analysis/FengshuiPanel";
import { HeatmapPanel } from "./Analysis/HeatmapPanel";
import { LayoutEditor } from "./Editor/LayoutEditor";
import { QuickStartWizard } from "./EditorWizard/QuickStartWizard";
import { SceneViewport } from "./Scene/SceneViewport";
import { LayoutPersistencePanel } from "./Templates/LayoutPersistencePanel";
import { TemplatePicker } from "./Templates/TemplatePicker";

interface DraftWall {
  start: LayoutPoint;
  end: LayoutPoint;
}

function cloneLayout(layout: HouseLayout): HouseLayout {
  return JSON.parse(JSON.stringify(layout)) as HouseLayout;
}

export function AppShell() {
  const [layout, setLayout] = useState<HouseLayout>(() => createTemplateLayout("compact-two-room"));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(layout.rooms[0]?.id ?? null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [draftWall, setDraftWall] = useState<DraftWall | null>(null);

  const validation = useMemo(() => validateLayout(layout), [layout]);
  const heatmap = useMemo(() => generateHeatmap(layout), [layout]);
  const airflow = useMemo(() => generateAirflow(layout), [layout]);
  const fengshui = useMemo(() => analyzeFengshui(layout), [layout]);

  const selectedRoom = layout.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedRoomPalace = selectedRoom
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoom.id)?.palace ?? null
    : null;

  function applyTemplate(templateId: TemplateId) {
    const nextLayout = createTemplateLayout(templateId);
    setLayout(nextLayout);
    setSelectedRoomId(nextLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
  }

  function updateMetadata(key: keyof HouseLayout["metadata"], value: string | number) {
    setLayout((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [key]: value
      }
    }));
  }

  function updateWeather(key: keyof HouseLayout["weather"], value: number) {
    setLayout((current) => ({
      ...current,
      weather: {
        ...current.weather,
        [key]: value
      }
    }));
  }

  function addSensorPoint() {
    setLayout((current) => {
      const nextNumber = current.sensors.length + 1;
      const sensor: SensorPoint = {
        id: `sensor-${Date.now()}`,
        label: `温度点 ${nextNumber}`,
        x: Number((current.bounds.width / 2).toFixed(2)),
        y: Number((current.bounds.depth / 2).toFixed(2)),
        temperature: Number((current.weather.outdoorTemperature - 4).toFixed(1))
      };
      return {
        ...current,
        sensors: [...current.sensors, sensor]
      };
    });
  }

  function updateSensorPoint(sensorId: string, patch: Partial<SensorPoint>) {
    setLayout((current) => ({
      ...current,
      sensors: current.sensors.map((sensor) =>
        sensor.id === sensorId
          ? {
              ...sensor,
              ...patch,
              x:
                patch.x === undefined
                  ? sensor.x
                  : Number(Math.min(current.bounds.width, Math.max(0, patch.x)).toFixed(2)),
              y:
                patch.y === undefined
                  ? sensor.y
                  : Number(Math.min(current.bounds.depth, Math.max(0, patch.y)).toFixed(2)),
              temperature:
                patch.temperature === undefined
                  ? sensor.temperature
                  : Number(patch.temperature.toFixed(1))
            }
          : sensor
      )
    }));
  }

  function deleteSensorPoint(sensorId: string) {
    setLayout((current) => ({
      ...current,
      sensors: current.sensors.filter((sensor) => sensor.id !== sensorId)
    }));
  }

  function updateOrientation(key: "facingDegrees" | "frontDoorDegrees", value: number) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        orientation: {
          ...current.orientation,
          [key]: value
        }
      })
    );
  }

  function updateRoomDimensions(roomId: string, key: "width" | "depth", value: number) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                [key]: Math.max(0.4, Number(value.toFixed(2)))
              }
            : room
        )
      })
    );
  }

  function updateRoomOrigin(roomId: string, axis: "x" | "y", value: number) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                origin: {
                  ...room.origin,
                  [axis]: Number(Math.max(0, value).toFixed(2))
                }
              }
            : room
        )
      })
    );
  }

  function nudgeRoom(roomId: string, axis: "x" | "y", delta: number) {
    setLayout((current) => {
      const next = cloneLayout(current);
      next.rooms = next.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              origin: {
                ...room.origin,
                [axis]: Number(Math.max(0, room.origin[axis] + delta).toFixed(2))
              }
            }
          : room
      );
      return syncDerivedLayoutData(next);
    });
  }

  function replaceLayout(nextLayout: HouseLayout) {
    setLayout(nextLayout);
  }

  function restoreLayout(nextLayout: HouseLayout) {
    const syncedLayout = syncDerivedLayoutData(nextLayout);
    setLayout(syncedLayout);
    setSelectedRoomId(syncedLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
  }

  function deleteSelectedWall() {
    if (!selectedWallId) {
      return;
    }
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        walls: current.walls.filter((wall) => wall.id !== selectedWallId)
      })
    );
    setSelectedWallId(null);
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedWallId(null);
  }

  function selectWall(wallId: string | null) {
    setSelectedWallId(wallId);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">3D HOUSE FS</p>
          <h1>小白也能上手的 3D 户型分析工作台</h1>
          <p className="hero-copy">
            这一版已经实现了三条主线：真实 3D 场景、鼠标画墙，以及九宫/飞星/房间联动的风水信息展示。
            你可以先从模板起步，再边画边看热力图、气流图和 3D 罗盘。
          </p>
        </div>
        <div className="hero-chip-row">
          <span className="hero-chip">Three.js 场景</span>
          <span className="hero-chip">鼠标画墙</span>
          <span className="hero-chip">热力图</span>
          <span className="hero-chip">气流图</span>
          <span className="hero-chip">九宫飞星</span>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="panel stack gap-xl">
          <QuickStartWizard layout={layout} validationCount={validation.length} />
          <TemplatePicker currentTemplate={layout.templateId} onSelect={applyTemplate} />
          <LayoutPersistencePanel layout={layout} onRestoreLayout={restoreLayout} />
          <LayoutEditor
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            editorMode={editorMode}
            onSelectRoom={selectRoom}
            onSelectWall={selectWall}
            onSetEditorMode={setEditorMode}
            onDeleteSelectedWall={deleteSelectedWall}
            onUpdateMetadata={updateMetadata}
            onUpdateWeather={updateWeather}
            onUpdateOrientation={updateOrientation}
            onUpdateRoomDimensions={updateRoomDimensions}
            onUpdateRoomOrigin={updateRoomOrigin}
            onNudgeRoom={nudgeRoom}
            onAddSensorPoint={addSensorPoint}
            onUpdateSensorPoint={updateSensorPoint}
            onDeleteSensorPoint={deleteSensorPoint}
          />
        </aside>

        <section className="center-column stack gap-xl">
          <SceneViewport
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            activePalace={selectedRoomPalace}
            editorMode={editorMode}
            draftWall={draftWall}
            onSetEditorMode={setEditorMode}
            onSelectRoom={selectRoom}
            onSelectWall={selectWall}
            onDraftWallChange={setDraftWall}
            onCommitLayout={replaceLayout}
            onDeleteSelectedWall={deleteSelectedWall}
            heatmap={heatmap}
            airflow={airflow}
            fengshui={fengshui}
          />
        </section>

        <aside className="panel stack gap-xl">
          <HeatmapPanel heatmap={heatmap} sensors={layout.sensors} />
          <AirflowPanel airflow={airflow} rooms={layout.rooms} />
          <FengshuiPanel
            layout={layout}
            fengshui={fengshui}
            selectedRoomId={selectedRoom?.id ?? null}
            activePalace={selectedRoomPalace}
            onSelectRoom={selectRoom}
          />
        </aside>
      </section>
    </main>
  );
}
