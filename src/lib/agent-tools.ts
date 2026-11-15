import type { FunctionDeclaration, Tool } from "@google/genai";
import type { AgentId } from "@/data/agents";

export interface AgentToolContext {
  agentId: AgentId;
  command: string;
}

export type AgentToolExecutor = (
  call: { name: string; args: Record<string, unknown> },
  context: AgentToolContext,
) => Promise<Record<string, unknown>>;

/**
 * One external integration exposed to a single agent.
 *
 * `declarations` are sent to Gemini, and `execute` runs a requested call and
 * returns JSON-serialisable output. Attach the Gmail MCP/API tool to `email`
 * and the Google Sheets tool to `finance` here; the runtime already sends the
 * declarations and resolves function calls before asking for the final answer.
 */
export interface AgentToolSet {
  declarations: FunctionDeclaration[];
  execute: AgentToolExecutor;
}

export const AGENT_TOOLS: Partial<Record<AgentId, AgentToolSet>> = {};

export function getToolConfig(agentId: AgentId): Tool[] {
  const toolSet = AGENT_TOOLS[agentId];
  if (!toolSet || toolSet.declarations.length === 0) return [];
  return [{ functionDeclarations: toolSet.declarations }];
}
