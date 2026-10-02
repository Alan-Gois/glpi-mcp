// ============================================================
// GLPI MCP Server — Query string helpers
// ============================================================

type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [key: string]: QueryValue };

/**
 * Flatten nested params into PHP bracket notation, as the GLPI API expects:
 * { searchText: { name: "pc" }, items: [{ itemtype: "Ticket" }] }
 * → { "searchText[name]": "pc", "items[0][itemtype]": "Ticket" }
 */
export function flattenParams(
  params: Record<string, QueryValue>,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === "object") {
          Object.assign(out, flattenParams(v as Record<string, QueryValue>, `${name}[${i}]`));
        } else if (v !== undefined && v !== null) {
          out[`${name}[${i}]`] = String(v);
        }
      });
    } else if (typeof value === "object") {
      Object.assign(out, flattenParams(value, name));
    } else {
      out[name] = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    }
  }
  return out;
}

/** Parse the GLPI Content-Range header ("0-49/120") */
export function parseContentRange(header: string | null): { start: number; end: number; total: number } | undefined {
  const m = header?.match(/(\d+)-(\d+)\/(\d+)/);
  if (!m) return undefined;
  return { start: Number(m[1]), end: Number(m[2]), total: Number(m[3]) };
}
