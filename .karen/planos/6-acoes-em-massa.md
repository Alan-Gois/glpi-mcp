# Plano: Issue #6 — ações em massa

Branch: `feat/6-acoes-em-massa`

## Passos
1. `glpi_massive_actions_list` (por itemtype ou item; lixeira) e `glpi_massive_action_parameters`.
2. `glpi_massive_action_apply` só registrada com `GLPI_ALLOW_MASSIVE=true`; ids explícitos (máx. 500);
   ações `delete`/`purge` exigem também `GLPI_ALLOW_DELETE=true`.

## Validação
Testes unitários (`massive-actions.test.ts`) e teste real num GLPI 11: listar ações da lixeira de projetos,
purge bloqueado sem a variável, restore e delete (de volta para a lixeira) nos projetos `[TESTE]`.
