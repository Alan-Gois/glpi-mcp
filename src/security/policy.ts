// ============================================================
// GLPI MCP Server — Tool policy (what the server is allowed to expose)
// ============================================================

export interface ToolPolicy {
  /** Register glpi_delete_items (GLPI_ALLOW_DELETE=true) */
  allowDelete: boolean;
}

const isTrue = (v: string | undefined): boolean => /^(1|true|yes)$/i.test(v ?? "");

export function loadPolicy(env: NodeJS.ProcessEnv = process.env): ToolPolicy {
  return {
    allowDelete: isTrue(env.GLPI_ALLOW_DELETE),
  };
}
