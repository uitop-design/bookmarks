import { describe, expect, it } from 'vitest';
import { InvalidUrlError, normalizeUrl } from '../src/lib/normalize-url.js';

describe('normalizeUrl', () => {
  it.each([
    ['HTTPS://Example.COM/Path', 'https://example.com/Path'],
    ['https://example.com', 'https://example.com/'],
    ['https://example.com/', 'https://example.com/'],
    ['https://example.com/docs/', 'https://example.com/docs'],
    ['https://example.com/docs///', 'https://example.com/docs'],
    ['https://example.com/a#section', 'https://example.com/a'],
    ['https://example.com/#top', 'https://example.com/'],
    ['https://example.com:443/a', 'https://example.com/a'],
    ['http://example.com:80/a', 'http://example.com/a'],
    ['http://example.com:443/a', 'http://example.com:443/a'],
    ['https://example.com:8443/a', 'https://example.com:8443/a'],
    ['https://example.com/?utm_source=x&utm_medium=y', 'https://example.com/'],
    ['https://example.com/a?id=1&utm_campaign=z', 'https://example.com/a?id=1'],
    ['https://example.com/a?UTM_Source=x&id=1', 'https://example.com/a?id=1'],
    ['https://example.com/a?fbclid=1&gclid=2&page=3', 'https://example.com/a?page=3'],
    ['https://example.com/a?b=2&a=1', 'https://example.com/a?b=2&a=1'],
    ['https://example.com/a?q=hello%20world', 'https://example.com/a?q=hello%20world'],
    ['https://example.com/a?utm=1', 'https://example.com/a?utm=1'],
    ['https://example.com/a?&&id=1&', 'https://example.com/a?id=1'],
    ['  https://example.com/a  ', 'https://example.com/a'],
    ['https://Bücher.example/', 'https://xn--bcher-kva.example/'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    ['example.com', 'absolute'],
    ['/relative/path', 'absolute'],
    ['', 'absolute'],
    ['javascript:alert(1)', 'http and https'],
    ['ftp://example.com/file', 'http and https'],
    ['mailto:user@example.com', 'http and https'],
    ['data:text/html,hi', 'http and https'],
    ['https://user:secret@example.com/', 'credentials'],
    [`https://example.com/${'a'.repeat(2030)}`, '2048'],
  ])('rejects %s', (input, message) => {
    expect(() => normalizeUrl(input)).toThrow(InvalidUrlError);
    expect(() => normalizeUrl(input)).toThrow(message);
  });

  it('accepts a url of exactly 2048 characters', () => {
    const base = 'https://example.com/';
    const url = base + 'a'.repeat(2048 - base.length);
    expect(normalizeUrl(url)).toHaveLength(2048);
  });
});
