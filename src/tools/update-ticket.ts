// ============================================================
// Tool: glpi_update_ticket
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { PRIORITY_NAME_MAP, STATUS_NAME_MAP } from "../types.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to update."),
    title: z.string().optional().describe("New title for the ticket."),
    content: z.string().optional().describe("New description/content for the ticket."),
    status: z.enum(["new", "assigned", "planned", "waiting", "solved", "closed"]).optional().describe("New status."),
    priority: z.enum(["very_low", "low", "medium", "high", "very_high", "critical"]).optional().describe("New priority."),
};

export function registerUpdateTicket(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_update_ticket",
        {
            title: "Update GLPI Ticket",
            description: "Update fields of an existing ticket.",
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                const data: Record<string, any> = {};
                if (params.title) data.name = params.title;
                if (params.content) data.content = params.content;
                if (params.status) data.status = STATUS_NAME_MAP[params.status];
                if (params.priority) data.priority = PRIORITY_NAME_MAP[params.priority];

                await client.updateTicket(params.ticket_id, data);

                return {
                    content: [{ type: "text" as const, text: `Ticket #${params.ticket_id} atualizado com sucesso.` }],
                };
            } catch (err) {
                return { content: [{ type: "text" as const, text: `Erro: ${err}` }], isError: true };
            }
        }
    );
}
