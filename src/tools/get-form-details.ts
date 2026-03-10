// ============================================================
// Tool: glpi_get_form_details
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    form_id: z.number().int().positive().describe("The ID of the form to retrieve details for."),
};

export function registerGetFormDetails(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_get_form_details",
        {
            title: "Get GLPI Form Details",
            description: `Retrieve the full configuration of a GLPI 11 native form, including questions and sections.

This tool is essential for the AI to understand what questions/fields a user needs to fill to submit a request via the service catalog.

Args:
  - form_id: The ID of the form.

Returns:
  A detailed breakdown of the form's structure and fields.`,
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                const details = await client.getFormDetails(params.form_id);

                const lines = [
                    `## Detalhes do Formulário: ${details.form.name}`,
                    `ID: ${details.form.id}`,
                    details.form.description ? `\n> ${details.form.description}\n` : "",
                    "### Campos do Formulário",
                    "",
                ];

                if (details.questions.length === 0) {
                    lines.push("_Este formulário não possui perguntas ou as perguntas não foram localizadas._");
                } else {
                    // Group by section if available
                    const sectionsMap: Record<number, string> = {};
                    details.sections.forEach(s => sectionsMap[s.id] = s.name);

                    // Sort questions by rank
                    const sortedQuestions = [...details.questions].sort((a, b) => (a.rank as number) - (b.rank as number));

                    let currentSectionId = -1;

                    for (const q of sortedQuestions) {
                        const sectionId = q.forms_sections_id as number;
                        if (sectionId !== currentSectionId) {
                            const sectionName = sectionsMap[sectionId] || "Principal";
                            lines.push(`\n**Seção: ${sectionName}**`);
                            currentSectionId = sectionId;
                        }

                        const required = q.is_required ? " (Obrigatório)" : "";
                        const type = q.field_type ? ` [Tipo: ${q.field_type}]` : "";
                        lines.push(`- **${q.name}**${required}${type}${q.description ? `: ${q.description}` : ""}`);
                    }
                }

                return {
                    content: [{ type: "text" as const, text: lines.join("\n") }],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text" as const, text: `Erro ao obter detalhes do formulário: ${msg}` }],
                    isError: true,
                };
            }
        }
    );
}
