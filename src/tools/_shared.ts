// ============================================================
// Shared helpers for tool handlers
// ============================================================

import { z } from "zod";
import { truncateIfNeeded } from "../services/formatting.js";

/** GLPI itemtype names, including namespaced ones such as Glpi\Form\Form */
export const ItemtypeSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*(\\[A-Za-z][A-Za-z0-9_]*)*$/, "Invalid GLPI itemtype")
  .describe("GLPI itemtype (class name), e.g. Ticket, Computer, User, Project, ProjectTask.");

export const IdSchema = z.number().int().positive();

/** Arbitrary GLPI field values for create/update */
export const FieldsSchema = z.record(z.unknown());

export function jsonResult(data: unknown, header?: string) {
  const body = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text" as const, text: truncateIfNeeded(header ? `${header}\n\n${body}` : body) }],
  };
}

export function errorResult(context: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `${context}: ${msg}` }], isError: true };
}

/** Keep only the requested fields of each row (reduces output size) */
export function pickFields(rows: Record<string, unknown>[], fields?: string[]): Record<string, unknown>[] {
  if (!fields || fields.length === 0) return rows;
  return rows.map((row) => Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]])));
}
