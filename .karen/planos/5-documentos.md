# Plano: Issue #5 — documentos (upload e download)

Branch: `feat/5-documentos`

## Passos
1. Cliente: `uploadDocument` (multipart com `uploadManifest` + `filename[0]`, Content-Type definido pelo fetch)
   e `downloadDocument` (`Accept: application/octet-stream`).
2. `src/security/files.ts`: caminhos locais só dentro de `GLPI_MCP_FILES_DIR` (bloqueia `..`, absolutos fora e
   links simbólicos para fora); sem a variável, só base64. Limite `GLPI_MCP_MAX_FILE_MB` (padrão 10).
3. `glpi_document_upload` (arquivo local ou base64; vínculo opcional via `Document_Item`) e
   `glpi_document_download` (salva sem sobrescrever ou devolve base64; confere SHA-1 com o do GLPI).

## Validação
Testes unitários (`documents.test.ts`) e teste real num GLPI 11: upload por arquivo e base64, vínculo a um
projeto `[TESTE]`, download com SHA-1 conferido, recusa de `../`; documentos de teste para a lixeira.
