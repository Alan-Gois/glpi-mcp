// ============================================================
// GLPI MCP Server — Local file access sandbox (documents)
// ============================================================

import fs from "node:fs";
import path from "node:path";

export interface FileSandbox {
  /** Directory where local files may be read/written (GLPI_MCP_FILES_DIR); undefined = base64 only */
  dir?: string;
  /** Maximum file size in bytes (GLPI_MCP_MAX_FILE_MB, default 10) */
  maxBytes: number;
}

export function loadFileSandbox(env: NodeJS.ProcessEnv = process.env): FileSandbox {
  const mb = Number(env.GLPI_MCP_MAX_FILE_MB ?? 10);
  return {
    dir: env.GLPI_MCP_FILES_DIR ? path.resolve(env.GLPI_MCP_FILES_DIR) : undefined,
    maxBytes: Math.max(1, Number.isFinite(mb) ? mb : 10) * 1024 * 1024,
  };
}

/**
 * Resolve a path inside the sandbox directory. Rejects absolute paths outside it, `..` escapes and
 * (for existing files) symlinks pointing outside.
 */
export function resolveInSandbox(sandbox: FileSandbox, relative: string): string {
  if (!sandbox.dir) {
    throw new Error("Local file paths are disabled. Set GLPI_MCP_FILES_DIR or use base64 content.");
  }
  const root = fs.existsSync(sandbox.dir) ? fs.realpathSync(sandbox.dir) : sandbox.dir;
  const target = path.resolve(root, relative);
  const inside = (p: string) => p === root || p.startsWith(root + path.sep);
  if (!inside(target)) throw new Error(`Path is outside GLPI_MCP_FILES_DIR: ${relative}`);
  if (fs.existsSync(target) && !inside(fs.realpathSync(target))) {
    throw new Error(`Path resolves outside GLPI_MCP_FILES_DIR: ${relative}`);
  }
  return target;
}

export function checkSize(sandbox: FileSandbox, bytes: number): void {
  if (bytes > sandbox.maxBytes) {
    throw new Error(`File too large (${bytes} bytes; limit ${sandbox.maxBytes}). Adjust GLPI_MCP_MAX_FILE_MB.`);
  }
}
