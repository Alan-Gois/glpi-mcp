// ============================================================
// Tools: massive actions (legacy REST API)
// glpi_massive_actions_list, glpi_massive_action_parameters,
// glpi_massive_action_apply (GLPI_ALLOW_MASSIVE; delete/purge also need GLPI_ALLOW_DELETE)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { ToolPolicy } from "../security/policy.js";
import { errorResult, FieldsSchema, IdSchema, ItemtypeSchema, jsonResult } from "./_shared.js";

const ActionKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_\\]+:[A-Za-z0-9_]+$/, "Massive action key, e.g. MassiveAction:update")
  .describe("Action key from glpi_massive_actions_list, e.g. MassiveAction:update.");

/** Actions that move items to the trash or delete them for good */
export const isDeleteAction = (key: string): boolean => /:(delete|purge|delete_\w*|purge_\w*)$/i.test(key);

const enc = encodeURIComponent;

export function registerMassiveActionTools(server: McpServer, client: GlpiClient, policy: ToolPolicy): void {
  server.registerTool(
    "glpi_massive_actions_list",
    {
      title: "List GLPI Massive Actions",
      description:
        "List the massive actions available for an itemtype, or for one item when id is given " +
        "(GET /getMassiveActions/:itemtype[/:id]).",
      inputSchema: {
        itemtype: ItemtypeSchema,
        id: IdSchema.optional().describe("Item id (actions available for this item)."),
        is_deleted: z.boolean().default(false).describe("Actions for items in the trash."),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const path = `getMassiveActions/${enc(params.itemtype)}${params.id ? `/${params.id}` : ""}`;
        const result = await client.callEndpoint("GET", path, undefined, { is_deleted: params.is_deleted ? "1" : "0" });
        return jsonResult(result);
      } catch (err) {
        return errorResult(`Error listing massive actions of ${params.itemtype}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_massive_action_parameters",
    {
      title: "Get GLPI Massive Action Parameters",
      description: "Get the input fields a massive action expects (GET /getMassiveActionParameters/:itemtype/:action).",
      inputSchema: { itemtype: ItemtypeSchema, action: ActionKeySchema },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const result = await client.callEndpoint("GET", `getMassiveActionParameters/${enc(params.itemtype)}/${enc(params.action)}`);
        return jsonResult(result);
      } catch (err) {
        return errorResult(`Error getting parameters of ${params.action}`, err);
      }
    }
  );

  if (!policy.allowMassive) return;

  server.registerTool(
    "glpi_massive_action_apply",
    {
      title: "Apply GLPI Massive Action",
      description:
        "Apply a massive action to an explicit list of item ids (POST /applyMassiveAction/:itemtype/:action). " +
        "Check glpi_massive_action_parameters first. Enabled only with GLPI_ALLOW_MASSIVE=true; delete/purge " +
        "actions also require GLPI_ALLOW_DELETE=true.",
      inputSchema: {
        itemtype: ItemtypeSchema,
        action: ActionKeySchema,
        ids: z.array(IdSchema).min(1).max(500).describe("Explicit item ids (max 500)."),
        input: FieldsSchema.optional().describe("Action parameters."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (params) => {
      try {
        if (isDeleteAction(params.action) && !policy.allowDelete) {
          return errorResult(`Action ${params.action} not allowed`, "delete/purge actions require GLPI_ALLOW_DELETE=true");
        }
        const result = await client.callEndpoint(
          "POST",
          `applyMassiveAction/${enc(params.itemtype)}/${enc(params.action)}`,
          { ids: params.ids, input: params.input ?? {} }
        );
        return jsonResult(result, `${params.action} applied to ${params.ids.length} ${params.itemtype}:`);
      } catch (err) {
        return errorResult(`Error applying ${params.action}`, err);
      }
    }
  );
}
