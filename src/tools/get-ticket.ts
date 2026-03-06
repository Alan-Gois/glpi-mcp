// ============================================================
// Tool: glpi_get_ticket
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import {
  formatTicketDetail,
  formatFollowups,
  truncateIfNeeded,
} from "../services/formatting.js";

const InputSchema = {
  ticket_id: z
    .number()
    .int()
    .positive()
    .describe("The ID of the ticket to retrieve (e.g. 42)."),
  include_followups: z
    .boolean()
    .default(true)
    .describe("Whether to include followups/timeline in the response."),
};

export function registerGetTicket(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_get_ticket",
    {
      title: "Get GLPI Ticket Details",
      description: `Retrieve complete details of a specific GLPI ticket by its ID.

Returns ticket metadata (status, priority, type, dates) plus the full description and optionally the followup timeline.

Args:
  - ticket_id (number): The GLPI ticket ID
  - include_followups (boolean): Include followup messages (default: true)

Returns:
  Full ticket detail in markdown format with description and timeline.

Examples:
  - "Show me ticket #42" → ticket_id=42
  - "What's the status of ticket 150?" → ticket_id=150
  - "Get ticket 99 without followups" → ticket_id=99, include_followups=false`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const ticket = await client.getTicket(params.ticket_id);
        let output = formatTicketDetail(ticket);

        if (params.include_followups) {
          try {
            const followups = await client.getTicketFollowups(params.ticket_id);
            output += formatFollowups(followups as Array<Record<string, unknown>>);
          } catch {
            output += "\n\n_Could not retrieve followups._";
          }
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(output) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving ticket #${params.ticket_id}: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
