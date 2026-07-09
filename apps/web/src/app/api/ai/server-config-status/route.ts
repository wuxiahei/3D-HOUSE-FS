import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function readEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const requiredPassword = readEnv("AI_SERVER_PASSWORD");

  if (!requiredPassword) {
    return NextResponse.json(
      {
        ok: false,
        message: "服务器未配置 AI_SERVER_PASSWORD，暂不能启用服务器内置 AI。"
      },
      { status: 503 }
    );
  }

  if (!password || !secureEquals(password, requiredPassword)) {
    return NextResponse.json(
      {
        ok: false,
        message: "服务器密码错误，不能使用内置 AI 配置。"
      },
      { status: 401 }
    );
  }

  const apiKey = readEnv("AI_API_KEY") ?? readEnv("OPENAI_API_KEY");
  const model = readEnv("AI_MODEL");
  if (!apiKey || !model) {
    return NextResponse.json(
      {
        ok: false,
        message: "服务器已通过密码鉴权，但 AI_API_KEY / OPENAI_API_KEY 或 AI_MODEL 未配置完整。"
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "服务器内置 AI 配置可用。",
    provider: {
      name: (readEnv("AI_PROVIDER", "openai-compatible") ?? "openai-compatible").toLowerCase(),
      model
    }
  });
}
