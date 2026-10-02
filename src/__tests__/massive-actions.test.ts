import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GlpiClient } from '../services/glpi-client';
import { isDeleteAction, registerMassiveActionTools } from '../tools/massive-actions';

describe('massive action tools', () => {
    const register = (allowMassive: boolean, allowDelete: boolean) => {
        const tools: Record<string, Function> = {};
        const server = {
            registerTool: jest.fn((name: string, _c: unknown, cb: Function) => { tools[name] = cb; }),
        } as unknown as McpServer;
        const client = { callEndpoint: jest.fn().mockResolvedValue({ ok: 2, ko: 0 }) } as unknown as jest.Mocked<GlpiClient>;
        registerMassiveActionTools(server, client, { allowDelete, allowMassive });
        return { tools, client };
    };

    it('classifies delete and purge actions', () => {
        expect(isDeleteAction('MassiveAction:delete')).toBe(true);
        expect(isDeleteAction('MassiveAction:purge')).toBe(true);
        expect(isDeleteAction('MassiveAction:purge_item_but_devices')).toBe(true);
        expect(isDeleteAction('MassiveAction:update')).toBe(false);
        expect(isDeleteAction('MassiveAction:restore')).toBe(false);
    });

    it('registers apply only with GLPI_ALLOW_MASSIVE', () => {
        expect(Object.keys(register(false, true).tools)).toEqual(['glpi_massive_actions_list', 'glpi_massive_action_parameters']);
        expect(Object.keys(register(true, false).tools)).toContain('glpi_massive_action_apply');
    });

    it('lists actions of one item with encoded path', async () => {
        const { tools, client } = register(false, false);
        await tools.glpi_massive_actions_list({ itemtype: 'Ticket', id: 5, is_deleted: false });
        expect(client.callEndpoint).toHaveBeenCalledWith('GET', 'getMassiveActions/Ticket/5', undefined, { is_deleted: '0' });
    });

    it('applies an action to explicit ids', async () => {
        const { tools, client } = register(true, false);
        await tools.glpi_massive_action_apply({ itemtype: 'Project', action: 'MassiveAction:update', ids: [1, 2], input: { a: 1 } });
        expect(client.callEndpoint).toHaveBeenCalledWith(
            'POST', 'applyMassiveAction/Project/MassiveAction%3Aupdate', { ids: [1, 2], input: { a: 1 } }
        );
    });

    it('blocks delete actions without GLPI_ALLOW_DELETE', async () => {
        const { tools, client } = register(true, false);
        const result = await tools.glpi_massive_action_apply({ itemtype: 'Project', action: 'MassiveAction:purge', ids: [1] });
        expect(result.isError).toBe(true);
        expect(client.callEndpoint).not.toHaveBeenCalled();
    });
});
