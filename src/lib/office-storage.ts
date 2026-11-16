import {
  AGENT_STATUSES,
  FURNITURE_STYLES,
  cloneAgents,
  cloneRooms,
  computeRoomPlacement,
  computeStationPosition,
  normalizeRoomName,
  type ActiveTask,
  type Agent,
  type AgentAvatar,
  type AgentRuntimeSource,
  type AgentStatus,
  type CompletedTask,
  type FurnitureStyle,
  type QuickAction,
  type Room,
} from "@/data/agents";
import type { CustomSkillDefinition } from "@/data/skills";

const STORAGE_KEY = "virtual-office-state-v2";
const LEGACY_STORAGE_KEY = "virtual-office-state-v1";
const VERSION = 2;
const MAX_COMPLETED_TASKS = 5;
const MAX_LOG_LENGTH = 800;

export interface PersistedOfficeState {
  version: typeof VERSION;
  savedAt: number;
  agents: Agent[];
  rooms: Room[];
  theme?: "day" | "night";
  sheetId?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStatus(value: unknown): value is AgentStatus {
  return typeof value === "string" && (AGENT_STATUSES as readonly string[]).includes(value);
}

function isFurnitureStyle(value: unknown): value is FurnitureStyle {
  return typeof value === "string" && (FURNITURE_STYLES as readonly string[]).includes(value);
}

function isSource(value: unknown): value is AgentRuntimeSource {
  return value === "gemini" || value === "local-runtime";
}

function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseActiveTask(value: unknown): ActiveTask | null {
  if (!isRecord(value)) return null;
  const titleAr = readText(value.titleAr, 200);
  if (!titleAr) return null;
  const durationMs = readNumber(value.durationMs);
  return {
    id: readText(value.id, 120),
    titleAr,
    progress: Math.min(100, Math.max(0, Math.round(readNumber(value.progress) ?? 0))),
    noteAr: readText(value.noteAr, 160) ?? "قيد التنفيذ",
    startedAt: readNumber(value.startedAt),
    durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
    startAr: readText(value.startAr, 300),
    completionAr: readText(value.completionAr, 300),
    logAr: readText(value.logAr, MAX_LOG_LENGTH),
    source: isSource(value.source) ? value.source : undefined,
  };
}

function parseCompletedTasks(value: unknown): CompletedTask[] {
  if (!Array.isArray(value)) return [];
  const tasks: CompletedTask[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = readText(entry.id, 120);
    const titleAr = readText(entry.titleAr, 200);
    if (!id || !titleAr) continue;
    tasks.push({
      id,
      titleAr,
      timeAr: readText(entry.timeAr, 60) ?? "سابقاً",
      outcome: entry.outcome === "error" ? "error" : "done",
      completedAt: readNumber(entry.completedAt),
      logAr: readText(entry.logAr, MAX_LOG_LENGTH),
      source: isSource(entry.source) ? entry.source : undefined,
    });
    if (tasks.length === MAX_COMPLETED_TASKS) break;
  }
  return tasks;
}

function parseQuickActions(value: unknown): QuickAction[] {
  if (!Array.isArray(value)) return [];
  const actions: QuickAction[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = readText(entry.id, 80);
    const labelAr = readText(entry.labelAr, 80);
    const command = readText(entry.command, 320);
    const hintAr = readText(entry.hintAr, 60) ?? "تشغيل";
    if (!id || !labelAr || !command) continue;
    actions.push({ id, labelAr, command, hintAr });
    if (actions.length >= 6) break;
  }
  return actions;
}

function parseCustomSkills(value: unknown): CustomSkillDefinition[] {
  if (!Array.isArray(value)) return [];
  const skills: CustomSkillDefinition[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = readText(entry.id, 80);
    const nameAr = readText(entry.nameAr, 80);
    const descriptionAr = readText(entry.descriptionAr, 240) ?? "";
    const promptInstruction = readText(entry.promptInstruction, 3000);
    if (!id || !nameAr || !promptInstruction) continue;
    const localPath = readText(entry.localPath, 200);
    const files = Array.isArray(entry.files)
      ? entry.files.filter((f): f is string => typeof f === "string" && f.length > 0 && f.length < 150)
      : undefined;

    skills.push({
      id,
      nameAr,
      descriptionAr: descriptionAr || promptInstruction.slice(0, 120),
      promptInstruction,
      format: entry.format === "json" ? "json" : "markdown",
      sourceUrl: readText(entry.sourceUrl, 250),
      installs:
        typeof entry.installs === "number" || typeof entry.installs === "string"
          ? entry.installs
          : undefined,
      localPath,
      files,
    });
    if (skills.length >= 24) break;
  }
  return skills;
}

function parseAvatar(value: unknown, fallback: AgentAvatar): AgentAvatar {
  if (!isRecord(value)) return { ...fallback };
  const style =
    value.style === "short" ||
    value.style === "long" ||
    value.style === "curly" ||
    value.style === "bun"
      ? value.style
      : fallback.style;
  const accessory =
    value.accessory === "none" ||
    value.accessory === "glasses" ||
    value.accessory === "headset" ||
    value.accessory === "beanie"
      ? value.accessory
      : fallback.accessory;
  return {
    skin: readText(value.skin, 24) ?? fallback.skin,
    skinShadow: readText(value.skinShadow, 24) ?? fallback.skinShadow,
    hair: readText(value.hair, 24) ?? fallback.hair,
    hairShadow: readText(value.hairShadow, 24) ?? fallback.hairShadow,
    shirt: readText(value.shirt, 24) ?? fallback.shirt,
    shirtShadow: readText(value.shirtShadow, 24) ?? fallback.shirtShadow,
    accent: readText(value.accent, 24) ?? fallback.accent,
    style,
    accessory,
    beard: typeof value.beard === "boolean" ? value.beard : fallback.beard,
  };
}

export function parseOfficeStatePayload(
  parsed: unknown,
  initialAgents: Agent[],
  initialRooms: Room[],
): { agents: Agent[]; rooms: Room[] } | null {
  if (
    !isRecord(parsed) ||
    parsed.version !== VERSION ||
    !Array.isArray(parsed.agents) ||
    !Array.isArray(parsed.rooms)
  ) {
    return null;
  }

  const baseGmAgent = initialAgents[0];
  const baseGmRoom = initialRooms[0];

  const rooms: Room[] = [];
  const roomNameMap = new Map<string, Room>();
  const roomIdMapping = new Map<string, string>();

  for (const entry of parsed.rooms) {
    if (!isRecord(entry)) continue;
    const id = readText(entry.id, 80);
    const nameAr = readText(entry.nameAr, 100);
    if (!id || !nameAr) continue;

    const normName = normalizeRoomName(nameAr);
    const existingRoom = normName ? roomNameMap.get(normName) : undefined;
    if (existingRoom) {
      roomIdMapping.set(id, existingRoom.id);
      if (Array.isArray(entry.agentIds)) {
        for (const rawAid of entry.agentIds) {
          if (typeof rawAid === "string" && rawAid.trim()) {
            const aid = rawAid.trim();
            if (!existingRoom.agentIds.includes(aid)) {
              existingRoom.agentIds.push(aid);
            }
          }
        }
      }
      continue;
    }

    const placement = computeRoomPlacement(rooms.length);
    const agentIds = Array.isArray(entry.agentIds)
      ? entry.agentIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
    const fallbackRoom = initialRooms.find((r) => r.id === id) ?? baseGmRoom;
    const newRoom: Room = {
      id,
      nameAr,
      shortNameAr: readText(entry.shortNameAr, 40) ?? nameAr.slice(0, 18),
      descriptionAr: readText(entry.descriptionAr, 240) ?? fallbackRoom.descriptionAr,
      rect: placement.rect,
      accent: readText(entry.accent, 24) ?? fallbackRoom.accent,
      furnitureStyle: isFurnitureStyle(entry.furnitureStyle)
        ? entry.furnitureStyle
        : fallbackRoom.furnitureStyle,
      agentIds,
    };
    rooms.push(newRoom);
    roomIdMapping.set(id, id);
    if (normName) {
      roomNameMap.set(normName, newRoom);
    }
  }

  if (rooms.length === 0) return null;

  const roomById = new Map(rooms.map((room, index) => [room.id, { room, index }]));
  const agents: Agent[] = [];

  for (const entry of parsed.agents) {
    if (!isRecord(entry)) continue;
    const id = readText(entry.id, 80);
    const nameAr = readText(entry.nameAr, 80);
    const roleAr = readText(entry.roleAr, 80);
    let roomId = readText(entry.roomId, 80);
    if (!id || !nameAr || !roleAr || !roomId) continue;

    if (roomIdMapping.has(roomId)) {
      roomId = roomIdMapping.get(roomId)!;
    }

    if (!roomById.has(roomId)) continue;

    const baseline = initialAgents.find((a) => a.id === id) ?? baseGmAgent;
    const roomMeta = roomById.get(roomId)!;
    const placement = computeRoomPlacement(roomMeta.index);
    const status = isStatus(entry.status) ? entry.status : "idle";
    const activeTask = parseActiveTask(entry.activeTask);
    const parsedActions = parseQuickActions(entry.quickActions);

    agents.push({
      id,
      nameAr,
      roleAr,
      roleEn: readText(entry.roleEn, 80) ?? baseline.roleEn,
      roomId,
      stationAr: readText(entry.stationAr, 80) ?? `محطة ${roleAr}`,
      status: status === "working" && !activeTask ? "idle" : status,
      statusNoteAr: readText(entry.statusNoteAr, 240) ?? baseline.statusNoteAr,
      activeTask,
      completedTasks: parseCompletedTasks(entry.completedTasks),
      quickActions: parsedActions.length > 0 ? parsedActions : baseline.quickActions.map((a) => ({ ...a })),
      rules: typeof entry.rules === "string" ? entry.rules.slice(0, 2000) : baseline.rules,
      skills: Array.isArray(entry.skills)
        ? entry.skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [...baseline.skills],
      customSkills: parseCustomSkills(entry.customSkills),
      avatar: parseAvatar(entry.avatar, baseline.avatar),
      position: placement.agentPosition,
    });
  }

  if (agents.length === 0) return null;

  for (const room of rooms) {
    const roomAgents = agents.filter((a) => a.roomId === room.id);
    room.agentIds = roomAgents.map((a) => a.id);
    const totalInRoom = roomAgents.length;
    roomAgents.forEach((agent, stationIdx) => {
      agent.position = computeStationPosition(room.rect, stationIdx, totalInRoom);
      if (totalInRoom > 1) {
        agent.stationAr = `محطة ${stationIdx + 1} · ${agent.roleAr}`;
      }
    });
  }

  if (agents.length === 0) return null;

  return {
    agents: cloneAgents(agents),
    rooms: cloneRooms(rooms),
  };
}

export function loadOfficeState(
  initialAgents: Agent[],
  initialRooms: Room[],
): { agents: Agent[]; rooms: Room[] } | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return parseOfficeStatePayload(parsed, initialAgents, initialRooms);
}

export function saveOfficeState(agents: Agent[], rooms: Room[]): void {
  if (typeof window === "undefined") return;

  const payload: PersistedOfficeState = {
    version: VERSION,
    savedAt: Date.now(),
    agents: cloneAgents(agents),
    rooms: cloneRooms(rooms),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be blocked or full; keep live UI running smoothly.
  }
}

export function clearOfficeState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export async function saveOfficeStateToServer(payload: {
  agents: Agent[];
  rooms: Room[];
  theme?: "day" | "night";
  sheetId?: string | null;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/office-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch (error) {
    console.error("Failed to save office state to server:", error);
    return false;
  }
}

export async function clearOfficeStateOnServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/office-state", {
      method: "DELETE",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch (error) {
    console.error("Failed to clear office state on server:", error);
    return false;
  }
}
