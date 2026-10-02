// ============================================================
// Tool: glpi_submit_form
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    form_id: z.number().int().positive().describe("The ID of the form to submit."),
    answers: z.record(z.string(), z.any()).describe("A map where keys are Question IDs (as strings) and values are the answers."),
};

export function registerSubmitForm(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_submit_form",
        {
            title: "Submit GLPI Form",
            description: `Submit a structured request via a GLPI 11 native form.

This tool sends user answers to a specific form, which in turn creates a Ticket or Change in GLPI according to the form's target configuration.

Args:
  - form_id: The ID of the form.
  - answers: An object where keys are the Question IDs and values are the user inputs.

Example:
  answers = { "1": "3", "6": "Reparo de impressora", "7": "A impressora do RH parou." }`,
            inputSchema: InputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false },
        },
        async (params) => {
            try {
                // Convert the record to the array format expected by the client
                const answersArray = Object.entries(params.answers).map(([id, value]) => ({
                    questions_id: parseInt(id),
                    value: value
                }));

                const result = await client.submitForm(params.form_id, answersArray);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Formulário submetido com sucesso!\nID da Submissão: ${result.id}\n${result.message || ""}`
                        }
                    ],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Erro ao submeter formulário: ${msg}\n\nNota: Verifique se o usuário possui permissão para criar AnswersSet no GLPI 11.`
                        }
                    ],
                    isError: true,
                };
            }
        }
    );
}
