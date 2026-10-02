import { GlpiClient } from '../services/glpi-client';

/**
 * Tokens travel in headers by default (URLs end up in proxy and server logs).
 * `tokensInQuery: true` keeps the legacy behaviour for WAFs that drop custom headers.
 */
describe('GlpiClient - token transport (legacy API)', () => {
    let fetchMock: jest.SpyInstance;
    const MOCK_API_URL = 'https://mock-glpi.com';

    const makeClient = (tokensInQuery?: boolean) => {
        const client = new GlpiClient({
            url: MOCK_API_URL, apiVersion: 10, userToken: 'test_token', appToken: 'app_tok', tokensInQuery,
        });
        // @ts-ignore
        client.session = { sessionToken: 'dummy_v10', expiresAt: Date.now() + 3600000 };
        return client;
    };

    beforeEach(() => {
        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) });
    });

    afterEach(() => fetchMock.mockRestore());

    it('sends session and app tokens only in headers by default', async () => {
        await makeClient().getTicket(1);

        const [url, init] = fetchMock.mock.calls[0];
        const params = new URL(url as string).searchParams;
        expect(params.has('session_token')).toBe(false);
        expect(params.has('app_token')).toBe(false);
        expect(init.headers['Session-Token']).toBe('dummy_v10');
        expect(init.headers['App-Token']).toBe('app_tok');
    });

    it('also sends the tokens in the query string when tokensInQuery is true', async () => {
        await makeClient(true).getTicket(1);

        const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(calledUrl.searchParams.get('session_token')).toBe('dummy_v10');
        expect(calledUrl.searchParams.get('app_token')).toBe('app_tok');
    });

    it('sends the app token of initSession in a header by default', async () => {
        const client = makeClient();
        // @ts-ignore
        client.session = null;
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ session_token: 's1' }) });

        await client.getTicket(1);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${MOCK_API_URL}/apirest.php/initSession`);
        expect(init.headers['App-Token']).toBe('app_tok');
    });
});
