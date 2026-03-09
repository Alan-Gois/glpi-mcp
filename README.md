# GLPI MCP Server

Connect AI assistants (Claude, ChatGPT, Copilot) to your **GLPI** IT Service Management instance via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

> **First MCP Server for GLPI** — Manage tickets, search assets, and automate IT operations through natural language.

## Features

- **List Tickets** — View open, assigned, waiting, or all tickets
- **Get Ticket Details** — Full ticket info with description and followup timeline
- **Create Tickets** — Open incidents or service requests via AI
- **Add Followups** — Reply to tickets without leaving your AI assistant
- **Search Everything** — Find computers, users, software, printers, and more

## Supported Versions

| GLPI Version | API | Status |
|-------------|-----|--------|
| 10.0.x | Legacy REST API | ✅ Supported |
| 11.0.x | HLAPI (OAuth2) | 🔜 Coming soon |

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A GLPI instance with the REST API enabled
- An API User Token or username/password

### 2. Setup GLPI API Access

In your GLPI instance:

1. Go to **Setup > General > API**
2. Enable **REST API** (set to YES)
3. Enable authentication method (Credentials and/or External Token)
4. Note the **API URL** shown at the top
5. Get your **User Token** from your user profile > **Remote Access Keys** > Regenerate

### 3. Install & Build

```bash
git clone https://github.com/your-user/glpi-mcp-server.git
cd glpi-mcp-server
npm install
npm run build
```

### 4. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp-server/dist/index.js"],
      "env": {
        "GLPI_URL": "https://your-glpi-instance.com",
        "GLPI_USER_TOKEN": "your_user_token_here",
        "GLPI_APP_TOKEN": "your_app_token_here"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

After saving the config, restart Claude Desktop. You should see the GLPI tools available in the tools menu.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GLPI_URL` | Yes | Base URL of your GLPI instance |
| `GLPI_USER_TOKEN` | Yes* | User API token (from user profile) |
| `GLPI_APP_TOKEN` | No | App token (from API client config) |
| `GLPI_USERNAME` | Yes* | Username (alternative to user token) |
| `GLPI_PASSWORD` | Yes* | Password (alternative to user token) |

\* Either `GLPI_USER_TOKEN` or both `GLPI_USERNAME` + `GLPI_PASSWORD` are required.

## Tools Reference

### `glpi_list_tickets`

List tickets with optional status filter.

```
"Show me all open tickets"
"List waiting tickets, max 10"
"What tickets are assigned right now?"
```

### `glpi_get_ticket`

Get complete details of a specific ticket.

```
"Show me ticket #42"
"What's the status of ticket 150?"
"Get the timeline for ticket 99"
```

### `glpi_create_ticket`

Create a new incident or service request.

```
"Open a ticket: WiFi not working in meeting room 3"
"Create a request for a new monitor for João Silva"
```

### `glpi_add_followup`

Add a followup message to an existing ticket.

```
"Reply to ticket 42: the router has been restarted"
"Add a private note to ticket 100 saying we're waiting for parts"
```

### `glpi_search`

Search across any GLPI item type. Now supports advanced multi-criteria searches with AND/OR logic!

```
"Find all computers where location is Finance and OS is Windows"
"Search for user named Maria"
"List HP printers"
"Find software named Chrome"
```

**Supported item types:** Ticket, Computer, User, Software, NetworkEquipment, Monitor, Printer

### `glpi_list_search_options`

Discover all possible search fields and their numeric IDs for any GLPI item type. Essential for advanced searches where fields aren't mapped by default (like Antivirus, installed software, etc.).

```
"What fields can I search on Computer?"
"Find antivirus-related fields for Computer"
"Show all ticket search fields related to SLA"
```

## Claude Code Configuration

For use with Claude Code, create a `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp-server/dist/index.js"],
      "env": {
        "GLPI_URL": "https://your-glpi-instance.com",
        "GLPI_USER_TOKEN": "your_user_token_here"
      }
    }
  }
}
```

## Development

```bash
# Watch mode (recompile on changes)
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Project Structure

```
glpi-mcp-server/
├── src/
│   ├── index.ts                  # Entry point, server setup
│   ├── types.ts                  # TypeScript types and constants
│   ├── services/
│   │   ├── glpi-client.ts        # GLPI REST API client
│   │   └── formatting.ts         # Response formatting utilities
│   └── tools/
│       ├── list-tickets.ts       # glpi_list_tickets
│       ├── get-ticket.ts         # glpi_get_ticket
│       ├── create-ticket.ts      # glpi_create_ticket
│       ├── add-followup.ts       # glpi_add_followup
│       ├── search.ts             # glpi_search (v2 Multi-Criteria)
│       └── list-search-options.ts # glpi_list_search_options
├── package.json
├── tsconfig.json
└── README.md
```

## Knowledge Base & Guidelines

This section serves as the continuous knowledge base for project progress, maintainability, and testing.

### Personas

1. **IT Administrator / Analyst (End-User)**: Uses AI assistants (like Claude) connected via this MCP server to manage tickets, search for assets, and automate daily IT operations without opening the GLPI interface.
2. **MCP Server Developer / Contributor**: TypeScript developer responsible for maintaining the GLPI integration, adding new endpoints, ensuring API backward/forward compatibility (e.g., GLPI 10 REST to GLPI 11 HLAPI), and optimizing performance.
3. **AI Agent (System Persona)**: The LLM client connecting via MCP that acts as the intelligent middleman. It needs structured, clear, and comprehensive descriptions of tools and schemas to effectively parse user intent into GLPI actions.

### Rules

- **Code & Architecture**: Maintain the clear separation of concerns. Keep `src/services/` for API communication and data formatting, and `src/tools/` for the MCP tool definitions. All new code must be written in TypeScript.
- **API Interactions**: Always respect GLPI API limits and handle authentication gracefully. Validate `GLPI_USER_TOKEN` and application tokens securely.
- **Type Safety**: Strictly use TypeScript interfaces and Zod schemas (from `@modelcontextprotocol/sdk`) to validate all inputs from the AI model before passing them to the GLPI client.
- **Error Handling**: Format errors in a way that the AI Agent can read and relay back to the user clearly (e.g., "Missing permissions" instead of raw 403 stack traces).
- **Stability**: Ensure the server is stateless and can quickly recover or handle multiple concurrent agent requests.
- **Documentation Sync**: Every sensitive or architectural code change, new entity mapping, or workflow alteration MUST be immediately reflected inside this `README.md` file to keep it as the reliable single source of truth for the project.
- **Automated Testing**: All backend components, formatting utilities, and tool abstractions must be covered by automated tests (**Jest**). **See [TESTS.md](./TESTS.md) for full testing rules, routines, and workflows.**
### Workflows

#### 1. Developing a New Tool
1. **Define the Schema**: Identify the GLPI endpoints needed. Create Zod schemas for the inputs.
2. **Implement the Service**: Add the corresponding API call method to `src/services/glpi-client.ts`.
3. **Create the Tool Module**: Create a new file in `src/tools/` defining the tool's name, description, and execution logic.
4. **Register**: Import and register the new tool in `src/index.ts`.
5. **Compile**: Run `npm run build` to update the `dist/` directory.

#### 2. Local Testing Workflow
1. **Watch Mode**: Run `npm run dev` to automatically recompile TypeScript on save.
2. **MCP Inspector**: Use the inspector to test the server in isolation (without Claude Desktop):
   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js
   ```
3. **Configuration**: Supply required environment variables (`GLPI_URL`, `GLPI_USER_TOKEN`) within the inspector's UI to run tests against a staging or test GLPI environment.
4. **Validation**: Validate successful creation, retrieval, edge cases (e.g., invalid ticket IDs), and proper error returns.

#### 3. Automated Testing Routine (Jest)
For all instructions related to writing tests, running tests, and test execution rules, please refer directly to the **[TESTS.md](./TESTS.md)** document.

### Skills & Competencies Required

- **TypeScript / Node.js**: Advanced proficiency for robust server-side development.
- **GLPI Architecture**: Deep understanding of GLPI's Itemtypes (`Ticket`, `Computer`, `User`, `Software`), ITIL concepts, and legacy REST API payload structures.
- **Model Context Protocol (MCP)**: Knowledge of building and debugging MCP servers using the official `@modelcontextprotocol/sdk`.
- **System Integration**: Ability to design safe, predictable integrations between unpredictable LLMs and strict database-backed systems.

## Roadmap
- [ ] GLPI 11 HLAPI support (OAuth2)
- [ ] MySQL direct read for Pro tier
- [ ] Additional tools: solutions, tasks, changes, problems
- [ ] MCP Resources (status, entities, ticket stats)
- [ ] MCP Prompts (analyze ticket, daily report)
- [ ] Docker image
- [ ] npm publishing

## License

MIT
