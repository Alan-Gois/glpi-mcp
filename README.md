# GLPI MCP Server

Connect AI assistants (Claude, ChatGPT, Copilot) to your **GLPI** IT Service Management instance via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

> **First MCP Server for GLPI** — Manage tickets, search assets, and automate IT operations through natural language.

> This repository continues [ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server) by Ageu Bonfim (MIT),
> keeping its full history, with the goal of covering the whole GLPI REST API, including projects.

## Features

- **List Tickets** — View open, assigned, waiting, or all tickets
- **Get Ticket Details** — Full ticket info with description and followup timeline
- **Create Tickets** — Open incidents or service requests via AI
- **Update Tickets** — 🆕 Change status, priority, or attribution
- **Add Followups & Solutions** — 🆕 Reply to or solve tickets directly
- **Manage Tasks** — 🆕 Create and view technical tasks for tickets
- **ITIL Processes** — 🆕 Create Changes and Problems
- **Search Everything** — Find computers, users, software, printers, and more

## Supported Versions

| GLPI Version | API | Status |
|-------------|-----|--------|
| 10.0.x | Legacy REST API (`/apirest.php`) | ✅ Supported |
| 11.0.x | HLAPI (`/api.php`) | ✅ Supported |

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
git clone https://github.com/Alan-Gois/glpi-mcp.git
cd glpi-mcp
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
      "args": ["/absolute/path/to/glpi-mcp/dist/index.js"],
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
| `GLPI_URL` | Yes | Base URL of your GLPI instance. Do not include `/api.php` or `/apirest.php` unless you intentionally want to override auto-detection. |
| `GLPI_API_VERSION` | No | API version. Defaults to `10`; set `11` to enable HLAPI routing and OAuth2 authentication. |
| `GLPI_USER_TOKEN` | v10 only* | User API token from the user profile. Preferred for GLPI 10 legacy REST auth. |
| `GLPI_USERNAME` | v11 required** | GLPI username. Also valid for GLPI 10 when used with `GLPI_PASSWORD`. |
| `GLPI_PASSWORD` | v11 required** | GLPI password. Also valid for GLPI 10 when used with `GLPI_USERNAME`. |
| `GLPI_APP_TOKEN` | No | App token from API client config. |
| `GLPI_TOKENS_IN_QUERY` | No | `true` to also send tokens in the query string (only for WAFs that strip custom headers). Default: off. |
| `GLPI_ALLOW_DELETE` | No | `true` to register `glpi_delete_items` (trash by default, `force_purge` to delete permanently). Default: off. |
| `GLPI_OAUTH_CLIENT_ID` | v11 required** | OAuth2 Client ID for GLPI 11 HLAPI. |
| `GLPI_OAUTH_CLIENT_SECRET` | v11 required** | OAuth2 Client Secret for GLPI 11 HLAPI. |

\* For GLPI 10, either `GLPI_USER_TOKEN` or both `GLPI_USERNAME` + `GLPI_PASSWORD` are required.
\** For GLPI 11, `GLPI_USERNAME`, `GLPI_PASSWORD`, `GLPI_OAUTH_CLIENT_ID`, and `GLPI_OAUTH_CLIENT_SECRET` are required.

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

### `glpi_update_ticket` 🆕

Update an existing ticket's name, content, status, priority, etc.

### `glpi_add_solution` 🆕

Add a solution to a ticket and mark it as solved.

### `glpi_add_task` 🆕

Add a technical task to a ticket with state, planning, and duration.

### `glpi_get_ticket_tasks` 🆕

List all tasks associated with a ticket.

### `glpi_create_change` 🆕

Create an ITIL Change Request.

### `glpi_create_problem` 🆕

Create an ITIL Problem report.

### `glpi_request_validation` 🆕

Request validation for a ticket from a supervisor or manager.

### `glpi_get_ticket_validations` 🆕

List all validation requests associated with a ticket.

### `glpi_answer_validation` 🆕

Approve or Refuse an existing ticket validation request.

### `glpi_list_forms` 🆕

Discover available native GLPI 11 forms in the service catalog.

### `glpi_get_form_details` 🆕

Retrieve a native form's questions and sections.

### `glpi_submit_form` 🆕

Submit structured answers to a native GLPI 11 form.

## Claude Code Configuration

For use with Claude Code, create a `.mcp.json` in your project root.

**Example for GLPI 11 (OAuth2):**
```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp/dist/index.js"],
      "env": {
        "GLPI_URL": "https://your-glpi-instance.com",
        "GLPI_API_VERSION": "11",
        "GLPI_USERNAME": "your_username",
        "GLPI_PASSWORD": "your_password",
        "GLPI_OAUTH_CLIENT_ID": "your_client_id",
        "GLPI_OAUTH_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

**Example for GLPI 10 (Legacy REST):**
```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp/dist/index.js"],
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
glpi-mcp/
├── src/
│   ├── index.ts                  # Entry point, server setup
│   ├── types.ts                  # TypeScript types and constants
│   ├── services/
│   │   ├── glpi-client.ts        # GLPI REST API client
│   │   └── formatting.ts         # Response formatting utilities
│   └── tools/
│       ├── add-followup.ts       # glpi_add_followup
│       ├── add-solution.ts       # glpi_add_solution
│       ├── add-task.ts           # glpi_add_task
│       ├── answer-validation.ts  # glpi_answer_validation
│       ├── create-change.ts      # glpi_create_change
│       ├── create-problem.ts     # glpi_create_problem
│       ├── create-ticket.ts      # glpi_create_ticket
│       ├── get-form-details.ts   # glpi_get_form_details
│       ├── get-ticket.ts         # glpi_get_ticket
│       ├── get-ticket-tasks.ts   # glpi_get_ticket_tasks
│       ├── get-ticket-validations.ts # glpi_get_ticket_validations
│       ├── list-forms.ts         # glpi_list_forms
│       ├── list-search-options.ts # glpi_list_search_options
│       ├── list-tickets.ts       # glpi_list_tickets
│       ├── request-validation.ts # glpi_request_validation
│       ├── search.ts             # glpi_search (v2 Multi-Criteria)
│       ├── submit-form.ts        # glpi_submit_form
│       └── update-ticket.ts      # glpi_update_ticket
├── jest.config.js
├── .env.example
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
- **Roadmap Validation**: The AI Assistant MUST proactively check the `Roadmap` section at the start of every session and update it whenever a feature moves from "In Progress" to "Completed". All new features discussed must be added to the roadmap before implementation begins.
- **Automated Testing**: New or changed backend components, formatting utilities, and tool abstractions must be covered by automated tests (**Jest**). **See [TESTS.md](./TESTS.md) for full testing rules, routines, and workflows.**
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
3. **Configuration**: Supply required environment variables within the inspector's UI to run tests against a staging or test GLPI environment. For GLPI 10, use `GLPI_URL` plus `GLPI_USER_TOKEN` or `GLPI_USERNAME` + `GLPI_PASSWORD`. For GLPI 11, use `GLPI_URL`, `GLPI_API_VERSION=11`, `GLPI_USERNAME`, `GLPI_PASSWORD`, `GLPI_OAUTH_CLIENT_ID`, and `GLPI_OAUTH_CLIENT_SECRET`.
4. **Validation**: Validate successful creation, retrieval, edge cases (e.g., invalid ticket IDs), and proper error returns.

### Production Notes & Tips

- **WAF / Firewall Bypass**: Strict corporate firewalls often strip custom HTTP headers like `App-Token` or `Session-Token`, causing `400 ERROR_WRONG_APP_TOKEN_PARAMETER` errors. To ensure maximum compatibility, set `GLPI_TOKENS_IN_QUERY=true` to also send the tokens in the URL query string (`?app_token=...&session_token=...`) on the legacy API. It is off by default because URLs end up in proxy and server logs.
- **Group Search**: GLPI uses hierarchical group names (e.g., `TECH_DEPT > INFRA > NETWORKS`). When searching tickets by group, always use the `contains` search type with the last part of the name (the "leaf") for best results.
- **Assignment Required**: In some `glpi11` environments, you **must** assign a technician to a ticket before the API allows registering a solution. If you get a 400 error when solving, check if the ticket has an assigned technician.
- **Escalade Plugin**: If your instance uses the *Escalade* plugin, you can search for escalated tickets using field ID `1881` ("Grupo afetado pela escalada").
- **API Versions**: `GLPI_API_VERSION="11"` enables HLAPI routing through `/api.php` with path patterns like `/Assistance/Ticket`. Without this variable, the server defaults to GLPI 10 legacy REST routing through `/apirest.php`.

#### 3. Automated Testing Routine (Jest)
For all instructions related to writing tests, running tests, and test execution rules, please refer directly to the **[TESTS.md](./TESTS.md)** document.

### Skills & Competencies Required

- **TypeScript / Node.js**: Advanced proficiency for robust server-side development.
- **GLPI Architecture**: Deep understanding of GLPI's Itemtypes (`Ticket`, `Computer`, `User`, `Software`), ITIL concepts, and legacy REST API payload structures.
- **Model Context Protocol (MCP)**: Knowledge of building and debugging MCP servers using the official `@modelcontextprotocol/sdk`.
- **System Integration**: Ability to design safe, predictable integrations between unpredictable LLMs and strict database-backed systems.

## Roadmap

### Core v0.2.0 (Completed ✅)
- [x] **Cross-Version Support**: Dynamic routing for `glpi10` and `glpi11`.
- [x] **Full ITSM Cycle**: Ticket Solution, Tasks, Changes, and Problems.
- [x] **Advanced Search**: Multi-criteria AND/OR search with field ID mapping.
- [x] **Escalade Plugin Support**: Field 1881 mapping for `glpi11`.

### Enterprise ITSM (v0.3.0) ✅
- [x] **Approval Workflow (Validations)**:
  - `glpi_request_validation`: Send approval requests to Managers.
  - `glpi_answer_validation`: Approve or Reject via Chat.
  - `glpi_get_ticket_validations`: Monitor status of approvals.
- [x] **Native Forms (GLPI 11)**:
  - `glpi_list_forms`: Discovery of available service catalogs.
  - `glpi_get_form_details`: Retrieve questions and form configuration.
  - `glpi_submit_form`: Submit structured requests (Tickets/Changes).

### Enterprise ITSM (Development 🏗️)
- [ ] **Phase 3: SLA/OLA Management**:
  - `glpi_check_prazos`: Real-time monitoring of TTO and TTR countdowns.

## 🚀 Enterprise Blueprint: Approval Workflow

To achieve the Full ITSM Cycle, we will focus first on the **Validation Engine**. This allows the AI to act as a governance layer between the user and the technical execution.

| Asset | GLPI Itemtype | Action | Fields / Logic |
| :--- | :--- | :--- | :--- |
| **Request** | `TicketValidation` | `POST` | `tickets_id`, `users_id_validate`, `comment_submission` |
| **Response**| `TicketValidation` | `PUT` | `status` (2-Approve, 3-Refuse), `comment_validation` |
| **Check**   | `TicketValidation` | `GET` | Filter by `tickets_id` to prevent duplicate requests. |

**Implementation Strategy:**
1. **Tool Logic**: The AI must check for existing validations before requesting a new one.
2. **Status Sync**: If a validation is refused, the AI should optionally move the Ticket to a `Waiting` or `Closed` status automatically.
3. **Escalation**: Integration with the `Escalade` plugin to ensure validations follow the correct hierarchical chain.

## 🚀 Enterprise Blueprint: Native Forms (GLPI 11)
Technical specification for the Service Catalog core integration.

| Asset | GLPI Itemtype | Action | Logic |
| :--- | :--- | :--- | :--- |
| **Catalog** | `Glpi\Form\Form` | `GET` | Discovery of active forms in entity. |
| **Schema**  | `Glpi\Form\Question`| `GET` | List inputs (text, dropdown) for a form. |
| **Sections**| `Glpi\Form\Section` | `GET` | Structural grouping of questions. |

**Workflow:**
1. **Discovery**: AI lists available catalogs using `glpi_list_forms`.
2. **Setup**: AI fetches questions using `glpi_get_form_details` to build the user interaction.
3. **Submit**: AI sends structured answers using `glpi_submit_form`.

### Infrastructure
- [ ] **Active Notifications**: Webhook receiver for push alerts (New critical tickets).
- [ ] **MySQL Direct Read**: Optional engine for high-performance reporting.
- [ ] **Dockerization**: Ready-to-go deployment image.

## Generic tools (any itemtype)

Work with the legacy REST API (`GLPI_API_VERSION=10`, also available in GLPI 11):

| Tool | Endpoint |
|---|---|
| `glpi_get_item` | `GET /:itemtype/:id` (with_devices, with_logs, ...) |
| `glpi_get_items` | `GET /:itemtype` with pagination, sort, `searchText`, trash |
| `glpi_get_sub_items` | `GET /:itemtype/:id/:sub_itemtype` |
| `glpi_get_multiple_items` | `GET /getMultipleItems` |
| `glpi_add_items` | `POST /:itemtype` (one or many) |
| `glpi_update_items` | `PUT /:itemtype` (one or many) |
| `glpi_delete_items` | `DELETE /:itemtype` — only with `GLPI_ALLOW_DELETE=true` |

## Project tools

| Tool | What it does |
|---|---|
| `glpi_project_list` | Projects with state, parent, manager, progress; filters by name, state, parent |
| `glpi_project_get` | Project + subprojects + team + task tree (with task teams) |
| `glpi_project_create` / `glpi_project_update` | Create/update projects and subprojects (`parent_id`) |
| `glpi_project_task_list` | Tasks of a project as a tree (or flat) |
| `glpi_project_task_create` / `glpi_project_task_update` | Tasks and subtasks (`parent_task_id`), state, %, dates, `planned_duration_hours`, milestone |
| `glpi_project_team_add` | Add a User, Group, Supplier or Contact to a project or task team |
| `glpi_project_states_list` | Project states (and project/task types) |

Dropdown fields come with the id and the name (`projectstates_id` + `projectstates_id_name`).

## Session, profiles, entities and configuration

| Tool | Endpoint |
|---|---|
| `glpi_get_my_profiles` / `glpi_get_active_profile` / `glpi_change_active_profile` | `getMyProfiles`, `getActiveProfile`, `changeActiveProfile` |
| `glpi_get_my_entities` / `glpi_get_active_entities` / `glpi_change_active_entities` | `getMyEntities`, `getActiveEntities`, `changeActiveEntities` |
| `glpi_get_full_session` | `getFullSession` (use `keys` to limit the output) |
| `glpi_get_glpi_config` | `getGlpiConfig` (use `keys` to limit the output) |

Passwords, tokens, keys, cookies and hashes are masked in these outputs. `lostPassword` is not exposed.

## License

MIT. See [LICENSE](LICENSE). Original work by Ageu Bonfim ([ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server)).
