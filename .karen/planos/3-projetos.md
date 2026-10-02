# Plano: Issue #3 — ferramentas de projetos

Branch: `feat/3-projetos`

## Passos
1. `glpi_project_list` (filtros nome/estado/pai; estado e pai filtrados no cliente sobre até 1000 linhas),
   `glpi_project_get` (projeto + subprojetos + equipe + árvore de tarefas com equipe de cada tarefa).
2. `glpi_project_create`/`update` e `glpi_project_task_create`/`update` com nomes amigáveis mapeados para as
   colunas do GLPI (`parent_id` → `projects_id`, `planned_duration_hours` → segundos, booleanos → 0/1).
3. `glpi_project_team_add` (User/Group/Supplier/Contact em projeto ou tarefa), `glpi_project_states_list`
   (estados e, opcionalmente, tipos).
4. Saída com id e nome dos campos de lista suspensa (`campo` + `campo_name`), via duas leituras (ids e nomes).

## Validação
Testes unitários (`projects.test.ts`) e teste real criando projeto → subprojeto → tarefa → subtarefa `[TESTE]`
num GLPI 11, com equipe, atualização de estado e leitura da árvore; itens de teste enviados para a lixeira.
