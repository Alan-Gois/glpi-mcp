// ============================================================
// Tool: glpi_add_task
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to add a task to."),
    content: z.string().min(3).describe("Description of the task."),
    status: z.enum(["info", "todo", "done"]).default("todo").describe("State: info (0), todo (1), done (2)."),
    duration: z.number().int().positive().optional().describe("Task duration in seconds."),
};

export function registerAddTask(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_add_task",
        {
            title: "Add Task to GLPI Ticket",
            description: "Create a technical task linked to a ticket.",
            inputSchema: InputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false },
        },
        async (params) => {
            try {
                const stateCodeMap = { info: 0, todo: 1, done: 2 };

                await client.addTask(params.ticket_id, params.content, {
                    state: stateCodeMap[params.status],
                    actiontime: params.duration,
                });

                return {
                    content: [{ type: "text" as const, text: `Tarefa adicionada com sucesso ao Ticket #${params.ticket_id}.` }],
                };
            } catch (err) {
                return { content: [{ type: "text" as const, text: `Erro: ${err}` }], isError: true };
            }
        }
    );
}
