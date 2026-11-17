import { describe, expect, it } from 'vitest';
import { parseMetadata, truncate } from '../src/metadata/parse-metadata.js';

const PAGE = 'https://example.com/blog/post';

function page(head: string): string {
  return `<!doctype html><html><head>${head}</head><body><title>Body title</title></body></html>`;
}

describe('parseMetadata', () => {
  it('prefers open graph tags', () => {
    const result = parseMetadata(
      page(`
        <title>Document title</title>
        <meta property="og:title" content="OG title">
        <meta name="description" content="Meta description">
        <meta property="og:description" content="OG description">
        <meta property="og:site_name" content="Example">
      `),
      PAGE,
    );
    expect(result).toMatchObject({
      title: 'OG title',
      description: 'OG description',
      siteName: 'Example',
    });
  });

  it('falls back to <title> and meta description', () => {
    const result = parseMetadata(
      page('<title>  Document \n title </title><meta name="Description" content="Meta">'),
      PAGE,
    );
    expect(result.title).toBe('Document title');
    expect(result.description).toBe('Meta');
    expect(result.siteName).toBeNull();
  });

  it('skips empty open graph values', () => {
    const result = parseMetadata(
      page('<meta property="og:title" content="   "><title>Real title</title>'),
      PAGE,
    );
    expect(result.title).toBe('Real title');
  });

  it('returns null title when the page has none', () => {
    const result = parseMetadata('<html><head></head><body>Hi</body></html>', PAGE);
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
  });

  it('decodes html entities and is case insensitive', () => {
    const result = parseMetadata(
      '<HTML><HEAD><META PROPERTY="OG:TITLE" CONTENT="Tom &amp; Jerry"></HEAD></HTML>',
      PAGE,
    );
    expect(result.title).toBe('Tom & Jerry');
  });

  it('truncates long titles and descriptions', () => {
    const result = parseMetadata(
      page(
        `<title>${'t'.repeat(250)}</title><meta name="description" content="${'word '.repeat(100)}">`,
      ),
      PAGE,
    );
    expect(result.title).toHaveLength(200);
    expect(result.title?.endsWith('…')).toBe(true);
    expect(result.description).toHaveLength(300);
    expect(result.description?.endsWith('…')).toBe(true);
  });

  it.each([
    ['<link rel="icon" href="/static/icon.png">', 'https://example.com/static/icon.png'],
    ['<link rel="shortcut icon" href="favicon.png">', 'https://example.com/blog/favicon.png'],
    ['<link rel="apple-touch-icon" href="../touch.png">', 'https://example.com/touch.png'],
    ['<link rel="icon" href="//cdn.example.net/i.svg">', 'https://cdn.example.net/i.svg'],
    [
      '<link rel="apple-touch-icon" href="/apple.png"><link rel="icon" href="/icon.png">',
      'https://example.com/icon.png',
    ],
    ['<link rel="icon" href="data:image/png;base64,AAAA">', 'https://example.com/favicon.ico'],
    ['<link rel="stylesheet" href="/style.css">', 'https://example.com/favicon.ico'],
    ['', 'https://example.com/favicon.ico'],
    [
      '<base href="https://static.example.org/assets/"><link rel="icon" href="icon.png">',
      'https://static.example.org/assets/icon.png',
    ],
  ])('resolves favicon from %s', (head, expected) => {
    expect(parseMetadata(page(head), PAGE).faviconUrl).toBe(expected);
  });
});

describe('truncate', () => {
  it('keeps short values', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('does not split surrogate pairs', () => {
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });
});
