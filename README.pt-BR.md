# GLPI MCP Server (português)

Conecta assistentes de IA (Claude, ChatGPT, Copilot…) ao **GLPI** pelo
[Model Context Protocol (MCP)](https://modelcontextprotocol.io): chamados, ITIL, **projetos**, qualquer
itemtype, documentos, ações em massa, sessão e configuração — com padrões seguros.

[English](README.md) · [Segurança](docs/security.md) · [Changelog](CHANGELOG.md)

> Continuação de [ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server), de Ageu Bonfim (MIT),
> com o histórico completo, para cobrir toda a API REST legada do GLPI.

## Destaques

- **47 ferramentas**: chamados e ITIL, CRUD genérico de **qualquer itemtype**, **gestão de projetos**
  (projetos, subprojetos, árvore de tarefas, equipes, estados), sessão/perfis/entidades, documentos e ações em massa.
- **Seguro por padrão**: exclusão e ações em massa desligadas; modo somente leitura; filtros de ferramentas por
  regex; segredos mascarados em toda saída; tokens em cabeçalhos (não na URL); arquivos locais restritos a um diretório.
- Funciona com **GLPI 10 e 11** pela API REST legada (`apirest.php`, que também vem no GLPI 11).

## Versões

| GLPI | API | Situação |
|---|---|---|
| 10.0.x | REST legada (`/apirest.php`) | ✅ Todas as ferramentas |
| 11.0.x | REST legada (`/apirest.php`) — recomendado | ✅ Todas as ferramentas (testado no 11.0.7) |
| 11.0.x | API de alto nível (`/api.php`, OAuth2) | ⚠️ Só as ferramentas originais de chamados/ITIL/formulários |

## Início rápido

1. **Habilite a API no GLPI:** Configurar → Geral → API → ligar a API REST e o "login com token externo".
   Pegue o **Token de API** do usuário: preferências do usuário (ou Administração → Usuários → usuário) →
   **Senhas e chaves de acesso** → **Token de API** → regenerar. O *App-Token* só é necessário se o cliente da
   API exigir.
2. **Instale** (Node.js 20+):

   ```bash
   git clone https://github.com/Alan-Gois/glpi-mcp.git
   cd glpi-mcp
   npm ci
   npm run build
   ```

   Ou direto do GitHub: `npx -y github:Alan-Gois/glpi-mcp`.
3. **Configure o cliente MCP.** No Claude Code (`.mcp.json` do projeto), com os valores vindos de variáveis de
   ambiente:

   ```json
   {
     "mcpServers": {
       "glpi": {
         "command": "node",
         "args": ["/caminho/absoluto/glpi-mcp/dist/index.js"],
         "env": {
           "GLPI_URL": "https://glpi.exemplo.com.br",
           "GLPI_USER_TOKEN": "${GLPI_USER_TOKEN}",
           "GLPI_MCP_READ_ONLY": "true"
         }
       }
     }
   }
   ```

Comece com `GLPI_MCP_READ_ONLY=true` e libere escrita quando estiver confortável.

## Variáveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GLPI_URL` | Sim | URL base do GLPI (sem `/apirest.php`). |
| `GLPI_USER_TOKEN` | Sim* | Token de API do usuário. |
| `GLPI_USERNAME` / `GLPI_PASSWORD` | * | Alternativa ao token (API legada); obrigatórios na API v2. |
| `GLPI_APP_TOKEN` | Não | App-Token, se o cliente da API exigir. |
| `GLPI_API_VERSION` | Não | `10` (padrão, API legada — recomendado também no GLPI 11) ou `11` (API de alto nível). |
| `GLPI_MCP_READ_ONLY` | Não | `true` registra só ferramentas de leitura (vence as opções abaixo). |
| `GLPI_MCP_TOOLS_ALLOW_PATTERN` | Não | Regex: só registra ferramentas cujo nome casa. |
| `GLPI_MCP_TOOLS_DENY_PATTERN` | Não | Regex: nunca registra ferramentas cujo nome casa. |
| `GLPI_ALLOW_DELETE` | Não | `true` registra `glpi_delete_items` e libera ações em massa de exclusão. Padrão: desligado. |
| `GLPI_ALLOW_MASSIVE` | Não | `true` registra `glpi_massive_action_apply`. Padrão: desligado. |
| `GLPI_MCP_FILES_DIR` | Não | Diretório onde as ferramentas de documento podem ler/gravar arquivos. Padrão: nenhum (só base64). |
| `GLPI_MCP_MAX_FILE_MB` | Não | Tamanho máximo de documento em MB. Padrão: 10. |
| `GLPI_TOKENS_IN_QUERY` | Não | `true` também envia tokens na URL (só para WAFs que removem cabeçalhos). Padrão: desligado. |

\* API legada: `GLPI_USER_TOKEN` ou `GLPI_USERNAME` + `GLPI_PASSWORD`.

## Ferramentas

A lista completa, com os endpoints, está no [README em inglês](README.md#tools). Grupos:

- **Chamados e ITIL**: listar, ler, criar, editar, acompanhamentos, soluções, tarefas, validações, mudanças,
  problemas, busca avançada e formulários nativos do GLPI 11.
- **CRUD genérico**: `glpi_get_item`, `glpi_get_items`, `glpi_get_sub_items`, `glpi_get_multiple_items`,
  `glpi_add_items`, `glpi_update_items`, `glpi_delete_items` (protegida).
- **Projetos**: `glpi_project_list`, `glpi_project_get`, `glpi_project_create`, `glpi_project_update`,
  `glpi_project_task_list`, `glpi_project_task_create`, `glpi_project_task_update`, `glpi_project_team_add`,
  `glpi_project_states_list`.
- **Sessão**: perfis, entidades, sessão completa e configuração (com segredos mascarados).
- **Documentos**: upload e download com conferência de SHA-1.
- **Ações em massa**: listar, parâmetros e aplicar (protegida).

## Segurança

Veja [docs/security.md](docs/security.md): perfil mínimo no GLPI para o usuário da API, modo somente leitura no
início, exclusão e ações em massa desligadas, tokens só em variáveis de ambiente ou cofre de senhas.

## Créditos e licença

MIT — veja [LICENSE](LICENSE). Trabalho original de Ageu Bonfim
([ageugyn/glpi-mcp-server](https://github.com/ageugyn/glpi-mcp-server)); continuação de Alan Gois.
