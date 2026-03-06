# GLPI MCP Server - Testing Guidelines

This document outlines the testing strategies, rules, and workflows for the GLPI MCP Server project. All contributors must adhere to these guidelines to ensure continuous stability and quality.

## Testing Stack

- **Framework**: [Jest](https://jestjs.io/)
- **Language**: TypeScript (`ts-jest`)
- **Location**: All test files must reside within the `src/__tests__/` directory.
- **Naming Convention**: Test files must follow the `*.test.ts` or `*.spec.ts` naming pattern.

## Rules & Mandates

1. **Test Coverage Requirement**: Every new tool, service class, formatting utility, and endpoint mapper added to the project MUST have corresponding unit tests. Uncovered architectural code will not be accepted.
2. **Prevent Regressions**: Under no circumstances should code be committed or merged if `npm test` throws errors or regressions. The master/main branch must always present a green passing test state.
3. **Mocking External APIs**: Since this MCP server interacts with a live GLPI REST API, tests should mock outgoing HTTP requests (via `jest.mock` or a library like `nock`) to prevent tests from depending on external network availability or sensitive tokens. Real integration tests mapped to test-environments are optional but recommended when validating payload structures.

## Workflows

### 1. Running Tests Locally
To validate all existing functionalities, run the test suite:
```bash
# Run all tests once
npm test

# Run tests in watch mode (ideal for active development)
npm run test:watch
```
*(Note: to use watch mode, you may add `"test:watch": "jest --watch"` to package.json).*

### 2. Writing a New Unit Test
Whenever you create a new logic block, follow this workflow:
1. Create a corresponding test file in `src/__tests__/`. For example, if you created `src/services/formatting.ts`, create `src/__tests__/formatting.test.ts`.
2. Wrap your test suites in `describe('Description', () => { ... })`.
3. Use `it('should do X', () => { ... })` for individual test cases.
4. Ensure you handle missing environment variables or mocked API responses gracefully inside the tests.
5. Run `npm test` to verify your new test passes alongside all others.

## Continuous Integration (CI)

Our goal is to integrate `npm test` into the CI/CD pipeline (e.g., GitHub Actions). Whenever a Pull Request is opened, the automated system will execute `npm test` to validate the commit. If the pipeline fails, the code will require fixes before being accepted.

## Evolution & Documentation Sync
Any change to the testing framework or configuration (e.g., changing from Jest to Vitest, or modifying test paths) MUST be documented in this `TESTS.md` file to keep the project's knowledge base updated, adhering to the project's "Documentation Sync" rule established in the `README.md`.
