import type { AgentId, AgentRuntimeSource } from "@/data/agents";

export type CommandTarget = AgentId | "auto";

export interface AgentCommandRequest {
  target: CommandTarget;
  command: string;
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
}

export interface AgentCommandError {
  ok: false;
  error: string;
}
