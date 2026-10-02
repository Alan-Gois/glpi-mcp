// ============================================================
// Tool: glpi_create_problem
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { PRIORITY_NAME_MAP } from "../types.js";

const InputSchema = {
    title: z.string().min(3).describe("Short summary of the problem."),
    content: z.string().min(10).describe("Detailed description of the problem."),
    priority: z.enum(["very_low", "low", "medium", "high", "very_high", "critical"]).default("medium").describe("Priority."),
};

export function registerCreateProblem(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_create_problem",
        {
            title: "Create GLPI Problem",
            description: "Report a new ITIL Problem in GLPI.",
            inputSchema: InputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false },
        },
        async (params) => {
            try {
                const priorityCode = PRIORITY_NAME_MAP[params.priority] ?? 3;

                const result = await client.createProblem({
                    name: params.title,
                    content: params.content,
                    priority: priorityCode,
                });

                return {
                    content: [{ type: "text" as const, text: `Problema #${result.id} registrado com sucesso!` }],
                };
            } catch (err) {
                return { content: [{ type: "text" as const, text: `Erro: ${err}` }], isError: true };
            }
        }
    );
}
