import { GlpiClient } from '../services/glpi-client';

/**
 * Regression: on the legacy REST API (GLPI 10 and 11), GET /Ticket only accepts a
 * *field name* in `sort`. Sending the search option id ("15") makes GLPI 11 answer
 * HTTP 400 "sort param is not a field of glpi_tickets".
 */
describe('GlpiClient - listTickets (legacy API)', () => {
    let client: GlpiClient;
    let fetchMock: jest.SpyInstance;
    const MOCK_API_URL = 'https://mock-glpi.com';

    beforeEach(() => {
        client = new GlpiClient({ url: MOCK_API_URL, apiVersion: 10, userToken: 'test_token' });
        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
        // @ts-ignore
        client.session = { sessionToken: 'dummy_v10', expiresAt: Date.now() + 3600000 };
    });

    afterEach(() => fetchMock.mockRestore());

    it('uses the field name date_mod (not the search option id) in the sort parameter', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });

        await client.listTickets(undefined, 10);

        const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(calledUrl.pathname).toBe('/apirest.php/Ticket');
        expect(calledUrl.searchParams.get('sort')).toBe('date_mod');
        expect(calledUrl.searchParams.get('order')).toBe('DESC');
        expect(calledUrl.searchParams.get('range')).toBe('0-9');
    });
});
