import { NextResponse } from "next/server";
import { isAgentId } from "@/data/agents";
import type { AgentCommandError } from "@/lib/agent-contracts";
import { executeAgentCommand } from "@/lib/agent-runtime";

const MAX_COMMAND_LENGTH = 320;

function errorResponse(message: string, status: number) {
  return NextResponse.json<AgentCommandError>(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("تعذّر قراءة الطلب. تأكد من إرسال JSON صالح.", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("صيغة الطلب غير صحيحة.", 400);
  }

  const payload = body as Record<string, unknown>;
  const rawTarget = payload.target ?? "auto";
  const target = rawTarget === "auto" || isAgentId(rawTarget) ? rawTarget : null;
  const command = typeof payload.command === "string" ? payload.command.trim() : "";

  if (!target) {
    return errorResponse("الوكيل المحدد غير موجود.", 400);
  }

  if (!command) {
    return errorResponse("اكتب أمراً أولاً حتى يستلمه الوكيل.", 422);
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    return errorResponse("الأمر طويل جداً. اختصره إلى 320 حرفاً أو أقل.", 422);
  }

  const result = await executeAgentCommand({ target, command });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
      "X-Agent-Runtime": result.source,
    },
  });
}
