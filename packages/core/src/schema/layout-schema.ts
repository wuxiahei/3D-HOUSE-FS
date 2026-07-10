import { z } from "zod";
import type { CompassDirection, HouseLayout, LayoutPoint, Room, ValidationIssue, WallSegment } from "../types/layout";

export const CURRENT_SCHEMA_VERSION = 2 as const;

export const LAYOUT_LIMITS = {
  rooms: 32,
  walls: 256,
  openings: 256,
  sensors: 64,
  devices: 64
} as const;

const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const roomPurposes = ["living", "bedroom", "kitchen", "bathroom", "study", "balcony", "entry", "other"] as const;

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const nonNegativeNumber = finiteNumber.min(0);
const idSchema = z.string().trim().min(1).max(96);

export const LayoutPointSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber
  })
  .strict();

export const LayoutBoundsSchema = z
  .object({
    width: positiveNumber.max(200),
    depth: positiveNumber.max(200),
    height: positiveNumber.max(20)
  })
  .strict();

export const RoomSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    purpose: z.enum(roomPurposes),
    origin: LayoutPointSchema,
    width: positiveNumber.max(200),
    depth: positiveNumber.max(200),
    level: z.number().int().min(0).max(32),
    notes: z.string().max(500).optional()
  })
  .strict();

export const WallSegmentSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1).max(120),
    start: LayoutPointSchema,
    end: LayoutPointSchema,
    thickness: positiveNumber.max(2),
    exterior: z.boolean(),
    source: z.enum(["room", "custom"]),
    roomId: idSchema.optional()
  })
  .strict();

export const OpeningSchema = z
  .object({
    id: idSchema,
    type: z.enum(["door", "window"]),
    wallId: idSchema,
    width: positiveNumber.max(20),
    height: positiveNumber.max(20),
    offset: nonNegativeNumber,
    sillHeight: nonNegativeNumber.optional(),
    notes: z.string().max(500).optional()
  })
  .strict();

export const SensorPointSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1).max(120),
    x: finiteNumber,
    y: finiteNumber,
    temperature: finiteNumber.min(-80).max(120)
  })
  .strict();

export const ClimateDeviceSchema = z
  .object({
    id: idSchema,
    type: z.enum(["ac", "kitchen-heat"]),
    roomId: idSchema,
    label: z.string().trim().min(1).max(120),
    x: finiteNumber,
    y: finiteNumber,
    directionDegrees: finiteNumber.min(0).max(360),
    strength: positiveNumber.max(1),
    temperatureDelta: finiteNumber.min(-50).max(50)
  })
  .strict();

export const WeatherInputSchema = z
  .object({
    windDirection: finiteNumber.min(0).max(360),
    windSpeed: nonNegativeNumber.max(100),
    outdoorTemperature: finiteNumber.min(-80).max(80)
  })
  .strict();

export const HouseOrientationSchema = z
  .object({
    facingDegrees: finiteNumber.min(0).max(360),
    facingLabel: z.enum(directions),
    frontDoorDegrees: finiteNumber.min(0).max(360),
    frontDoorLabel: z.enum(directions)
  })
  .strict();

export const HouseMetadataSchema = z
  .object({
    projectName: z.string().trim().min(1).max(160),
    address: z.string().max(240),
    latitude: finiteNumber.min(-90).max(90).optional(),
    longitude: finiteNumber.min(-180).max(180).optional(),
    timezone: z.string().max(80).optional(),
    buildYear: z.number().int().min(1800).max(2200),
    renovationYear: z.number().int().min(1800).max(2200)
  })
  .strict();

function distance(a: LayoutPoint, b: LayoutPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointInsideRoom(room: Room, point: LayoutPoint) {
  return (
    point.x >= room.origin.x &&
    point.x <= room.origin.x + room.width &&
    point.y >= room.origin.y &&
    point.y <= room.origin.y + room.depth
  );
}

function roomInsideBounds(room: Room, bounds: { width: number; depth: number }) {
  return (
    room.origin.x >= 0 &&
    room.origin.y >= 0 &&
    room.origin.x + room.width <= bounds.width &&
    room.origin.y + room.depth <= bounds.depth
  );
}

function roomsOverlap(left: Room, right: Room) {
  const xOverlap = Math.min(left.origin.x + left.width, right.origin.x + right.width) - Math.max(left.origin.x, right.origin.x);
  const yOverlap = Math.min(left.origin.y + left.depth, right.origin.y + right.depth) - Math.max(left.origin.y, right.origin.y);
  return xOverlap > 0.001 && yOverlap > 0.001;
}

function addDuplicateIssues(ctx: z.RefinementCtx, label: string, values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        path: [label],
        message: `Duplicate ${label} id: ${value}`
      });
    }
    seen.add(value);
  }
}

export const HouseLayoutSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    id: idSchema,
    templateId: z.enum(["blank", "compact-two-room", "family-three-room"]),
    metadata: HouseMetadataSchema,
    bounds: LayoutBoundsSchema,
    orientation: HouseOrientationSchema,
    rooms: z.array(RoomSchema).min(1).max(LAYOUT_LIMITS.rooms),
    walls: z.array(WallSegmentSchema).max(LAYOUT_LIMITS.walls),
    openings: z.array(OpeningSchema).max(LAYOUT_LIMITS.openings),
    sensors: z.array(SensorPointSchema).max(LAYOUT_LIMITS.sensors),
    devices: z.array(ClimateDeviceSchema).max(LAYOUT_LIMITS.devices),
    weather: WeatherInputSchema
  })
  .strict()
  .superRefine((layout, ctx) => {
    const roomIds = new Set(layout.rooms.map((room) => room.id));
    const allIds = [
      ...layout.rooms.map((room) => room.id),
      ...layout.walls.map((wall) => wall.id),
      ...layout.openings.map((opening) => opening.id),
      ...layout.sensors.map((sensor) => sensor.id),
      ...layout.devices.map((device) => device.id)
    ];

    addDuplicateIssues(ctx, "entity", allIds);

    layout.rooms.forEach((room, index) => {
      if (!roomInsideBounds(room, layout.bounds)) {
        ctx.addIssue({ code: "custom", path: ["rooms", index], message: `Room ${room.id} is outside layout bounds` });
      }
    });

    for (let i = 0; i < layout.rooms.length; i += 1) {
      for (let j = i + 1; j < layout.rooms.length; j += 1) {
        if (roomsOverlap(layout.rooms[i], layout.rooms[j])) {
          ctx.addIssue({
            code: "custom",
            path: ["rooms", j],
            message: `Room ${layout.rooms[j].id} overlaps ${layout.rooms[i].id}`
          });
        }
      }
    }

    layout.walls.forEach((wall, index) => {
      if (distance(wall.start, wall.end) < 0.05) {
        ctx.addIssue({ code: "custom", path: ["walls", index], message: `Wall ${wall.id} is too short` });
      }
      if (wall.roomId && !roomIds.has(wall.roomId)) {
        ctx.addIssue({ code: "custom", path: ["walls", index, "roomId"], message: `Wall ${wall.id} references missing room ${wall.roomId}` });
      }
    });

    layout.openings.forEach((opening, index) => {
      const wall = layout.walls.find((item) => item.id === opening.wallId);
      if (!wall) {
        ctx.addIssue({ code: "custom", path: ["openings", index, "wallId"], message: `Opening ${opening.id} references missing wall ${opening.wallId}` });
        return;
      }
      if (opening.offset + opening.width > distance(wall.start, wall.end) + 0.001) {
        ctx.addIssue({ code: "custom", path: ["openings", index], message: `Opening ${opening.id} exceeds wall length` });
      }
    });

    const byWall = new Map<string, typeof layout.openings>();
    for (const opening of layout.openings) {
      byWall.set(opening.wallId, [...(byWall.get(opening.wallId) ?? []), opening]);
    }
    for (const openings of byWall.values()) {
      for (let i = 0; i < openings.length; i += 1) {
        for (let j = i + 1; j < openings.length; j += 1) {
          const a = openings[i];
          const b = openings[j];
          const overlap = Math.min(a.offset + a.width, b.offset + b.width) - Math.max(a.offset, b.offset);
          if (overlap > 0.02) {
            ctx.addIssue({ code: "custom", path: ["openings"], message: `Openings ${a.id} and ${b.id} overlap` });
          }
        }
      }
    }

    layout.devices.forEach((device, index) => {
      const room = layout.rooms.find((item) => item.id === device.roomId);
      if (!room) {
        ctx.addIssue({ code: "custom", path: ["devices", index, "roomId"], message: `Device ${device.id} references missing room ${device.roomId}` });
        return;
      }
      if (!pointInsideRoom(room, { x: device.x, y: device.y })) {
        ctx.addIssue({ code: "custom", path: ["devices", index], message: `Device ${device.id} is outside room ${room.id}` });
      }
    });
  });

export type ParsedHouseLayout = z.infer<typeof HouseLayoutSchema>;

export interface LayoutParseResult {
  success: boolean;
  layout?: HouseLayout;
  issues: ValidationIssue[];
}

export function zodIssuesToValidationIssues(issues: z.ZodIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    level: "error",
    code: issue.code.toUpperCase(),
    message: issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message
  }));
}

export function parseHouseLayoutV2(input: unknown): LayoutParseResult {
  const result = HouseLayoutSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: zodIssuesToValidationIssues(result.error.issues)
    };
  }

  return {
    success: true,
    layout: result.data as HouseLayout,
    issues: []
  };
}

export type { CompassDirection, HouseLayout, LayoutPoint, Room, WallSegment };
