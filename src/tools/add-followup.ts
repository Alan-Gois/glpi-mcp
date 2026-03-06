// ============================================================
// Tool: glpi_add_followup
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
  ticket_id: z
    .number()
    .int()
    .positive()
    .describe("The ID of the ticket to add a followup to."),
  content: z
    .string()
    .min(1, "Content cannot be empty")
    .describe("The followup message content. Supports plain text."),
  is_private: z
    .boolean()
    .default(false)
    .describe("If true, the followup is only visible to technicians (not the requester)."),
};

export function registerAddFollowup(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_add_followup",
    {
      title: "Add Followup to GLPI Ticket",
      description: `Add a followup message to an existing GLPI ticket.

Followups are messages added to the ticket timeline. They can be public (visible to the requester) or private (technicians only). GLPI notifications will be triggered automatically.

Args:
  - ticket_id (number): The ticket ID to add the followup to
  - content (string): The message text
  - is_private (boolean): Make it a private note (default: false)

Returns:
  Confirmation with the followup ID.

Examples:
  - "Reply to ticket 42: the issue has been resolved" → ticket_id=42, content="The issue has been resolved."
  - "Add private note to ticket 100" → ticket_id=100, content="...", is_private=true`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await client.addFollowup(
          params.ticket_id,
          params.content,
          params.is_private
        );

        const followupId =
          result.id ?? (result as Record<string, unknown>)["id"];
        const visibility = params.is_private ? "private" : "public";

        return {
          content: [
            {
              type: "text" as const,
              text: `Followup added successfully!\n\n**Followup ID:** ${followupId}\n**Ticket:** #${params.ticket_id}\n**Visibility:** ${visibility}\n**Content:** ${params.content.slice(0, 200)}${params.content.length > 200 ? "..." : ""}`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding followup to ticket #${params.ticket_id}: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
