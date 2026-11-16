import { NextResponse } from "next/server";
import { GM_AGENT_ID } from "@/data/agents";
import type { CustomSkillDefinition } from "@/data/skills";
import type {
  AgentCommandError,
  AgentCommandRequest,
  AgentPromptProfile,
  RoomPromptProfile,
} from "@/lib/agent-contracts";
import { executeAgentCommand } from "@/lib/agent-runtime";

const MAX_COMMAND_LENGTH = 500;
const MAX_SHEET_ID_LENGTH = 140;
const MAX_AGENTS_IN_ROSTER = 24;

function errorResponse(message: string, status: number) {
  return NextResponse.json<AgentCommandError>(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parseBearerToken(headerValue: string | null): string | undefined {
  if (!headerValue) return undefined;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : undefined;
}

function isValidAgentIdToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{1,64}$/i.test(value.trim());
}

function parseCustomSkills(raw: unknown): CustomSkillDefinition[] {
  if (!Array.isArray(raw)) return [];
  const items: CustomSkillDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id.trim().slice(0, 80) : "";
    const nameAr = typeof obj.nameAr === "string" ? obj.nameAr.trim().slice(0, 80) : "";
    const promptInstruction =
      typeof obj.promptInstruction === "string" ? obj.promptInstruction.trim().slice(0, 3000) : "";
    const descriptionAr =
      typeof obj.descriptionAr === "string" ? obj.descriptionAr.trim().slice(0, 240) : "";
    if (!id || !nameAr || !promptInstruction) continue;
    items.push({
      id,
      nameAr,
      descriptionAr,
      promptInstruction,
      format: obj.format === "json" ? "json" : "markdown",
      sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl.trim().slice(0, 250) : undefined,
      installs:
        typeof obj.installs === "number" || typeof obj.installs === "string"
          ? obj.installs
          : undefined,
    });
    if (items.length >= 24) break;
  }
  return items;
}

function parseAgentsRoster(raw: unknown): AgentPromptProfile[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: AgentPromptProfile[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    if (!isValidAgentIdToken(obj.id)) continue;
    const id = obj.id.trim();
    const nameAr = typeof obj.nameAr === "string" ? obj.nameAr.trim().slice(0, 80) : "";
    const roleAr = typeof obj.roleAr === "string" ? obj.roleAr.trim().slice(0, 80) : "";
    const roleEn = typeof obj.roleEn === "string" ? obj.roleEn.trim().slice(0, 80) : "";
    if (!nameAr || !roleAr) continue;
    result.push({
      id,
      nameAr,
      roleAr,
      roleEn: roleEn || roleAr,
      roomId: typeof obj.roomId === "string" ? obj.roomId.trim().slice(0, 64) : undefined,
      roomNameAr: typeof obj.roomNameAr === "string" ? obj.roomNameAr.trim().slice(0, 100) : undefined,
      rules: typeof obj.rules === "string" ? obj.rules.trim().slice(0, 2000) : "",
      skills: Array.isArray(obj.skills)
        ? obj.skills
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim().slice(0, 60))
            .slice(0, 24)
        : [],
      customSkills: parseCustomSkills(obj.customSkills),
    });
    if (result.length >= MAX_AGENTS_IN_ROSTER) break;
  }
  return result.length > 0 ? result : undefined;
}

function parseRooms(raw: unknown): RoomPromptProfile[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: RoomPromptProfile[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id.trim().slice(0, 64) : "";
    const nameAr = typeof obj.nameAr === "string" ? obj.nameAr.trim().slice(0, 80) : "";
    const shortNameAr =
      typeof obj.shortNameAr === "string" && obj.shortNameAr.trim()
        ? obj.shortNameAr.trim().slice(0, 40)
        : nameAr.slice(0, 18);
    const furnitureStyle =
      obj.furnitureStyle === "tech" ||
      obj.furnitureStyle === "creative" ||
      obj.furnitureStyle === "finance" ||
      obj.furnitureStyle === "admin"
        ? obj.furnitureStyle
        : undefined;
    if (!id || !nameAr) continue;
    const agentIds = Array.isArray(obj.agentIds)
      ? obj.agentIds
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim().slice(0, 64))
      : [];
    const rules = typeof obj.rules === "string" ? obj.rules.trim().slice(0, 2000) : undefined;
    const skills = Array.isArray(obj.skills)
      ? obj.skills
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim().slice(0, 60))
      : undefined;
    result.push({
      id,
      nameAr,
      shortNameAr,
      furnitureStyle,
      agentIds,
      rules,
      skills,
    });
    if (result.length >= 24) break;
  }
  return result.length > 0 ? result : undefined;
}

function parseConfirmAction(raw: unknown): AgentCommandRequest["confirmAction"] | null {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const toolName = obj.toolName;
  if (
    toolName !== "create_email_draft" &&
    toolName !== "trash_emails" &&
    toolName !== "log_expense_or_invoice"
  ) {
    return null;
  }
  if (!obj.args || typeof obj.args !== "object" || Array.isArray(obj.args)) {
    return null;
  }
  return {
    toolName,
    args: obj.args as Record<string, unknown>,
    ...(isValidAgentIdToken(obj.targetAgentId) ? { targetAgentId: obj.targetAgentId.trim() } : {}),
  };
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
  const agents = parseAgentsRoster(payload.agents);
  const rawTarget = payload.target ?? "auto";
  const targetStr = typeof rawTarget === "string" ? rawTarget.trim() : "";

  const isAllowedTarget =
    targetStr === "auto" ||
    targetStr === GM_AGENT_ID ||
    targetStr === "email" ||
    targetStr === "finance" ||
    (isValidAgentIdToken(targetStr) && (!agents || agents.some((a) => a.id === targetStr)));

  const target = isAllowedTarget ? targetStr : null;
  const command = typeof payload.command === "string" ? payload.command.trim() : "";
  const sheetId =
    typeof payload.sheetId === "string" && payload.sheetId.trim().length > 0
      ? payload.sheetId.trim().slice(0, MAX_SHEET_ID_LENGTH)
      : undefined;
  const confirmAction = parseConfirmAction(payload.confirmAction);

  if (!target) {
    return errorResponse("الوكيل المحدد غير موجود.", 400);
  }

  if (confirmAction === null) {
    return errorResponse("بيانات تأكيد الإجراء غير صالحة.", 400);
  }

  if (!command && !confirmAction) {
    return errorResponse("اكتب أمراً أولاً حتى يستلمه الوكيل.", 422);
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    return errorResponse(`الأمر طويل جداً. اختصره إلى ${MAX_COMMAND_LENGTH} حرفاً أو أقل.`, 422);
  }

  const googleAccessToken = parseBearerToken(request.headers.get("authorization"));

  const result = await executeAgentCommand({
    target,
    command:
      command ||
      (confirmAction?.toolName === "create_email_draft"
        ? "تأكيد إنشاء مسودة بريد"
        : confirmAction?.toolName === "trash_emails"
          ? "تأكيد نقل الرسائل إلى سلة المهملات"
          : "تأكيد تسجيل عملية مالية"),
    agents,
    rooms: parseRooms(payload.rooms),
    globalRules:
      typeof payload.globalRules === "string" ? payload.globalRules.trim().slice(0, 3000) : undefined,
    globalSkills: Array.isArray(payload.globalSkills)
      ? payload.globalSkills
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim().slice(0, 60))
      : undefined,
    sandboxMode: Boolean(payload.sandboxMode),
    hopCount: typeof payload.hopCount === "number" ? payload.hopCount : 0,
    googleAccessToken,
    sheetId,
    confirmAction,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
      "X-Agent-Runtime": result.source,
    },
  });
}
