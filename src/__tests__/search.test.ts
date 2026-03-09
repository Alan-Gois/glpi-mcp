import { registerSearch } from '../tools/search';
import { GlpiClient } from '../services/glpi-client';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

jest.mock('../services/glpi-client');

describe('glpi_search tool', () => {
    let mockClient: jest.Mocked<GlpiClient>;
    let mockServer: McpServer;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let registeredCallback: Function;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = new GlpiClient({ url: 'http://localhost' }) as jest.Mocked<GlpiClient>;
        mockServer = {
            registerTool: jest.fn((name, config, callback) => {
                registeredCallback = callback;
            }),
        } as unknown as McpServer;
    });

    it('deve realizar busca simples convertendo nome do campo pré-mapeado', async () => {
        registerSearch(mockServer, mockClient);

        // Simulando a resposta do GLPI
        mockClient.search.mockResolvedValue({
            data: [{ id: 1, name: 'Computador A', location_name: 'TI' }],
            totalcount: 1,
            count: 1
        } as any);

        const result = await registeredCallback({
            itemtype: 'Computer',
            criteria: [{ field: 'location', value: 'TI', search_type: 'contains' }],
            limit: 25
        });

        // Verificações
        expect(mockClient.search).toHaveBeenCalledWith(
            'Computer',
            [{ field: 3, searchtype: 'contains', value: 'TI' }],
            { range: '0-24', forcedisplay: expect.any(String) }
        );

        expect(result.isError).toBeFalsy();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Resultados da Busca: Computer');
        expect(result.content[0].text).toContain('Computador A');
    });

    it('deve formatar erro graciosamente quando a requisição falha (MCP Graceful Error)', async () => {
        registerSearch(mockServer, mockClient);

        mockClient.search.mockRejectedValue(new Error('GLPI API Timeout'));

        const result = await registeredCallback({
            itemtype: 'Computer',
            criteria: [{ field: 'name', value: 'test' }],
            limit: 10
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Erro ao buscar Computer: GLPI API Timeout');
    });

    it('deve reter o link (AND/OR) para buscas multi-critério', async () => {
        registerSearch(mockServer, mockClient);

        mockClient.search.mockResolvedValue({ data: [], totalcount: 0 } as any);

        await registeredCallback({
            itemtype: 'Computer',
            criteria: [
                { field: 'location', value: 'Financeiro', search_type: 'contains' },
                { field: 'name', value: 'SRV', search_type: 'equals', link: 'AND' }
            ],
            limit: 10
        });

        expect(mockClient.search).toHaveBeenCalledWith(
            'Computer',
            [
                { field: 3, searchtype: 'contains', value: 'Financeiro' },
                { field: 1, searchtype: 'equals', value: 'SRV', link: 'AND' }
            ],
            expect.any(Object)
        );
    });

    it('deve aceitar IDs numéricos como string customizados', async () => {
        registerSearch(mockServer, mockClient);
        mockClient.search.mockResolvedValue({ data: [], totalcount: 0 } as any);

        await registeredCallback({
            itemtype: 'Computer',
            criteria: [{ field: '167', value: 'SemAntivirus', search_type: 'equals' }],
            limit: 5
        });

        expect(mockClient.search).toHaveBeenCalledWith(
            'Computer',
            [{ field: 167, searchtype: 'equals', value: 'SemAntivirus' }],
            expect.any(Object)
        );
    });
});
