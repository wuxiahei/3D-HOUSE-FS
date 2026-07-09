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
import { useMemo, useState } from "react";
import type { EditorMode } from "../lib/editor";
import { AirflowPanel } from "./Analysis/AirflowPanel";
import { FengshuiPanel } from "./Analysis/FengshuiPanel";
import { HeatmapPanel } from "./Analysis/HeatmapPanel";
import { LayoutEditor } from "./Editor/LayoutEditor";
import { SceneViewport } from "./Scene/SceneViewport";
import { LayoutPersistencePanel } from "./Templates/LayoutPersistencePanel";
import { TemplatePicker } from "./Templates/TemplatePicker";
import { useSimulation } from "../simulation/useSimulation";

export interface SceneLayers {
  heat: boolean;
  airflow: boolean;
  fengshui: boolean;
  walls: boolean;
}

export type AnalysisLayer = "heat" | "airflow" | "fengshui";

export interface AnalysisControls {
  showHeatContours: boolean;
  animateAirflow: boolean;
  airflowParticleDensity: number;
  airflowParticleSpeed: number;
  showRoof: boolean;
  structureOpacity: number;
}

type InspectorTab = "properties" | "files" | "templates";

interface DraftWall {
  start: LayoutPoint;
  end: LayoutPoint;
}

function cloneLayout(layout: HouseLayout): HouseLayout {
  return JSON.parse(JSON.stringify(layout)) as HouseLayout;
}

function ToolIcon({ name }: { name: "select" | "wall" | "door" | "window" | "ac" | "sensor" | "heat" | "air" | "compass" | "walls" }) {
  if (name === "select") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3l11 9-5 1.3 3.2 6.1-2.3 1.2-3.2-6-3.7 3.4V3z" />
      </svg>
    );
  }
  if (name === "wall") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h16v3H4zM5 4h5v5H5zm9 0h5v5h-5zM5 11h14v3H5z" />
      </svg>
    );
  }
  if (name === "door") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 21V4h10v17h-2V6H8v15zm5-9h2v2h-2z" />
      </svg>
    );
  }
  if (name === "window") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zm2 2v4h5V7zm7 0v4h5V7zm-7 6v4h5v-4zm7 0v4h5v-4z" />
      </svg>
    );
  }
  if (name === "ac") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v7H4zm2 2v3h12V7zm2 9c1.8-1.4 4.2-1.4 6 0 1 .8 2.3.8 3.3 0l1.2 1.6c-1.7 1.3-4 1.3-5.7 0-1.1-.9-2.6-.9-3.7 0-1.7 1.3-4 1.3-5.7 0L4.6 16c1 .8 2.3.8 3.4 0z" />
      </svg>
    );
  }
  if (name === "sensor") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 4h2v8.1a4 4 0 11-2 0zm1 10a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    );
  }
  if (name === "heat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c3 3.1 5 5.7 5 9.3A5 5 0 017 12.4C7 9.9 8.4 8 10.1 6c.4 1.5 1.2 2.7 2.3 3.6.4-2.1.2-4.1-.4-6.6z" />
      </svg>
    );
  }
  if (name === "air") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h10a2 2 0 10-1.7-3l-1.7-.9A4 4 0 1114 10H4zm0 5h13a2 2 0 11-1.7 3l-1.7.9A4 4 0 1017 11H4zm0 4h7v2H4z" />
      </svg>
    );
  }
  if (name === "compass") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm3.8 5.2l-2.2 5.4-5.4 2.2 2.2-5.4zM12 11a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v3H4zm0 6h16v3H4zm0 6h16v3H4z" />
    </svg>
  );
}

export function AppShell() {
  const [layout, setLayout] = useState<HouseLayout>(() => createTemplateLayout("compact-two-room"));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(layout.rooms[0]?.id ?? null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [draftWall, setDraftWall] = useState<DraftWall | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisLayer>("heat");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [analysisControls, setAnalysisControls] = useState<AnalysisControls>({
    showHeatContours: true,
    animateAirflow: true,
    airflowParticleDensity: 0.68,
    airflowParticleSpeed: 1.25,
    showRoof: true,
    structureOpacity: 0.42
  });
  const [layers, setLayers] = useState<SceneLayers>({
    heat: true,
    airflow: true,
    fengshui: true,
    walls: true
  });

  const validation = useMemo(() => validateLayout(layout), [layout]);
  const { simulation, pending: simulationPending } = useSimulation(layout);
  const heatmap = simulation.heatmap;
  const airflow = simulation.airflow;
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
    setLayout((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }

  function updateWeather(key: keyof HouseLayout["weather"], value: number) {
    setLayout((current) => ({ ...current, weather: { ...current.weather, [key]: value } }));
  }

  function updateOrientation(key: "facingDegrees" | "frontDoorDegrees", value: number) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        orientation: { ...current.orientation, [key]: value }
      })
    );
  }

  function updateRoomDimensions(roomId: string, key: "width" | "depth", value: number) {
    setLayout((current) =>
      syncDerivedLayoutData({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId ? { ...room, [key]: Math.max(0.4, Number(value.toFixed(2))) } : room
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
            ? { ...room, origin: { ...room.origin, [axis]: Number(Math.max(0, value).toFixed(2)) } }
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
          ? { ...room, origin: { ...room.origin, [axis]: Number(Math.max(0, room.origin[axis] + delta).toFixed(2)) } }
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
      return { ...current, sensors: [...current.sensors, sensor] };
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
              x: patch.x === undefined ? sensor.x : Number(Math.min(current.bounds.width, Math.max(0, patch.x)).toFixed(2)),
              y: patch.y === undefined ? sensor.y : Number(Math.min(current.bounds.depth, Math.max(0, patch.y)).toFixed(2)),
              temperature: patch.temperature === undefined ? sensor.temperature : Number(patch.temperature.toFixed(1))
            }
          : sensor
      )
    }));
  }

  function deleteSensorPoint(sensorId: string) {
    setLayout((current) => ({ ...current, sensors: current.sensors.filter((sensor) => sensor.id !== sensorId) }));
  }

  function addOpening(wallId: string, type: Opening["type"]) {
    setLayout((current) => {
      const opening = createOpeningForWall(current, wallId, type);
      if (!opening) {
        return current;
      }
      return syncDerivedLayoutData({ ...current, openings: [...current.openings, opening] });
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
    setLayout((current) => syncDerivedLayoutData({ ...current, openings: current.openings.filter((opening) => opening.id !== openingId) }));
  }

  function addDevice(roomId: string, type: ClimateDevice["type"]) {
    setLayout((current) => {
      const device = createDeviceForRoom(current, roomId, type);
      if (!device) {
        return current;
      }
      return syncDerivedLayoutData({ ...current, devices: [...(current.devices ?? []), device] });
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
    setLayout((current) => syncDerivedLayoutData({ ...current, devices: (current.devices ?? []).filter((device) => device.id !== deviceId) }));
  }

  function replaceLayout(nextLayout: HouseLayout) {
    setLayout(nextLayout);
  }

  function deleteSelectedWall() {
    if (!selectedWallId) {
      return;
    }
    setLayout((current) => syncDerivedLayoutData({ ...current, walls: current.walls.filter((wall) => wall.id !== selectedWallId) }));
    setSelectedWallId(null);
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedWallId(null);
  }

  function toggleLayer(key: keyof SceneLayers) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
    if (key === "heat" || key === "airflow" || key === "fengshui") {
      setActiveAnalysis(key);
    }
  }

  function updateAnalysisControl<K extends keyof AnalysisControls>(key: K, value: AnalysisControls[K]) {
    setAnalysisControls((current) => ({ ...current, [key]: value }));
  }

  const selectedRoomWalls = selectedRoom ? layout.walls.filter((wall) => wall.roomId === selectedRoom.id) : [];
  const quickOpeningWallId = selectedWallId ?? selectedRoomWalls[0]?.id ?? layout.walls[0]?.id ?? null;

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="brand-block">
          <strong>3D HOUSE FS</strong>
          <span>{layout.metadata.projectName}</span>
        </div>
        <div className="layer-strip analysis-switch" aria-label="analysis layers">
          {[
            ["heat", "热力", "heat"],
            ["airflow", "气流", "air"],
            ["fengshui", "罗盘", "compass"]
          ].map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className={`${layers[key as AnalysisLayer] ? "active" : ""} ${activeAnalysis === key ? "current" : ""}`}
              onClick={() => toggleLayer(key as AnalysisLayer)}
            >
              <ToolIcon name={icon as "heat" | "air" | "compass"} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`aux-layer-toggle ${layers.walls ? "active" : ""}`} onClick={() => toggleLayer("walls")}>
          <ToolIcon name="walls" />
          <span>结构</span>
        </button>
        <div className="status-pill">{simulationPending ? "场计算中" : validation.length === 0 ? "模型有效" : `${validation.length} 个问题`}</div>
      </header>

      <div className="studio-body">
        <nav className="tool-rail" aria-label="main tools">
          <button type="button" className={editorMode === "select" ? "active" : ""} title="选择" onClick={() => setEditorMode("select")}>
            <ToolIcon name="select" />
          </button>
          <button type="button" className={editorMode === "draw-wall" ? "active" : ""} title="画墙" onClick={() => setEditorMode("draw-wall")}>
            <ToolIcon name="wall" />
          </button>
          <button type="button" disabled={!quickOpeningWallId} title="加门" onClick={() => quickOpeningWallId && addOpening(quickOpeningWallId, "door")}>
            <ToolIcon name="door" />
          </button>
          <button type="button" disabled={!quickOpeningWallId} title="加窗" onClick={() => quickOpeningWallId && addOpening(quickOpeningWallId, "window")}>
            <ToolIcon name="window" />
          </button>
          <button type="button" disabled={!selectedRoom} title="加空调" onClick={() => selectedRoom && addDevice(selectedRoom.id, "ac")}>
            <ToolIcon name="ac" />
          </button>
          <button type="button" title="加温度点" onClick={addSensorPoint}>
            <ToolIcon name="sensor" />
          </button>
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
            heatField={simulation.heatField}
            flowField={simulation.flowField}
            controls={analysisControls}
            fengshui={fengshui}
          />
        </section>

        <aside className="inspector">
          <div className="inspector-tabs">
            {[
              ["properties", "属性"],
              ["files", "文件"],
              ["templates", "模板"]
            ].map(([tab, label]) => (
              <button key={tab} type="button" className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab as InspectorTab)}>
                {label}
              </button>
            ))}
          </div>
          {inspectorTab === "properties" ? (
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
          ) : null}
          {inspectorTab === "files" ? <LayoutPersistencePanel layout={layout} onRestoreLayout={restoreLayout} /> : null}
          {inspectorTab === "templates" ? <TemplatePicker currentTemplate={layout.templateId} onSelect={applyTemplate} /> : null}
        </aside>
      </div>

      <footer className={`analysis-dock active-${activeAnalysis}`}>
        <div className="dock-main">
          {activeAnalysis === "heat" ? <HeatmapPanel heatmap={heatmap} sensors={layout.sensors} field={simulation.heatField} /> : null}
          {activeAnalysis === "airflow" ? <AirflowPanel airflow={airflow} rooms={layout.rooms} field={simulation.flowField} /> : null}
          {activeAnalysis === "fengshui" ? (
            <FengshuiPanel
              layout={layout}
              fengshui={fengshui}
              selectedRoomId={selectedRoom?.id ?? null}
              activePalace={activePalace}
              onSelectRoom={selectRoom}
            />
          ) : null}
        </div>
        <div className="analysis-controls">
          {activeAnalysis === "heat" ? (
            <>
              <label className="toggle-field">
                <input type="checkbox" checked={analysisControls.showHeatContours} onChange={(event) => updateAnalysisControl("showHeatContours", event.target.checked)} />
                <span>等温线</span>
              </label>
              <div className="legend-bar heat-legend" aria-hidden="true" />
              <div className="legend-readout">
                <span>{simulation.heatField.min.toFixed(1)} C</span>
                <span>{((simulation.heatField.min + simulation.heatField.max) / 2).toFixed(1)} C</span>
                <span>{simulation.heatField.max.toFixed(1)} C</span>
              </div>
            </>
          ) : null}
          {activeAnalysis === "airflow" ? (
            <>
              <label className="toggle-field">
                <input type="checkbox" checked={analysisControls.animateAirflow} onChange={(event) => updateAnalysisControl("animateAirflow", event.target.checked)} />
                <span>动画</span>
              </label>
              <label className="range-field">
                <span>粒子密度</span>
                <input type="range" min={0.15} max={1} step={0.05} value={analysisControls.airflowParticleDensity} onChange={(event) => updateAnalysisControl("airflowParticleDensity", Number(event.target.value))} />
              </label>
              <label className="range-field">
                <span>流速显示</span>
                <input type="range" min={0.4} max={2.2} step={0.1} value={analysisControls.airflowParticleSpeed} onChange={(event) => updateAnalysisControl("airflowParticleSpeed", Number(event.target.value))} />
              </label>
              <div className="legend-bar flow-legend" aria-hidden="true" />
              <span className="legend-note">{simulation.flowField.streamlines.length} 条路径 / {simulation.flowField.seedPoints.length} 个种子</span>
            </>
          ) : null}
          {activeAnalysis === "fengshui" ? <div className="legend-note">罗盘、九宫和房间解读共用同一层。</div> : null}
          <label className="toggle-field">
            <input type="checkbox" checked={analysisControls.showRoof} onChange={(event) => updateAnalysisControl("showRoof", event.target.checked)} />
            <span>屋顶</span>
          </label>
          <label className="range-field">
            <span>结构透明度</span>
            <input type="range" min={0.18} max={0.92} step={0.02} value={analysisControls.structureOpacity} onChange={(event) => updateAnalysisControl("structureOpacity", Number(event.target.value))} />
          </label>
        </div>
      </footer>
    </main>
  );
}
