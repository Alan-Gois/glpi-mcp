import { GlpiClient } from '../services/glpi-client';

describe('GlpiClient - GLPI 11 HLAPI Compatibility', () => {
    let clientV11: GlpiClient;
    let fetchMock: jest.SpyInstance;
    const MOCK_API_URL = 'https://mock-glpi.com';

    beforeEach(() => {
        // Mock environment variables to ensure test isolation
        process.env.GLPI_URL = MOCK_API_URL;
        process.env.GLPI_USERNAME = 'testuser';
        process.env.GLPI_PASSWORD = 'testpass';
        process.env.GLPI_OAUTH_CLIENT_ID = 'test_client_id';
        process.env.GLPI_OAUTH_CLIENT_SECRET = 'test_client_secret';

        clientV11 = new GlpiClient({
            url: process.env.GLPI_URL!,
            apiVersion: 11,
            username: process.env.GLPI_USERNAME,
            password: process.env.GLPI_PASSWORD,
            oauthClientId: process.env.GLPI_OAUTH_CLIENT_ID,
            oauthSecret: process.env.GLPI_OAUTH_CLIENT_SECRET,
        });

        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        fetchMock.mockRestore();
        // Clear mock env vars
        delete process.env.GLPI_URL;
        delete process.env.GLPI_USERNAME;
        delete process.env.GLPI_PASSWORD;
        delete process.env.GLPI_OAUTH_CLIENT_ID;
        delete process.env.GLPI_OAUTH_CLIENT_SECRET;
    });

    it('deve usar fluxo de autenticação OAuth2 Password Grant para v11', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'valid-jwt-token', expires_in: 3600 })
        });

        await clientV11.initSession();

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/token`,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Basic'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }),
                body: expect.any(URLSearchParams)
            })
        );

        const lastCallBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
        expect(lastCallBody.get('grant_type')).toBe('password');
        expect(lastCallBody.get('scope')).toBe('api');
    });

    it('deve resolver rotas corretamente para GLPI 11 (Assistance prefix)', async () => {
        // @ts-ignore - accessing private property for test sanity
        clientV11.session = { accessToken: 'dummy', refreshToken: 'dummy', expiresAt: Date.now() + 3600000 };
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 123, name: 'Ticket 1' }) });

        await clientV11.getItem('Ticket', 123);

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/Assistance/Ticket/123`,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy'
                })
            })
        );
    });

    it('deve resolver rotas corretamente para Assets no GLPI 11', async () => {
        // @ts-ignore
        clientV11.session = { accessToken: 'dummy', refreshToken: 'dummy', expiresAt: Date.now() + 3600000 };
        fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

        await clientV11.getItems('Computer');

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/Assets/Computer`,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy'
                })
            })
        );
    });

    it('deve mapear corretamente o subitem de Followup (Timeline) no GLPI 11', async () => {
        // @ts-ignore
        clientV11.session = { accessToken: 'dummy', refreshToken: 'dummy', expiresAt: Date.now() + 3600000 };
        fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

        await clientV11.getTicketFollowups(42);

        expect(fetchMock).toHaveBeenCalledWith(
            `${MOCK_API_URL}/api.php/Assistance/Ticket/42/Timeline/Followup`,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy'
                })
            })
        );
    });
});
