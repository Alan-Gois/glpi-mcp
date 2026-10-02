// ============================================================
// Tools: generic CRUD for any GLPI itemtype (legacy REST API)
// glpi_get_item, glpi_get_items, glpi_get_sub_items, glpi_get_multiple_items,
// glpi_add_items, glpi_update_items, glpi_delete_items (GLPI_ALLOW_DELETE)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { flattenParams } from "../services/query.js";
import { ToolPolicy } from "../security/policy.js";
import { errorResult, FieldsSchema, IdSchema, ItemtypeSchema, jsonResult, pickFields } from "./_shared.js";

const WITH_OPTIONS = [
  "devices", "disks", "softwares", "connections", "networkports", "infocoms", "contracts",
  "documents", "tickets", "problems", "changes", "notes", "logs",
] as const;

const ListSchema = {
  start: z.number().int().min(0).default(0).describe("First row (0-based)."),
  limit: z.number().int().min(1).max(1000).default(50).describe("Rows to return (max 1000)."),
  sort: z.string().regex(/^[a-z0-9_]+$/).optional().describe("Field name to sort by, e.g. date_mod, name, id."),
  order: z.enum(["ASC", "DESC"]).optional(),
  expand_dropdowns: z.boolean().default(true).describe("Show names instead of ids for dropdown fields."),
  fields: z.array(z.string()).optional().describe("Keep only these fields in the output."),
};

export const range = (start: number, limit: number) => `${start}-${start + limit - 1}`;

export function registerItemTools(server: McpServer, client: GlpiClient, policy: ToolPolicy): void {
  server.registerTool(
    "glpi_get_item",
    {
      title: "Get GLPI Item",
      description: "Get one item of any itemtype by id (GET /:itemtype/:id), optionally with related data.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        id: IdSchema.describe("Item id."),
        expand_dropdowns: z.boolean().default(true),
        with: z.array(z.enum(WITH_OPTIONS)).optional().describe("Related data to include (with_devices, with_logs...)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {
          expand_dropdowns: String(params.expand_dropdowns),
          get_hateoas: "false",
        };
        for (const w of params.with ?? []) query[`with_${w}`] = "true";
        return jsonResult(await client.getItem(params.itemtype, params.id, query));
      } catch (err) {
        return errorResult(`Error getting ${params.itemtype} ${params.id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_get_items",
    {
      title: "List GLPI Items",
      description:
        "List items of any itemtype with pagination (GET /:itemtype). Use search_text for LIKE filters per field " +
        "(e.g. {\"name\": \"printer\"}). For complex criteria use glpi_search.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        ...ListSchema,
        search_text: z.record(z.string()).optional().describe("Field → text filters (SQL LIKE)."),
        is_deleted: z.boolean().optional().describe("true to list items in the trash."),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const query = flattenParams({
          range: range(params.start, params.limit),
          sort: params.sort,
          order: params.order,
          expand_dropdowns: params.expand_dropdowns,
          get_hateoas: false,
          is_deleted: params.is_deleted,
          searchText: params.search_text,
        });
        const { items, range: r } = await client.listItems(params.itemtype, query);
        return jsonResult({
          itemtype: params.itemtype,
          total: r?.total ?? items.length,
          start: params.start,
          count: items.length,
          items: pickFields(items, params.fields),
        });
      } catch (err) {
        return errorResult(`Error listing ${params.itemtype}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_get_sub_items",
    {
      title: "List GLPI Sub-items",
      description:
        "List the sub-items of an item (GET /:itemtype/:id/:sub_itemtype), e.g. Ticket → ITILFollowup, " +
        "Project → ProjectTask, Computer → Item_Disk.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        id: IdSchema.describe("Parent item id."),
        sub_itemtype: ItemtypeSchema.describe("Sub itemtype, e.g. ITILFollowup, ProjectTask, Log."),
        ...ListSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const query = flattenParams({
          range: range(params.start, params.limit),
          sort: params.sort,
          order: params.order,
          expand_dropdowns: params.expand_dropdowns,
          get_hateoas: false,
        });
        const items = await client.getSubItems<Record<string, unknown>[]>(
          params.itemtype, params.id, params.sub_itemtype, query
        );
        const rows = Array.isArray(items) ? items : [];
        return jsonResult({ count: rows.length, items: pickFields(rows, params.fields) });
      } catch (err) {
        return errorResult(`Error listing ${params.sub_itemtype} of ${params.itemtype} ${params.id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_get_multiple_items",
    {
      title: "Get Multiple GLPI Items",
      description: "Get several items, possibly of different itemtypes, in one call (GET /getMultipleItems).",
      inputSchema: {
        items: z.array(z.object({ itemtype: ItemtypeSchema, id: IdSchema })).min(1).max(100),
        expand_dropdowns: z.boolean().default(true),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const result = await client.getMultipleItems(
          params.items.map((i) => ({ itemtype: i.itemtype, items_id: i.id })),
          { expand_dropdowns: String(params.expand_dropdowns), get_hateoas: "false" }
        );
        return jsonResult(result);
      } catch (err) {
        return errorResult("Error getting multiple items", err);
      }
    }
  );

  server.registerTool(
    "glpi_add_items",
    {
      title: "Create GLPI Items",
      description:
        "Create one or more items of any itemtype (POST /:itemtype). Field names are the GLPI database columns " +
        "(e.g. name, content, entities_id, *_id foreign keys). Returns the new ids.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        items: z.array(FieldsSchema).min(1).max(100).describe("One object per item to create."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (params) => {
      try {
        const input = params.items.length === 1 ? params.items[0] : params.items;
        return jsonResult(await client.addItems(params.itemtype, input), `Created ${params.itemtype}:`);
      } catch (err) {
        return errorResult(`Error creating ${params.itemtype}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_update_items",
    {
      title: "Update GLPI Items",
      description: "Update one or more items of any itemtype (PUT /:itemtype). Each object must include its id.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        items: z.array(z.object({ id: IdSchema }).passthrough()).min(1).max(100),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (params) => {
      try {
        return jsonResult(await client.updateItems(params.itemtype, params.items), `Updated ${params.itemtype}:`);
      } catch (err) {
        return errorResult(`Error updating ${params.itemtype}`, err);
      }
    }
  );

  if (policy.allowDelete) {
    server.registerTool(
      "glpi_delete_items",
      {
        title: "Delete GLPI Items",
        description:
          "Delete items (DELETE /:itemtype). By default items go to the trash when the itemtype supports it; " +
          "force_purge=true removes them permanently. Enabled only with GLPI_ALLOW_DELETE=true.",
        inputSchema: {
          itemtype: ItemtypeSchema,
          ids: z.array(IdSchema).min(1).max(100),
          force_purge: z.boolean().default(false).describe("Permanently delete instead of moving to the trash."),
          history: z.boolean().default(true).describe("Keep a history entry of the deletion."),
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      async (params) => {
        try {
          const result = await client.deleteItems(params.itemtype, params.ids, {
            forcePurge: params.force_purge,
            history: params.history,
          });
          return jsonResult(result, `${params.force_purge ? "Purged" : "Deleted"} ${params.itemtype}:`);
        } catch (err) {
          return errorResult(`Error deleting ${params.itemtype}`, err);
        }
      }
    );
  }
}
