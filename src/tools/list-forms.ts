// ============================================================
// Tool: glpi_list_forms
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Maximum number of forms to return (1-100)."),
};

export function registerListForms(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_list_forms",
        {
            title: "List GLPI Service Catalog Forms",
            description: `Discover available native forms in the GLPI 11 service catalog.

Returns a list of forms with their ID, name, and description. This is the first step to guide a user through a structured request.

Args:
  - limit: Max results to return (default: 25, max: 100)

Returns:
  Formatted list of available forms.`,
            inputSchema: InputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
        },
        async (params) => {
            try {
                const forms = await client.listForms({
                    range: `0-${params.limit - 1}`,
                });

                if (!forms || forms.length === 0) {
                    return {
                        content: [{ type: "text" as const, text: "Nenhum formulário ativo encontrado no catálogo de serviços." }],
                    };
                }

                const lines = [
                    "## Catálogo de Serviços (Formulários)",
                    `_Exibindo ${forms.length} formulário(s) disponível(is)_`,
                    "",
                    "| ID | Nome | Descrição |",
                    "|---|---|---|",
                ];

                for (const form of forms) {
                    const desc = form.description ? form.description.replace(/\n/g, " ").substring(0, 100) : "(Sem descrição)";
                    lines.push(`| ${form.id} | **${form.name}** | ${desc} |`);
                }

                return {
                    content: [{ type: "text" as const, text: lines.join("\n") }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text" as const, text: `Erro ao listar formulários: ${msg}` }],
                    isError: true,
                };
            }
        }
    );
}
