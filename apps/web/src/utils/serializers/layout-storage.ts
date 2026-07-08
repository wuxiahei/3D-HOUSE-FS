import {
  createTemplateLayout,
  syncDerivedLayoutData
} from "@fengshui/core";
import type { HouseLayout, TemplateId } from "@fengshui/core";

export const SAVED_LAYOUT_STORAGE_KEY = "3d-house-fs:layout";

const templateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function templateIdValue(value: unknown): TemplateId {
  return typeof value === "string" && templateIds.includes(value as TemplateId)
    ? (value as TemplateId)
    : "blank";
}

export function stringifyLayout(layout: HouseLayout): string {
  return JSON.stringify(layout, null, 2);
}

export function parseLayoutJson(source: string): HouseLayout {
  const parsed = JSON.parse(source) as unknown;
  return normalizeImportedLayout(parsed);
}

export function normalizeImportedLayout(value: unknown): HouseLayout {
  if (!isRecord(value)) {
    throw new Error("导入内容不是有效的布局对象。");
  }

  const fallback = createTemplateLayout("blank");
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const bounds = isRecord(value.bounds) ? value.bounds : {};
  const orientation = isRecord(value.orientation) ? value.orientation : {};
  const weather = isRecord(value.weather) ? value.weather : {};

  const rooms = Array.isArray(value.rooms) ? value.rooms : [];
  if (rooms.length === 0) {
    throw new Error("导入布局至少需要包含一个房间。");
  }

  const imported: HouseLayout = {
    id: stringValue(value.id, `imported-layout-${Date.now()}`),
    templateId: templateIdValue(value.templateId),
    metadata: {
      ...fallback.metadata,
      projectName: stringValue(metadata.projectName, fallback.metadata.projectName),
      address: stringValue(metadata.address, fallback.metadata.address),
      latitude: numberValue(metadata.latitude, fallback.metadata.latitude ?? 0),
      longitude: numberValue(metadata.longitude, fallback.metadata.longitude ?? 0),
      timezone: stringValue(metadata.timezone, fallback.metadata.timezone ?? "Asia/Shanghai"),
      buildYear: numberValue(metadata.buildYear, fallback.metadata.buildYear),
      renovationYear: numberValue(metadata.renovationYear, fallback.metadata.renovationYear)
    },
    bounds: {
      width: numberValue(bounds.width, fallback.bounds.width),
      depth: numberValue(bounds.depth, fallback.bounds.depth),
      height: numberValue(bounds.height, fallback.bounds.height)
    },
    orientation: {
      ...fallback.orientation,
      facingDegrees: numberValue(orientation.facingDegrees, fallback.orientation.facingDegrees),
      frontDoorDegrees: numberValue(orientation.frontDoorDegrees, fallback.orientation.frontDoorDegrees)
    },
    rooms: rooms as HouseLayout["rooms"],
    walls: Array.isArray(value.walls) ? (value.walls as HouseLayout["walls"]) : [],
    openings: Array.isArray(value.openings) ? (value.openings as HouseLayout["openings"]) : [],
    sensors: Array.isArray(value.sensors) ? (value.sensors as HouseLayout["sensors"]) : [],
    weather: {
      windDirection: numberValue(weather.windDirection, fallback.weather.windDirection),
      windSpeed: numberValue(weather.windSpeed, fallback.weather.windSpeed),
      outdoorTemperature: numberValue(
        weather.outdoorTemperature,
        fallback.weather.outdoorTemperature
      )
    }
  };

  return syncDerivedLayoutData(imported);
}
