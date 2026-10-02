// ============================================================
// Tools: documents (legacy REST API)
// glpi_document_upload, glpi_document_download
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { checkSize, FileSandbox, resolveInSandbox } from "../security/files.js";
import { errorResult, IdSchema, ItemtypeSchema, jsonResult } from "./_shared.js";

const MIME_BY_EXT: Record<string, string> = {
  ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".pdf": "application/pdf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".zip": "application/zip", ".xml": "application/xml", ".html": "text/html", ".log": "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const FilenameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^\\/:*?"<>|\x00-\x1f]+$/, "Plain file name without path separators");

const sha1 = (data: Uint8Array) => createHash("sha1").update(data).digest("hex");

export function registerDocumentTools(server: McpServer, client: GlpiClient, sandbox: FileSandbox): void {
  server.registerTool(
    "glpi_document_upload",
    {
      title: "Upload GLPI Document",
      description:
        "Upload a file as a GLPI Document and optionally link it to an item (e.g. a Ticket or Project). " +
        "Give either content_base64 + filename, or file_path (relative to GLPI_MCP_FILES_DIR).",
      inputSchema: {
        filename: FilenameSchema.optional().describe("File name (required with content_base64)."),
        content_base64: z.string().optional().describe("File content in base64."),
        file_path: z.string().optional().describe("Path relative to GLPI_MCP_FILES_DIR."),
        name: z.string().optional().describe("Document name in GLPI (default: file name)."),
        comment: z.string().optional(),
        documentcategories_id: z.number().int().min(0).optional(),
        entities_id: z.number().int().min(0).optional(),
        link_itemtype: ItemtypeSchema.optional().describe("Link the document to this itemtype..."),
        link_id: IdSchema.optional().describe("...and this item id."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (params) => {
      try {
        if (!!params.content_base64 === !!params.file_path) {
          return errorResult("Invalid input", "give exactly one of content_base64 or file_path");
        }
        if (!!params.link_itemtype !== !!params.link_id) {
          return errorResult("Invalid input", "link_itemtype and link_id go together");
        }

        let content: Uint8Array;
        let filename: string;
        if (params.file_path) {
          const full = resolveInSandbox(sandbox, params.file_path);
          checkSize(sandbox, fs.statSync(full).size);
          content = new Uint8Array(fs.readFileSync(full));
          filename = params.filename ?? path.basename(full);
        } else {
          if (!params.filename) return errorResult("Invalid input", "filename is required with content_base64");
          content = new Uint8Array(Buffer.from(params.content_base64 as string, "base64"));
          checkSize(sandbox, content.byteLength);
          filename = params.filename;
        }

        const input: Record<string, unknown> = { name: params.name ?? filename };
        if (params.comment) input.comment = params.comment;
        if (params.documentcategories_id !== undefined) input.documentcategories_id = params.documentcategories_id;
        if (params.entities_id !== undefined) input.entities_id = params.entities_id;

        const mime = MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
        const doc = await client.uploadDocument(input, filename, content, mime);

        let link: unknown;
        if (params.link_itemtype && params.link_id) {
          link = await client.addItems("Document_Item", {
            documents_id: doc.id,
            itemtype: params.link_itemtype,
            items_id: params.link_id,
          });
        }
        return jsonResult(
          { id: doc.id, filename, size: content.byteLength, sha1: sha1(content), linked_to: link ? { itemtype: params.link_itemtype, id: params.link_id } : undefined },
          "Document uploaded:"
        );
      } catch (err) {
        return errorResult("Error uploading document", err);
      }
    }
  );

  server.registerTool(
    "glpi_document_download",
    {
      title: "Download GLPI Document",
      description:
        "Download a GLPI Document. Saves to save_as (relative to GLPI_MCP_FILES_DIR) or returns base64 " +
        "(size limited by GLPI_MCP_MAX_FILE_MB). The SHA-1 is checked against GLPI's.",
      inputSchema: {
        id: IdSchema.describe("Document id."),
        save_as: z.string().optional().describe("Path relative to GLPI_MCP_FILES_DIR (existing files are not overwritten)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const meta = await client.getItem<Record<string, unknown>>("Document", params.id, { get_hateoas: "false" });
        const content = await client.downloadDocument(params.id);
        checkSize(sandbox, content.byteLength);
        const digest = sha1(content);
        const info = {
          id: params.id,
          filename: meta.filename,
          mime: meta.mime,
          size: content.byteLength,
          sha1: digest,
          sha1_matches_glpi: typeof meta.sha1sum === "string" ? meta.sha1sum === digest : undefined,
        };

        if (params.save_as) {
          const target = resolveInSandbox(sandbox, params.save_as);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, content, { flag: "wx" });
          return jsonResult({ ...info, saved_to: params.save_as }, "Document saved:");
        }
        return jsonResult({ ...info, content_base64: Buffer.from(content).toString("base64") });
      } catch (err) {
        return errorResult(`Error downloading document ${params.id}`, err);
      }
    }
  );
}
