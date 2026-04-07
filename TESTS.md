# GLPI MCP Server - Testing Guidelines

This document outlines the testing strategies, rules, and workflows for the GLPI MCP Server project. All contributors must adhere to these guidelines to ensure continuous stability and quality.

## Testing Stack

- **Framework**: [Jest](https://jestjs.io/)
- **Language**: TypeScript (`ts-jest`)
- **Location**: All test files must reside within the `src/__tests__/` directory.
- **Naming Convention**: Test files must follow the `*.test.ts` naming pattern.

## Rules & Mandates

1. **Test Coverage Requirement**: Every new or changed tool, service class, formatting utility, and endpoint mapper MUST have corresponding unit tests. Uncovered architectural changes will not be accepted.
2. **Prevent Regressions**: Under no circumstances should code be committed or merged if `npm test` throws errors or regressions. The master/main branch must always present a green passing test state.
3. **Mocking External APIs**: Since this MCP server interacts with a live GLPI REST API, tests should mock outgoing HTTP requests (via `jest.mock` or a library like `nock`) to prevent tests from depending on external network availability or sensitive tokens. Real integration tests mapped to test-environments are optional but recommended when validating payload structures.

## Workflows

### 1. Running Unit Tests (Mocked)
To validate business logic without hitting real APIs, run the mocked test suite:
```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### 2. Running Real Integration Tests (Against Live GLPI)
For critical validation of payload structures and cross-version compatibility (v10 vs v11), use a staging GLPI instance and validate with MCP Inspector or a dedicated integration script.

There is currently no versioned live integration script in this repository. If one is added later, document the exact command and output artifact here in the same change.

1. **Configure your `.env`**: Switch the active target (`glpi10` or `glpi11`) using the variables from `.env.example`.
2. **Build the server**:
```bash
npm run build
```
3. **Validate with MCP Inspector**: Run the server through the inspector and execute the Tool Validation Matrix below against the staging instance.

### 3. Validating GLPI 11 HLAPI Compatibility
A dedicated test suite, `src/__tests__/glpi11.test.ts`, ensures that the `GlpiClient` correctly interacts with the modern GLPI 11 "HLAPI". This is crucial for environments using the latest GLPI version.

This suite specifically covers:
- **OAuth2 Authentication**: Verifies that the client can perform the OAuth2 Password Grant flow to obtain a bearer token.
- **V11 Resource Routing**: Confirms that item types are correctly mapped to their new prefixed paths (e.g., `Ticket` -> `Assistance/Ticket`, `Computer` -> `Assets/Computer`).
- **Sub-Item Mapping**: Ensures that nested resources, like followups, are resolved to their new `Timeline` paths.

Running `npm test` will automatically execute this suite, preventing regressions in GLPI 11 compatibility.

### 4. Writing a New Unit Test
Whenever you create a new logic block, follow this workflow:
1. Create a corresponding test file in `src/__tests__/`. For example, if you created `src/services/formatting.ts`, create `src/__tests__/formatting.test.ts`.
2. Wrap your test suites in `describe('Description', () => { ... })`.
3. Use `it('should do X', () => { ... })` for individual test cases.
4. Ensure you handle missing environment variables or mocked API responses gracefully inside the tests.
5. Run `npm test` to verify your new test passes alongside all others.

## Continuous Integration (CI)

Our goal is to integrate `npm test` into the CI/CD pipeline (e.g., GitHub Actions). Whenever a Pull Request is opened, the automated system will execute `npm test` to validate the commit. If the pipeline fails, the code will require fixes before being accepted.

## Production Observations & Edge Cases (`glpi11` vs `glpi10`)

### 1. Group Hierarchies & Search
The same physical team might have different hierarchical paths and names in each instance. Searches must use the "contains" type with the specific leaf name:
- **glpi11**: Search for `NETWORKS` (Full: `TECH_DEPT > INFRA > NETWORKS`).
- **glpi10**: Search for `REDES` (Full path includes prefix `ORG > DEPT > ... > NETWORKS`).

### 2. Business Rules (ITSM Enforcement)
- **glpi11**: Requires a **Technician** (ID Actor type 2) to be assigned to the ticket before a Solution can be registered. Attempting to solve an unassigned ticket will return a 400 error.
- **glpi10**: Allows solution registration without strict actor enforcement in basic configurations.

### 3. Plugin Escalade (`glpi11` Only)
- **Field 1881**: "Grupo afetado pela escalada". Used to track tickets moved via the Escalade plugin.
- **Field 8**: "Grupo técnico". Native field for current ticket ownership in both versions.

### 4. GLPI 11 Native Forms (Phase 2)
- **Namespace Support**: GLPI 11 uses namespaced itemtypes (e.g., `Glpi\Form\Form`). The client resolves these to HLAPI path segments such as `/Glpi/Form/Form`.
- **Search vs. Filter**: The `/search/Glpi\Form\Question` endpoint may return 400 in some environments. Prefer the base collection endpoint with explicit query parameters for better reliability.
- **Form Submission**: Submissions are handled via `Glpi\Form\AnswersSet`. Ensure the profile has the "form" right (ID 31) enabled.

## Environments Mapping
Tests must pass in both major GLPI versions supported:

- **glpi10**: Uses the Legacy REST provider. Validates stable ITIL workflows.
- **glpi11**: Uses the HLAPI provider with updated item routing. Validates future-readiness and routing consistency.

## Tool Validation Matrix (v0.3.0)
Every tool in the following categories must be checked during major releases:

| Tool | Cycle | Manual Validation Step |
|---|---|---|
| `glpi_add_solution` | ITSM Solution | Verify if status is set to "Solved" (5). |
| `glpi_add_task` | Planning | Verify state is "To do" (1) or "Done" (2). |
| `glpi_create_change` | ITIL Change | Verify successful item creation in Change module. |
| `glpi_create_problem` | ITIL Problem | Verify successful item creation in Problem module. |
| `glpi_search` | Discovery | Test complex criteria (AND/OR) with at least 3 fields. |
| `glpi_request_validation` | Approval | Verify record created in `TicketValidation` table. |
| `glpi_answer_validation` | Approval | Verify status changes to 2 (Approved) or 3 (Refused). |
| `glpi_get_ticket_validations`| Visibility | List all approval history for a single ticket. |
| `glpi_list_forms` | Discovery | List active Native Forms in the Service Catalog. |
| `glpi_get_form_details` | Analysis | Retrieve full schema (Questions/Sections) of a form. |
| `glpi_submit_form` | Submission | Submit structured answers to create Tickets/Changes. |

## Evolution & Documentation Sync
Any change to the testing framework or configuration (e.g., changing from Jest to Vitest, or modifying test paths) MUST be documented in this `TESTS.md` file to keep the project's knowledge base updated, adhering to the project's "Documentation Sync" rule established in the `README.md`.
