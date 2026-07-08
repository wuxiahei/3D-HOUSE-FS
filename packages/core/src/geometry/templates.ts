import type { ClimateDevice, HouseLayout, Opening, Room, TemplateId } from "../types/layout";
import { buildWallsFromRooms, degreesToDirection } from "./layout-helpers";

function createOpenings(rooms: Room[]): Opening[] {
  const openings: Opening[] = [];

  rooms.forEach((room) => {
    const windowWall = room.depth >= room.width ? `${room.id}-east` : `${room.id}-south`;
    openings.push({
      id: `${room.id}-window-main`,
      type: "window",
      wallId: windowWall,
      width: Math.min(1.8, Math.max(0.9, room.width * 0.36)),
      height: 1.35,
      offset: Math.max(0.35, room.width * 0.22),
      sillHeight: 0.9,
      notes: `${room.name} 主采光窗`
    });
  });

  const entry = rooms.find((room) => room.purpose === "entry");
  if (entry) {
    openings.push({
      id: "entry-door",
      type: "door",
      wallId: `${entry.id}-south`,
      width: 1,
      height: 2.1,
      offset: Math.max(0.2, entry.width * 0.25),
      notes: "入户门"
    });
  }

  return openings;
}

function createRooms(templateId: TemplateId): Room[] {
  if (templateId === "family-three-room") {
    return [
      { id: "living", name: "客厅", purpose: "living", origin: { x: 0.4, y: 0.4 }, width: 5.0, depth: 3.9, level: 1 },
      { id: "master", name: "主卧", purpose: "bedroom", origin: { x: 5.4, y: 0.4 }, width: 3.8, depth: 3.2, level: 1 },
      { id: "bedroom-2", name: "次卧", purpose: "bedroom", origin: { x: 5.4, y: 3.6 }, width: 3.8, depth: 3.0, level: 1 },
      { id: "kitchen", name: "厨房", purpose: "kitchen", origin: { x: 0.4, y: 4.3 }, width: 2.5, depth: 2.3, level: 1 },
      { id: "study", name: "书房", purpose: "study", origin: { x: 2.9, y: 4.3 }, width: 2.5, depth: 2.3, level: 1 },
      { id: "entry", name: "玄关", purpose: "entry", origin: { x: 2.9, y: 6.6 }, width: 2.5, depth: 1.2, level: 1 }
    ];
  }

  if (templateId === "compact-two-room") {
    return [
      { id: "living", name: "客餐厅", purpose: "living", origin: { x: 0.4, y: 0.4 }, width: 4.9, depth: 3.6, level: 1 },
      { id: "bedroom", name: "卧室", purpose: "bedroom", origin: { x: 5.3, y: 0.4 }, width: 3.1, depth: 3.6, level: 1 },
      { id: "kitchen", name: "厨房", purpose: "kitchen", origin: { x: 0.4, y: 4.0 }, width: 2.35, depth: 2.0, level: 1 },
      { id: "bathroom", name: "卫浴", purpose: "bathroom", origin: { x: 2.75, y: 4.0 }, width: 2.0, depth: 2.0, level: 1 },
      { id: "entry", name: "玄关", purpose: "entry", origin: { x: 4.75, y: 4.0 }, width: 1.9, depth: 1.45, level: 1 }
    ];
  }

  return [
    { id: "living", name: "主空间", purpose: "living", origin: { x: 0.4, y: 0.4 }, width: 5.6, depth: 4.2, level: 1 },
    { id: "entry", name: "玄关", purpose: "entry", origin: { x: 6.0, y: 0.4 }, width: 1.8, depth: 1.4, level: 1 }
  ];
}

function createDevices(rooms: Room[]): ClimateDevice[] {
  const devices: ClimateDevice[] = [];
  const living = rooms.find((room) => room.purpose === "living");
  const bedroom = rooms.find((room) => room.purpose === "bedroom");
  const kitchen = rooms.find((room) => room.purpose === "kitchen");

  if (living) {
    devices.push({
      id: "ac-living",
      type: "ac",
      roomId: living.id,
      label: "客厅空调",
      x: Number((living.origin.x + living.width * 0.82).toFixed(2)),
      y: Number((living.origin.y + living.depth * 0.18).toFixed(2)),
      directionDegrees: 180,
      strength: 0.75,
      temperatureDelta: -4.5
    });
  }

  if (bedroom) {
    devices.push({
      id: "ac-bedroom",
      type: "ac",
      roomId: bedroom.id,
      label: "卧室空调",
      x: Number((bedroom.origin.x + bedroom.width * 0.2).toFixed(2)),
      y: Number((bedroom.origin.y + bedroom.depth * 0.18).toFixed(2)),
      directionDegrees: 135,
      strength: 0.62,
      temperatureDelta: -3.8
    });
  }

  if (kitchen) {
    devices.push({
      id: "heat-kitchen",
      type: "kitchen-heat",
      roomId: kitchen.id,
      label: "灶台热源",
      x: Number((kitchen.origin.x + kitchen.width * 0.5).toFixed(2)),
      y: Number((kitchen.origin.y + kitchen.depth * 0.55).toFixed(2)),
      directionDegrees: 0,
      strength: 0.86,
      temperatureDelta: 5.5
    });
  }

  return devices;
}

export function createTemplateLayout(templateId: TemplateId): HouseLayout {
  const rooms = createRooms(templateId);
  const bounds =
    templateId === "family-three-room"
      ? { width: 9.8, depth: 8.2, height: 3 }
      : templateId === "compact-two-room"
        ? { width: 8.8, depth: 6.4, height: 2.9 }
        : { width: 8.2, depth: 5.4, height: 2.9 };

  const facingDegrees = templateId === "family-three-room" ? 160 : 135;
  const frontDoorDegrees = templateId === "family-three-room" ? 110 : 90;

  return {
    id: `layout-${templateId}`,
    templateId,
    metadata: {
      projectName: templateId === "blank" ? "空白起步户型" : "示例户型",
      address: "上海市示例地址 88 号",
      latitude: 31.2304,
      longitude: 121.4737,
      timezone: "Asia/Shanghai",
      buildYear: 2018,
      renovationYear: 2024
    },
    bounds,
    orientation: {
      facingDegrees,
      facingLabel: degreesToDirection(facingDegrees),
      frontDoorDegrees,
      frontDoorLabel: degreesToDirection(frontDoorDegrees)
    },
    rooms,
    walls: buildWallsFromRooms(rooms, 0.18),
    openings: createOpenings(rooms),
    sensors: [
      { id: "sensor-living", label: "客厅传感点", x: 2.2, y: 1.8, temperature: 26.2 },
      { id: "sensor-bedroom", label: "卧室传感点", x: 6.5, y: 1.8, temperature: 25.4 },
      { id: "sensor-kitchen", label: "厨房传感点", x: 1.4, y: 5.0, temperature: 27.1 }
    ],
    devices: createDevices(rooms),
    weather: {
      windDirection: 135,
      windSpeed: 3.6,
      outdoorTemperature: 31
    }
  };
}
