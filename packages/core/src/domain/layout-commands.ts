import type { ClimateDevice, HouseLayout, LayoutPoint, Opening, Room, SensorPoint, ValidationIssue, WallSegment } from "../types/layout";
import {
  buildWallsFromRooms,
  clampDeviceToRoom,
  clampOpeningToWall,
  clampPointToBounds,
  createCustomWall,
  createDeviceForRoom,
  createOpeningForWall,
  syncDerivedLayoutData,
  wallLength
} from "../geometry/layout-helpers";
import { parseHouseLayoutDocument } from "../schema/layout-migrations";
import { collectEntityIds, nextEntityId } from "./entity-id";

export type LayoutCommandResult =
  | { ok: true; layout: HouseLayout; issues: [] }
  | { ok: false; layout: HouseLayout; issues: ValidationIssue[] };

function validateNext(current: HouseLayout, next: HouseLayout): LayoutCommandResult {
  const parsed = parseHouseLayoutDocument(syncDerivedLayoutData(next));
  if (!parsed.success || !parsed.layout) {
    return { ok: false, layout: current, issues: parsed.issues };
  }
  return { ok: true, layout: parsed.layout, issues: [] };
}

function entityIds(layout: HouseLayout) {
  return collectEntityIds(layout);
}

function roomContains(room: Room, point: LayoutPoint) {
  return (
    point.x >= room.origin.x &&
    point.x <= room.origin.x + room.width &&
    point.y >= room.origin.y &&
    point.y <= room.origin.y + room.depth
  );
}

export function addCustomWall(layout: HouseLayout, start: LayoutPoint, end: LayoutPoint): LayoutCommandResult {
  const wall = createCustomWall(layout, start, end);
  wall.id = nextEntityId("custom-wall", entityIds(layout));
  wall.label = `Custom wall ${wall.id.replace("custom-wall-", "")}`;
  return validateNext(layout, {
    ...layout,
    walls: [...layout.walls, wall]
  });
}

export function removeWall(layout: HouseLayout, wallId: string): LayoutCommandResult {
  const wall = layout.walls.find((item) => item.id === wallId);
  if (!wall) {
    return { ok: false, layout, issues: [{ level: "error", code: "WALL_NOT_FOUND", message: `Wall ${wallId} was not found` }] };
  }
  if (wall.source !== "custom") {
    return { ok: false, layout, issues: [{ level: "error", code: "DERIVED_WALL", message: "Room walls cannot be removed independently" }] };
  }

  return validateNext(layout, {
    ...layout,
    walls: layout.walls.filter((item) => item.id !== wallId),
    openings: layout.openings.filter((item) => item.wallId !== wallId)
  });
}

export function upsertOpening(layout: HouseLayout, opening: Opening): LayoutCommandResult {
  const wall = layout.walls.find((item) => item.id === opening.wallId);
  if (!wall) {
    return { ok: false, layout, issues: [{ level: "error", code: "WALL_NOT_FOUND", message: `Wall ${opening.wallId} was not found` }] };
  }

  const normalized = clampOpeningToWall(opening, wall);
  const exists = layout.openings.some((item) => item.id === normalized.id);
  return validateNext(layout, {
    ...layout,
    openings: exists
      ? layout.openings.map((item) => (item.id === normalized.id ? normalized : item))
      : [...layout.openings, { ...normalized, id: normalized.id || nextEntityId(normalized.type, entityIds(layout)) }]
  });
}

export function addOpening(layout: HouseLayout, wallId: string, type: Opening["type"], offset?: number): LayoutCommandResult {
  const opening = createOpeningForWall(layout, wallId, type);
  if (!opening) {
    return { ok: false, layout, issues: [{ level: "error", code: "WALL_NOT_FOUND", message: `Wall ${wallId} was not found` }] };
  }

  return upsertOpening(layout, {
    ...opening,
    id: nextEntityId(type, entityIds(layout)),
    offset: typeof offset === "number" ? offset : opening.offset
  });
}

export function removeOpening(layout: HouseLayout, openingId: string): LayoutCommandResult {
  return validateNext(layout, {
    ...layout,
    openings: layout.openings.filter((opening) => opening.id !== openingId)
  });
}

export function addDevice(layout: HouseLayout, roomId: string, type: ClimateDevice["type"], point?: LayoutPoint): LayoutCommandResult {
  const base = createDeviceForRoom(layout, roomId, type);
  if (!base) {
    return { ok: false, layout, issues: [{ level: "error", code: "ROOM_NOT_FOUND", message: `Room ${roomId} was not found` }] };
  }

  const device = clampDeviceToRoom(
    {
      ...base,
      id: nextEntityId(type, entityIds(layout)),
      ...(point ? clampPointToBounds(point, layout) : {})
    },
    layout
  );

  return validateNext(layout, {
    ...layout,
    devices: [...layout.devices, device]
  });
}

export function updateDevice(layout: HouseLayout, device: ClimateDevice): LayoutCommandResult {
  return validateNext(layout, {
    ...layout,
    devices: layout.devices.map((item) => (item.id === device.id ? clampDeviceToRoom(device, layout) : item))
  });
}

export function removeDevice(layout: HouseLayout, deviceId: string): LayoutCommandResult {
  return validateNext(layout, {
    ...layout,
    devices: layout.devices.filter((device) => device.id !== deviceId)
  });
}

export function addSensor(layout: HouseLayout, point: LayoutPoint, label = "Sensor"): LayoutCommandResult {
  const sensor: SensorPoint = {
    id: nextEntityId("sensor", entityIds(layout)),
    label,
    ...clampPointToBounds(point, layout),
    temperature: layout.weather.outdoorTemperature
  };

  return validateNext(layout, {
    ...layout,
    sensors: [...layout.sensors, sensor]
  });
}

export function removeSensor(layout: HouseLayout, sensorId: string): LayoutCommandResult {
  return validateNext(layout, {
    ...layout,
    sensors: layout.sensors.filter((sensor) => sensor.id !== sensorId)
  });
}

export function moveRoom(layout: HouseLayout, roomId: string, delta: LayoutPoint): LayoutCommandResult {
  const nextRooms = layout.rooms.map((room) =>
    room.id === roomId
      ? {
          ...room,
          origin: clampPointToBounds({ x: room.origin.x + delta.x, y: room.origin.y + delta.y }, layout)
        }
      : room
  );
  const roomWalls = buildWallsFromRooms(nextRooms, 0.18);
  const customWalls = layout.walls.filter((wall) => wall.source === "custom");
  return validateNext(layout, {
    ...layout,
    rooms: nextRooms,
    walls: [...roomWalls, ...customWalls]
  });
}

export function moveCustomWall(layout: HouseLayout, wallId: string, delta: LayoutPoint): LayoutCommandResult {
  const wall = layout.walls.find((item) => item.id === wallId);
  if (!wall || wall.source !== "custom") {
    return { ok: false, layout, issues: [{ level: "error", code: "CUSTOM_WALL_REQUIRED", message: "Only custom walls can be moved independently" }] };
  }

  const movePoint = (point: LayoutPoint) => clampPointToBounds({ x: point.x + delta.x, y: point.y + delta.y }, layout);
  return validateNext(layout, {
    ...layout,
    walls: layout.walls.map((item) => (item.id === wallId ? { ...item, start: movePoint(item.start), end: movePoint(item.end) } : item))
  });
}

export function findRoomAtPoint(layout: HouseLayout, point: LayoutPoint): Room | null {
  return layout.rooms.find((room) => roomContains(room, point)) ?? null;
}

export function findWallAtPoint(layout: HouseLayout, point: LayoutPoint, tolerance = 0.18): WallSegment | null {
  let best: { wall: WallSegment; distance: number } | null = null;
  for (const wall of layout.walls) {
    const length = wallLength(wall);
    if (length === 0) {
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - wall.start.x) * (wall.end.x - wall.start.x) + (point.y - wall.start.y) * (wall.end.y - wall.start.y)) / (length * length))
    );
    const closest = {
      x: wall.start.x + (wall.end.x - wall.start.x) * t,
      y: wall.start.y + (wall.end.y - wall.start.y) * t
    };
    const distance = Math.hypot(point.x - closest.x, point.y - closest.y);
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { wall, distance };
    }
  }
  return best?.wall ?? null;
}
