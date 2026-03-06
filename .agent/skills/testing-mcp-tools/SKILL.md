---
name: Mocking and MCP Testing
description: Specialized guidelines on testing GLPI REST endpoints alongside the MCP Server protocol.
---

# Mocking and testing the MCP Protocol

## Purpose
The primary objective of testing this server is to ensure the **MCP input payloads** from natural language prompts are well parsed, structured, and executed without directly pinging a live GLPI REST API (which depends on tokens, passwords and strict network settings).

## Methodology

### 1. Mock the Service logic (`jest.mock`)
You should avoid making realistic network HTTP requests from the `glpi-client.ts`. By abstracting `src/services/`, you test whether the `src/tools/` correctly pass instructions.
```typescript
import { myServiceFunction } from '../../services/glpi-client';
// Use jest to mock the imported dependency entirely
jest.mock('../../services/glpi-client');
```

### 2. Mocking Returns
You must manually specify what the mocked function should return as an asynchronous promise. E.g.:
```typescript
const mockServiceFunction = myServiceFunction as jest.MockedFunction<typeof myServiceFunction>;
mockServiceFunction.mockResolvedValue({ status: 200, data: 'Mocked Ticket Object' });
```

### 3. Verify Formatting Tools
The Model Context Protocol requires tools to respond with an array of structured text.
Always assert that tools return exactly:
```typescript
{
    content: [
      {
        type: "text",
        text: expect.any(String) // Usually JSON serialized or formatted markdown
      }
    ]
}
```

### 4. Throw Errors to Verify Resiliency
Validate the `catch {}` mechanisms returning error strings instead of crashing the MCP Server.
```typescript
mockServiceFunction.mockRejectedValue(new Error('GLPI API Timeout'));
// your expectations should verify that the MCP tool gracefully outputs the text: "Error: GLPI API Timeout".
```
