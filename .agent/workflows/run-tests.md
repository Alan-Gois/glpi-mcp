---
description: How to execute and validate tests for the GLPI MCP Server
---

# Automated Testing Workflow

1. Write your new logic inside the `src/` directory.
2. Draft the expected test cases in a `*.test.ts` file in `src/__tests__/`.
3. Use this tool command to automatically run all the test suites to validate your logic.

// turbo-all
4. Run Jest Test suite locally:
```bash
npm test
```

5. Evaluate the command output.
6. If the terminal throws an error or testing regressions are shown, you MUST fix the logic or the test constraints before committing to the repository or concluding the user task.
