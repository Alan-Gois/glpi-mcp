# Plano: Issue #1 — fundação do repositório

Issue: https://github.com/Alan-Gois/glpi-mcp/issues/1 · Branch: `chore/1-fundacao`

## Objetivo
Base sólida para as próximas entregas: build, testes e auditoria verdes no CI público.

## Passos
1. Teste de regressão do `list_tickets` (GLPI 11 rejeita `sort=15`) → corrigir para `sort=date_mod`.
2. Testes `create-ticket` e `update-ticket` já falhavam no original: o cliente mandava `session_token` e
   `app_token` na URL além dos cabeçalhos. Decisão: tokens **só em cabeçalhos** por padrão (URL vai para logs de
   proxy/servidor); `GLPI_TOKENS_IN_QUERY=true` mantém o comportamento antigo para WAFs que removem cabeçalhos.
   Teste novo `token-transport.test.ts`.
3. `package.json`: nome `@alan-gois/glpi-mcp`, bin `glpi-mcp` (mantido `glpi-mcp-server`), repositório, crédito ao
   autor original, `engines` Node ≥ 20, `files`.
4. `LICENSE` MIT com os dois copyrights; crédito no README.
5. `.gitignore`: `.env.*` (exceto `.env.example`), `coverage/`.
6. SDK MCP `^1.31.0` + `npm audit fix` → 0 vulnerabilidades.
7. GitHub Actions: Node 20/22/24 com `npm ci`, build, test e `npm audit --omit=dev`.

## Validação
- `npm test` (20 testes) e `npm run build` locais.
- Teste manual somente leitura contra um GLPI 11 real: `listTickets` e `getTicket` ok com tokens só em cabeçalhos.
- CI do PR verde nas 3 versões.

## Riscos
- Quem dependia do envio automático na URL (WAF) precisa ligar `GLPI_TOKENS_IN_QUERY=true` (documentado no README).
