import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { guardServer } from '../security/guard';
import { isToolAllowed, loadPolicy } from '../security/policy';
import { SERVER_VERSION } from '../version';

const pkg = require('../../package.json');

describe('tool policy', () => {
    it('defaults: everything allowed, delete and massive off', () => {
        const p = loadPolicy({});
        expect(p).toMatchObject({ allowDelete: false, allowMassive: false, readOnly: false });
        expect(isToolAllowed(p, 'glpi_add_items', false)).toBe(true);
    });

    it('read-only mode blocks write tools and overrides the write switches', () => {
        const p = loadPolicy({ GLPI_MCP_READ_ONLY: 'true', GLPI_ALLOW_DELETE: 'true', GLPI_ALLOW_MASSIVE: 'true' });
        expect(p.allowDelete).toBe(false);
        expect(p.allowMassive).toBe(false);
        expect(isToolAllowed(p, 'glpi_get_items', true)).toBe(true);
        expect(isToolAllowed(p, 'glpi_add_items', false)).toBe(false);
    });

    it('applies allow and deny patterns', () => {
        const p = loadPolicy({ GLPI_MCP_TOOLS_ALLOW_PATTERN: '^glpi_project_', GLPI_MCP_TOOLS_DENY_PATTERN: '_update$' });
        expect(isToolAllowed(p, 'glpi_project_list', true)).toBe(true);
        expect(isToolAllowed(p, 'glpi_project_update', false)).toBe(false);
        expect(isToolAllowed(p, 'glpi_get_items', true)).toBe(false);
    });

    it('rejects invalid patterns with a clear message', () => {
        expect(() => loadPolicy({ GLPI_MCP_TOOLS_DENY_PATTERN: '(' })).toThrow(/GLPI_MCP_TOOLS_DENY_PATTERN/);
    });
});

describe('guardServer', () => {
    const setup = (env: NodeJS.ProcessEnv) => {
        const registered: Record<string, Function> = {};
        const server = {
            registerTool: jest.fn((name: string, _c: unknown, cb: Function) => { registered[name] = cb; }),
        } as unknown as McpServer;
        const stats = guardServer(server, loadPolicy(env));
        return { server, registered, stats };
    };

    it('skips write tools in read-only mode, treating missing annotations as write', () => {
        const { server, registered, stats } = setup({ GLPI_MCP_READ_ONLY: 'true' });
        server.registerTool('r', { annotations: { readOnlyHint: true } } as any, async () => ({ content: [] }));
        server.registerTool('w', { annotations: { readOnlyHint: false } } as any, async () => ({ content: [] }));
        server.registerTool('none', {} as any, async () => ({ content: [] }));
        expect(Object.keys(registered)).toEqual(['r']);
        expect(stats).toEqual({ registered: ['r'], skipped: ['w', 'none'] });
    });

    it('masks secrets in results and in thrown errors', async () => {
        const { server, registered } = setup({});
        server.registerTool('leak', { annotations: { readOnlyHint: true } } as any,
            async () => ({ content: [{ type: 'text', text: '{"api_token": "abcdef123456", "name": "ok"}' }] }));
        server.registerTool('boom', { annotations: { readOnlyHint: true } } as any,
            async () => { throw new Error('GET /x?session_token=s3cr3tvalue failed'); });

        const ok = await registered.leak({});
        expect(ok.content[0].text).not.toContain('abcdef123456');
        expect(ok.content[0].text).toContain('"name": "ok"');

        const err = await registered.boom({});
        expect(err.isError).toBe(true);
        expect(err.content[0].text).not.toContain('s3cr3tvalue');
    });
});

describe('version', () => {
    it('matches package.json', () => {
        expect(SERVER_VERSION).toBe(pkg.version);
    });
});
