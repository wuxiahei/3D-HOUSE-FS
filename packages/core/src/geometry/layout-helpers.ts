import type {
  ClimateDevice,
  CompassDirection,
  HouseLayout,
  LayoutPoint,
  Opening,
  Room,
  WallSegment
} from "../types/layout";

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function degreesToDirection(value: number): CompassDirection {
  const angle = normalizeDegrees(value);
  const labels: CompassDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(angle / 45) % 8;
  return labels[index];
}

export function clampPointToBounds(point: LayoutPoint, layout: HouseLayout): LayoutPoint {
  return {
    x: Number(Math.min(layout.bounds.width, Math.max(0, point.x)).toFixed(2)),
    y: Number(Math.min(layout.bounds.depth, Math.max(0, point.y)).toFixed(2))
  };
}

export function snapOrthogonal(start: LayoutPoint, current: LayoutPoint): LayoutPoint {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  if (dx >= dy) {
    return { x: current.x, y: start.y };
  }
  return { x: start.x, y: current.y };
}

export function roomCenter(room: Room): LayoutPoint {
  return {
    x: room.origin.x + room.width / 2,
    y: room.origin.y + room.depth / 2
  };
}

export function wallLength(wall: WallSegment): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function wallCenter(wall: WallSegment): LayoutPoint {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2
  };
}

export function wallRotationRadians(wall: WallSegment): number {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
}

export function getLayoutPolygon(layout: HouseLayout): LayoutPoint[] {
  return [
    { x: 0, y: 0 },
    { x: layout.bounds.width, y: 0 },
    { x: layout.bounds.width, y: layout.bounds.depth },
    { x: 0, y: layout.bounds.depth }
  ];
}

export function roomToWalls(room: Room, thickness = 0.2): WallSegment[] {
  const x = room.origin.x;
  const y = room.origin.y;
  return [
    {
      id: `${room.id}-north`,
      label: `${room.name} 北墙`,
      start: { x, y },
      end: { x: x + room.width, y },
      thickness,
      exterior: false,
      source: "room",
      roomId: room.id
    },
    {
      id: `${room.id}-east`,
      label: `${room.name} 东墙`,
      start: { x: x + room.width, y },
      end: { x: x + room.width, y: y + room.depth },
      thickness,
      exterior: false,
      source: "room",
      roomId: room.id
    },
    {
      id: `${room.id}-south`,
      label: `${room.name} 南墙`,
      start: { x: x + room.width, y: y + room.depth },
      end: { x, y: y + room.depth },
      thickness,
      exterior: false,
      source: "room",
      roomId: room.id
    },
    {
      id: `${room.id}-west`,
      label: `${room.name} 西墙`,
      start: { x, y: y + room.depth },
      end: { x, y },
      thickness,
      exterior: false,
      source: "room",
      roomId: room.id
    }
  ];
}

export function buildWallsFromRooms(rooms: Room[], thickness = 0.2): WallSegment[] {
  return rooms.flatMap((room) => roomToWalls(room, thickness));
}

export function createCustomWall(
  layout: HouseLayout,
  start: LayoutPoint,
  end: LayoutPoint,
  thickness = 0.18
): WallSegment {
  const wallNumber = layout.walls.filter((wall) => wall.source === "custom").length + 1;
  return {
    id: `custom-wall-${wallNumber}`,
    label: `自定义墙 ${wallNumber}`,
    start: clampPointToBounds(start, layout),
    end: clampPointToBounds(end, layout),
    thickness,
    exterior: false,
    source: "custom"
  };
}

function nextOpeningId(layout: HouseLayout, type: Opening["type"]): string {
  const base = type === "door" ? "door" : "window";
  let index = layout.openings.filter((opening) => opening.type === type).length + 1;
  let id = `${base}-${index}`;

  while (layout.openings.some((opening) => opening.id === id)) {
    index += 1;
    id = `${base}-${index}`;
  }

  return id;
}

export function clampOpeningToWall(opening: Opening, wall: WallSegment): Opening {
  const length = wallLength(wall);
  const width = Number(Math.min(Math.max(opening.width, 0.25), Math.max(0.25, length - 0.12)).toFixed(2));
  const maxOffset = Math.max(0, length - width);
  const offset = Number(Math.min(Math.max(opening.offset, 0), maxOffset).toFixed(2));

  return {
    ...opening,
    width,
    height: Number(Math.max(opening.height, 0.3).toFixed(2)),
    offset,
    sillHeight:
      opening.type === "window"
        ? Number(Math.max(opening.sillHeight ?? 0.9, 0).toFixed(2))
        : opening.sillHeight
  };
}

export function createOpeningForWall(
  layout: HouseLayout,
  wallId: string,
  type: Opening["type"]
): Opening | null {
  const wall = layout.walls.find((item) => item.id === wallId);

  if (!wall) {
    return null;
  }

  const length = wallLength(wall);
  const width =
    type === "door"
      ? Math.min(0.9, Math.max(0.65, length * 0.28))
      : Math.min(1.5, Math.max(0.8, length * 0.42));
  const label = type === "door" ? "门" : "窗";

  return clampOpeningToWall(
    {
      id: nextOpeningId(layout, type),
      type,
      wallId,
      width,
      height: type === "door" ? 2.1 : 1.4,
      offset: Math.max(0, (length - width) / 2),
      sillHeight: type === "window" ? 0.9 : undefined,
      notes: `${wall.label} ${label}`
    },
    wall
  );
}

export function clampDeviceToRoom(device: ClimateDevice, layout: HouseLayout): ClimateDevice {
  const room = layout.rooms.find((item) => item.id === device.roomId) ?? layout.rooms[0];
  if (!room) {
    return device;
  }

  return {
    ...device,
    x: Number(Math.min(room.origin.x + room.width, Math.max(room.origin.x, device.x)).toFixed(2)),
    y: Number(Math.min(room.origin.y + room.depth, Math.max(room.origin.y, device.y)).toFixed(2)),
    strength: Number(Math.min(1, Math.max(0.05, device.strength)).toFixed(2)),
    temperatureDelta: Number(device.temperatureDelta.toFixed(1)),
    directionDegrees: normalizeDegrees(device.directionDegrees)
  };
}

export function createDeviceForRoom(
  layout: HouseLayout,
  roomId: string,
  type: ClimateDevice["type"]
): ClimateDevice | null {
  const room = layout.rooms.find((item) => item.id === roomId);
  if (!room) {
    return null;
  }

  const count = (layout.devices ?? []).filter((device) => device.type === type).length + 1;
  const isAc = type === "ac";

  return clampDeviceToRoom(
    {
      id: `${type}-${Date.now()}-${count}`,
      type,
      roomId,
      label: isAc ? `空调 ${count}` : `厨房热源 ${count}`,
      x: Number((room.origin.x + room.width * (isAc ? 0.82 : 0.5)).toFixed(2)),
      y: Number((room.origin.y + room.depth * (isAc ? 0.18 : 0.55)).toFixed(2)),
      directionDegrees: isAc ? 180 : 0,
      strength: isAc ? 0.72 : 0.8,
      temperatureDelta: isAc ? -4.5 : 5.5
    },
    layout
  );
}

export function syncDerivedLayoutData(layout: HouseLayout): HouseLayout {
  const roomWalls = buildWallsFromRooms(layout.rooms, 0.18);
  const customWalls = layout.walls.filter((wall) => wall.source === "custom");
  const walls = [...roomWalls, ...customWalls];
  const wallMap = new Map(walls.map((wall) => [wall.id, wall]));

  return {
    ...layout,
    orientation: {
      ...layout.orientation,
      facingLabel: degreesToDirection(layout.orientation.facingDegrees),
      frontDoorLabel: degreesToDirection(layout.orientation.frontDoorDegrees)
    },
    walls,
    openings: layout.openings.map((opening) => {
      const wall = wallMap.get(opening.wallId);
      return wall ? clampOpeningToWall(opening, wall) : opening;
    }),
    devices: (layout.devices ?? []).map((device) => clampDeviceToRoom(device, layout))
  };
}
