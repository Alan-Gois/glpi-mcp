// ============================================================
// GLPI MCP Server — Secret masking for tool outputs
// ============================================================

export const MASK = "***";

/** Keys whose values must never leave the server (passwords, tokens, keys, cookies, hashes) */
const SECRET_KEY = /(passw|token|secret|api_?key|private_?key|cookie|csrf|salt|crypt|^hash$|_hash$|authorization)/i;

/**
 * Values worth masking: non-empty strings that are not small settings flags/numbers
 * (e.g. password_min_length = "8" or use_password_security = "1" are policy settings, not secrets).
 */
function isSecretValue(v: unknown): boolean {
  return typeof v === "string" && v !== "" && !/^-?\d{1,6}$/.test(v);
}

/** Deep-copy a value replacing the values of secret-looking keys */
export function maskSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => maskSecrets(v)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) && isSecretValue(v) ? MASK : maskSecrets(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Mask secrets inside free text (tool results, error messages): JSON or query-string pairs whose key looks
 * secret, and Authorization / Session-Token / App-Token header values.
 */
export function maskText(text: string): string {
  return text
    .replace(
      /("([^"\\]*?(?:passw|token|secret|api_?key|private_?key|cookie|csrf|salt|crypt)[^"\\]*)"\s*:\s*)"(?:[^"\\]|\\.)+"/gi,
      `$1"${MASK}"`
    )
    .replace(/([?&][a-z_]*(?:token|passw|secret|api_?key)[a-z_]*=)[^&\s"']+/gi, `$1${MASK}`)
    .replace(/((?:Authorization|Session-Token|App-Token)\s*[:=]\s*)(?:(?:Basic|Bearer|user_token)\s+)?[^\s,"'}]+/gi, `$1${MASK}`);
}
