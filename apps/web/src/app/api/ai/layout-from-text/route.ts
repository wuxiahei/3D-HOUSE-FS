import {
  createTemplateLayout,
  syncDerivedLayoutData,
  validateLayout
} from "@fengshui/core";
import type { HouseLayout, TemplateId } from "@fengshui/core";
import { NextResponse } from "next/server";

type AiSource = "provider" | "local" | "fallback";

interface AiDraftChoice {
  templateId: TemplateId;
  projectName?: string;
  rationale?: string;
  tags?: string[];
  confidence?: number;
}

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

const allowedTemplateIds: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];

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
  if (normalized.includes("空白") || normalized.includes("自定义") || normalized.includes("blank")) {
    return "blank";
  }
  return "compact-two-room";
}

function cleanProjectName(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 36) : fallback;
}

function normalizeTemplateId(value: unknown, fallback: TemplateId): TemplateId {
  if (typeof value !== "string") {
    return fallback;
  }
  return allowedTemplateIds.includes(value as TemplateId) ? (value as TemplateId) : fallback;
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

function readEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function buildLayout(choice: AiDraftChoice, source: AiSource): HouseLayout {
  const layout = syncDerivedLayoutData(createTemplateLayout(choice.templateId));
  return {
    ...layout,
    metadata: {
      ...layout.metadata,
      projectName: cleanProjectName(
        choice.projectName,
        `${source === "provider" ? "AI" : "本地"}草案 - ${layout.metadata.projectName}`
      )
    }
  };
}

function responseFor({
  source,
  configured,
  choice,
  message,
  provider
}: {
  source: AiSource;
  configured: boolean;
  choice: AiDraftChoice;
  message: string;
  provider?: AiDraftResponse["provider"];
}) {
  const layout = buildLayout(choice, source);
  const payload: AiDraftResponse = {
    source,
    configured,
    templateId: choice.templateId,
    layout,
    message,
    rationale: choice.rationale,
    tags: choice.tags,
    confidence: choice.confidence,
    validation: validateLayout(layout),
    provider
  };
  return NextResponse.json(payload);
}

async function askConfiguredProvider(prompt: string, fallbackTemplateId: TemplateId) {
  const providerName = (readEnv("AI_PROVIDER", "") ?? "").toLowerCase();
  const apiKey = readEnv("AI_API_KEY") ?? readEnv("OPENAI_API_KEY");
  const model = readEnv("AI_MODEL");
  const baseUrl = (readEnv("AI_BASE_URL", "https://api.openai.com/v1") ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const path = readEnv("AI_CHAT_COMPLETIONS_PATH", "/chat/completions") ?? "/chat/completions";
  const timeoutValue = Number(readEnv("AI_TIMEOUT_MS", "20000"));
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? Math.min(timeoutValue, 60000) : 20000;

  if (providerName === "local" || !apiKey || !model) {
    return null;
  }

  const provider = {
    name: providerName || "openai-compatible",
    model,
    baseUrl
  };

  const systemPrompt = [
    "You choose a legal starter template for a browser-based 3D house planner.",
    "Return only a compact JSON object.",
    "Allowed templateId values: blank, compact-two-room, family-three-room.",
    "Do not invent full geometry. The app will generate geometry locally.",
    "JSON schema: {\"templateId\":\"compact-two-room\",\"projectName\":\"...\",\"rationale\":\"...\",\"tags\":[\"...\"],\"confidence\":0.0}"
  ].join("\n");

  const response = await (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `用户户型需求：${prompt}\n请只选择最合适的 templateId，并给出短理由。`
            }
          ]
        }),
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`AI provider request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned empty content");
  }

  const parsed = parseJsonObject(content);
  if (!parsed) {
    throw new Error("AI provider returned non-JSON content");
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((item): item is string => typeof item === "string").slice(0, 6)
    : undefined;
  const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : undefined;

  return {
    provider,
    choice: {
      templateId: normalizeTemplateId(parsed.templateId, fallbackTemplateId),
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : undefined,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
      tags,
      confidence
    } satisfies AiDraftChoice
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const fallbackTemplateId = templateFromPrompt(prompt);

  if (!prompt) {
    return responseFor({
      source: "local",
      configured: false,
      choice: {
        templateId: fallbackTemplateId,
        rationale: "未输入需求，使用默认紧凑两居草案。"
      },
      message: "请输入 AI 建模需求后再生成草案。"
    });
  }

  try {
    const providerResult = await askConfiguredProvider(prompt, fallbackTemplateId);
    if (providerResult) {
      return responseFor({
        source: "provider",
        configured: true,
        choice: providerResult.choice,
        message: "已通过 AI 配置生成草案。",
        provider: providerResult.provider
      });
    }
  } catch (error) {
    return responseFor({
      source: "fallback",
      configured: true,
      choice: {
        templateId: fallbackTemplateId,
        rationale: error instanceof Error ? `AI 服务调用失败，已回落本地规则：${error.message}` : "AI 服务调用失败，已回落本地规则。"
      },
      message: "AI 服务暂不可用，已生成本地草案。"
    });
  }

  return responseFor({
    source: "local",
    configured: false,
    choice: {
      templateId: fallbackTemplateId,
      rationale: "未检测到 AI_API_KEY / OPENAI_API_KEY 和 AI_MODEL，使用本地启发式规则。"
    },
    message: "未配置 AI 服务，已生成本地草案。"
  });
}
