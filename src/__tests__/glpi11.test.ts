import { GlpiClient } from '../services/glpi-client';
import dotenv from 'dotenv';

dotenv.config(); // Carrega as variáveis de ambiente do arquivo .env

describe('GlpiClient - GLPI 11 HLAPI Compatibility', () => {
    let clientV11: GlpiClient;
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
        clientV11 = new GlpiClient({
            url: process.env.GLPI_API_URL!,
            apiVersion: parseInt(process.env.GLPI_API_VERSION!, 10),
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
    });

    it('deve usar fluxo de autenticação OAuth2 Password Grant para v11', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'valid-jwt-token', expires_in: 3600 })
        });

        await clientV11.initSession();

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api.php/token'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Basic'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }),
                body: expect.any(URLSearchParams)
            })
        );

        // Verificando se enviou grant_type password e scope api
        const lastCallBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
        expect(lastCallBody.get('grant_type')).toBe('password');
        expect(lastCallBody.get('scope')).toBe('api');
    });

    it('deve resolver rotas corretamente para GLPI 11 (Assistance prefix)', async () => {
        // Setup session so we don't trigger initSession in this test
        // @ts-ignore - accessing private property for test sanity
        clientV11.session = { sessionToken: 'dummy' };

        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 123, name: 'Ticket 1' }) });

        await clientV11.getItem('Ticket', 123);

        expect(fetchMock).toHaveBeenCalledWith(
            `${process.env.GLPI_API_URL}/Assistance/Ticket/123`,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer dummy'
                })
            })
        );
    });

    it('deve resolver rotas corretamente para Assets no GLPI 11', async () => {
        // @ts-ignore
        clientV11.session = { sessionToken: 'dummy' };
        fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

        await clientV11.getItems('Computer');

        expect(fetchMock).toHaveBeenCalledWith(
            `${process.env.GLPI_API_URL}/Assets/Computer`,
            expect.any(Object)
        );
    });

    it('deve mapear corretamente o subitem de Followup (Timeline) no GLPI 11', async () => {
        // @ts-ignore
        clientV11.session = { sessionToken: 'dummy' };
        fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

        await clientV11.getTicketFollowups(42);

        expect(fetchMock).toHaveBeenCalledWith(
            `${process.env.GLPI_API_URL}/Assistance/Ticket/42/Timeline/Followup`,
            expect.any(Object)
        );
    });
});
