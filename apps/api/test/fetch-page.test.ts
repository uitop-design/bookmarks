import { describe, expect, it, vi } from 'vitest';
import { createPageFetcher, PageFetchError } from '../src/metadata/fetch-page.js';

type FetchImpl = typeof fetch;

const PUBLIC_IP = '93.184.216.34';

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

function fetcher(
  fetchImpl: FetchImpl,
  overrides: { lookup?: (host: string) => Promise<string[]>; allowPrivateAddresses?: boolean } = {},
) {
  return createPageFetcher({
    timeoutMs: 100,
    maxRedirects: 3,
    maxBytes: 1024 * 1024,
    userAgent: 'BookmarksBot/1.0',
    allowPrivateAddresses: overrides.allowPrivateAddresses ?? false,
    lookup: overrides.lookup ?? (async () => [PUBLIC_IP]),
    fetch: fetchImpl,
  });
}

function requestedUrls(fetchImpl: ReturnType<typeof vi.fn>) {
  return fetchImpl.mock.calls.map(([url]) => String(url));
}

describe('createPageFetcher', () => {
  it('returns html with the final url and sends the bot user agent', async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(html('<title>Hi</title>'));
    const page = await fetcher(fetchImpl)('https://example.com/a');
    expect(page).toEqual({ url: 'https://example.com/a', html: '<title>Hi</title>' });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.redirect).toBe('manual');
    expect(init?.headers).toMatchObject({ 'user-agent': 'BookmarksBot/1.0' });
  });

  it('follows up to three redirects, resolving relative locations', async () => {
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValueOnce(redirect('/step-1', 301))
      .mockResolvedValueOnce(redirect('https://www.example.com/step-2', 307))
      .mockResolvedValueOnce(redirect('step-3', 308))
      .mockResolvedValueOnce(html('<title>Done</title>'));
    const page = await fetcher(fetchImpl)('https://example.com/start');
    expect(page.url).toBe('https://www.example.com/step-3');
    expect(requestedUrls(fetchImpl)).toEqual([
      'https://example.com/start',
      'https://example.com/step-1',
      'https://www.example.com/step-2',
      'https://www.example.com/step-3',
    ]);
  });

  it('fails after more than three redirects', async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async () => redirect('/again'));
    await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toThrow(
      'More than 3 redirects',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('rejects redirects to other protocols or without location', async () => {
    await expect(
      fetcher(vi.fn<FetchImpl>().mockResolvedValue(redirect('ftp://example.com/file')))(
        'https://example.com/',
      ),
    ).rejects.toThrow('unsupported protocol');
    await expect(
      fetcher(vi.fn<FetchImpl>().mockResolvedValue(new Response(null, { status: 302 })))(
        'https://example.com/',
      ),
    ).rejects.toThrow('without a Location');
  });

  it('times out slow responses', async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toThrow(
      'Timed out after 100 ms',
    );
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('times out a body that never finishes', async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async (_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<title>Partial'));
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    });
    await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toBeInstanceOf(PageFetchError);
  });

  it('reads at most the size limit and stops the download', async () => {
    const chunk = new Uint8Array(64 * 1024).fill(120);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= 3 * 1024 * 1024) {
          controller.close();
          return;
        }
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }));
    const page = await fetcher(fetchImpl)('https://example.com/big');
    expect(page.html).toHaveLength(1024 * 1024);
    expect(pulled).toBeLessThan(3 * 1024 * 1024);
  });

  it.each([['image/png'], ['application/json'], ['text/plain'], ['application/xhtml+xml'], ['']])(
    'rejects content type "%s"',
    async (contentType) => {
      const response = new Response('data', {
        headers: contentType ? { 'content-type': contentType } : {},
      });
      if (!contentType) {
        response.headers.delete('content-type');
      }
      await expect(
        fetcher(vi.fn<FetchImpl>().mockResolvedValue(response))('https://example.com/'),
      ).rejects.toThrow('Unsupported content type');
    },
  );

  it('rejects error statuses', async () => {
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValue(
        new Response('oops', { status: 500, headers: { 'content-type': 'text/html' } }),
      );
    await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toThrow('status 500');
  });

  it('decodes the declared charset', async () => {
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockResolvedValue(
        new Response(bytes, { headers: { 'content-type': 'text/html; charset=windows-1251' } }),
      );
    expect((await fetcher(fetchImpl)('https://example.com/')).html).toBe('Привет');
  });

  it('wraps network errors', async () => {
    const fetchImpl = vi.fn<FetchImpl>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toThrow(PageFetchError);
  });

  describe('private addresses', () => {
    it('blocks private hosts before connecting', async () => {
      const fetchImpl = vi.fn<FetchImpl>();
      await expect(fetcher(fetchImpl)('http://127.0.0.1/')).rejects.toThrow('private or reserved');
      await expect(
        fetcher(fetchImpl, { lookup: async () => ['10.0.0.8'] })('http://intranet.example/'),
      ).rejects.toThrow('intranet.example');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('blocks redirects to private hosts', async () => {
      const fetchImpl = vi
        .fn<FetchImpl>()
        .mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data'));
      await expect(fetcher(fetchImpl)('https://example.com/')).rejects.toThrow('169.254.169.254');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('checks dns of every redirect target', async () => {
      const lookup = vi.fn(async (host: string) =>
        host === 'internal.example' ? ['192.168.0.2'] : [PUBLIC_IP],
      );
      const fetchImpl = vi
        .fn<FetchImpl>()
        .mockResolvedValueOnce(redirect('http://internal.example/'));
      await expect(fetcher(fetchImpl, { lookup })('https://example.com/')).rejects.toThrow(
        'internal.example',
      );
      expect(lookup.mock.calls.map(([host]) => host)).toEqual(['example.com', 'internal.example']);
    });

    it('allows private hosts when enabled', async () => {
      const lookup = vi.fn();
      const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(html('<title>Local</title>'));
      const page = await fetcher(fetchImpl, { lookup, allowPrivateAddresses: true })(
        'http://127.0.0.1:8080/',
      );
      expect(page.html).toBe('<title>Local</title>');
      expect(lookup).not.toHaveBeenCalled();
    });
  });
});
