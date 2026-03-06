// ============================================================
// Tool: glpi_search
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { truncateIfNeeded } from "../services/formatting.js";

/**
 * Common search option IDs by itemtype.
 * GLPI uses numeric field IDs for search — these are the most useful ones.
 * Full list available at: GET /listSearchOptions/{itemtype}
 */
const COMMON_SEARCH_FIELDS: Record<string, Record<string, number>> = {
  Ticket: {
    id: 2,
    name: 1,
    status: 12,
    priority: 3,
    requester: 4,
    technician: 5,
    group: 8,
    content: 21,
    category: 7,
    date_creation: 15,
    date_mod: 19,
    entity: 80,
    location: 83,
  },
  Computer: {
    id: 2,
    name: 1,
    status: 31,
    location: 3,
    type: 4,
    model: 40,
    serial: 5,
    os: 45,
    manufacturer: 23,
    user: 70,
    group: 71,
    entity: 80,
    ip: 126,
    mac: 21,
  },
  User: {
    id: 2,
    name: 1,
    realname: 9,
    firstname: 34,
    email: 5,
    phone: 6,
    location: 3,
    profile: 20,
    group: 13,
    entity: 80,
    active: 8,
  },
  Software: {
    id: 2,
    name: 1,
    publisher: 23,
    category: 10,
    entity: 80,
  },
  NetworkEquipment: {
    id: 2,
    name: 1,
    location: 3,
    type: 4,
    model: 40,
    serial: 5,
    ip: 126,
    entity: 80,
  },
  Monitor: {
    id: 2,
    name: 1,
    location: 3,
    type: 4,
    model: 40,
    serial: 5,
    manufacturer: 23,
    user: 70,
    entity: 80,
  },
  Printer: {
    id: 2,
    name: 1,
    location: 3,
    serial: 5,
    entity: 80,
  },
};

const SUPPORTED_ITEMTYPES = Object.keys(COMMON_SEARCH_FIELDS);

const InputSchema = {
  itemtype: z
    .string()
    .describe(
      `The GLPI item type to search. Supported: ${SUPPORTED_ITEMTYPES.join(", ")}. ` +
      `Use 'Ticket' for helpdesk tickets, 'Computer' for workstations/servers, 'User' for people, etc.`
    ),
  query: z
    .string()
    .min(1)
    .describe(
      "Search text to match. Searches across the item's name/title field by default."
    ),
  field: z
    .string()
    .optional()
    .describe(
      "Specific field to search in (e.g. 'name', 'serial', 'location', 'email'). " +
      "Defaults to 'name'. Available fields depend on the itemtype."
    ),
  search_type: z
    .enum(["contains", "equals", "notcontains", "notequals", "under", "notunder"])
    .default("contains")
    .describe("How to match the query: 'contains' for partial match, 'equals' for exact."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum results to return (1-100)."),
};

export function registerSearch(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_search",
    {
      title: "Search GLPI Items",
      description: `Search for any type of item in GLPI (tickets, computers, users, software, etc.).

Uses GLPI's search engine to find items matching your criteria. Each item type has different searchable fields.

Supported item types: ${SUPPORTED_ITEMTYPES.join(", ")}

Common field names by type:
  - Ticket: name, status, priority, requester, technician, group, content, category, entity, location
  - Computer: name, status, location, type, model, serial, os, manufacturer, user, group, ip, mac
  - User: name, realname, firstname, email, phone, location, profile, group, active
  - Software: name, publisher, category

Args:
  - itemtype (string): Item type to search (e.g. 'Computer', 'Ticket', 'User')
  - query (string): Search text
  - field (string, optional): Field to search in (default: 'name')
  - search_type: Match type — 'contains' (default) or 'equals'
  - limit (number): Max results (default: 25)

Returns:
  Formatted list of matching items.

Examples:
  - "Find computers in Finance department" → itemtype="Computer", query="Finance", field="location"
  - "Search for user named João" → itemtype="User", query="João", field="realname"
  - "List all HP printers" → itemtype="Printer", query="HP"`,
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

        // Validate itemtype
        const fieldMap = COMMON_SEARCH_FIELDS[itemtype];
        if (!fieldMap) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unsupported item type: '${itemtype}'. Supported types: ${SUPPORTED_ITEMTYPES.join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        // Resolve field name to numeric ID
        const fieldName = params.field ?? "name";
        const fieldId = fieldMap[fieldName];
        if (fieldId === undefined) {
          const available = Object.keys(fieldMap).join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown field '${fieldName}' for ${itemtype}. Available fields: ${available}`,
              },
            ],
            isError: true,
          };
        }

        // Build forcedisplay to get useful columns
        const displayFields = Object.values(fieldMap).slice(0, 8);
        const forcedisplay = displayFields.join(",");

        const result = await client.search(
          itemtype,
          [
            {
              field: fieldId,
              searchtype: params.search_type,
              value: params.query,
            },
          ],
          {
            range: `0-${params.limit - 1}`,
            forcedisplay: forcedisplay,
          }
        );

        const data = result.data ?? [];
        const total = result.totalcount ?? data.length;

        if (data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No ${itemtype} items found matching '${params.query}' in field '${fieldName}'.`,
              },
            ],
          };
        }

        // Format results as a readable table
        const lines = [
          `## Search Results: ${itemtype}`,
          `_Found ${total} result(s), showing ${data.length}_`,
          `_Filter: ${fieldName} ${params.search_type} "${params.query}"_`,
          "",
        ];

        // Build a mapping from field ID to field name for readable output
        const idToName: Record<string, string> = {};
        for (const [name, id] of Object.entries(fieldMap)) {
          idToName[String(id)] = name;
        }

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
            { type: "text" as const, text: `Error searching ${params.itemtype}: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );
}
