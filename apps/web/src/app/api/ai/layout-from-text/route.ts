import {
  createTemplateLayout,
  roomCenter,
  syncDerivedLayoutData,
  validateLayout
} from "@fengshui/core";
import type { ClimateDevice, HouseLayout, SensorPoint, TemplateId } from "@fengshui/core";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  normalizeAiProviderMode,
  normalizeBrowserAiConfig,
  type AiProviderMode
} from "../../../../lib/ai-config";

type AiSource = "provider" | "local" | "fallback";
type RoomPurpose =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "study"
  | "balcony"
  | "entry"
  | "other";
type OpeningSide = "north" | "east" | "south" | "west";

interface AiDraftResponse {
  source: AiSource;
  configured: boolean;
  templateId: TemplateId;
  layout: HouseLayout;
  message: string;
  rationale?: string;
  tags?: string[];
  confidence?: number;
  validation: ReturnType<typeof validateLayout>;
  provider?: {
    name: string;
    model?: string;
    baseUrl?: string;
  };
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  path: string;
  timeoutMs: number;
}

interface ReferenceImage {
  name: string;
  mediaType: string;
  dataUrl: string;
}

interface RequestPayload {
  prompt: string;
  providerMode: AiProviderMode;
  serverPassword: string;
  browserConfig: ReturnType<typeof normalizeBrowserAiConfig>;
  referenceImages: ReferenceImage[];
}

interface AiLayoutDraft {
  templateId?: unknown;
  projectName?: unknown;
  address?: unknown;
  buildYear?: unknown;
  renovationYear?: unknown;
  bounds?: unknown;
  orientation?: unknown;
  rooms?: unknown;
  openings?: unknown;
  devices?: unknown;
  sensors?: unknown;
  weather?: unknown;
  rationale?: unknown;
  tags?: unknown;
  confidence?: unknown;
}

const allowedTemplateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];
const allowedRoomPurposes: RoomPurpose[] = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "study",
  "balcony",
  "entry",
  "other"
];
const allowedOpeningSides: OpeningSide[] = ["north", "east", "south", "west"];
const allowedDeviceTypes: ClimateDevice["type"][] = ["ac", "kitchen-heat"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTemplateId(value: unknown, fallback: TemplateId): TemplateId {
  return typeof value === "string" && allowedTemplateIds.includes(value as TemplateId)
    ? (value as TemplateId)
    : fallback;
}

function templateFromPrompt(prompt: string): TemplateId {
  const normalized = prompt.toLowerCase();
  if (
    normalized.includes("三") ||
    normalized.includes("3") ||
    normalized.includes("家庭") ||
    normalized.includes("老人") ||
    normalized.includes("孩子") ||
    normalized.includes("family")
  ) {
    return "family-three-room";
  }
  if (
    normalized.includes("空白") ||
    normalized.includes("自定义") ||
    normalized.includes("blank")
  ) {
    return "blank";
  }
  return "compact-two-room";
}

function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : null;
  }
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function toIdSeed(value: string, index: number) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii.length > 0 ? ascii : `room-${index + 1}`;
}

function cleanProjectName(value: unknown, fallback: string) {
  const trimmed = stringValue(value, fallback);
  return trimmed.length > 0 ? trimmed.slice(0, 48) : fallback;
}

function extractMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .join("\n");
  }
  return "";
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "image/png";
  return {
    name: file.name || "reference-image",
    mediaType,
    dataUrl: `data:${mediaType};base64,${buffer.toString("base64")}`
  };
}

function parseMaybeJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function readPayload(request: Request): Promise<RequestPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const referenceFiles = form
      .getAll("referenceImages")
      .filter((item): item is File => item instanceof File);

    return {
      prompt: stringValue(form.get("prompt")),
      providerMode: normalizeAiProviderMode(form.get("providerMode")),
      serverPassword: stringValue(form.get("serverPassword")),
      browserConfig: normalizeBrowserAiConfig(parseMaybeJson(form.get("browserConfig"))),
      referenceImages: await Promise.all(referenceFiles.map(fileToReferenceImage))
    };
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    prompt: stringValue(body.prompt),
    providerMode: normalizeAiProviderMode(body.providerMode),
    serverPassword: stringValue(body.serverPassword),
    browserConfig: normalizeBrowserAiConfig(body.browserConfig),
    referenceImages: []
  };
}

function getServerProviderConfig(password: string): { config?: ProviderConfig; error?: string } {
  const requiredPassword = readEnv("AI_SERVER_PASSWORD");

  if (!requiredPassword) {
    return { error: "服务器未配置 AI_SERVER_PASSWORD，暂不能启用服务器内置 AI。" };
  }

  if (!password || !secureEquals(password, requiredPassword)) {
    return { error: "服务器内置 AI 密码错误，已拒绝使用服务器配置。" };
  }

  const apiKey = readEnv("AI_API_KEY") ?? readEnv("OPENAI_API_KEY");
  const model = readEnv("AI_MODEL");
  if (!apiKey || !model) {
    return { error: "服务器内置 AI 尚未配置 AI_API_KEY / OPENAI_API_KEY 或 AI_MODEL。" };
  }

  return {
    config: {
      name: (readEnv("AI_PROVIDER", "openai-compatible") ?? "openai-compatible").toLowerCase(),
      apiKey,
      model,
      baseUrl: (
        readEnv("AI_BASE_URL", "https://api.openai.com/v1") ?? "https://api.openai.com/v1"
      ).replace(/\/$/, ""),
      path: readEnv("AI_CHAT_COMPLETIONS_PATH", "/chat/completions") ?? "/chat/completions",
      timeoutMs: clamp(Number(readEnv("AI_TIMEOUT_MS", "20000")), 5000, 60000)
    }
  };
}

function getBrowserProviderConfig(
  browserConfig: ReturnType<typeof normalizeBrowserAiConfig>
): ProviderConfig | null {
  if (!browserConfig.apiKey || !browserConfig.model) {
    return null;
  }

  return {
    name: browserConfig.providerName || "openai-compatible",
    apiKey: browserConfig.apiKey,
    model: browserConfig.model,
    baseUrl: browserConfig.baseUrl,
    path: browserConfig.chatCompletionsPath,
    timeoutMs: browserConfig.timeoutMs
  };
}

function createDefaultDevices(rooms: HouseLayout["rooms"]): ClimateDevice[] {
  const devices: ClimateDevice[] = [];
  const living = rooms.find((room) => room.purpose === "living");
  const bedroom = rooms.find((room) => room.purpose === "bedroom");
  const kitchen = rooms.find((room) => room.purpose === "kitchen");

  if (living) {
    devices.push({
      id: "ac-living",
      type: "ac",
      roomId: living.id,
      label: `${living.name}空调`,
      x: Number((living.origin.x + living.width * 0.82).toFixed(2)),
      y: Number((living.origin.y + living.depth * 0.18).toFixed(2)),
      directionDegrees: 180,
      strength: 0.72,
      temperatureDelta: -4.5
    });
  }

  if (bedroom) {
    devices.push({
      id: "ac-bedroom",
      type: "ac",
      roomId: bedroom.id,
      label: `${bedroom.name}空调`,
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
      label: "厨房热源",
      x: Number((kitchen.origin.x + kitchen.width * 0.5).toFixed(2)),
      y: Number((kitchen.origin.y + kitchen.depth * 0.55).toFixed(2)),
      directionDegrees: 0,
      strength: 0.86,
      temperatureDelta: 5.5
    });
  }

  return devices;
}

function createDefaultSensors(rooms: HouseLayout["rooms"], outdoorTemperature: number): SensorPoint[] {
  return rooms.slice(0, Math.min(3, rooms.length)).map((room, index) => {
    const center = roomCenter(room);
    return {
      id: `sensor-${index + 1}`,
      label: `${room.name}传感点`,
      x: Number(center.x.toFixed(2)),
      y: Number(center.y.toFixed(2)),
      temperature: Number((outdoorTemperature - 4 + index * 0.4).toFixed(1))
    };
  });
}

function createDefaultOpenings(rooms: HouseLayout["rooms"]) {
  const openings: HouseLayout["openings"] = [];

  rooms.forEach((room, index) => {
    const windowSide: OpeningSide = room.width >= room.depth ? "south" : "east";
    const wallLength = windowSide === "south" ? room.width : room.depth;
    const windowWidth = Number(clamp(wallLength * 0.36, 0.9, 1.8).toFixed(2));
    const windowOffset = Number(clamp((wallLength - windowWidth) / 2, 0.08, wallLength - windowWidth).toFixed(2));

    openings.push({
      id: `window-${index + 1}`,
      type: "window",
      wallId: `${room.id}-${windowSide}`,
      width: windowWidth,
      height: 1.4,
      offset: Number.isFinite(windowOffset) ? windowOffset : 0.1,
      sillHeight: 0.9,
      notes: `${room.name}采光窗`
    });
  });

  const entry = rooms.find((room) => room.purpose === "entry") ?? rooms[0];
  const entryWallLength = entry.width;
  const doorWidth = Number(clamp(entryWallLength * 0.32, 0.85, 1.1).toFixed(2));
  openings.push({
    id: "door-entry",
    type: "door",
    wallId: `${entry.id}-south`,
    width: doorWidth,
    height: 2.1,
    offset: Number(clamp((entryWallLength - doorWidth) / 2, 0.08, entryWallLength - doorWidth).toFixed(2)),
    notes: `${entry.name}入户门`
  });

  return openings;
}

function buildLayoutFromDraft(draft: AiLayoutDraft, fallbackTemplateId: TemplateId): HouseLayout {
  const templateId = normalizeTemplateId(draft.templateId, fallbackTemplateId);
  const fallback = createTemplateLayout(templateId);
  const boundsRecord = isRecord(draft.bounds) ? draft.bounds : {};
  const orientationRecord = isRecord(draft.orientation) ? draft.orientation : {};
  const weatherRecord = isRecord(draft.weather) ? draft.weather : {};

  const rawRooms = Array.isArray(draft.rooms) ? draft.rooms : [];
  const normalizedRooms =
    rawRooms
      .filter(isRecord)
      .slice(0, 8)
      .map((room, index) => {
        const fallbackRoom = fallback.rooms[Math.min(index, fallback.rooms.length - 1)] ?? fallback.rooms[0];
        const name = stringValue(room.name, fallbackRoom?.name ?? `房间 ${index + 1}`) || `房间 ${index + 1}`;
        const purpose = stringValue(room.purpose, fallbackRoom?.purpose ?? "other") as RoomPurpose;

        return {
          id: toIdSeed(name, index),
          name,
          purpose: allowedRoomPurposes.includes(purpose) ? purpose : "other",
          origin: {
            x: Number(clamp(numberValue(isRecord(room.origin) ? room.origin.x : undefined, fallbackRoom?.origin.x ?? 0.4), 0, 30).toFixed(2)),
            y: Number(clamp(numberValue(isRecord(room.origin) ? room.origin.y : undefined, fallbackRoom?.origin.y ?? 0.4), 0, 30).toFixed(2))
          },
          width: Number(clamp(numberValue(room.width, fallbackRoom?.width ?? 3), 1.1, 12).toFixed(2)),
          depth: Number(clamp(numberValue(room.depth, fallbackRoom?.depth ?? 3), 1.1, 12).toFixed(2)),
          level: Math.max(1, Math.round(numberValue(room.level, 1))),
          notes: stringValue(room.notes)
        };
      }) ?? [];

  const rooms = normalizedRooms.length > 0 ? normalizedRooms : fallback.rooms;
  const maxX = Math.max(...rooms.map((room) => room.origin.x + room.width), fallback.bounds.width - 0.4);
  const maxY = Math.max(...rooms.map((room) => room.origin.y + room.depth), fallback.bounds.depth - 0.4);

  const weather = {
    windDirection: Number(clamp(numberValue(weatherRecord.windDirection, fallback.weather.windDirection), 0, 359).toFixed(0)),
    windSpeed: Number(clamp(numberValue(weatherRecord.windSpeed, fallback.weather.windSpeed), 0.2, 20).toFixed(1)),
    outdoorTemperature: Number(
      clamp(numberValue(weatherRecord.outdoorTemperature, fallback.weather.outdoorTemperature), -25, 50).toFixed(1)
    )
  };

  const layout: HouseLayout = syncDerivedLayoutData({
    ...fallback,
    id: `ai-layout-${Date.now()}`,
    templateId,
    metadata: {
      ...fallback.metadata,
      projectName: cleanProjectName(draft.projectName, `AI 草案 - ${fallback.metadata.projectName}`),
      address: stringValue(draft.address, fallback.metadata.address),
      buildYear: Math.round(clamp(numberValue(draft.buildYear, fallback.metadata.buildYear), 1950, 2100)),
      renovationYear: Math.round(
        clamp(numberValue(draft.renovationYear, fallback.metadata.renovationYear), 1950, 2100)
      )
    },
    bounds: {
      width: Number(
        Math.max(
          clamp(numberValue(boundsRecord.width, fallback.bounds.width), 4, 30),
          Number((maxX + 0.6).toFixed(2))
        ).toFixed(2)
      ),
      depth: Number(
        Math.max(
          clamp(numberValue(boundsRecord.depth, fallback.bounds.depth), 4, 30),
          Number((maxY + 0.6).toFixed(2))
        ).toFixed(2)
      ),
      height: Number(clamp(numberValue(boundsRecord.height, fallback.bounds.height), 2.4, 4.5).toFixed(2))
    },
    orientation: {
      ...fallback.orientation,
      facingDegrees: Number(clamp(numberValue(orientationRecord.facingDegrees, fallback.orientation.facingDegrees), 0, 359).toFixed(0)),
      frontDoorDegrees: Number(
        clamp(numberValue(orientationRecord.frontDoorDegrees, fallback.orientation.frontDoorDegrees), 0, 359).toFixed(0)
      )
    },
    rooms,
    walls: [],
    openings: [],
    devices: [],
    sensors: [],
    weather
  });

  const roomMap = new Map(
    layout.rooms.map((room) => [normalizeLabel(room.name), room] as const)
  );
  const openings = Array.isArray(draft.openings)
    ? draft.openings
        .filter(isRecord)
        .map((opening, index) => {
          const roomName = stringValue(opening.roomName);
          const side = stringValue(opening.side) as OpeningSide;
          const room = roomMap.get(normalizeLabel(roomName));
          if (!room || !allowedOpeningSides.includes(side)) {
            return null;
          }
          const type: "door" | "window" =
            stringValue(opening.type) === "door" ? "door" : "window";
          return {
            id: `opening-${index + 1}`,
            type,
            wallId: `${room.id}-${side}`,
            width: Number(clamp(numberValue(opening.width, 1), 0.45, 3).toFixed(2)),
            height: Number(clamp(numberValue(opening.height, type === "door" ? 2.1 : 1.4), 0.4, 3).toFixed(2)),
            offset: Number(clamp(numberValue(opening.offset, 0.35), 0, 20).toFixed(2)),
            sillHeight:
              type === "window"
                ? Number(clamp(numberValue(opening.sillHeight, 0.9), 0, 2.2).toFixed(2))
                : undefined,
            notes: stringValue(opening.notes, `${room.name}${type === "door" ? "门" : "窗"}`)
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const devices = Array.isArray(draft.devices)
    ? draft.devices
        .filter(isRecord)
        .map((device, index) => {
          const type = stringValue(device.type) as ClimateDevice["type"];
          const room = roomMap.get(normalizeLabel(stringValue(device.roomName)));
          if (!room || !allowedDeviceTypes.includes(type)) {
            return null;
          }

          return {
            id: `device-${index + 1}`,
            type,
            roomId: room.id,
            label:
              stringValue(device.label) ||
              (type === "ac" ? `${room.name}空调` : `${room.name}热源`),
            x: Number(
              clamp(numberValue(device.x, room.origin.x + room.width * (type === "ac" ? 0.82 : 0.5)), room.origin.x, room.origin.x + room.width).toFixed(2)
            ),
            y: Number(
              clamp(numberValue(device.y, room.origin.y + room.depth * (type === "ac" ? 0.18 : 0.55)), room.origin.y, room.origin.y + room.depth).toFixed(2)
            ),
            directionDegrees: Number(clamp(numberValue(device.directionDegrees, type === "ac" ? 180 : 0), 0, 359).toFixed(0)),
            strength: Number(clamp(numberValue(device.strength, type === "ac" ? 0.72 : 0.82), 0.05, 1).toFixed(2)),
            temperatureDelta: Number(clamp(numberValue(device.temperatureDelta, type === "ac" ? -4.5 : 5.5), -12, 12).toFixed(1))
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const sensors = Array.isArray(draft.sensors)
    ? draft.sensors
        .filter(isRecord)
        .slice(0, 5)
        .map((sensor, index) => ({
          id: `sensor-${index + 1}`,
          label: stringValue(sensor.label, `传感点 ${index + 1}`),
          x: Number(clamp(numberValue(sensor.x, layout.bounds.width / 2), 0, layout.bounds.width).toFixed(2)),
          y: Number(clamp(numberValue(sensor.y, layout.bounds.depth / 2), 0, layout.bounds.depth).toFixed(2)),
          temperature: Number(
            clamp(numberValue(sensor.temperature, layout.weather.outdoorTemperature - 4), -20, 60).toFixed(1)
          )
        }))
    : [];

  return syncDerivedLayoutData({
    ...layout,
    openings: openings.length > 0 ? openings : createDefaultOpenings(layout.rooms),
    devices: devices.length > 0 ? devices : createDefaultDevices(layout.rooms),
    sensors: sensors.length > 0 ? sensors : createDefaultSensors(layout.rooms, weather.outdoorTemperature)
  });
}

function responseFor({
  source,
  configured,
  fallbackTemplateId,
  layout,
  message,
  rationale,
  tags,
  confidence,
  provider
}: {
  source: AiSource;
  configured: boolean;
  fallbackTemplateId: TemplateId;
  layout?: HouseLayout;
  message: string;
  rationale?: string;
  tags?: string[];
  confidence?: number;
  provider?: AiDraftResponse["provider"];
}) {
  const normalizedLayout =
    layout ??
    syncDerivedLayoutData({
      ...createTemplateLayout(fallbackTemplateId),
      metadata: {
        ...createTemplateLayout(fallbackTemplateId).metadata,
        projectName: `AI 草案 - ${createTemplateLayout(fallbackTemplateId).metadata.projectName}`
      }
    });

  const payload: AiDraftResponse = {
    source,
    configured,
    templateId: normalizedLayout.templateId,
    layout: normalizedLayout,
    message,
    rationale,
    tags,
    confidence,
    validation: validateLayout(normalizedLayout),
    provider
  };

  return NextResponse.json(payload);
}

async function askConfiguredProvider(config: ProviderConfig, prompt: string, referenceImages: ReferenceImage[]) {
  const systemPrompt = [
    "You are an interior layout planner for a browser-based 3D house editor.",
    "Infer a practical single-floor residential layout from the user's text and reference images.",
    "Return only one compact JSON object.",
    "All dimensions must be meters.",
    "Rooms must be rectangles and should not overlap when possible.",
    "Include at least one living room and one entry room if the references imply a normal residence.",
    "Allowed templateId values: blank, compact-two-room, family-three-room.",
    "Allowed room purpose values: living, bedroom, kitchen, bathroom, study, balcony, entry, other.",
    "Openings schema item: {\"roomName\":\"客厅\",\"side\":\"south\",\"type\":\"window\",\"width\":1.8,\"offset\":0.7,\"height\":1.4,\"sillHeight\":0.9}",
    "Devices schema item: {\"roomName\":\"客厅\",\"type\":\"ac\",\"x\":4.2,\"y\":1.1,\"directionDegrees\":180,\"strength\":0.72,\"temperatureDelta\":-4.5}",
    "Sensors schema item: {\"label\":\"客厅传感点\",\"x\":2.4,\"y\":1.8,\"temperature\":26.2}",
    "JSON schema: {\"templateId\":\"compact-two-room\",\"projectName\":\"...\",\"address\":\"...\",\"buildYear\":2018,\"renovationYear\":2024,\"bounds\":{\"width\":8.8,\"depth\":6.4,\"height\":2.9},\"orientation\":{\"facingDegrees\":135,\"frontDoorDegrees\":90},\"rooms\":[{\"name\":\"客厅\",\"purpose\":\"living\",\"origin\":{\"x\":0.4,\"y\":0.4},\"width\":4.9,\"depth\":3.6,\"level\":1}],\"openings\":[],\"devices\":[],\"sensors\":[],\"weather\":{\"windDirection\":135,\"windSpeed\":3.6,\"outdoorTemperature\":31},\"rationale\":\"...\",\"tags\":[\"...\"],\"confidence\":0.0}"
  ].join("\n");

  const userText = [
    `用户需求：${prompt || "未提供文字需求，请主要参考图片。"}`,
    "如果图片是草图、户型图、现场照片，请优先提炼成可编辑的矩形房间布局，信息不确定时保守推断。"
  ].join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: userText }];

  referenceImages.forEach((image) => {
    content.push({
      type: "image_url",
      image_url: { url: image.dataUrl }
    });
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${config.path.startsWith("/") ? config.path : `/${config.path}`}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ]
      }),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`AI provider returned ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const contentText = extractMessageContent(json.choices?.[0]?.message?.content);
    if (!contentText) {
      throw new Error("AI provider returned empty content");
    }

    const parsed = parseJsonObject(contentText);
    if (!parsed) {
      throw new Error("AI provider returned non-JSON content");
    }

    return parsed as AiLayoutDraft;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI provider request timed out after ${config.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  const prompt = payload.prompt.trim();
  const fallbackTemplateId = templateFromPrompt(prompt);

  if (!prompt && payload.referenceImages.length === 0) {
    return responseFor({
      source: "local",
      configured: false,
      fallbackTemplateId,
      message: "请先输入客户需求，或上传草图 / 照片后再生成 AI 建模草案。",
      rationale: "当前没有可用于分析的文字或图片输入。"
    });
  }

  let providerConfig: ProviderConfig | null = null;
  let configured = false;

  if (payload.providerMode === "server") {
    const serverResult = getServerProviderConfig(payload.serverPassword);
    if (!serverResult.config) {
      return responseFor({
        source: "fallback",
        configured: false,
        fallbackTemplateId,
        message: serverResult.error ?? "服务器内置 AI 不可用，已回落本地规则。",
        rationale:
          payload.referenceImages.length > 0
            ? "本地回退只能按文字规则选模板，无法像多模态模型那样深度理解草图和照片。"
            : "已使用本地规则生成可编辑草案。"
      });
    }
    providerConfig = serverResult.config;
    configured = true;
  } else {
    providerConfig = getBrowserProviderConfig(payload.browserConfig);
    configured = Boolean(providerConfig);
  }

  if (!providerConfig) {
    return responseFor({
      source: "local",
      configured,
      fallbackTemplateId,
      message: "未检测到可用的浏览器端 AI 配置，已使用本地规则生成草案。",
      rationale:
        payload.referenceImages.length > 0
          ? "如果要让 AI 解析草图或拍照图片，请在“AI 设置”里填写浏览器本地 Key，或切换到服务器配置并输入密码。"
          : "可在“AI 设置”里填写浏览器本地 Key，不会存到服务器。"
    });
  }

  const providerInfo = {
    name: providerConfig.name,
    model: providerConfig.model,
    baseUrl: providerConfig.baseUrl
  };

  try {
    const draft = await askConfiguredProvider(providerConfig, prompt, payload.referenceImages);
    const layout = buildLayoutFromDraft(draft, fallbackTemplateId);
    const tags = Array.isArray(draft.tags)
      ? draft.tags.filter((item): item is string => typeof item === "string").slice(0, 8)
      : undefined;
    const confidence =
      typeof draft.confidence === "number"
        ? Number(clamp(draft.confidence, 0, 1).toFixed(2))
        : undefined;

    return responseFor({
      source: "provider",
      configured: true,
      fallbackTemplateId,
      layout,
      message:
        payload.referenceImages.length > 0
          ? "AI 已结合客户描述和图片参考生成可编辑的 JSON 建模草案。"
          : "AI 已根据客户描述生成可编辑的 JSON 建模草案。",
      rationale: stringValue(draft.rationale),
      tags,
      confidence,
      provider: providerInfo
    });
  } catch (error) {
    return responseFor({
      source: "fallback",
      configured: true,
      fallbackTemplateId,
      message: "AI 服务调用失败，已回落本地规则生成草案。",
      rationale:
        error instanceof Error
          ? `失败原因：${error.message}`
          : "AI 服务暂时不可用。"
      ,
      provider: providerInfo
    });
  }
}
