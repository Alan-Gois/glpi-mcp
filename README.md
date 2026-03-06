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

Search across any GLPI item type.

```
"Find all computers in the Finance department"
"Search for user named Maria"
"List HP printers"
"Find software named Chrome"
```

**Supported item types:** Ticket, Computer, User, Software, NetworkEquipment, Monitor, Printer

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
│   ├── index.ts              # Entry point, server setup
│   ├── types.ts              # TypeScript types and constants
│   ├── services/
│   │   ├── glpi-client.ts    # GLPI REST API client
│   │   └── formatting.ts     # Response formatting utilities
│   └── tools/
│       ├── list-tickets.ts   # glpi_list_tickets
│       ├── get-ticket.ts     # glpi_get_ticket
│       ├── create-ticket.ts  # glpi_create_ticket
│       ├── add-followup.ts   # glpi_add_followup
│       └── search.ts         # glpi_search
├── package.json
├── tsconfig.json
└── README.md
```

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
