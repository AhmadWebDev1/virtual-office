import type { AgentId, AgentRuntimeSource, FurnitureStyle, RoomId } from "@/data/agents";
import type { CustomSkillDefinition } from "@/data/skills";

export type CommandTarget = AgentId | "auto";

type WorkspaceConfirmToolName =
  | "create_email_draft"
  | "trash_emails"
  | "log_expense_or_invoice";

export interface PendingWorkspaceConfirmation {
  toolName: WorkspaceConfirmToolName;
  titleAr: string;
  descriptionAr: string;
  details: Array<{ labelAr: string; value: string }>;
  args: Record<string, unknown>;
  targetAgentId?: AgentId;
}

export interface RoomPromptProfile {
  id: RoomId;
  nameAr: string;
  shortNameAr: string;
  furnitureStyle?: FurnitureStyle;
  agentIds: AgentId[];
  rules?: string;
  skills?: string[];
}

export interface AgentPromptProfile {
  id: AgentId;
  nameAr: string;
  roleAr: string;
  roleEn: string;
  roomId?: RoomId;
  roomNameAr?: string;
  rules: string;
  skills: string[];
  customSkills?: CustomSkillDefinition[];
  xp?: number;
  level?: number;
}

export interface CreatedAgentSpec {
  id?: string;
  targetRoomId?: RoomId;
  nameAr: string;
  roleAr: string;
  roleEn?: string;
  roomNameAr: string;
  rules: string;
  skills: string[];
  themeColor: string;
  furnitureStyle: FurnitureStyle;
}

export interface AgentCommandRequest {
  target: CommandTarget;
  command: string;
  agents?: AgentPromptProfile[];
  rooms?: RoomPromptProfile[];
  globalRules?: string;
  globalSkills?: string[];
  sandboxMode?: boolean;
  hopCount?: number;
  googleAccessToken?: string;
  sheetId?: string;
  confirmAction?: {
    toolName: WorkspaceConfirmToolName;
    args: Record<string, unknown>;
    targetAgentId?: AgentId;
  };
}

export interface AgentTaskPlan {
  id: string;
  titleAr: string;
  durationMs: number;
}

export interface AgentCommandMessages {
  /** Short Arabic line shown in the agent speech bubble while working. */
  startAr: string;
  /** Short Arabic line shown in the speech bubble when the task completes. */
  completionAr: string;
  /** Detailed Arabic summary for logs and task receipts. */
  logAr: string;
}

export interface AgentCommandResponse {
  ok: true;
  requestId: string;
  agentId: AgentId;
  routedBy: AgentId | null;
  task: AgentTaskPlan;
  messages: AgentCommandMessages;
  source: AgentRuntimeSource;
  createdAgent?: CreatedAgentSpec;
  createdAgents?: CreatedAgentSpec[];
  createdSheetId?: string;
  createdSheetUrl?: string;
  authExpired?: boolean;
  pendingConfirmation?: PendingWorkspaceConfirmation;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
  loopBreakerTriggered?: boolean;
}

export interface AgentCommandError {
  ok: false;
  error: string;
}
