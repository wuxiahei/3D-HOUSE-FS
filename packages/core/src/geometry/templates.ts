import type { HouseLayout, Opening, Room, TemplateId } from "../types/layout";
import { buildWallsFromRooms, degreesToDirection } from "./layout-helpers";

function createOpenings(rooms: Room[]): Opening[] {
  const openings: Opening[] = [];
  rooms.forEach((room) => {
    openings.push({
      id: `${room.id}-window-main`,
      type: "window",
      wallId: `${room.id}-south`,
      width: Math.min(1.8, room.width * 0.4),
      height: 1.4,
      offset: Math.max(0.6, room.width * 0.2),
      sillHeight: 0.9,
      notes: `${room.name} 采光窗`
    });
  });
  openings.push({
    id: "entry-door",
    type: "door",
    wallId: "entry-east",
    width: 1,
    height: 2.1,
    offset: 0.4,
    notes: "入户门"
  });
  return openings;
}

function createRooms(templateId: TemplateId): Room[] {
  if (templateId === "family-three-room") {
    return [
      { id: "living", name: "客厅", purpose: "living", origin: { x: 0.6, y: 0.6 }, width: 4.8, depth: 3.9, level: 1 },
      { id: "master", name: "主卧", purpose: "bedroom", origin: { x: 5.6, y: 0.6 }, width: 3.6, depth: 3.2, level: 1 },
      { id: "bedroom-2", name: "次卧", purpose: "bedroom", origin: { x: 5.6, y: 3.95 }, width: 3.6, depth: 3.0, level: 1 },
      { id: "kitchen", name: "厨房", purpose: "kitchen", origin: { x: 0.6, y: 4.7 }, width: 2.5, depth: 2.25, level: 1 },
      { id: "study", name: "书房", purpose: "study", origin: { x: 3.25, y: 4.7 }, width: 2.15, depth: 2.25, level: 1 },
      { id: "entry", name: "玄关", purpose: "entry", origin: { x: 0.6, y: 7.1 }, width: 2.2, depth: 1.2, level: 1 }
    ];
  }

  if (templateId === "compact-two-room") {
    return [
      { id: "living", name: "客餐厅", purpose: "living", origin: { x: 0.5, y: 0.5 }, width: 4.6, depth: 3.5, level: 1 },
      { id: "bedroom", name: "卧室", purpose: "bedroom", origin: { x: 5.3, y: 0.5 }, width: 3.1, depth: 3.2, level: 1 },
      { id: "kitchen", name: "厨房", purpose: "kitchen", origin: { x: 0.5, y: 4.2 }, width: 2.3, depth: 2.1, level: 1 },
      { id: "bathroom", name: "卫浴", purpose: "bathroom", origin: { x: 3.0, y: 4.2 }, width: 1.8, depth: 2.1, level: 1 },
      { id: "entry", name: "玄关", purpose: "entry", origin: { x: 5.0, y: 4.2 }, width: 1.8, depth: 1.4, level: 1 }
    ];
  }

  return [
    { id: "living", name: "主空间", purpose: "living", origin: { x: 0.5, y: 0.5 }, width: 5.4, depth: 4.2, level: 1 },
    { id: "entry", name: "玄关", purpose: "entry", origin: { x: 6.1, y: 0.5 }, width: 1.6, depth: 1.4, level: 1 }
  ];
}

export function createTemplateLayout(templateId: TemplateId): HouseLayout {
  const rooms = createRooms(templateId);
  const bounds =
    templateId === "family-three-room"
      ? { width: 10.2, depth: 8.8, height: 3 }
      : templateId === "compact-two-room"
        ? { width: 8.8, depth: 6.8, height: 2.9 }
        : { width: 8.2, depth: 5.8, height: 2.9 };

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
      { id: "sensor-kitchen", label: "厨房传感点", x: 1.6, y: 5.2, temperature: 27.1 }
    ],
    weather: {
      windDirection: 135,
      windSpeed: 3.6,
      outdoorTemperature: 31
    }
  };
}
