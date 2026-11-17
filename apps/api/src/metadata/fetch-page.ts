import { TextDecoder } from 'node:util';
import { isHttpUrl } from '../lib/normalize-url.js';
import { assertPublicHost, type HostLookup, systemLookup } from './address-guard.js';

export interface PageFetcherOptions {
  timeoutMs: number;
  maxRedirects: number;
  maxBytes: number;
  userAgent: string;
  allowPrivateAddresses: boolean;
  lookup?: HostLookup;
  fetch?: typeof fetch;
}

export interface FetchedPage {
  url: string;
  html: string;
}

export type PageFetcher = (url: string) => Promise<FetchedPage>;

export class PageFetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PageFetchError';
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_CONTENT_TYPE = /^\s*text\/html\s*(;|$)/i;

function charsetOf(contentType: string): string {
  const match = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType);
  return match?.[1] ?? 'utf-8';
}

function createDecoder(charset: string): TextDecoder {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder('utf-8');
  }
}

async function readText(response: Response, maxBytes: number, charset: string): Promise<string> {
  if (!response.body) {
    return '';
  }
  const reader = response.body.getReader();
  const decoder = createDecoder(charset);
  let received = 0;
  let text = '';
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value.subarray(0, maxBytes - received);
      received += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text + decoder.decode();
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export function createPageFetcher(options: PageFetcherOptions): PageFetcher {
  const fetchImpl = options.fetch ?? fetch;
  const lookup = options.lookup ?? systemLookup;

  async function fetchFollowingRedirects(url: string, signal: AbortSignal): Promise<FetchedPage> {
    let current = new URL(url);
    for (let redirects = 0; ; redirects += 1) {
      if (!options.allowPrivateAddresses) {
        await withAbort(assertPublicHost(current.hostname, lookup), signal);
      }

      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': options.userAgent,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        },
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get('location');
        if (!location) {
          throw new PageFetchError(`Redirect ${response.status} without a Location header`);
        }
        if (redirects >= options.maxRedirects) {
          throw new PageFetchError(`More than ${options.maxRedirects} redirects`);
        }
        const next = new URL(location, current);
        if (!isHttpUrl(next)) {
          throw new PageFetchError(`Redirect to unsupported protocol ${next.protocol}`);
        }
        current = next;
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new PageFetchError(`Unexpected response status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!HTML_CONTENT_TYPE.test(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new PageFetchError(`Unsupported content type "${contentType || 'unknown'}"`);
      }

      const html = await readText(response, options.maxBytes, charsetOf(contentType));
      return { url: current.href, html };
    }
  }

  return async (url) => {
    const signal = AbortSignal.timeout(options.timeoutMs);
    try {
      return await fetchFollowingRedirects(url, signal);
    } catch (error) {
      if (error instanceof PageFetchError) {
        throw error;
      }
      if (signal.aborted) {
        throw new PageFetchError(`Timed out after ${options.timeoutMs} ms`, { cause: error });
      }
      throw new PageFetchError(error instanceof Error ? error.message : 'Request failed', {
        cause: error,
      });
    }
  };
}
