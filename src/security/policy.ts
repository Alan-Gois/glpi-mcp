// ============================================================
// GLPI MCP Server — Tool policy (what the server is allowed to expose)
// ============================================================

export interface ToolPolicy {
  /** Register glpi_delete_items (GLPI_ALLOW_DELETE=true) */
  allowDelete: boolean;
  /** Register glpi_massive_action_apply (GLPI_ALLOW_MASSIVE=true) */
  allowMassive: boolean;
  /** Only register tools annotated readOnlyHint=true (GLPI_MCP_READ_ONLY=true) */
  readOnly?: boolean;
  /** Only register tools whose name matches (GLPI_MCP_TOOLS_ALLOW_PATTERN) */
  allowPattern?: RegExp;
  /** Never register tools whose name matches (GLPI_MCP_TOOLS_DENY_PATTERN) */
  denyPattern?: RegExp;
}

const isTrue = (v: string | undefined): boolean => /^(1|true|yes)$/i.test(v ?? "");

function toRegExp(name: string, value: string | undefined): RegExp | undefined {
  if (!value) return undefined;
  try {
    return new RegExp(value);
  } catch (err) {
    throw new Error(`${name} is not a valid regular expression: ${err instanceof Error ? err.message : err}`);
  }
}

export function loadPolicy(env: NodeJS.ProcessEnv = process.env): ToolPolicy {
  const readOnly = isTrue(env.GLPI_MCP_READ_ONLY);
  return {
    // Read-only mode wins over the write switches
    allowDelete: !readOnly && isTrue(env.GLPI_ALLOW_DELETE),
    allowMassive: !readOnly && isTrue(env.GLPI_ALLOW_MASSIVE),
    readOnly,
    allowPattern: toRegExp("GLPI_MCP_TOOLS_ALLOW_PATTERN", env.GLPI_MCP_TOOLS_ALLOW_PATTERN),
    denyPattern: toRegExp("GLPI_MCP_TOOLS_DENY_PATTERN", env.GLPI_MCP_TOOLS_DENY_PATTERN),
  };
}

/** Whether a tool may be registered under the policy */
export function isToolAllowed(policy: ToolPolicy, name: string, readOnlyHint: boolean): boolean {
  if (policy.readOnly && !readOnlyHint) return false;
  if (policy.denyPattern?.test(name)) return false;
  if (policy.allowPattern && !policy.allowPattern.test(name)) return false;
  return true;
}
