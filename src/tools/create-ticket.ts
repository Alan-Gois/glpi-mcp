// ============================================================
// Tool: glpi_create_ticket
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { PRIORITY_NAME_MAP } from "../types.js";

const InputSchema = {
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(255)
    .describe("Short title summarizing the issue or request."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .describe("Detailed description of the issue or request. Supports plain text."),
  type: z
    .enum(["incident", "request"])
    .default("incident")
    .describe("Ticket type: 'incident' for a problem, 'request' for a service request."),
  priority: z
    .enum(["very_low", "low", "medium", "high", "very_high", "critical"])
    .default("medium")
    .describe("Priority level for the ticket."),
  category_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("ITIL category ID (optional). Use glpi_search to find valid category IDs."),
  entity_id: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Entity ID to create the ticket in (optional, defaults to user's active entity)."),
};

export function registerCreateTicket(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_create_ticket",
    {
      title: "Create GLPI Ticket",
      description: `Create a new ticket (incident or request) in the GLPI helpdesk.

The ticket will be created using the permissions of the authenticated API user. Business rules, SLAs, and notifications configured in GLPI will be applied automatically.

Args:
  - title (string): Short summary of the issue (3-255 chars)
  - description (string): Full description of the issue (min 10 chars)
  - type ('incident' | 'request'): Ticket type (default: incident)
  - priority: Priority level (default: medium)
  - category_id (number, optional): ITIL category ID
  - entity_id (number, optional): Target entity ID

Returns:
  Confirmation with the new ticket ID.

Examples:
  - "Open a ticket: printer not working in HR" → title="Printer not working in HR", description="...", type="incident"
  - "Create a request for new laptop" → title="New laptop request", type="request"`,
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
        const typeCode = params.type === "request" ? 2 : 1;
        const priorityCode = PRIORITY_NAME_MAP[params.priority] ?? 3;

        const result = await client.createTicket({
          name: params.title,
          content: params.description,
          type: typeCode,
          priority: priorityCode,
          urgency: priorityCode,
          itilcategories_id: params.category_id,
          entities_id: params.entity_id,
        });

        const ticketId = result.id ?? (result as Record<string, unknown>)["id"];

        return {
          content: [
            {
              type: "text" as const,
              text: `Chamado criado com sucesso!\n\n**ID do Chamado:** #${ticketId}\n**Título:** ${params.title}\n**Tipo:** ${params.type === "request" ? "Requisição" : "Incidente"}\n**Prioridade:** ${params.priority}\n\nPara visualizar: glpi_get_ticket(ticket_id=${ticketId})`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: `Erro ao criar chamado: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );
}
