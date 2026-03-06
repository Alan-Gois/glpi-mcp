// ============================================================
// GLPI MCP Server — Formatting Utilities
// ============================================================

import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  GlpiTicket,
} from "../types.js";

/** Maximum characters in a single tool response */
export const CHARACTER_LIMIT = 50_000;

/** Strip HTML tags from GLPI content fields */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Format a ticket as a readable summary line */
export function formatTicketSummary(ticket: Record<string, unknown>): string {
  const id = ticket["id"] ?? ticket["2"] ?? "?";
  const name = ticket["name"] ?? ticket["1"] ?? "Sem título";
  const status = resolveLabel(
    ticket["status"] ?? ticket["12"],
    TICKET_STATUS_LABELS
  );
  const priority = resolveLabel(
    ticket["priority"] ?? ticket["3"],
    TICKET_PRIORITY_LABELS
  );
  const date =
    (ticket["date_creation"] as string) ?? (ticket["15"] as string) ?? "";

  return `#${id} [${status}] (${priority}) ${name} — ${date}`;
}

/** Format a full ticket detail view */
export function formatTicketDetail(ticket: GlpiTicket): string {
  const lines: string[] = [
    `# Chamado #${ticket.id}: ${ticket.name}`,
    "",
    `**Status:** ${TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}`,
    `**Prioridade:** ${TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}`,
    `**Tipo:** ${TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}`,
    `**Criado em:** ${ticket.date_creation}`,
    `**Última atualização:** ${ticket.date_mod}`,
  ];

  if (ticket.solvedate) lines.push(`**Solucionado em:** ${ticket.solvedate}`);
  if (ticket.closedate) lines.push(`**Fechado em:** ${ticket.closedate}`);

  lines.push("", "## Descrição", "", stripHtml(ticket.content));

  return lines.join("\n");
}

/** Format followups for display */
export function formatFollowups(
  followups: Array<Record<string, unknown>>
): string {
  if (!followups.length) return "\n_Nenhum acompanhamento registrado._";

  const lines = ["\n## Acompanhamentos", ""];
  for (const fu of followups) {
    const date = fu["date_creation"] ?? "";
    const user = fu["users_id"] ?? "Desconhecido";
    const priv = fu["is_private"] === 1 ? " [PRIVADO]" : "";
    const content = stripHtml(String(fu["content"] ?? ""));
    lines.push(`**${date}** — Usuário #${user}${priv}`);
    lines.push(content);
    lines.push("---");
  }
  return lines.join("\n");
}

/** Resolve a numeric code to its label */
function resolveLabel(
  value: unknown,
  labels: Record<number, string>
): string {
  if (typeof value === "number") return labels[value] ?? String(value);
  if (typeof value === "string") {
    // If it's already a resolved label from expand_dropdowns, return as-is
    const num = Number(value);
    if (!isNaN(num) && labels[num]) return labels[num];
    return value;
  }
  return "Unknown";
}

/** Truncate text if it exceeds the character limit */
export function truncateIfNeeded(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT - 100) +
    "\n\n... [Resposta truncada. Use filtros mais específicos para reduzir os resultados.]"
  );
}
