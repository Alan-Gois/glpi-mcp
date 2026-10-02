# Plano: Issue #7 — segurança, documentação e release v1.0.0

Branch: `release/7-v1.0.0`

## Passos
1. Política completa: `GLPI_MCP_READ_ONLY`, `GLPI_MCP_TOOLS_ALLOW_PATTERN`, `GLPI_MCP_TOOLS_DENY_PATTERN`
   (regex inválida derruba a inicialização com mensagem clara); somente leitura desliga delete/massive.
2. `guardServer`: filtra o registro pela política (sem anotação = escrita) e mascara toda saída e erro.
3. Anotações MCP em todas as ferramentas originais.
4. Revisão de segurança: validar e codificar itemtype em `glpi_search`/`glpi_list_search_options`
   (corrige também o 404 do `listSearchOptions`).
5. Versão 1.0.0 (`src/version.ts` conferido com o `package.json` por teste), `prepare` para instalar do GitHub,
   `files` sem testes e mapas.
6. README (en) reescrito, README.pt-BR, `docs/security.md`, `CHANGELOG.md`.
7. Release: tag `v1.0.0` e release no GitHub; `npm pack` e instalação do tarball em diretório limpo.

## Validação
72 testes; teste real: modos padrão (45 ferramentas), tudo liberado (47), somente leitura (27), filtro (7);
`list_search_options` funcionando; caminho malicioso recusado; pacote instalado do tarball rodando.
