import { GlpiClient } from '../services/glpi-client';

describe('GlpiClient - Create Ticket', () => {
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
        
        // Mock da sessão (para pular login)
        // @ts-ignore
        client.session = { sessionToken: 'dummy_v10', expiresAt: Date.now() + 3600000 };
    });

    afterEach(() => {
        fetchMock.mockRestore();
    });

    it('deve criar um chamado no GLPI 10 usando /apirest.php/Ticket com wrapper { input }', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ id: 42, message: 'Ticket created' })
        });

        const result = await client.createTicket({
            name: 'Ticket v10 Test',
            content: 'My description',
            priority: 4
        });

        expect(result.id).toBe(42);
        expect(result.message).toBe('Ticket created');

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/apirest.php/Ticket`,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Session-Token': 'dummy_v10',
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    input: {
                        name: 'Ticket v10 Test',
                        content: 'My description',
                        type: 1,      // default
                        priority: 4,  // passed
                        urgency: 3    // default
                    }
                })
            })
        );
    });

    it('deve criar um chamado no GLPI 11 usando /api.php/Assistance/Ticket sem wrapper { input }', async () => {
        const clientV11 = new GlpiClient({
            url: MOCK_API_URL,
            apiVersion: 11,
            username: 'test',
            password: 'test',
            oauthClientId: 'test',
            oauthSecret: 'test'
        });
        
        // @ts-ignore
        clientV11.session = { accessToken: 'dummy_v11', refreshToken: 'dummy', expiresAt: Date.now() + 3600000 };

        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ id: 99, message: 'Ticket created v11' })
        });

        const result = await clientV11.createTicket({
            name: 'Ticket v11 Test',
            content: 'Content V11',
            entities_id: 2
        });

        expect(result.id).toBe(99);

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/Assistance/Ticket`,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy_v11',
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    name: 'Ticket v11 Test',
                    content: 'Content V11',
                    type: 1,
                    priority: 3,
                    urgency: 3,
                    entities_id: 2
                })
            })
        );
    });
});
