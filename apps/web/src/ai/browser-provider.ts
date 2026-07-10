import {
  createTemplateLayout,
  parseHouseLayoutDocument,
  roomCenter,
  syncDerivedLayoutData
} from "@fengshui/core";
import type { ClimateDevice, HouseLayout, SensorPoint, TemplateId } from "@fengshui/core";
import type { BrowserAiConfig } from "../lib/ai-config";

type AiSource = "provider" | "local" | "fallback";

export interface BrowserAiDraftResponse {
  source: AiSource;
  configured: boolean;
  templateId: TemplateId;
  layout?: HouseLayout;
  message: string;
  rationale?: string;
  tags?: string[];
  confidence?: number;
  provider?: {
    name: string;
    model?: string;
    baseUrl?: string;
  };
}

interface AiLayoutDraft {
  templateId?: unknown;
  projectName?: unknown;
  address?: unknown;
  bounds?: unknown;
  orientation?: unknown;
  rooms?: unknown;
  weather?: unknown;
  rationale?: unknown;
  tags?: unknown;
  confidence?: unknown;
}

interface ReferenceImage {
  name: string;
  mediaType: string;
  dataUrl: string;
}

const templateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];
const purposes = ["living", "bedroom", "kitchen", "bathroom", "study", "balcony", "entry", "other"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  return typeof value === "string" && templateIds.includes(value as TemplateId)
    ? (value as TemplateId)
    : fallback;
}

function toId(value: string, index: number) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `room-${index + 1}`;
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

function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () =>
      resolve({
        name: file.name || "reference-image",
        mediaType: file.type || "image/png",
        dataUrl: String(reader.result)
      });
    reader.readAsDataURL(file);
  });
}

function defaultSensors(layout: HouseLayout): SensorPoint[] {
  return layout.rooms.slice(0, 3).map((room, index) => {
    const center = roomCenter(room);
    return {
      id: `sensor-${index + 1}`,
      label: `${room.name} sensor`,
      x: Number(center.x.toFixed(2)),
      y: Number(center.y.toFixed(2)),
      temperature: Number((layout.weather.outdoorTemperature - 4 + index * 0.4).toFixed(1))
    };
  });
}

function defaultDevices(layout: HouseLayout): ClimateDevice[] {
  const living = layout.rooms.find((room) => room.purpose === "living") ?? layout.rooms[0];
  if (!living) {
    return [];
  }
  return [
    {
      id: "ac-1",
      type: "ac",
      roomId: living.id,
      label: `${living.name} AC`,
      x: Number((living.origin.x + living.width * 0.8).toFixed(2)),
      y: Number((living.origin.y + living.depth * 0.18).toFixed(2)),
      directionDegrees: 180,
      strength: 0.72,
      temperatureDelta: -4.5
    }
  ];
}

function buildLayoutFromDraft(draft: AiLayoutDraft, fallbackTemplateId: TemplateId): HouseLayout {
  const templateId = normalizeTemplateId(draft.templateId, fallbackTemplateId);
  const fallback = createTemplateLayout(templateId);
  const bounds = isRecord(draft.bounds) ? draft.bounds : {};
  const orientation = isRecord(draft.orientation) ? draft.orientation : {};
  const weather = isRecord(draft.weather) ? draft.weather : {};
  const rawRooms = Array.isArray(draft.rooms) ? draft.rooms : [];
  const rooms = rawRooms
    .filter(isRecord)
    .slice(0, 12)
    .map((room, index) => {
      const fallbackRoom = fallback.rooms[Math.min(index, fallback.rooms.length - 1)] ?? fallback.rooms[0];
      const name = stringValue(room.name, fallbackRoom?.name ?? `Room ${index + 1}`) || `Room ${index + 1}`;
      const purpose = stringValue(room.purpose, fallbackRoom?.purpose ?? "other");
      const origin = isRecord(room.origin) ? room.origin : {};
      return {
        id: toId(name, index),
        name,
        purpose: purposes.includes(purpose as (typeof purposes)[number]) ? (purpose as (typeof purposes)[number]) : "other",
        origin: {
          x: Number(clamp(numberValue(origin.x, fallbackRoom?.origin.x ?? 0.4), 0, 30).toFixed(2)),
          y: Number(clamp(numberValue(origin.y, fallbackRoom?.origin.y ?? 0.4), 0, 30).toFixed(2))
        },
        width: Number(clamp(numberValue(room.width, fallbackRoom?.width ?? 3), 1.1, 12).toFixed(2)),
        depth: Number(clamp(numberValue(room.depth, fallbackRoom?.depth ?? 3), 1.1, 12).toFixed(2)),
        level: Math.max(1, Math.round(numberValue(room.level, 1)))
      };
    });

  const layout = syncDerivedLayoutData({
    ...fallback,
    id: `browser-ai-layout-${Date.now()}`,
    templateId,
    metadata: {
      ...fallback.metadata,
      projectName: stringValue(draft.projectName, `AI draft - ${fallback.metadata.projectName}`),
      address: stringValue(draft.address, fallback.metadata.address)
    },
    bounds: {
      width: Number(clamp(numberValue(bounds.width, fallback.bounds.width), 4, 40).toFixed(2)),
      depth: Number(clamp(numberValue(bounds.depth, fallback.bounds.depth), 4, 40).toFixed(2)),
      height: Number(clamp(numberValue(bounds.height, fallback.bounds.height), 2.4, 5).toFixed(2))
    },
    orientation: {
      ...fallback.orientation,
      facingDegrees: Number(clamp(numberValue(orientation.facingDegrees, fallback.orientation.facingDegrees), 0, 359).toFixed(0)),
      frontDoorDegrees: Number(clamp(numberValue(orientation.frontDoorDegrees, fallback.orientation.frontDoorDegrees), 0, 359).toFixed(0))
    },
    rooms: rooms.length > 0 ? rooms : fallback.rooms,
    walls: [],
    openings: [],
    sensors: [],
    devices: [],
    weather: {
      windDirection: Number(clamp(numberValue(weather.windDirection, fallback.weather.windDirection), 0, 359).toFixed(0)),
      windSpeed: Number(clamp(numberValue(weather.windSpeed, fallback.weather.windSpeed), 0, 30).toFixed(1)),
      outdoorTemperature: Number(clamp(numberValue(weather.outdoorTemperature, fallback.weather.outdoorTemperature), -30, 55).toFixed(1))
    }
  });

  const withDefaults = syncDerivedLayoutData({
    ...layout,
    sensors: defaultSensors(layout),
    devices: defaultDevices(layout)
  });
  const parsed = parseHouseLayoutDocument(withDefaults);
  return parsed.layout ?? fallback;
}

export async function requestBrowserAiDraft({
  prompt,
  referenceFiles,
  config,
  fallbackTemplateId
}: {
  prompt: string;
  referenceFiles: File[];
  config: BrowserAiConfig;
  fallbackTemplateId: TemplateId;
}): Promise<BrowserAiDraftResponse> {
  if (!config.apiKey || !config.model) {
    return {
      source: "local",
      configured: false,
      templateId: fallbackTemplateId,
      message: "Browser AI is not configured."
    };
  }

  const referenceImages = await Promise.all(referenceFiles.map(fileToReferenceImage));
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    {
      type: "text",
      text: [
        "Create a practical single-floor rectangular room layout for this 3D house editor.",
        "Return one compact JSON object only.",
        "All dimensions are meters. Rooms must be rectangles.",
        "Schema: {\"templateId\":\"compact-two-room\",\"projectName\":\"...\",\"address\":\"...\",\"bounds\":{\"width\":8.8,\"depth\":6.4,\"height\":2.9},\"orientation\":{\"facingDegrees\":135,\"frontDoorDegrees\":90},\"rooms\":[{\"name\":\"Living\",\"purpose\":\"living\",\"origin\":{\"x\":0.4,\"y\":0.4},\"width\":4.9,\"depth\":3.6,\"level\":1}],\"weather\":{\"windDirection\":135,\"windSpeed\":3.6,\"outdoorTemperature\":31},\"rationale\":\"...\",\"tags\":[\"...\"],\"confidence\":0.8}",
        `User request: ${prompt || "Use the reference images."}`
      ].join("\n")
    }
  ];

  referenceImages.forEach((image) => {
    content.push({ type: "image_url", image_url: { url: image.dataUrl } });
  });

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const path = config.chatCompletionsPath.startsWith("/")
      ? config.chatCompletionsPath
      : `/${config.chatCompletionsPath}`;
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }]
      }),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    const json = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const draft = parseJsonObject(extractMessageContent(json.choices?.[0]?.message?.content));
    if (!draft) {
      throw new Error("Provider returned non-JSON content");
    }

    const layout = buildLayoutFromDraft(draft, fallbackTemplateId);
    return {
      source: "provider",
      configured: true,
      templateId: layout.templateId,
      layout,
      message: "Browser AI generated an editable layout.",
      rationale: stringValue(draft.rationale),
      tags: Array.isArray(draft.tags) ? draft.tags.filter((item): item is string => typeof item === "string").slice(0, 8) : undefined,
      confidence: typeof draft.confidence === "number" ? Number(clamp(draft.confidence, 0, 1).toFixed(2)) : undefined,
      provider: {
        name: config.providerName || "openai-compatible",
        model: config.model,
        baseUrl: config.baseUrl
      }
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
