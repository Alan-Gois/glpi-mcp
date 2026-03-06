// ============================================================
// Tool: glpi_list_tickets
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { STATUS_NAME_MAP } from "../types.js";
import {
  formatTicketSummary,
  truncateIfNeeded,
} from "../services/formatting.js";

const InputSchema = {
  status: z
    .enum(["all", "new", "assigned", "planned", "waiting", "solved", "closed"])
    .default("all")
    .describe("Filter tickets by status. Use 'all' for every status."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum number of tickets to return (1-100)."),
};

export function registerListTickets(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_list_tickets",
    {
      title: "List GLPI Tickets",
      description: `List tickets from the GLPI helpdesk with optional status filter.

Returns a formatted list of tickets showing ID, status, priority, title, and creation date.

Args:
  - status: Filter by ticket status (new, assigned, planned, waiting, solved, closed, or all)
  - limit: Max results to return (default: 25, max: 100)

Returns:
  Formatted ticket list with summary for each ticket.

Examples:
  - "Show me open tickets" → status="new"
  - "List all waiting tickets" → status="waiting"
  - "Show last 10 tickets" → limit=10`,
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
        const statusCode =
          params.status === "all" ? undefined : STATUS_NAME_MAP[params.status];

        const tickets = await client.listTickets(statusCode, params.limit);

        if (!tickets || tickets.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No tickets found${params.status !== "all" ? ` with status '${params.status}'` : ""}.`,
              },
            ],
          };
        }

        const lines = [
          `## GLPI Tickets${params.status !== "all" ? ` (${params.status})` : ""}`,
          `_Showing ${tickets.length} ticket(s)_`,
          "",
        ];

        for (const ticket of tickets) {
          lines.push(formatTicketSummary(ticket as Record<string, unknown>));
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(lines.join("\n")) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error listing tickets: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
