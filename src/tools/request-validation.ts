// ============================================================
// Tool: glpi_request_validation
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to request validation for."),
    validator_id: z.number().int().positive().describe("The user ID of the person who must validate the ticket."),
    comment: z.string().optional().describe("Small message summarizing the validation request."),
};

export function registerRequestValidation(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_request_validation",
        {
            title: "Request Ticket Validation",
            description: `Send a validation request to a manager or supervisor for a specific ticket.

Validation is a key part of the ITIL process for approval before technical execution or closing a ticket.

Args:
  - ticket_id (number): The ticket ID to request validation for
  - validator_id (number): The user ID of the person who will validate (approve/refuse)
  - comment (string, optional): A text explaining why the validation is needed

Returns:
  Confirmation with the new validation ID.`,
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                const result = await client.createValidation(
                    params.ticket_id,
                    params.validator_id,
                    params.comment
                );

                const validationId = result.id;

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `✅ Solicitação de validação enviada com sucesso!\n\n**ID da Validação:** #${validationId}\n**Ticket:** #${params.ticket_id}\n**Validador (User ID):** ${params.validator_id}`,
                        },
                    ],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [
                        { type: "text" as const, text: `Erro ao solicitar validação: ${msg}` },
                    ],
                    isError: true,
                };
            }
        }
    );
}
