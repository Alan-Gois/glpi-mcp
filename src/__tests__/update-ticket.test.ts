import { GlpiClient } from '../services/glpi-client';

describe('GlpiClient - Update Ticket', () => {
    let client: GlpiClient;
    let fetchMock: jest.SpyInstance;
    const MOCK_API_URL = 'https://mock-glpi.com';

    beforeEach(() => {
        client = new GlpiClient({
            url: MOCK_API_URL,
            apiVersion: 10,
            userToken: 'test_token'
        });

        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
        
        // Mock da sessão
        // @ts-ignore
        client.session = { sessionToken: 'dummy_v10', expiresAt: Date.now() + 3600000 };
    });

    afterEach(() => {
        fetchMock.mockRestore();
    });

    it('deve atualizar um chamado no GLPI 10 usando PUT /apirest.php/Ticket/{id} com wrapper { input }', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ 42: true }) // Formato de sucesso do GLPI legacy
        });

        await client.updateTicket(42, {
            status: 2, // Em andamento (atribuído)
            users_id_assign: 5
        });

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/apirest.php/Ticket/42`,
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({
                    input: {
                        status: 2,
                        users_id_assign: 5
                    }
                })
            })
        );
    });

    it('deve atualizar um chamado no GLPI 11 usando PUT /api.php/Assistance/Ticket/{id} sem wrapper { input }', async () => {
        const clientV11 = new GlpiClient({
            url: MOCK_API_URL,
            apiVersion: 11,
            username: 'u', password: 'p', oauthClientId: 'c', oauthSecret: 's'
        });
        
        // @ts-ignore
        clientV11.session = { accessToken: 'dummy_v11', refreshToken: 'dummy', expiresAt: Date.now() + 3600000 };

        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ 99: true })
        });

        await clientV11.updateTicket(99, {
            content: 'Texto atualizado',
            priority: 5
        });

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/Assistance/Ticket/99`,
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy_v11'
                }),
                body: JSON.stringify({
                    content: 'Texto atualizado',
                    priority: 5
                })
            })
        );
    });
});
