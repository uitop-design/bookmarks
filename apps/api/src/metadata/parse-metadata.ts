import { type HTMLElement, parse } from 'node-html-parser';
import { isHttpUrl, MAX_URL_LENGTH } from '../lib/normalize-url.js';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 300;
export const SITE_NAME_MAX_LENGTH = 200;

export interface ParsedMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
  faviconUrl: string;
}

const ICON_RELS = ['icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'] as const;

export function truncate(value: string, maxLength: number): string {
  const chars = Array.from(value);
  if (chars.length <= maxLength) {
    return value;
  }
  return `${chars
    .slice(0, maxLength - 1)
    .join('')
    .trimEnd()}…`;
}

function clean(value: string | undefined, maxLength: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? truncate(text, maxLength) : null;
}

function readMetaTags(root: HTMLElement): Map<string, string> {
  const tags = new Map<string, string>();
  for (const meta of root.querySelectorAll('meta')) {
    const key = (meta.getAttribute('property') ?? meta.getAttribute('name'))?.trim().toLowerCase();
    const content = meta.getAttribute('content');
    if (key && content?.trim() && !tags.has(key)) {
      tags.set(key, content);
    }
  }
  return tags;
}

function resolveHttpUrl(href: string | undefined, base: string): string | null {
  const value = href?.trim();
  if (!value || !URL.canParse(value, base)) {
    return null;
  }
  const url = new URL(value, base);
  return isHttpUrl(url) && url.href.length <= MAX_URL_LENGTH ? url.href : null;
}

function findFavicon(root: HTMLElement, baseUrl: string): string {
  const links = root.querySelectorAll('link[rel][href]').map((link) => ({
    rels: (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/),
    href: link.getAttribute('href'),
  }));
  for (const rel of ICON_RELS) {
    for (const link of links) {
      if (!link.rels.includes(rel)) {
        continue;
      }
      const url = resolveHttpUrl(link.href, baseUrl);
      if (url) {
        return url;
      }
    }
  }
  return new URL('/favicon.ico', baseUrl).href;
}

export function parseMetadata(html: string, pageUrl: string): ParsedMetadata {
  const root = parse(html);
  const meta = readMetaTags(root);
  const baseUrl = resolveHttpUrl(root.querySelector('base[href]')?.getAttribute('href'), pageUrl);

  return {
    title:
      clean(meta.get('og:title'), TITLE_MAX_LENGTH) ??
      clean(root.querySelector('title')?.text, TITLE_MAX_LENGTH),
    description:
      clean(meta.get('og:description'), DESCRIPTION_MAX_LENGTH) ??
      clean(meta.get('description'), DESCRIPTION_MAX_LENGTH),
    siteName: clean(meta.get('og:site_name'), SITE_NAME_MAX_LENGTH),
    faviconUrl: findFavicon(root, baseUrl ?? pageUrl),
  };
}
