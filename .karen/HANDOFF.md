# HANDOFF — glpi-mcp

Repositório público: MCP geral do GLPI (API REST legada e v2), continuação de `ageugyn/glpi-mcp-server`.
Primário: GitHub `Alan-Gois/glpi-mcp` (Issues/PRs). Espelho: Gitea (pendente de criação do repositório).
Regra: nada de IPs, usuários, tokens ou dados de empresa neste repositório.

## Roteiro (Issues)
- [x] #1 fundação (CI, dependências, SDK, `list_tickets` no GLPI 11) — PR #8
- [x] #2 CRUD genérico de qualquer itemtype (Claude Code, estação do mantenedor)
- [x] #3 ferramentas de projetos (Claude Code, estação do mantenedor)
- [ ] #4 sessão, perfis, entidades e configuração
- [ ] #5 documentos (upload/download)
- [ ] #6 ações em massa
- [ ] #7 segurança, docs e release v1.0.0

## Issue #1 — checklist
- [x] Teste + correção do `sort` no `list_tickets` (Claude Code, estação do mantenedor)
- [x] Tokens só em cabeçalhos por padrão; `GLPI_TOKENS_IN_QUERY` opcional (Claude Code, estação do mantenedor)
- [x] package.json, LICENSE, .gitignore, crédito no README (Claude Code, estação do mantenedor)
- [x] SDK 1.31.0 + audit zerado (Claude Code, estação do mantenedor)
- [x] CI GitHub Actions Node 20/22/24 (Claude Code, estação do mantenedor)
- [x] Teste manual contra GLPI 11 real (Claude Code, estação do mantenedor)
- [x] PR `Closes #1` com CI verde (#8)

## Onde parei
Issue #3 implementada e testada contra GLPI 11 real; PR aberto.

## Próximo passo
Issue #4 (sessão, perfis, entidades e configuração).

## Pendências externas
- GitHub Project "GLPI MCP": requer `gh auth refresh -h github.com -s project`.
- Espelho Gitea: criar o repositório vazio (push-to-create desativado) e enviar `main` + branches.
