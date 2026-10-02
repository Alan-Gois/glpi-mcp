import { GlpiClient } from '../services/glpi-client';
import { ItemtypeSchema } from '../tools/_shared';

describe('itemtype handling in API paths', () => {
    let fetchMock: jest.SpyInstance;
    const client = () => {
        const c = new GlpiClient({ url: 'https://mock-glpi.com', apiVersion: 10, userToken: 't' });
        // @ts-ignore
        c.session = { sessionToken: 'sess', expiresAt: Date.now() + 3600000 };
        return c;
    };
    beforeEach(() => {
        // @ts-ignore
        fetchMock = jest.spyOn(global, 'fetch');
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    });
    afterEach(() => fetchMock.mockRestore());

    it('calls GET /listSearchOptions/:itemtype (regression: slash was encoded as %2F → 404)', async () => {
        await client().listSearchOptions('Project');
        expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/apirest.php/listSearchOptions/Project');
    });

    it('encodes the itemtype of /search/:itemtype', async () => {
        await client().search('Ticket/../getFullSession', []);
        expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/apirest.php/search/Ticket%2F..%2FgetFullSession');
    });

    it('accepts class names and namespaces, rejects paths', () => {
        expect(ItemtypeSchema.safeParse('Ticket').success).toBe(true);
        expect(ItemtypeSchema.safeParse('Glpi\Form\Form').success).toBe(true);
        expect(ItemtypeSchema.safeParse('Ticket/../getFullSession').success).toBe(false);
        expect(ItemtypeSchema.safeParse('../x').success).toBe(false);
    });
});
