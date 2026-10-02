# Plano: Issue #2 — CRUD genérico de qualquer itemtype

Branch: `feat/2-crud-generico`

## Passos
1. Cliente: separar `send()` (Response, cabeçalhos/binário) de `request()` (JSON); corpo também em `DELETE`;
   `requireLegacy()` com erro claro quando `GLPI_API_VERSION=11`.
2. `flattenParams` (notação de colchetes do PHP) e `parseContentRange` (total da paginação).
3. Métodos `listItems`, `getMultipleItems`, `addItems`, `updateItems`, `deleteItems`.
4. Ferramentas `glpi_get_item`, `glpi_get_items`, `glpi_get_sub_items`, `glpi_get_multiple_items`,
   `glpi_add_items`, `glpi_update_items` e `glpi_delete_items` (só registrada com `GLPI_ALLOW_DELETE=true`;
   lixeira por padrão, `force_purge` explícito). Anotações MCP `readOnlyHint`/`destructiveHint`.
5. Contagem de ferramentas registradas automática no log de inicialização.

## Validação
- Testes unitários (`items.test.ts`).
- Teste real via cliente MCP stdio contra GLPI 11: listar/ler/sub-itens/múltiplos; criar, editar e mandar para a
  lixeira um projeto `[TESTE]`.
