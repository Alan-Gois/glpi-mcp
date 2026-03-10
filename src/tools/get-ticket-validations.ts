// ============================================================
// Tool: glpi_get_ticket_validations
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { VALIDATION_STATUS_LABELS } from "../types.js";

const InputSchema = {
    ticket_id: z.number().int().positive().describe("The ID of the ticket to list validations for."),
};

export function registerGetTicketValidations(server: McpServer, client: GlpiClient): void {
    server.registerTool(
        "glpi_get_ticket_validations",
        {
            title: "Get Ticket Validations",
            description: `List all approval requests associated with a single ticket. This allows AI to check if a ticket is waiting for validation or has already been approved/refused.

Args:
  - ticket_id (number): The ticket ID to list validations for

Returns:
  A list of validations with IDs, status, and comments.`,
            inputSchema: InputSchema,
        },
        async (params) => {
            try {
                const validations = await client.getValidations(params.ticket_id);

                if (validations.length === 0) {
                    return {
                        content: [
                            { type: "text" as const, text: `Nenhuma solicitação de validação encontrada para o ticket #${params.ticket_id}.` },
                        ],
                    };
                }

                const formattedValidations = validations.map((v) => {
                    const statusLabel = VALIDATION_STATUS_LABELS[v.status as number] || "Desconhecido";
                    return [
                        `**ID da Validação:** #${v.id}`,
                        `**Status:** ${statusLabel}`,
                        `**Validador (User ID):** ${v.users_id_validate}`,
                        `**Comentário (Solicitação):** ${v.comment_submission || "(vazio)"}`,
                        `**Comentário (Resposta):** ${v.comment_validation || "(vazio)"}`,
                        `-----------------------------------`,
                    ].join("\n");
                }).join("\n\n");

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `### Validações do Ticket #${params.ticket_id}\n\n${formattedValidations}`,
                        },
                    ],
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [
                        { type: "text" as const, text: `Erro ao buscar validações: ${msg}` },
                    ],
                    isError: true,
                };
            }
        }
    );
}
