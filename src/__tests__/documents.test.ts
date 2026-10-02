import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GlpiClient } from '../services/glpi-client';
import { loadFileSandbox, resolveInSandbox } from '../security/files';
import { registerDocumentTools } from '../tools/documents';

const SHA1_HELLO = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'; // sha1("hello")

describe('file sandbox', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glpi-mcp-'));
    const sandbox = loadFileSandbox({ GLPI_MCP_FILES_DIR: dir, GLPI_MCP_MAX_FILE_MB: '1' });

    it('resolves paths inside the directory', () => {
        expect(resolveInSandbox(sandbox, 'a/b.txt')).toBe(path.join(fs.realpathSync(dir), 'a', 'b.txt'));
        expect(sandbox.maxBytes).toBe(1024 * 1024);
    });

    it('rejects escapes and absolute paths outside', () => {
        expect(() => resolveInSandbox(sandbox, '../x.txt')).toThrow(/outside/);
        expect(() => resolveInSandbox(sandbox, path.resolve(os.tmpdir(), 'x.txt'))).toThrow(/outside/);
    });

    it('disables local paths when no directory is configured', () => {
        expect(() => resolveInSandbox(loadFileSandbox({}), 'x.txt')).toThrow(/GLPI_MCP_FILES_DIR/);
    });
});

describe('GlpiClient - documents', () => {
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
    });
    afterEach(() => fetchMock.mockRestore());

    it('uploads multipart with the uploadManifest and lets fetch set the Content-Type', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 9 }) });

        await client().uploadDocument({ name: 'Doc' }, 'a.txt', new TextEncoder().encode('hello'), 'text/plain');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://mock-glpi.com/apirest.php/Document');
        expect(init.headers['Content-Type']).toBeUndefined();
        expect(init.headers['Session-Token']).toBe('sess');
        const form = init.body as FormData;
        expect(JSON.parse(form.get('uploadManifest') as string)).toEqual({ input: { name: 'Doc', _filename: ['a.txt'] } });
        expect((form.get('filename[0]') as File).name).toBe('a.txt');
    });

    it('downloads binary content with Accept octet-stream', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('hello').buffer });

        const data = await client().downloadDocument(9);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/apirest.php/Document/9');
        expect(init.headers.Accept).toBe('application/octet-stream');
        expect(new TextDecoder().decode(data)).toBe('hello');
    });
});

describe('document tools', () => {
    let tools: Record<string, Function>;
    let glpi: jest.Mocked<GlpiClient>;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glpi-mcp-docs-'));

    beforeEach(() => {
        tools = {};
        const server = {
            registerTool: jest.fn((name: string, _c: unknown, cb: Function) => { tools[name] = cb; }),
        } as unknown as McpServer;
        glpi = {
            uploadDocument: jest.fn().mockResolvedValue({ id: 9 }),
            addItems: jest.fn().mockResolvedValue({ id: 3 }),
            getItem: jest.fn().mockResolvedValue({ filename: 'a.txt', mime: 'text/plain', sha1sum: SHA1_HELLO }),
            downloadDocument: jest.fn().mockResolvedValue(new TextEncoder().encode('hello')),
        } as unknown as jest.Mocked<GlpiClient>;
        registerDocumentTools(server, glpi, loadFileSandbox({ GLPI_MCP_FILES_DIR: dir }));
    });

    it('uploads base64 content and links it to an item', async () => {
        const result = await tools.glpi_document_upload({
            filename: 'a.txt', content_base64: Buffer.from('hello').toString('base64'), link_itemtype: 'Ticket', link_id: 5,
        });

        expect(glpi.uploadDocument).toHaveBeenCalledWith({ name: 'a.txt' }, 'a.txt', expect.any(Uint8Array), 'text/plain');
        expect(glpi.addItems).toHaveBeenCalledWith('Document_Item', { documents_id: 9, itemtype: 'Ticket', items_id: 5 });
        expect(result.content[0].text).toContain(SHA1_HELLO);
    });

    it('requires exactly one source', async () => {
        const result = await tools.glpi_document_upload({ filename: 'a.txt' });
        expect(result.isError).toBe(true);
        expect(glpi.uploadDocument).not.toHaveBeenCalled();
    });

    it('uploads a file from the sandbox directory', async () => {
        fs.writeFileSync(path.join(dir, 'b.txt'), 'hello');
        await tools.glpi_document_upload({ file_path: 'b.txt' });
        expect(glpi.uploadDocument).toHaveBeenCalledWith({ name: 'b.txt' }, 'b.txt', expect.any(Uint8Array), 'text/plain');
    });

    it('downloads, checks the SHA-1 and saves without overwriting', async () => {
        const first = await tools.glpi_document_download({ id: 9, save_as: 'out/a.txt' });
        expect(JSON.parse(first.content[0].text.replace(/^[^{]*/, '')).sha1_matches_glpi).toBe(true);
        expect(fs.readFileSync(path.join(dir, 'out', 'a.txt'), 'utf8')).toBe('hello');

        const second = await tools.glpi_document_download({ id: 9, save_as: 'out/a.txt' });
        expect(second.isError).toBe(true);
    });

    it('returns base64 when no path is given', async () => {
        const result = await tools.glpi_document_download({ id: 9 });
        expect(JSON.parse(result.content[0].text).content_base64).toBe(Buffer.from('hello').toString('base64'));
    });
});
