// ============================================================
// Tool: glpi_list_search_options
// ============================================================
// This tool queries the GLPI API to discover ALL searchable
// fields for any itemtype, including linked items (antivirus,
// software, network ports, etc.). Essential for building
// advanced multi-criteria searches.
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { truncateIfNeeded } from "../services/formatting.js";

const InputSchema = {
  itemtype: z
    .string()
    .describe(
      "GLPI item type to list search options for (e.g. 'Computer', 'Ticket', 'User', 'Software', 'Printer', etc.)."
    ),
  filter: z
    .string()
    .optional()
    .describe(
      "Optional text to filter results. Only shows fields whose name or group contains this text. " +
      "Examples: 'antivirus', 'software', 'location', 'operating system', 'network'."
    ),
};

/** Parsed search option from the GLPI API */
interface SearchOption {
  id: number;
  name: string;
  group: string;
  field: string;
  table: string;
  datatype: string;
}

export function registerListSearchOptions(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_list_search_options",
    {
      title: "List GLPI Search Options",
      description: `Discover all searchable fields for any GLPI item type.

Returns the complete list of search option IDs, names, and data types available in the GLPI search engine. This is essential for building advanced queries with glpi_search, especially when you need fields beyond the commonly mapped ones (like antivirus status, installed software, network ports, etc.).

Use the 'filter' parameter to narrow results to a specific topic.

Args:
  - itemtype (string): The item type (e.g. 'Computer', 'Ticket')
  - filter (string, optional): Text filter to narrow results (e.g. 'antivirus', 'software', 'location')

Returns:
  Table of search option IDs, names, groups, and data types.

Examples:
  - "What fields can I search on Computer?" → itemtype="Computer"
  - "Find antivirus-related fields for Computer" → itemtype="Computer", filter="antivirus"
  - "What software fields are available?" → itemtype="Computer", filter="software"
  - "Show all ticket search fields related to SLA" → itemtype="Ticket", filter="sla"`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        // Call GLPI API: GET /listSearchOptions/{itemtype}
        const options = await client.getItems<Record<string, unknown>>(
          `listSearchOptions/${params.itemtype}`,
          {}
        );

        // Parse the response — GLPI returns a flat object keyed by option ID
        const parsed: SearchOption[] = [];
        for (const [key, val] of Object.entries(options)) {
          // Skip non-numeric keys (like "common" group headers)
          const id = Number(key);
          if (isNaN(id) || id <= 0) continue;

          if (typeof val === "object" && val !== null) {
            const opt = val as Record<string, unknown>;
            parsed.push({
              id,
              name: String(opt["name"] ?? ""),
              group: String(opt["group"] ?? ""),
              field: String(opt["field"] ?? ""),
              table: String(opt["table"] ?? ""),
              datatype: String(opt["datatype"] ?? ""),
            });
          }
        }

        if (parsed.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Nenhuma opção de busca encontrada para '${params.itemtype}'. Verifique se o tipo é válido.`,
              },
            ],
            isError: true,
          };
        }

        // Apply text filter if provided
        let filtered = parsed;
        if (params.filter) {
          const filterLower = params.filter.toLowerCase();
          filtered = parsed.filter(
            (opt) =>
              opt.name.toLowerCase().includes(filterLower) ||
              opt.group.toLowerCase().includes(filterLower) ||
              opt.field.toLowerCase().includes(filterLower) ||
              opt.table.toLowerCase().includes(filterLower)
          );

          if (filtered.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Nenhum campo encontrado contendo '${params.filter}' para ${params.itemtype}.\n\n` +
                    `Total de campos disponíveis: ${parsed.length}. ` +
                    `Tente um filtro mais genérico ou remova o filtro para ver todos.`,
                },
              ],
            };
          }
        }

        // Sort by group then ID for readability
        filtered.sort((a, b) => {
          const groupCmp = a.group.localeCompare(b.group);
          return groupCmp !== 0 ? groupCmp : a.id - b.id;
        });

        // Format output
        const lines = [
          `## Opções de Busca: ${params.itemtype}`,
          params.filter
            ? `_Filtrado por: "${params.filter}" — ${filtered.length} de ${parsed.length} campo(s)_`
            : `_${filtered.length} campo(s) disponíveis_`,
          "",
          "| ID | Campo | Grupo | Tipo |",
          "|----|-------|-------|------|",
        ];

        let currentGroup = "";
        for (const opt of filtered) {
          if (opt.group !== currentGroup) {
            currentGroup = opt.group;
          }
          lines.push(
            `| **${opt.id}** | ${opt.name} | ${opt.group} | ${opt.datatype} |`
          );
        }

        lines.push(
          "",
          "_Use o ID numérico no campo 'field' do glpi_search. Ex: criteria=[{field:\"" +
            filtered[0].id +
            '", value:"...", search_type:"contains"}]_'
        );

        return {
          content: [
            { type: "text" as const, text: truncateIfNeeded(lines.join("\n")) },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Erro ao listar opções de busca para ${params.itemtype}: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
