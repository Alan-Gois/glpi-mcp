---
description: Strict rules regarding automated testing and test-driven development (TDD)
---

# Automated Testing Rules

1. **Mandatory Coverage**: All backend components, formatting utilities, and tool abstractions MUST be covered by automated tests using Jest.
2. **Prevent Regressions**: Never commit code, finish a task, or accept a Pull Request if `npm test` throws errors or regressions. The project must always be kept in a passing state.
3. **Location & Pattern**: Test files must reside in the `src/__tests__/` directory and follow the `*.test.ts` naming convention.
4. **Mock ExternalAPIs**: Do not rely on valid GLPI network connection or tokens during unit testing. You must mock the requests to ensure the MCP server tests run in an isolated and stable environment.
5. **Documentation Sync**: Modifying any testing procedure requires updating `TESTS.md` and `README.md`.
