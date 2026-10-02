# Plano: Issue #4 — sessão, perfis, entidades e configuração

Branch: `feat/4-sessao`

## Passos
1. `callEndpoint()` no cliente para endpoints da API legada sem itemtype.
2. Uma ferramenta por endpoint: `glpi_get_my_profiles`, `glpi_get_active_profile`, `glpi_change_active_profile`,
   `glpi_get_my_entities`, `glpi_get_active_entities`, `glpi_change_active_entities`, `glpi_get_full_session`,
   `glpi_get_glpi_config`. `lostPassword` não é exposto (dispara e-mail).
3. `src/security/mask.ts`: `maskSecrets` (chaves com senha/token/segredo/chave/cookie/csrf/hash, preservando
   números e flags de configuração) e `maskText` (texto livre, query string e cabeçalhos) — base da #7.
4. GLPI responde `false` (HTTP 200) quando recusa troca de perfil/entidade: tratar como erro.

## Validação
Testes unitários (`session.test.ts`) e teste real num GLPI 11: perfis, entidades, sessão e configuração
(sem segredos na saída), troca de perfil ida e volta, recusa de entidade recursiva reportada como erro.
