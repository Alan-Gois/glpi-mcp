// ============================================================
// Tool: glpi_add_solution
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to solve."),
    content: z.string().min(5).describe("Detailed solution of the ticket."),
    solution_type: z.number().int().optional().describe("Solution type ID (optional)."),
};

export function registerAddSolution(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_add_solution",
        {
            title: "Add Solution to GLPI Ticket",
            description: "Mark a ticket as solved and provide the solution details.",
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                await client.addSolution(params.ticket_id, params.content, params.solution_type);

                return {
                    content: [{ type: "text" as const, text: `Ticket #${params.ticket_id} solucionado com sucesso.` }],
                };
            } catch (err) {
                return { content: [{ type: "text" as const, text: `Erro: ${err}` }], isError: true };
            }
        }
    );
}
