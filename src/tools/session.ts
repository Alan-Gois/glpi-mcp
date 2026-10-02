// ============================================================
// Tools: session, profiles, entities and configuration (legacy REST API)
// glpi_get_my_profiles, glpi_get_active_profile, glpi_change_active_profile,
// glpi_get_my_entities, glpi_get_active_entities, glpi_change_active_entities,
// glpi_get_full_session, glpi_get_glpi_config
// lostPassword is intentionally not exposed (it sends password reset e-mails).
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { maskSecrets } from "../security/mask.js";
import { errorResult, IdSchema, jsonResult } from "./_shared.js";

type Row = Record<string, unknown>;

/** Keep only the given top-level keys (all when none given) */
export function pickKeys(obj: Row, keys?: string[]): Row {
  if (!keys || keys.length === 0) return obj;
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

const KeysSchema = z
  .array(z.string())
  .optional()
  .describe("Return only these keys (the full object is large). Secrets are always masked.");

/** GLPI answers `false` (HTTP 200) when it refuses a profile/entity change */
export function ensureAccepted(result: unknown, what: string): void {
  if (result === false) {
    throw new Error(`GLPI refused to change the ${what} (not allowed for this user/profile).`);
  }
}

// Changing the active profile/entity only affects the API session, not GLPI data.
const SESSION_HINTS = { readOnlyHint: true, idempotentHint: true } as const;

export function registerSessionTools(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_get_my_profiles",
    {
      title: "Get My GLPI Profiles",
      description: "List the profiles of the API user, with the entities of each profile (GET /getMyProfiles).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const r = await client.callEndpoint<{ myprofiles?: Row[] }>("GET", "getMyProfiles");
        return jsonResult(maskSecrets(r.myprofiles ?? r));
      } catch (err) {
        return errorResult("Error getting profiles", err);
      }
    }
  );

  server.registerTool(
    "glpi_get_active_profile",
    {
      title: "Get Active GLPI Profile",
      description: "Get the active profile of the session (GET /getActiveProfile). include_rights adds the rights matrix.",
      inputSchema: { include_rights: z.boolean().default(false) },
      annotations: { readOnlyHint: true },
    },
    async ({ include_rights }) => {
      try {
        const r = await client.callEndpoint<{ active_profile?: Row }>("GET", "getActiveProfile");
        const p = r.active_profile ?? {};
        const out = include_rights ? p : pickKeys(p, ["id", "name", "interface", "is_default", "comment"]);
        return jsonResult(maskSecrets(out));
      } catch (err) {
        return errorResult("Error getting active profile", err);
      }
    }
  );

  server.registerTool(
    "glpi_change_active_profile",
    {
      title: "Change Active GLPI Profile",
      description: "Switch the session to another profile of the API user (POST /changeActiveProfile).",
      inputSchema: { profiles_id: IdSchema.describe("Profile id (see glpi_get_my_profiles).") },
      annotations: SESSION_HINTS,
    },
    async ({ profiles_id }) => {
      try {
        ensureAccepted(await client.callEndpoint("POST", "changeActiveProfile", { profiles_id }), "active profile");
        return jsonResult({ active_profile: profiles_id }, "Active profile changed:");
      } catch (err) {
        return errorResult("Error changing active profile", err);
      }
    }
  );

  server.registerTool(
    "glpi_get_my_entities",
    {
      title: "Get My GLPI Entities",
      description: "List the entities the API user can access (GET /getMyEntities).",
      inputSchema: { is_recursive: z.boolean().default(true).describe("Include child entities.") },
      annotations: { readOnlyHint: true },
    },
    async ({ is_recursive }) => {
      try {
        const r = await client.callEndpoint<{ myentities?: Row[] }>("GET", "getMyEntities", undefined, {
          is_recursive: is_recursive ? "1" : "0",
        });
        return jsonResult(r.myentities ?? r);
      } catch (err) {
        return errorResult("Error getting entities", err);
      }
    }
  );

  server.registerTool(
    "glpi_get_active_entities",
    {
      title: "Get Active GLPI Entities",
      description: "Get the active entity and the entities currently in scope (GET /getActiveEntities).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const r = await client.callEndpoint<{ active_entity?: Row }>("GET", "getActiveEntities");
        return jsonResult(r.active_entity ?? r);
      } catch (err) {
        return errorResult("Error getting active entities", err);
      }
    }
  );

  server.registerTool(
    "glpi_change_active_entities",
    {
      title: "Change Active GLPI Entities",
      description: "Change the active entity of the session, or \"all\" (POST /changeActiveEntities).",
      inputSchema: {
        entities_id: z.union([z.number().int().min(0), z.literal("all")]).describe("Entity id or \"all\"."),
        is_recursive: z.boolean().default(false).describe("Include child entities."),
      },
      annotations: SESSION_HINTS,
    },
    async ({ entities_id, is_recursive }) => {
      try {
        ensureAccepted(
          await client.callEndpoint("POST", "changeActiveEntities", { entities_id, is_recursive }),
          "active entities"
        );
        const active = await client.callEndpoint("GET", "getActiveEntities");
        return jsonResult((active as { active_entity?: unknown }).active_entity ?? active, "Active entities changed:");
      } catch (err) {
        return errorResult("Error changing active entities", err);
      }
    }
  );

  server.registerTool(
    "glpi_get_full_session",
    {
      title: "Get Full GLPI Session",
      description:
        "Get the PHP session of the API user (GET /getFullSession): user id/name, language, active profile and " +
        "entities, preferences. Use keys to limit the output (e.g. glpiID, glpiname, glpiactive_entity). " +
        "Tokens, passwords and hashes are masked.",
      inputSchema: { keys: KeysSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ keys }) => {
      try {
        const r = await client.callEndpoint<{ session?: Row }>("GET", "getFullSession");
        return jsonResult(maskSecrets(pickKeys(r.session ?? {}, keys)));
      } catch (err) {
        return errorResult("Error getting session", err);
      }
    }
  );

  server.registerTool(
    "glpi_get_glpi_config",
    {
      title: "Get GLPI Configuration",
      description:
        "Get the GLPI configuration (GET /getGlpiConfig): version, URL, language, enabled features... Use keys to " +
        "limit the output (e.g. version, url_base, language). Passwords, keys and tokens are masked.",
      inputSchema: { keys: KeysSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ keys }) => {
      try {
        const r = await client.callEndpoint<{ cfg_glpi?: Row }>("GET", "getGlpiConfig");
        return jsonResult(maskSecrets(pickKeys(r.cfg_glpi ?? {}, keys)));
      } catch (err) {
        return errorResult("Error getting GLPI configuration", err);
      }
    }
  );
}
