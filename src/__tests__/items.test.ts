import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GlpiClient } from '../services/glpi-client';
import { flattenParams, parseContentRange } from '../services/query';
import { registerItemTools } from '../tools/items';

const MOCK_API_URL = 'https://mock-glpi.com';

const okResponse = (body: unknown, contentRange?: string) => ({
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h === 'Content-Range' ? contentRange ?? null : null) },
    json: async () => body,
});

const legacyClient = () => {
    const client = new GlpiClient({ url: MOCK_API_URL, apiVersion: 10, userToken: 't' });
    // @ts-ignore
    client.session = { sessionToken: 'sess', expiresAt: Date.now() + 3600000 };
    return client;
};

describe('query helpers', () => {
    it('flattens nested params into PHP bracket notation', () => {
        expect(flattenParams({
            range: '0-9',
            searchText: { name: 'pc' },
            items: [{ itemtype: 'Ticket', items_id: 1 }],
            ids: [3, 4],
            flag: true,
            skip: undefined,
        })).toEqual({
            range: '0-9',
            'searchText[name]': 'pc',
            'items[0][itemtype]': 'Ticket',
            'items[0][items_id]': '1',
            'ids[0]': '3',
            'ids[1]': '4',
            flag: 'true',
        });
    });

    it('parses Content-Range', () => {
        expect(parseContentRange('0-49/120')).toEqual({ start: 0, end: 49, total: 120 });
        expect(parseContentRange(null)).toBeUndefined();
    });
});

describe('GlpiClient - generic items (legacy API)', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
    });
    afterEach(() => fetchMock.mockRestore());

    it('listItems returns rows and the total from Content-Range', async () => {
        fetchMock.mockResolvedValueOnce(okResponse([{ id: 1 }, { id: 2 }], '0-1/57'));

        const result = await legacyClient().listItems('Computer', { range: '0-1' });

        const url = new URL(fetchMock.mock.calls[0][0]);
        expect(url.pathname).toBe('/apirest.php/Computer');
        expect(url.searchParams.get('range')).toBe('0-1');
        expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }], range: { start: 0, end: 1, total: 57 } });
    });

    it('getMultipleItems encodes the items list', async () => {
        fetchMock.mockResolvedValueOnce(okResponse([]));

        await legacyClient().getMultipleItems([{ itemtype: 'Ticket', items_id: 5 }, { itemtype: 'User', items_id: 2 }]);

        const url = new URL(fetchMock.mock.calls[0][0]);
        expect(url.pathname).toBe('/apirest.php/getMultipleItems');
        expect(url.searchParams.get('items[0][itemtype]')).toBe('Ticket');
        expect(url.searchParams.get('items[1][items_id]')).toBe('2');
    });

    it('addItems posts the input wrapper', async () => {
        fetchMock.mockResolvedValueOnce(okResponse([{ id: 10 }, { id: 11 }]));

        await legacyClient().addItems('Location', [{ name: 'A' }, { name: 'B' }]);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${MOCK_API_URL}/apirest.php/Location`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ input: [{ name: 'A' }, { name: 'B' }] });
    });

    it('updateItems sends PUT with ids inside the input', async () => {
        fetchMock.mockResolvedValueOnce(okResponse([{ 7: true }]));

        await legacyClient().updateItems('Location', [{ id: 7, name: 'C' }]);

        const [, init] = fetchMock.mock.calls[0];
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body)).toEqual({ input: [{ id: 7, name: 'C' }] });
    });

    it('deleteItems sends DELETE with ids, trash by default', async () => {
        fetchMock.mockResolvedValueOnce(okResponse([{ 7: true }]));

        await legacyClient().deleteItems('Location', [7, 8]);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${MOCK_API_URL}/apirest.php/Location`);
        expect(init.method).toBe('DELETE');
        expect(JSON.parse(init.body)).toEqual({ input: [{ id: 7 }, { id: 8 }], force_purge: false, history: true });
    });

    it('rejects legacy-only features when configured for the v2 API', async () => {
        const v2 = new GlpiClient({ url: MOCK_API_URL, apiVersion: 11 });
        await expect(v2.addItems('Location', { name: 'x' })).rejects.toThrow(/GLPI_API_VERSION=10/);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('item tools registration', () => {
    const register = (allowDelete: boolean) => {
        const tools: Record<string, Function> = {};
        const server = {
            registerTool: jest.fn((name: string, _config: unknown, cb: Function) => { tools[name] = cb; }),
        } as unknown as McpServer;
        const client = { listItems: jest.fn() } as unknown as GlpiClient;
        registerItemTools(server, client, { allowDelete });
        return { tools, client };
    };

    it('does not register glpi_delete_items unless allowed', () => {
        expect(Object.keys(register(false).tools)).not.toContain('glpi_delete_items');
        expect(Object.keys(register(true).tools)).toContain('glpi_delete_items');
    });

    it('glpi_get_items reports the total and keeps only requested fields', async () => {
        const { tools, client } = register(false);
        (client.listItems as jest.Mock).mockResolvedValue({
            items: [{ id: 1, name: 'PC-01', serial: 'X' }],
            range: { start: 0, end: 0, total: 42 },
        });

        const result = await tools.glpi_get_items({
            itemtype: 'Computer', start: 0, limit: 1, expand_dropdowns: true,
            fields: ['id', 'name'], search_text: { name: 'PC' },
        });

        expect(client.listItems).toHaveBeenCalledWith('Computer', expect.objectContaining({
            range: '0-0', 'searchText[name]': 'PC', get_hateoas: 'false',
        }));
        const body = JSON.parse(result.content[0].text);
        expect(body.total).toBe(42);
        expect(body.items).toEqual([{ id: 1, name: 'PC-01' }]);
    });
});
