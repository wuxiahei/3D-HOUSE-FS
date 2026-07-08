import type { HouseLayout, SensorPoint, WallSegment } from "@fengshui/core";
import type { EditorMode } from "../../lib/editor";

interface LayoutEditorProps {
  layout: HouseLayout;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  editorMode: EditorMode;
  onSelectRoom: (roomId: string) => void;
  onSelectWall: (wallId: string | null) => void;
  onSetEditorMode: (mode: EditorMode) => void;
  onDeleteSelectedWall: () => void;
  onUpdateMetadata: (key: keyof HouseLayout["metadata"], value: string | number) => void;
  onUpdateWeather: (key: keyof HouseLayout["weather"], value: number) => void;
  onUpdateOrientation: (key: "facingDegrees" | "frontDoorDegrees", value: number) => void;
  onUpdateRoomDimensions: (roomId: string, key: "width" | "depth", value: number) => void;
  onUpdateRoomOrigin: (roomId: string, axis: "x" | "y", value: number) => void;
  onNudgeRoom: (roomId: string, axis: "x" | "y", delta: number) => void;
  onAddSensorPoint: () => void;
  onUpdateSensorPoint: (sensorId: string, patch: Partial<SensorPoint>) => void;
  onDeleteSensorPoint: (sensorId: string) => void;
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.1
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function wallLength(wall: WallSegment) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function LayoutEditor({
  layout,
  selectedRoomId,
  selectedWallId,
  editorMode,
  onSelectRoom,
  onSelectWall,
  onSetEditorMode,
  onDeleteSelectedWall,
  onUpdateMetadata,
  onUpdateWeather,
  onUpdateOrientation,
  onUpdateRoomDimensions,
  onUpdateRoomOrigin,
  onNudgeRoom,
  onAddSensorPoint,
  onUpdateSensorPoint,
  onDeleteSensorPoint
}: LayoutEditorProps) {
  const selectedRoom = layout.rooms.find((room) => room.id === selectedRoomId) ?? layout.rooms[0];
  const customWalls = layout.walls.filter((wall) => wall.source === "custom");
  const selectedWall = customWalls.find((wall) => wall.id === selectedWallId) ?? null;

  return (
    <section className="inspector-section">
      <div className="section-title">
        <h2>检查器</h2>
        <span>{editorMode === "draw-wall" ? "画墙" : "选择"}</span>
      </div>

      <div className="segmented">
        <button type="button" className={editorMode === "select" ? "active" : ""} onClick={() => onSetEditorMode("select")}>
          选择
        </button>
        <button type="button" className={editorMode === "draw-wall" ? "active" : ""} onClick={() => onSetEditorMode("draw-wall")}>
          画墙
        </button>
      </div>

      <div className="field-grid two-col">
        <label className="field">
          <span>项目</span>
          <input value={layout.metadata.projectName} onChange={(event) => onUpdateMetadata("projectName", event.target.value)} />
        </label>
        <label className="field">
          <span>地址</span>
          <input value={layout.metadata.address} onChange={(event) => onUpdateMetadata("address", event.target.value)} />
        </label>
      </div>

      <div className="field-grid three-col">
        <NumberField label="朝向" value={layout.orientation.facingDegrees} onChange={(value) => onUpdateOrientation("facingDegrees", value)} step={1} />
        <NumberField label="门向" value={layout.orientation.frontDoorDegrees} onChange={(value) => onUpdateOrientation("frontDoorDegrees", value)} step={1} />
        <NumberField label="年份" value={layout.metadata.renovationYear} onChange={(value) => onUpdateMetadata("renovationYear", value)} step={1} />
      </div>

      <div className="field-grid three-col">
        <NumberField label="风向" value={layout.weather.windDirection} onChange={(value) => onUpdateWeather("windDirection", value)} step={1} />
        <NumberField label="风速" value={layout.weather.windSpeed} onChange={(value) => onUpdateWeather("windSpeed", value)} />
        <NumberField label="室外温度" value={layout.weather.outdoorTemperature} onChange={(value) => onUpdateWeather("outdoorTemperature", value)} />
      </div>

      <div className="room-list">
        {layout.rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            className={`room-pill ${selectedRoom?.id === room.id ? "active" : ""}`}
            onClick={() => {
              onSelectWall(null);
              onSelectRoom(room.id);
            }}
          >
            {room.name}
          </button>
        ))}
      </div>

      {selectedRoom ? (
        <div className="property-block">
          <div className="section-title compact">
            <h3>{selectedRoom.name}</h3>
            <span>{selectedRoom.purpose}</span>
          </div>
          <div className="field-grid two-col">
            <NumberField label="宽度" value={selectedRoom.width} onChange={(value) => onUpdateRoomDimensions(selectedRoom.id, "width", value)} />
            <NumberField label="进深" value={selectedRoom.depth} onChange={(value) => onUpdateRoomDimensions(selectedRoom.id, "depth", value)} />
            <NumberField label="X" value={selectedRoom.origin.x} onChange={(value) => onUpdateRoomOrigin(selectedRoom.id, "x", value)} />
            <NumberField label="Y" value={selectedRoom.origin.y} onChange={(value) => onUpdateRoomOrigin(selectedRoom.id, "y", value)} />
          </div>
          <div className="mini-action-row">
            <button type="button" onClick={() => onNudgeRoom(selectedRoom.id, "x", -0.2)}>左</button>
            <button type="button" onClick={() => onNudgeRoom(selectedRoom.id, "x", 0.2)}>右</button>
            <button type="button" onClick={() => onNudgeRoom(selectedRoom.id, "y", -0.2)}>上</button>
            <button type="button" onClick={() => onNudgeRoom(selectedRoom.id, "y", 0.2)}>下</button>
          </div>
        </div>
      ) : null}

      <div className="property-block">
        <div className="section-title compact">
          <h3>温度点</h3>
          <button type="button" onClick={onAddSensorPoint}>新增</button>
        </div>
        <div className="sensor-editor-list">
          {layout.sensors.map((sensor) => (
            <div key={sensor.id} className="sensor-editor-row">
              <label className="field sensor-label-field">
                <span>名称</span>
                <input value={sensor.label} onChange={(event) => onUpdateSensorPoint(sensor.id, { label: event.target.value })} />
              </label>
              <NumberField label="X" value={sensor.x} onChange={(value) => onUpdateSensorPoint(sensor.id, { x: value })} />
              <NumberField label="Y" value={sensor.y} onChange={(value) => onUpdateSensorPoint(sensor.id, { y: value })} />
              <NumberField label="温度" value={sensor.temperature} onChange={(value) => onUpdateSensorPoint(sensor.id, { temperature: value })} />
              <button type="button" className="danger-button" onClick={() => onDeleteSensorPoint(sensor.id)}>删</button>
            </div>
          ))}
        </div>
      </div>

      <div className="property-block">
        <div className="section-title compact">
          <h3>自定义墙</h3>
          <span>{customWalls.length} 段</span>
        </div>
        <div className="wall-list">
          {customWalls.map((wall) => (
            <button
              key={wall.id}
              type="button"
              className={`wall-pill ${selectedWall?.id === wall.id ? "active" : ""}`}
              onClick={() => onSelectWall(wall.id)}
            >
              <strong>{wall.label}</strong>
              <span>{wallLength(wall).toFixed(2)}m</span>
            </button>
          ))}
          {customWalls.length === 0 ? <p className="muted">切换到画墙模式后，在主场景中拖拽即可创建墙体。</p> : null}
        </div>
        <button type="button" className="danger-button full-width" disabled={!selectedWall} onClick={onDeleteSelectedWall}>
          删除选中墙体
        </button>
      </div>
    </section>
  );
}
