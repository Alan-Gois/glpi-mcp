import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GlpiClient } from '../services/glpi-client';
import { MASK, maskSecrets, maskText } from '../security/mask';
import { registerSessionTools } from '../tools/session';

describe('secret masking', () => {
    it('masks secret-looking keys at any depth and keeps the rest', () => {
        expect(maskSecrets({
            glpiID: 7,
            glpiname: 'api',
            api_token: 'abc123',
            nested: { smtp_passwd: 'p', personal_token: 'x', _glpi_csrf_token: 'c', empty_token: '', password_min_length: '8', use_password_security: 1 },
            list: [{ password: 'q', name: 'ok' }],
        })).toEqual({
            glpiID: 7,
            glpiname: 'api',
            api_token: MASK,
            nested: { smtp_passwd: MASK, personal_token: MASK, _glpi_csrf_token: MASK, empty_token: '', password_min_length: '8', use_password_security: 1 },
            list: [{ password: MASK, name: 'ok' }],
        });
    });

    it('masks secrets inside free text', () => {
        const text = '{"api_token": "abcdef", "name": "x"} GET /x?session_token=s3cr3t&range=0-1 Authorization: user_token zzz';
        const masked = maskText(text);
        expect(masked).not.toMatch(/abcdef|s3cr3t|zzz/);
        expect(masked).toContain('"name": "x"');
        expect(masked).toContain('range=0-1');
    });
});

describe('session tools', () => {
    let tools: Record<string, Function>;
    let client: jest.Mocked<GlpiClient>;

    beforeEach(() => {
        tools = {};
        const server = {
            registerTool: jest.fn((name: string, _c: unknown, cb: Function) => { tools[name] = cb; }),
        } as unknown as McpServer;
        client = { callEndpoint: jest.fn() } as unknown as jest.Mocked<GlpiClient>;
        registerSessionTools(server, client);
    });

    it('registers one tool per endpoint and no lostPassword', () => {
        expect(Object.keys(tools)).toHaveLength(8);
        expect(Object.keys(tools).join()).not.toMatch(/lost|password/i);
    });

    it('masks secrets of the full session and filters keys', async () => {
        client.callEndpoint.mockResolvedValue({ session: { glpiID: 7, glpiname: 'api', valid_id: 'abc', glpicsrftokens: { a: 1 }, api_token: 'tok' } });

        const all = JSON.parse((await tools.glpi_get_full_session({})).content[0].text);
        expect(all.api_token).toBe(MASK);

        const some = JSON.parse((await tools.glpi_get_full_session({ keys: ['glpiID', 'glpiname'] })).content[0].text);
        expect(some).toEqual({ glpiID: 7, glpiname: 'api' });
    });

    it('masks the configuration', async () => {
        client.callEndpoint.mockResolvedValue({ cfg_glpi: { version: '11.0.7', smtp_passwd: 'secret', proxy_passwd: 'x' } });
        const cfg = JSON.parse((await tools.glpi_get_glpi_config({})).content[0].text);
        expect(cfg).toEqual({ version: '11.0.7', smtp_passwd: MASK, proxy_passwd: MASK });
    });

    it('changes the active entity and returns the new scope', async () => {
        client.callEndpoint.mockResolvedValueOnce(true).mockResolvedValueOnce({ active_entity: { id: 0, active_entity_recursive: 1 } });
        const result = await tools.glpi_change_active_entities({ entities_id: 'all', is_recursive: true });
        expect(client.callEndpoint).toHaveBeenCalledWith('POST', 'changeActiveEntities', { entities_id: 'all', is_recursive: true });
        expect(result.content[0].text).toContain('"active_entity_recursive": 1');
    });

    it('reports an error when GLPI refuses the change (answers false)', async () => {
        client.callEndpoint.mockResolvedValue(false);
        const r1 = await tools.glpi_change_active_entities({ entities_id: 0, is_recursive: true });
        const r2 = await tools.glpi_change_active_profile({ profiles_id: 99 });
        expect(r1.isError).toBe(true);
        expect(r2.isError).toBe(true);
        expect(r2.content[0].text).toMatch(/refused/);
    });

    it('summarizes the active profile unless rights are requested', async () => {
        client.callEndpoint.mockResolvedValue({ active_profile: { id: 4, name: 'Super-Admin', interface: 'central', ticket: 31 } });
        const p = JSON.parse((await tools.glpi_get_active_profile({ include_rights: false })).content[0].text);
        expect(p).toEqual({ id: 4, name: 'Super-Admin', interface: 'central' });
    });
});
