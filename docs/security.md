# Security

An MCP server gives an AI assistant the same power as the GLPI account behind the token. This page lists what
the server does to limit that power and what you should do on your side.

## What the server does

| Area | Behaviour |
|---|---|
| Credentials | Read only from environment variables. Never written to logs or tool outputs. |
| Token transport | `Session-Token` / `App-Token` go in HTTP headers. Query-string tokens only with `GLPI_TOKENS_IN_QUERY=true` (URLs end up in proxy and server logs). |
| Output masking | Every tool result and error passes through a central mask (`src/security/guard.ts`): values of keys that look like passwords, tokens, API keys, secrets, cookies, CSRF tokens, salts or hashes are replaced by `***`, as are `?token=` query values and `Authorization` / `Session-Token` / `App-Token` header values. Numeric settings such as `password_min_length` are kept. |
| Read-only mode | `GLPI_MCP_READ_ONLY=true` registers only tools annotated `readOnlyHint: true`. Tools without annotations are treated as write tools. Read-only mode also disables delete and massive actions. |
| Tool filters | `GLPI_MCP_TOOLS_ALLOW_PATTERN` / `GLPI_MCP_TOOLS_DENY_PATTERN` (regular expressions on tool names). Invalid patterns stop the server at startup. |
| Deletion | `glpi_delete_items` exists only with `GLPI_ALLOW_DELETE=true`; trash by default, permanent purge only with `force_purge=true`. |
| Massive actions | `glpi_massive_action_apply` exists only with `GLPI_ALLOW_MASSIVE=true`, needs an explicit list of ids (max 500); `delete`/`purge` actions also need `GLPI_ALLOW_DELETE=true`. |
| Itemtypes | New tools validate itemtypes as class names (`Ticket`, `Glpi\Form\Form`); path characters are rejected and itemtypes are URL-encoded. |
| Local files | Document tools read/write only inside `GLPI_MCP_FILES_DIR` (no `..`, no absolute paths or symlinks outside it); without it only base64 is accepted. Size limit `GLPI_MCP_MAX_FILE_MB` (default 10). Downloads never overwrite files. |
| Not exposed | `lostPassword` (sends password reset e-mails). |
| Session changes | GLPI answers `false` when it refuses a profile/entity change; the tools report it as an error. |

## What you should do

1. **Dedicated API user with a minimal profile.** The server can only do what the GLPI profile allows. Prefer a
   user whose profile covers the entities and rights the assistant needs — not Super-Admin.
2. **Start read-only.** Use `GLPI_MCP_READ_ONLY=true`, then open specific write tools with
   `GLPI_MCP_TOOLS_ALLOW_PATTERN` when needed.
3. **Keep delete and massive actions off** unless you need them for a task, and turn them off afterwards.
4. **Keep tokens out of files under version control.** Reference environment variables (`${GLPI_USER_TOKEN}`
   in `.mcp.json`) or a secret manager. Regenerate the token if it ever appears in a log, chat or commit.
5. **Use HTTPS** for `GLPI_URL` outside a trusted network.
6. **Review what the assistant is about to do** before approving write tools in your MCP client.

## Reporting a vulnerability

Open a private security advisory on GitHub
([Security → Report a vulnerability](https://github.com/Alan-Gois/glpi-mcp/security/advisories/new)).
Please do not open a public issue for vulnerabilities.

## Security review — v1.0.0 (2026-10-02)

Reviewed: token handling, output masking, policy/guard, path building, file sandbox, delete/massive gates.

- Fixed: tokens were sent in the query string by default (now headers only).
- Fixed: `glpi_search` put the raw itemtype in `/search/:itemtype` (a value such as `Ticket/../getFullSession`
  reached another endpoint) — itemtype now validated and encoded.
- Fixed: `glpi_list_search_options` encoded the whole path (`listSearchOptions%2FX`) and always returned 404.
- Fixed: profile/entity changes refused by GLPI were reported as success.
- Accepted: `glpi_document_download` is a read tool for GLPI but can write files inside `GLPI_MCP_FILES_DIR`;
  without that variable it only returns base64.
- Accepted: the masking is key-based; free-text fields (e.g. a ticket description containing a password typed
  by a user) are returned as stored in GLPI.
