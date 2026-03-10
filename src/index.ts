#!/usr/bin/env node
// ============================================================
// GLPI MCP Server — Main Entry Point
// ============================================================
// Connect AI assistants (Claude, ChatGPT, Copilot) to your
// GLPI IT Service Management instance via MCP.
//
// Supports: GLPI 10.0.x (Legacy REST API)
// Transport: stdio (default) or Streamable HTTP
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GlpiClient } from "./services/glpi-client.js";
import { GlpiConfig } from "./types.js";

// Tools
import { registerListTickets } from "./tools/list-tickets.js";
import { registerGetTicket } from "./tools/get-ticket.js";
import { registerCreateTicket } from "./tools/create-ticket.js";
import { registerAddFollowup } from "./tools/add-followup.js";
import { registerSearch } from "./tools/search.js";
import { registerListSearchOptions } from "./tools/list-search-options.js";

// ----------------------------------------------------------
// Configuration from environment
// ----------------------------------------------------------

function loadConfig(): GlpiConfig {
  const url = process.env.GLPI_URL;
  if (!url) {
    console.error(
      "ERROR: GLPI_URL environment variable is required.\n" +
      "Set it to your GLPI instance URL (e.g. https://glpi.example.com)\n"
    );
    process.exit(1);
  }

  const apiVersion = parseInt(process.env.GLPI_API_VERSION || "10", 10);
  const config: GlpiConfig = { url, apiVersion };

  if (apiVersion === 11) {
    if (process.env.GLPI_OAUTH_CLIENT_ID && process.env.GLPI_OAUTH_SECRET) {
      config.oauthClientId = process.env.GLPI_OAUTH_CLIENT_ID;
      config.oauthSecret = process.env.GLPI_OAUTH_SECRET;
    } else {
      console.error(
        "ERROR: GLPI 11 Authentication requires GLPI_OAUTH_CLIENT_ID and GLPI_OAUTH_SECRET.\n"
      );
      process.exit(1);
    }
  } else {
    // App Token (optional but recommended for v10)
    if (process.env.GLPI_APP_TOKEN) {
      config.appToken = process.env.GLPI_APP_TOKEN;
    }

    // Authentication: User Token takes priority over username/password
    if (process.env.GLPI_USER_TOKEN) {
      config.userToken = process.env.GLPI_USER_TOKEN;
    } else if (process.env.GLPI_USERNAME && process.env.GLPI_PASSWORD) {
      config.username = process.env.GLPI_USERNAME;
      config.password = process.env.GLPI_PASSWORD;
    } else {
      console.error(
        "ERROR: Authentication required for GLPI 10.\n" +
        "Set GLPI_USER_TOKEN or both GLPI_USERNAME and GLPI_PASSWORD.\n"
      );
      process.exit(1);
    }
  }

  return config;
}

// ----------------------------------------------------------
// Server setup
// ----------------------------------------------------------

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new GlpiClient(config);

  // Validate connection on startup
  try {
    await client.initSession();
    console.error(`Conectado ao GLPI em ${config.url}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Falha ao conectar ao GLPI: ${msg}`);
    console.error("Verifique GLPI_URL e as credenciais de autenticação.");
    process.exit(1);
  }

  // Create MCP server
  const server = new McpServer({
    name: "glpi-mcp-server",
    version: "0.1.0",
  });

  // Register all tools
  registerListTickets(server, client);
  registerGetTicket(server, client);
  registerCreateTicket(server, client);
  registerAddFollowup(server, client);
  registerSearch(server, client);
  registerListSearchOptions(server, client);

  // Start transport
  const transportType = process.env.TRANSPORT ?? "stdio";

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GLPI MCP Server rodando via stdio");
  } else {
    console.error(`Transporte desconhecido: ${transportType}. Use 'stdio'.`);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.error("Encerrando GLPI MCP Server...");
    await client.killSession();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
