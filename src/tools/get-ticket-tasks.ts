// ============================================================
// Tool: glpi_get_ticket_tasks
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to list tasks for."),
};

export function registerGetTicketTasks(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_get_ticket_tasks",
        {
            title: "Get GLPI Ticket Tasks",
            description: "List all tasks planned or done for a ticket.",
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                const tasks = await client.getTicketTasks(params.ticket_id);

                if (tasks.length === 0) {
                    return {
                        content: [
                            { type: "text" as const, text: `Nenhuma tarefa encontrada para o ticket #${params.ticket_id}.` },
                        ],
                    };
                }

                const formattedTasks = tasks.map((t) => {
                    const stateLabel = t.state === 0 ? "Informação" : t.state === 1 ? "A fazer" : t.state === 2 ? "Concluída" : "Desconhecido";
                    return [
                        `**ID da Tarefa:** #${t.id}`,
                        `**Status:** ${stateLabel}`,
                        `**Conteúdo:** ${t.content || "(vazio)"}`,
                        `**Duração:** ${t.actiontime || 0}s`,
                        `-----------------------------------`,
                    ].join("\n");
                }).join("\n\n");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `### Tarefas do Ticket #${params.ticket_id}\n\n${formattedTasks}`,
                        },
                    ],
                };
            } catch (err) {
                return { content: [{ type: "text" as const, text: `Erro: ${err}` }], isError: true };
            }
        }
    );
}
