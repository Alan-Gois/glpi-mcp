# Changelog

All notable changes to this project. Format based on [Keep a Changelog](https://keepachangelog.com/),
versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-02

First release of `@alan-gois/glpi-mcp`, continuing
[ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server) 0.3.0.

### Added
- Generic CRUD for any itemtype: `glpi_get_item`, `glpi_get_items` (pagination with total, `searchText`, trash,
  field selection), `glpi_get_sub_items`, `glpi_get_multiple_items`, `glpi_add_items`, `glpi_update_items`,
  `glpi_delete_items` (opt-in). (#2)
- Project management: `glpi_project_list`, `glpi_project_get` (subprojects, team, task tree with task teams),
  `glpi_project_create`, `glpi_project_update`, `glpi_project_task_list`, `glpi_project_task_create`,
  `glpi_project_task_update`, `glpi_project_team_add`, `glpi_project_states_list`. (#3)
- Session, profiles, entities and configuration: `glpi_get_my_profiles`, `glpi_get_active_profile`,
  `glpi_change_active_profile`, `glpi_get_my_entities`, `glpi_get_active_entities`,
  `glpi_change_active_entities`, `glpi_get_full_session`, `glpi_get_glpi_config`. (#4)
- Documents: `glpi_document_upload`, `glpi_document_download` with SHA-1 check and a local file sandbox. (#5)
- Massive actions: `glpi_massive_actions_list`, `glpi_massive_action_parameters`,
  `glpi_massive_action_apply` (opt-in). (#6)
- Read-only mode, allow/deny tool patterns, central secret masking of every output, MCP tool annotations on all
  tools, `docs/security.md`, README in English and Portuguese. (#7)
- CI on Node 20/22/24 with build, tests and `npm audit`. (#1)

### Changed
- Package renamed to `@alan-gois/glpi-mcp` (bin `glpi-mcp`, `glpi-mcp-server` kept); Node.js 20+. (#1)
- MCP SDK 1.31.0; no known vulnerabilities. (#1)
- Tokens of the legacy API are sent in headers only; `GLPI_TOKENS_IN_QUERY=true` restores query-string
  tokens. (#1)

### Fixed
- `glpi_list_tickets` failed on GLPI 11 (`sort param is not a field of glpi_tickets`). (#1)
- `glpi_list_search_options` always returned 404 on the legacy API. (#7)
- `glpi_search` accepted path characters in the itemtype. (#7)
- Profile/entity changes refused by GLPI were reported as success. (#4)
