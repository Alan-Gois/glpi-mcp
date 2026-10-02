// ============================================================
// GLPI MCP Server — Guarded tool registration
// Every tool goes through here: the policy decides whether it is registered,
// and every result and error message is passed through secret masking.
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { maskText } from "./mask.js";
import { isToolAllowed, ToolPolicy } from "./policy.js";

type ToolConfig = { annotations?: { readOnlyHint?: boolean } };
type ToolContent = { type: string; text?: string };
type ToolResult = { content?: ToolContent[]; isError?: boolean };
type Handler = (...args: unknown[]) => Promise<ToolResult> | ToolResult;

export interface GuardStats {
  registered: string[];
  skipped: string[];
}

/** Mask secrets in every text block of a tool result */
export function maskResult(result: ToolResult): ToolResult {
  if (!result?.content) return result;
  return {
    ...result,
    content: result.content.map((c) => (typeof c.text === "string" ? { ...c, text: maskText(c.text) } : c)),
  };
}

/**
 * Patch server.registerTool so tools are filtered by the policy and outputs are masked.
 * Tools without readOnlyHint=true are treated as write tools (safe default).
 */
export function guardServer(server: McpServer, policy: ToolPolicy): GuardStats {
  const stats: GuardStats = { registered: [], skipped: [] };
  const original = server.registerTool.bind(server) as (...args: unknown[]) => unknown;

  server.registerTool = ((name: string, config: ToolConfig, handler: Handler) => {
    const readOnlyHint = config?.annotations?.readOnlyHint === true;
    if (!isToolAllowed(policy, name, readOnlyHint)) {
      stats.skipped.push(name);
      return undefined;
    }
    stats.registered.push(name);
    const wrapped: Handler = async (...args) => {
      try {
        return maskResult(await handler(...args));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: maskText(`Error in ${name}: ${msg}`) }], isError: true };
      }
    };
    return original(name, config, wrapped);
  }) as unknown as typeof server.registerTool;

  return stats;
}
