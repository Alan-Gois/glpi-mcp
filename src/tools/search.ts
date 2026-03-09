// ============================================================
// Tool: glpi_search (v2 — Multi-criteria AND/OR)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { truncateIfNeeded } from "../services/formatting.js";

/**
 * Common search option IDs by itemtype.
 * For the complete list, use glpi_list_search_options.
 */
const COMMON_SEARCH_FIELDS: Record<string, Record<string, number>> = {
  Ticket: {
    id: 2, name: 1, status: 12, priority: 3, requester: 4,
    technician: 5, group: 8, content: 21, category: 7,
    date_creation: 15, date_mod: 19, entity: 80, location: 83,
  },
  Computer: {
    id: 2, name: 1, status: 31, location: 3, type: 4, model: 40,
    serial: 5, os: 45, manufacturer: 23, user: 70, group: 71,
    entity: 80, ip: 126, mac: 21,
  },
  User: {
    id: 2, name: 1, realname: 9, firstname: 34, email: 5, phone: 6,
    location: 3, profile: 20, group: 13, entity: 80, active: 8,
  },
  Software: {
    id: 2, name: 1, publisher: 23, category: 10, entity: 80,
  },
  NetworkEquipment: {
    id: 2, name: 1, location: 3, type: 4, model: 40, serial: 5,
    ip: 126, entity: 80,
  },
  Monitor: {
    id: 2, name: 1, location: 3, type: 4, model: 40, serial: 5,
    manufacturer: 23, user: 70, entity: 80,
  },
  Printer: {
    id: 2, name: 1, location: 3, serial: 5, entity: 80,
  },
};

const SUPPORTED_ITEMTYPES = Object.keys(COMMON_SEARCH_FIELDS);

const CriterionSchema = z.object({
  field: z
    .string()
    .describe(
      "Field name (e.g. 'name', 'location', 'status') or numeric GLPI search option ID as string (e.g. '45'). " +
      "Use glpi_list_search_options to discover all field IDs including linked items."
    ),
  value: z.string().describe("Value to search for in this field."),
  search_type: z
    .enum(["contains", "equals", "notcontains", "notequals", "under", "notunder"])
    .default("contains")
    .describe("Match type: 'contains' for partial, 'equals' for exact."),
  link: z
    .enum(["AND", "OR", "AND NOT", "OR NOT"])
    .default("AND")
    .describe("Logical operator to combine with previous criterion. Ignored for the first criterion."),
});

const InputSchema = {
  itemtype: z
    .string()
    .describe(
      `GLPI item type to search. Common: ${SUPPORTED_ITEMTYPES.join(", ")}. ` +
      `Any valid GLPI itemtype name is accepted.`
    ),
  criteria: z
    .array(CriterionSchema)
    .min(1)
    .max(10)
    .describe(
      "One or more search criteria combined with AND/OR logic. " +
      "Example: [{field:'location', value:'Finance'}, {field:'os', value:'Windows', link:'AND'}]"
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(25)
    .describe("Maximum results (1-200, default: 25)."),
};

type CriterionInput = z.infer<typeof CriterionSchema>;

export function registerSearch(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_search",
    {
      title: "Search GLPI Items",
      description: `Search for items in GLPI using one or more criteria combined with AND/OR logic.

Supports complex queries like "computers in location X with OS Y" or "high priority tickets assigned to group Z that are not closed".

Common item types: ${SUPPORTED_ITEMTYPES.join(", ")}

Commonly mapped field names (use glpi_list_search_options for ALL fields):
  - Ticket: name, status, priority, requester, technician, group, content, category, entity, location
  - Computer: name, status, location, type, model, serial, os, manufacturer, user, group, ip, mac
  - User: name, realname, firstname, email, phone, location, profile, group, active

You can also use numeric field IDs directly (e.g. field:"45"). Run glpi_list_search_options first to discover ALL searchable fields including linked items like antivirus, software versions, installed software, network ports, etc.

Args:
  - itemtype: Item type (e.g. 'Computer', 'Ticket')
  - criteria: Array of conditions [{field, value, search_type, link}]
  - limit: Max results (default: 25)

Examples:
  - Single: criteria=[{field:"location", value:"Finance"}]
  - AND: criteria=[{field:"location", value:"Finance"}, {field:"os", value:"Windows", link:"AND"}]
  - OR: criteria=[{field:"name", value:"SRV"}, {field:"name", value:"DC", link:"OR"}]
  - Numeric ID: criteria=[{field:"45", value:"Windows 11"}]
  - NOT: criteria=[{field:"status", value:"Closed", search_type:"notequals"}]`,
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
        const itemtype = params.itemtype;
        const fieldMap = COMMON_SEARCH_FIELDS[itemtype] ?? {};

        // Resolve each criterion's field name → numeric ID
        const resolvedCriteria = params.criteria.map(
          (c: CriterionInput, index: number) => {
            let fieldId: number;

            // Try as numeric ID first
            const numericId = Number(c.field);
            if (!isNaN(numericId) && numericId > 0) {
              fieldId = numericId;
            } else if (fieldMap[c.field] !== undefined) {
              fieldId = fieldMap[c.field];
            } else {
              const available = Object.keys(fieldMap);
              const hint = available.length > 0
                ? `Campos conhecidos: ${available.join(", ")}.`
                : `Tipo '${itemtype}' não tem campos pré-mapeados.`;
              return {
                error: `Campo '${c.field}' não encontrado para ${itemtype}. ${hint} ` +
                  `Use glpi_list_search_options(itemtype="${itemtype}") para ver todos os campos e IDs.`,
              };
            }

            return {
              field: fieldId,
              searchtype: c.search_type,
              value: c.value,
              ...(index > 0 ? { link: c.link } : {}),
            };
          }
        );

        // Check for resolution errors
        const errors = resolvedCriteria.filter(
          (c): c is { error: string } => "error" in c
        );
        if (errors.length > 0) {
          return {
            content: [
              { type: "text" as const, text: errors.map((e) => e.error).join("\n") },
            ],
            isError: true,
          };
        }

        const validCriteria = resolvedCriteria as Array<{
          field: number;
          searchtype: string;
          value: string;
          link?: string;
        }>;

        // Build forcedisplay columns
        const displayFields = Object.values(fieldMap).slice(0, 8);
        const forcedisplay =
          displayFields.length > 0 ? displayFields.join(",") : "1,2,80";

        const result = await client.search(itemtype, validCriteria, {
          range: `0-${params.limit - 1}`,
          forcedisplay,
        });

        const data = result.data ?? [];
        const total = result.totalcount ?? data.length;

        // Human-readable criteria description
        const criteriaDesc = params.criteria
          .map(
            (c: CriterionInput, i: number) =>
              `${i > 0 ? c.link + " " : ""}${c.field} ${c.search_type} "${c.value}"`
          )
          .join(" ");

        if (data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Nenhum item ${itemtype} encontrado para: ${criteriaDesc}.\n\n` +
                  `Dicas:\n` +
                  `- Verifique a ortografia e nomenclatura exata usada no GLPI\n` +
                  `- Use glpi_list_search_options para ver todos os campos disponíveis\n` +
                  `- Tente search_type:"contains" para buscas parciais\n` +
                  `- Verifique se o usuário da API tem permissão para visualizar esses itens`,
              },
            ],
          };
        }

        // Build field ID → name mapping for readable output
        const idToName: Record<string, string> = {};
        for (const [name, id] of Object.entries(fieldMap)) {
          idToName[String(id)] = name;
        }

        const lines = [
          `## Resultados da Busca: ${itemtype}`,
          `_${total} resultado(s), exibindo ${data.length}_`,
          `_Filtro: ${criteriaDesc}_`,
          "",
        ];

        for (const row of data) {
          const parts: string[] = [];
          for (const [key, value] of Object.entries(row)) {
            const label = idToName[key] ?? key;
            if (value !== null && value !== undefined && value !== "") {
              parts.push(`**${label}:** ${value}`);
            }
          }
          lines.push(parts.join(" | "));
          lines.push("");
        }

        return {
          content: [
            { type: "text" as const, text: truncateIfNeeded(lines.join("\n")) },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: `Erro ao buscar ${params.itemtype}: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );
}
