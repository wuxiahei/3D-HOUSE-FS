"use client";

import {
  analyzeFengshui,
  clampDeviceToRoom,
  clampOpeningToWall,
  createDeviceForRoom,
  createOpeningForWall,
  createTemplateLayout,
  syncDerivedLayoutData,
  validateLayout
} from "@fengshui/core";
import type { ClimateDevice, HouseLayout, LayoutPoint, Opening, SensorPoint, TemplateId } from "@fengshui/core";
import { generateAirflow, generateHeatmap } from "@fengshui/simulation";
import { useMemo, useState } from "react";
import type { EditorMode } from "../lib/editor";
import { AirflowPanel } from "./Analysis/AirflowPanel";
import { FengshuiPanel } from "./Analysis/FengshuiPanel";
import { HeatmapPanel } from "./Analysis/HeatmapPanel";
import { LayoutEditor } from "./Editor/LayoutEditor";
import { SceneViewport } from "./Scene/SceneViewport";
import { LayoutPersistencePanel } from "./Templates/LayoutPersistencePanel";
import { TemplatePicker } from "./Templates/TemplatePicker";

export interface SceneLayers {
  heat: boolean;
  airflow: boolean;
  fengshui: boolean;
  walls: boolean;
}

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
  const [layers, setLayers] = useState<SceneLayers>({
    heat: true,
    airflow: true,
    fengshui: true,
    walls: true
  });

  const validation = useMemo(() => validateLayout(layout), [layout]);
  const heatmap = useMemo(() => generateHeatmap(layout), [layout]);
  const airflow = useMemo(() => generateAirflow(layout), [layout]);
  const fengshui = useMemo(() => analyzeFengshui(layout), [layout]);

  const selectedRoom = layout.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const activePalace = selectedRoom
    ? fengshui.roomPalaceMap.find((item) => item.roomId === selectedRoom.id)?.palace ?? null
    : null;

  function applyTemplate(templateId: TemplateId) {
    const nextLayout = createTemplateLayout(templateId);
    setLayout(nextLayout);
    setSelectedRoomId(nextLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
  }

  function restoreLayout(nextLayout: HouseLayout) {
    const syncedLayout = syncDerivedLayoutData(nextLayout);
    setLayout(syncedLayout);
    setSelectedRoomId(syncedLayout.rooms[0]?.id ?? null);
    setSelectedWallId(null);
    setDraftWall(null);
    setEditorMode("select");
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

  function addOpening(wallId: string, type: Opening["type"]) {
    setLayout((current) => {
      const opening = createOpeningForWall(current, wallId, type);
      if (!opening) {
        return current;
      }
      return syncDerivedLayoutData({
        ...current,
        openings: [...current.openings, opening]
      });
    });
  }

  function updateOpening(openingId: string, patch: Partial<Opening>) {
    setLayout((current) => {
      const wallMap = new Map(current.walls.map((wall) => [wall.id, wall]));
      return syncDerivedLayoutData({
        ...current,
        openings: current.openings.map((opening) => {
          if (opening.id !== openingId) {
            return opening;
          }
          const next = { ...opening, ...patch };
          const wall = wallMap.get(next.wallId);
          return wall ? clampOpeningToWall(next, wall) : next;
        })
      });
    });
  }

  function deleteOpening(openingId: string) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        openings: current.openings.filter((opening) => opening.id !== openingId)
      })
    );
  }

  function addDevice(roomId: string, type: ClimateDevice["type"]) {
    setLayout((current) => {
      const device = createDeviceForRoom(current, roomId, type);
      if (!device) {
        return current;
      }
      return syncDerivedLayoutData({
        ...current,
        devices: [...(current.devices ?? []), device]
      });
    });
  }

  function updateDevice(deviceId: string, patch: Partial<ClimateDevice>) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        devices: (current.devices ?? []).map((device) =>
          device.id === deviceId ? clampDeviceToRoom({ ...device, ...patch }, current) : device
        )
      })
    );
  }

  function deleteDevice(deviceId: string) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        devices: (current.devices ?? []).filter((device) => device.id !== deviceId)
      })
    );
  }

  function replaceLayout(nextLayout: HouseLayout) {
    setLayout(nextLayout);
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

  function toggleLayer(key: keyof SceneLayers) {
    setLayers((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="brand-block">
          <strong>3D HOUSE FS</strong>
          <span>{layout.metadata.projectName}</span>
        </div>
        <div className="mode-strip" aria-label="编辑模式">
          <button
            type="button"
            className={editorMode === "select" ? "active" : ""}
            onClick={() => setEditorMode("select")}
          >
            选择
          </button>
          <button
            type="button"
            className={editorMode === "draw-wall" ? "active" : ""}
            onClick={() => setEditorMode("draw-wall")}
          >
            画墙
          </button>
        </div>
        <div className="layer-strip" aria-label="三维图层">
          {[
            ["heat", "热力图"],
            ["airflow", "气流图"],
            ["fengshui", "罗盘风水"],
            ["walls", "墙体"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={layers[key as keyof SceneLayers] ? "active" : ""}
              onClick={() => toggleLayer(key as keyof SceneLayers)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="status-pill">{validation.length === 0 ? "模型有效" : `${validation.length} 条提醒`}</div>
      </header>

      <div className="studio-body">
        <nav className="tool-rail" aria-label="主工具">
          <button type="button" className={editorMode === "select" ? "active" : ""} title="选择" onClick={() => setEditorMode("select")}>↖</button>
          <button type="button" className={editorMode === "draw-wall" ? "active" : ""} title="画墙" onClick={() => setEditorMode("draw-wall")}>╱</button>
          <button type="button" className={layers.heat ? "active" : ""} title="热力图" onClick={() => toggleLayer("heat")}>H</button>
          <button type="button" className={layers.airflow ? "active" : ""} title="气流图" onClick={() => toggleLayer("airflow")}>F</button>
          <button type="button" className={layers.fengshui ? "active" : ""} title="罗盘风水" onClick={() => toggleLayer("fengshui")}>◎</button>
        </nav>

        <section className="main-stage">
          <SceneViewport
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            activePalace={activePalace}
            editorMode={editorMode}
            draftWall={draftWall}
            layers={layers}
            onSetEditorMode={setEditorMode}
            onSelectRoom={selectRoom}
            onSelectWall={setSelectedWallId}
            onDraftWallChange={setDraftWall}
            onCommitLayout={replaceLayout}
            onDeleteSelectedWall={deleteSelectedWall}
            heatmap={heatmap}
            airflow={airflow}
            fengshui={fengshui}
          />
        </section>

        <aside className="inspector">
          <div className="inspector-tabs">
            <span>属性</span>
            <span>文件</span>
            <span>模板</span>
          </div>
          <LayoutEditor
            layout={layout}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            editorMode={editorMode}
            onSelectRoom={selectRoom}
            onSelectWall={setSelectedWallId}
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
            onAddOpening={addOpening}
            onUpdateOpening={updateOpening}
            onDeleteOpening={deleteOpening}
            onAddDevice={addDevice}
            onUpdateDevice={updateDevice}
            onDeleteDevice={deleteDevice}
          />
          <LayoutPersistencePanel layout={layout} onRestoreLayout={restoreLayout} />
          <TemplatePicker currentTemplate={layout.templateId} onSelect={applyTemplate} />
        </aside>
      </div>

      <footer className="analysis-dock">
        <HeatmapPanel heatmap={heatmap} sensors={layout.sensors} />
        <AirflowPanel airflow={airflow} rooms={layout.rooms} />
        <FengshuiPanel
          layout={layout}
          fengshui={fengshui}
          selectedRoomId={selectedRoom?.id ?? null}
          activePalace={activePalace}
          onSelectRoom={selectRoom}
        />
      </footer>
    </main>
  );
}
