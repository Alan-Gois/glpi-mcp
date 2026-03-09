import { registerListSearchOptions } from '../tools/list-search-options';
import { GlpiClient } from '../services/glpi-client';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

jest.mock('../services/glpi-client');

describe('glpi_list_search_options tool', () => {
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

    it('deve formatar todas as opções disponíveis formatadas como markdown', async () => {
        registerListSearchOptions(mockServer, mockClient);

        // Mock GLPI GET /listSearchOptions/Computer
        mockClient.getItems.mockResolvedValue({
            "1": { name: "Name", group: "General", field: "name", table: "glpi_computers", datatype: "string" },
            "common": "A header row to ignore",
            "167": { name: "Antivírus", group: "Inventory", field: "antivirus", table: "glpi_plugin_inventory", datatype: "string" }
        });

        const result = await registeredCallback({
            itemtype: 'Computer'
        });

        expect(mockClient.getItems).toHaveBeenCalledWith('listSearchOptions/Computer', {});

        expect(result.isError).toBeFalsy();
        const textOutput = result.content[0].text;
        expect(textOutput).toContain('Opções de Busca: Computer');

        expect(textOutput).toContain('| **1** | Name | General | string |');
        expect(textOutput).toContain('| **167** | Antivírus | Inventory | string |');
        expect(textOutput).not.toContain('A header row to ignore');
    });

    it('deve filtrar os campos quando filter é providenciado', async () => {
        registerListSearchOptions(mockServer, mockClient);

        mockClient.getItems.mockResolvedValue({
            "1": { name: "Name" },
            "3": { name: "Location" },
            "167": { name: "Software / Antivírus" }
        });

        const result = await registeredCallback({
            itemtype: 'Computer',
            filter: 'antiv'
        });

        const textOutput = result.content[0].text;
        expect(textOutput).toContain('167');
        expect(textOutput).toContain('Antivírus');
        expect(textOutput).not.toContain('Location'); // Field 3 shouldn't be printed
    });

    it('deve retornar isError=true (Graceful erro em exceção)', async () => {
        registerListSearchOptions(mockServer, mockClient);

        mockClient.getItems.mockRejectedValue(new Error('Unknown ItemType X'));

        const result = await registeredCallback({ itemtype: 'Fornecedor' });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Erro ao listar opções de busca para Fornecedor: Unknown ItemType X');
    });
});
