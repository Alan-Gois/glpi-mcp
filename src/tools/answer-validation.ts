// ============================================================
// Tool: glpi_answer_validation
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { ValidationStatus } from "../types.js";

const InputSchema = {
    validation_id: z.number().int().positive().describe("The ID of the validation record to answer."),
    status: z.enum(["approve", "refuse"]).describe("The validation result."),
    comment: z.string().optional().describe("Comment or explanation for the approval or refusal."),
};

export function registerAnswerValidation(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_answer_validation",
        {
            title: "Approve or Refuse Ticket Validation",
            description: `Answer an existing ticket validation request. This allows a supervisor or technical manager to confirm or reject a ticket's proposed path or completion.

Args:
  - validation_id (number): The specific ID of the validation request to answer
  - status ('approve' | 'refuse'): The result
  - comment (string, optional): A text explanation of the validation result

Returns:
  Confirmation that the validation has been processed.`,
            inputSchema: InputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false },
        },
        async (params) => {
            try {
                const statusCode = params.status === "approve" ? ValidationStatus.APPROVED : ValidationStatus.REFUSED;

                await client.updateValidation(
                    params.validation_id,
                    statusCode,
                    params.comment
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `✅ Validação #${params.validation_id} respondida com sucesso!\n\n**Resultado:** ${params.status.toUpperCase()}\n\nO status do chamado será atualizado de acordo com as regras de negócio do GLPI.`,
                        },
                    ],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [
                        { type: "text" as const, text: `Erro ao responder validação: ${msg}` },
                    ],
                    isError: true,
                };
            }
        }
    );
}
