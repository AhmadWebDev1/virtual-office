import fs from "node:fs";
import path from "node:path";
import { INITIAL_AGENTS, INITIAL_ROOMS, type Agent, type Room } from "@/data/agents";
import { parseOfficeStatePayload, type PersistedOfficeState } from "./office-storage";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "office-state.json");

export function getServerOfficeState(
  initialAgents: Agent[] = INITIAL_AGENTS,
  initialRooms: Room[] = INITIAL_ROOMS,
): PersistedOfficeState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    if (!raw.trim()) return null;

    const parsed = JSON.parse(raw);
    const parsedState = parseOfficeStatePayload(parsed, initialAgents, initialRooms);
    if (!parsedState) return null;

    return {
      version: 2,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      agents: parsedState.agents,
      rooms: parsedState.rooms,
      theme: parsed.theme === "night" ? "night" : "day",
      sheetId: typeof parsed.sheetId === "string" ? parsed.sheetId : null,
    };
  } catch (error) {
    console.error("Failed to read office-state.json:", error);
    return null;
  }
}

export function saveServerOfficeState(payload: {
  agents: Agent[];
  rooms: Room[];
  theme?: "day" | "night";
  sheetId?: string | null;
}): { ok: boolean; savedAt: number } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const savedAt = Date.now();
    const dataToSave: PersistedOfficeState = {
      version: 2,
      savedAt,
      agents: payload.agents,
      rooms: payload.rooms,
      theme: payload.theme ?? "day",
      sheetId: payload.sheetId ?? null,
    };

    const tmpFile = `${STATE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), "utf8");
    fs.renameSync(tmpFile, STATE_FILE);

    return { ok: true, savedAt };
  } catch (error) {
    console.error("Failed to save office-state.json:", error);
    return { ok: false, savedAt: 0 };
  }
}

export function clearServerOfficeState(): { ok: boolean } {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
    return { ok: true };
  } catch (error) {
    console.error("Failed to delete office-state.json:", error);
    return { ok: false };
  }
}
