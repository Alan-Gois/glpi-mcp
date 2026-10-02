# GLPI MCP Server

[![CI](https://github.com/Alan-Gois/glpi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Alan-Gois/glpi-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Connect AI assistants (Claude, ChatGPT, Copilot…) to **GLPI** through the
[Model Context Protocol (MCP)](https://modelcontextprotocol.io): tickets, ITIL, **projects**, any itemtype,
documents, massive actions, sessions and configuration — with safe defaults.

[Português](README.pt-BR.md) · [Security](docs/security.md) · [Changelog](CHANGELOG.md)

> Continues [ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server) by Ageu Bonfim (MIT),
> keeping its full history, with the goal of covering the whole GLPI legacy REST API.

## Highlights

- **47 tools**: tickets and ITIL, generic CRUD for **any itemtype**, **project management** (projects,
  subprojects, task trees, teams, states), session/profiles/entities, documents, massive actions.
- **Safe by default**: delete and massive actions are off; read-only mode; allow/deny tool patterns;
  secrets masked in every output; tokens sent in headers (not URLs); local files confined to one directory.
- Works with **GLPI 10 and 11** (legacy REST API `apirest.php`, also shipped with GLPI 11).

## Supported versions

| GLPI | API | Status |
|---|---|---|
| 10.0.x | Legacy REST API (`/apirest.php`) | ✅ All tools |
| 11.0.x | Legacy REST API (`/apirest.php`) — recommended | ✅ All tools (tested on 11.0.7) |
| 11.0.x | High-Level API (`/api.php`, OAuth2) | ⚠️ Original ticket/ITIL/forms tools only |

The generic, project, session, document and massive-action tools use the legacy API: keep
`GLPI_API_VERSION=10` (the default), which also works with GLPI 11.

## Quick start

### 1. Enable the GLPI API

In GLPI: **Setup → General → API** → enable the REST API and "login with external token".
Then get your **API token**: user preferences (or Administration → Users → your user) →
**Passwords and access keys** → **API token** → regenerate. An *App-Token* is only needed if your API
client requires one.

### 2. Install

Requires Node.js 20+.

```bash
git clone https://github.com/Alan-Gois/glpi-mcp.git
cd glpi-mcp
npm ci
npm run build
```

Or run straight from GitHub: `npx -y github:Alan-Gois/glpi-mcp` (builds on install).

### 3. Configure your MCP client

**Claude Code** — `.mcp.json` in your project (values come from your environment, not from the file):

```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp/dist/index.js"],
      "env": {
        "GLPI_URL": "https://glpi.example.com",
        "GLPI_USER_TOKEN": "${GLPI_USER_TOKEN}",
        "GLPI_APP_TOKEN": "${GLPI_APP_TOKEN:-}"
      }
    }
  }
}
```

**Claude Desktop** — `claude_desktop_config.json`
(macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`, Linux `~/.config/Claude/`):

```json
{
  "mcpServers": {
    "glpi": {
      "command": "node",
      "args": ["/absolute/path/to/glpi-mcp/dist/index.js"],
      "env": {
        "GLPI_URL": "https://glpi.example.com",
        "GLPI_USER_TOKEN": "your_user_token",
        "GLPI_MCP_READ_ONLY": "true"
      }
    }
  }
}
```

Restart the client and the `glpi_*` tools appear. Start with `GLPI_MCP_READ_ONLY=true` and open up writes
when you are comfortable.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GLPI_URL` | Yes | Base URL of GLPI (without `/apirest.php`). |
| `GLPI_USER_TOKEN` | Yes* | User API token (legacy API). |
| `GLPI_USERNAME` / `GLPI_PASSWORD` | * | Alternative to the user token (legacy API); required for the v2 API. |
| `GLPI_APP_TOKEN` | No | App token, if your API client requires one. |
| `GLPI_API_VERSION` | No | `10` (default, legacy API — recommended, also for GLPI 11) or `11` (High-Level API). |
| `GLPI_OAUTH_CLIENT_ID` / `GLPI_OAUTH_CLIENT_SECRET` | v2 only | OAuth2 client for `GLPI_API_VERSION=11`. |
| `GLPI_MCP_READ_ONLY` | No | `true` registers only read tools (overrides the switches below). |
| `GLPI_MCP_TOOLS_ALLOW_PATTERN` | No | Regex: only register tools whose name matches (e.g. `^glpi_(project_\|get_)`). |
| `GLPI_MCP_TOOLS_DENY_PATTERN` | No | Regex: never register tools whose name matches (e.g. `_update$`). |
| `GLPI_ALLOW_DELETE` | No | `true` registers `glpi_delete_items` and allows delete/purge massive actions. Default: off. |
| `GLPI_ALLOW_MASSIVE` | No | `true` registers `glpi_massive_action_apply`. Default: off. |
| `GLPI_MCP_FILES_DIR` | No | Directory where document tools may read/write local files. Default: none (base64 only). |
| `GLPI_MCP_MAX_FILE_MB` | No | Max document size in MB. Default: 10. |
| `GLPI_TOKENS_IN_QUERY` | No | `true` also sends tokens in the query string (only for WAFs that strip headers). Default: off. |

\* Legacy API: `GLPI_USER_TOKEN` or `GLPI_USERNAME` + `GLPI_PASSWORD`.

## Tools

### Tickets and ITIL

`glpi_list_tickets`, `glpi_get_ticket`, `glpi_create_ticket`, `glpi_update_ticket`, `glpi_add_followup`,
`glpi_add_solution`, `glpi_add_task`, `glpi_get_ticket_tasks`, `glpi_request_validation`,
`glpi_answer_validation`, `glpi_get_ticket_validations`, `glpi_create_change`, `glpi_create_problem`,
`glpi_search` (multi-criteria search on any itemtype), `glpi_list_search_options`, and GLPI 11 native forms:
`glpi_list_forms`, `glpi_get_form_details`, `glpi_submit_form`.

### Generic CRUD (any itemtype)

| Tool | Endpoint |
|---|---|
| `glpi_get_item` | `GET /:itemtype/:id` (with_devices, with_logs, …) |
| `glpi_get_items` | `GET /:itemtype` with pagination (total from `Content-Range`), sort, `searchText`, trash, field selection |
| `glpi_get_sub_items` | `GET /:itemtype/:id/:sub_itemtype` |
| `glpi_get_multiple_items` | `GET /getMultipleItems` |
| `glpi_add_items` | `POST /:itemtype` (one or many) |
| `glpi_update_items` | `PUT /:itemtype` (one or many) |
| `glpi_delete_items` | `DELETE /:itemtype` — only with `GLPI_ALLOW_DELETE=true`; trash by default, `force_purge` to delete permanently |

### Projects

| Tool | What it does |
|---|---|
| `glpi_project_list` | Projects with state, parent, manager, progress; filters by name, state, parent |
| `glpi_project_get` | Project + subprojects + team + task tree (with task teams) |
| `glpi_project_create` / `glpi_project_update` | Projects and subprojects (`parent_id`), state, dates, manager, priority |
| `glpi_project_task_list` | Tasks of a project as a tree (or flat) |
| `glpi_project_task_create` / `glpi_project_task_update` | Tasks and subtasks (`parent_task_id`), state, %, dates, `planned_duration_hours`, milestone |
| `glpi_project_team_add` | Add a User, Group, Supplier or Contact to a project or task team |
| `glpi_project_states_list` | Project states (and project/task types) |

Dropdown fields come with the id and the name (`projectstates_id` + `projectstates_id_name`).

### Session, profiles, entities and configuration

`glpi_get_my_profiles`, `glpi_get_active_profile`, `glpi_change_active_profile`, `glpi_get_my_entities`,
`glpi_get_active_entities`, `glpi_change_active_entities`, `glpi_get_full_session`, `glpi_get_glpi_config`
(use `keys` to limit large outputs). GLPI refusals are reported as errors. `lostPassword` is not exposed.

### Documents

| Tool | What it does |
|---|---|
| `glpi_document_upload` | Upload base64 content or a local file, optionally linked to an item |
| `glpi_document_download` | Download to a local file (never overwrites) or as base64; SHA-1 checked against GLPI |

### Massive actions

| Tool | Endpoint |
|---|---|
| `glpi_massive_actions_list` | `getMassiveActions/:itemtype[/:id]` |
| `glpi_massive_action_parameters` | `getMassiveActionParameters/:itemtype/:action` |
| `glpi_massive_action_apply` | `applyMassiveAction/:itemtype/:action` — only with `GLPI_ALLOW_MASSIVE=true`; explicit ids (max 500) |

## Example prompts

- "List the projects in progress and show the task tree of the biggest one."
- "Create project *Office move* with subprojects *Network* and *Furniture*, and a task *Cabling* of 16 hours."
- "Show open tickets of the last week and add a followup to #42."
- "Which computers in the Finance location run Windows 10?"
- "Attach `report.pdf` to ticket 120."

## Security

See [docs/security.md](docs/security.md). In short: give the API user only the GLPI profile it needs,
start in read-only mode, keep delete and massive actions off unless needed, and keep tokens in environment
variables or a secret manager — never in files under version control.

## Development

```bash
npm ci
npm run build
npm test
npx @modelcontextprotocol/inspector node dist/index.js
```

CI runs build, tests and `npm audit` on Node 20, 22 and 24.

## Credits and license

MIT — see [LICENSE](LICENSE). Original work by Ageu Bonfim
([ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server)); continued by Alan Gois.
