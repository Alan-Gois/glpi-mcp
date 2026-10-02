#!/usr/bin/env node
// ============================================================
// GLPI MCP Server — Main Entry Point
// ============================================================
// Connect AI assistants (Claude, ChatGPT, Copilot) to your
// GLPI IT Service Management instance via MCP.
//
// Supports: GLPI 10.0.x (Legacy REST API) and GLPI 11.x (HLAPI)
// Transport: stdio
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GlpiClient } from "./services/glpi-client.js";
import { GlpiConfig } from "./types.js";
import { loadPolicy, ToolPolicy } from "./security/policy.js";
import { guardServer } from "./security/guard.js";
import { maskText } from "./security/mask.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

// Tools — Generic CRUD (any itemtype)
import { registerItemTools } from "./tools/items.js";

// Tools — Projects
import { registerProjectTools } from "./tools/projects.js";

// Tools — Session, profiles, entities, configuration
import { registerSessionTools } from "./tools/session.js";

// Tools — Documents
import { registerDocumentTools } from "./tools/documents.js";
import { loadFileSandbox } from "./security/files.js";

// Tools — Massive actions
import { registerMassiveActionTools } from "./tools/massive-actions.js";

// Tools — Ticket Lifecycle
import { registerListTickets } from "./tools/list-tickets.js";
import { registerGetTicket } from "./tools/get-ticket.js";
import { registerCreateTicket } from "./tools/create-ticket.js";
import { registerUpdateTicket } from "./tools/update-ticket.js";
import { registerAddFollowup } from "./tools/add-followup.js";
import { registerAddSolution } from "./tools/add-solution.js";
import { registerAddTask } from "./tools/add-task.js";
import { registerGetTicketTasks } from "./tools/get-ticket-tasks.js";

// Tools — Search & Discovery
import { registerSearch } from "./tools/search.js";
import { registerListSearchOptions } from "./tools/list-search-options.js";

// Tools — ITIL Processes
import { registerCreateChange } from "./tools/create-change.js";
import { registerCreateProblem } from "./tools/create-problem.js";

// Tools — Enterprise Approval
import { registerRequestValidation } from "./tools/request-validation.js";
import { registerAnswerValidation } from "./tools/answer-validation.js";
import { registerGetTicketValidations } from "./tools/get-ticket-validations.js";

// Tools — Native Forms (GLPI 11)
import { registerListForms } from "./tools/list-forms.js";
import { registerGetFormDetails } from "./tools/get-form-details.js";
import { registerSubmitForm } from "./tools/submit-form.js";

// ----------------------------------------------------------
// Configuration from environment
// ----------------------------------------------------------

function loadConfig(): GlpiConfig {
  const url = process.env.GLPI_URL ?? process.env.GLPI_API_URL;
  if (!url) {
    console.error(
      "ERROR: GLPI_URL environment variable is required.\n" +
      "Set it to your GLPI instance URL (e.g. https://glpi.example.com)\n"
    );
    process.exit(1);
  }

  const config: GlpiConfig = { url };

  if (process.env.GLPI_API_VERSION) {
    const apiVersion = Number.parseInt(process.env.GLPI_API_VERSION, 10);
    if (Number.isNaN(apiVersion)) {
      console.error(
        "ERROR: GLPI_API_VERSION must be a number (e.g. 10 or 11).\n"
      );
      process.exit(1);
    }
    config.apiVersion = apiVersion;
  }

  // App Token (optional but recommended)
  if (process.env.GLPI_APP_TOKEN) {
    config.appToken = process.env.GLPI_APP_TOKEN;
  }

  if (process.env.GLPI_TOKENS_IN_QUERY === "true") {
    config.tokensInQuery = true;
  }

  if (process.env.GLPI_USERNAME && process.env.GLPI_PASSWORD) {
    config.username = process.env.GLPI_USERNAME;
    config.password = process.env.GLPI_PASSWORD;
  }

  if (process.env.GLPI_OAUTH_CLIENT_ID) {
    config.oauthClientId = process.env.GLPI_OAUTH_CLIENT_ID;
  }

  if (process.env.GLPI_OAUTH_CLIENT_SECRET) {
    config.oauthSecret = process.env.GLPI_OAUTH_CLIENT_SECRET;
  }

  const isV11 = (config.apiVersion ?? 10) >= 11;
  if (isV11) {
    if (
      !config.username ||
      !config.password ||
      !config.oauthClientId ||
      !config.oauthSecret
    ) {
      console.error(
        "ERROR: GLPI v11 authentication requires GLPI_USERNAME, GLPI_PASSWORD, GLPI_OAUTH_CLIENT_ID, and GLPI_OAUTH_CLIENT_SECRET.\n"
      );
      process.exit(1);
    }
  } else if (process.env.GLPI_USER_TOKEN) {
    // Legacy REST API accepts user tokens and keeps them preferred for v10.
    config.userToken = process.env.GLPI_USER_TOKEN;
    delete config.username;
    delete config.password;
  } else if (!config.username || !config.password) {
    console.error(
      "ERROR: Authentication required.\n" +
      "Set GLPI_USER_TOKEN or both GLPI_USERNAME and GLPI_PASSWORD.\n"
    );
    process.exit(1);
  }

  return config;
}

// ----------------------------------------------------------
// Server setup
// ----------------------------------------------------------

async function main(): Promise<void> {
  const config = loadConfig();
  let policy: ToolPolicy;
  try {
    policy = loadPolicy();
  } catch (err) {
    console.error(`ERROR: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  const client = new GlpiClient(config);

  // Validate connection on startup
  try {
    await client.initSession();
    console.error(`Conectado ao GLPI em ${config.url}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Falha ao conectar ao GLPI: ${maskText(msg)}`);
    console.error("Verifique GLPI_URL e as credenciais de autenticação.");
    process.exit(1);
  }

  // Create MCP server
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Policy filter (read-only mode, allow/deny patterns) + secret masking on every tool
  const stats = guardServer(server, policy);

  // Register all tools
  // -- Ticket Lifecycle
  registerListTickets(server, client);
  registerGetTicket(server, client);
  registerCreateTicket(server, client);
  registerUpdateTicket(server, client);
  registerAddFollowup(server, client);
  registerAddSolution(server, client);
  registerAddTask(server, client);
  registerGetTicketTasks(server, client);

  // -- Search & Discovery
  registerSearch(server, client);
  registerListSearchOptions(server, client);

  // -- Enterprise Approval
  registerRequestValidation(server, client);
  registerAnswerValidation(server, client);
  registerGetTicketValidations(server, client);

  // -- ITIL Processes
  registerCreateChange(server, client);
  registerCreateProblem(server, client);

  // -- Native Forms (GLPI 11)
  registerListForms(server, client);
  registerGetFormDetails(server, client);
  registerSubmitForm(server, client);

  // -- Generic CRUD (any itemtype)
  registerItemTools(server, client, policy);

  // -- Projects
  registerProjectTools(server, client);

  // -- Session, profiles, entities, configuration
  registerSessionTools(server, client);

  // -- Documents
  registerDocumentTools(server, client, loadFileSandbox());

  // -- Massive actions
  registerMassiveActionTools(server, client, policy);

  console.error(
    `${stats.registered.length} tools registrados` +
    (stats.skipped.length ? ` (${stats.skipped.length} desativados pela política)` : "") +
    (policy.readOnly ? " — modo somente leitura" : "")
  );

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
