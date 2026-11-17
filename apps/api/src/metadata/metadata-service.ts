import type { FastifyBaseLogger } from 'fastify';
import { hostnameOf } from '../lib/normalize-url.js';
import { createPageFetcher, type PageFetcher } from './fetch-page.js';
import { parseMetadata, TITLE_MAX_LENGTH, truncate } from './parse-metadata.js';

export const METADATA_TIMEOUT_MS = 5_000;
export const METADATA_MAX_REDIRECTS = 3;
export const METADATA_MAX_BYTES = 1024 * 1024;
export const METADATA_USER_AGENT = 'BookmarksBot/1.0 (+https://github.com/uitop-design/bookmarks)';

export interface PageMetadata {
  title: string;
  description: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  status: 'OK' | 'FAILED';
}

export type MetadataLoader = (url: string) => Promise<PageMetadata>;

interface MetadataLoaderOptions {
  allowPrivateAddresses: boolean;
  logger: FastifyBaseLogger;
  fetchPage?: PageFetcher;
}

export function createMetadataLoader({
  allowPrivateAddresses,
  logger,
  fetchPage = createPageFetcher({
    timeoutMs: METADATA_TIMEOUT_MS,
    maxRedirects: METADATA_MAX_REDIRECTS,
    maxBytes: METADATA_MAX_BYTES,
    userAgent: METADATA_USER_AGENT,
    allowPrivateAddresses,
  }),
}: MetadataLoaderOptions): MetadataLoader {
  return async (url) => {
    const fallbackTitle = truncate(hostnameOf(url), TITLE_MAX_LENGTH);
    try {
      const page = await fetchPage(url);
      const metadata = parseMetadata(page.html, page.url);
      return { ...metadata, title: metadata.title ?? fallbackTitle, status: 'OK' };
    } catch (error) {
      logger.warn(
        { url, reason: error instanceof Error ? error.message : error },
        'Metadata fetch failed',
      );
      return {
        title: fallbackTitle,
        description: null,
        siteName: null,
        faviconUrl: null,
        status: 'FAILED',
      };
    }
  };
}
