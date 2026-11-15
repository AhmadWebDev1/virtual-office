import {
  AGENT_STATUSES,
  cloneAgents,
  type ActiveTask,
  type Agent,
  type AgentRuntimeSource,
  type AgentStatus,
  type CompletedTask,
} from "@/data/agents";

const STORAGE_KEY = "virtual-office-state-v1";
const VERSION = 1;
const MAX_COMPLETED_TASKS = 5;
const MAX_LOG_LENGTH = 800;

interface PersistedAgentState {
  id: string;
  status: AgentStatus;
  statusNoteAr: string;
  activeTask: ActiveTask | null;
  completedTasks: CompletedTask[];
}

interface PersistedOfficeState {
  version: typeof VERSION;
  savedAt: number;
  agents: PersistedAgentState[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStatus(value: unknown): value is AgentStatus {
  return typeof value === "string" && (AGENT_STATUSES as readonly string[]).includes(value);
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

/**
 * Restores the dynamic part of the office from localStorage and merges it onto
 * the static agent definitions, so avatars and rooms always come from code.
 */
export function loadOfficeAgents(initialAgents: Agent[]): Agent[] | null {
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
  if (!isRecord(parsed) || parsed.version !== VERSION || !Array.isArray(parsed.agents)) {
    return null;
  }

  const saved = new Map<string, Record<string, unknown>>();
  for (const entry of parsed.agents) {
    if (isRecord(entry) && typeof entry.id === "string") saved.set(entry.id, entry);
  }
  if (saved.size === 0) return null;

  return cloneAgents(initialAgents).map((agent) => {
    const state = saved.get(agent.id);
    if (!state) return agent;

    const status = isStatus(state.status) ? state.status : agent.status;
    const activeTask = parseActiveTask(state.activeTask);

    return {
      ...agent,
      status: status === "working" && !activeTask ? "idle" : status,
      statusNoteAr: readText(state.statusNoteAr, 240) ?? agent.statusNoteAr,
      activeTask,
      completedTasks: parseCompletedTasks(state.completedTasks),
    };
  });
}

export function saveOfficeAgents(agents: Agent[]): void {
  if (typeof window === "undefined") return;

  const payload: PersistedOfficeState = {
    version: VERSION,
    savedAt: Date.now(),
    agents: agents.map(({ id, status, statusNoteAr, activeTask, completedTasks }) => ({
      id,
      status,
      statusNoteAr,
      activeTask,
      completedTasks,
    })),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be blocked or full (private mode); the live UI keeps working.
  }
}

export function clearOfficeState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
