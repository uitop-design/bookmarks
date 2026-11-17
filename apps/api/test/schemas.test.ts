import { describe, expect, it } from 'vitest';
import {
  createBookmarkSchema,
  listBookmarksQuerySchema,
  updateBookmarkSchema,
} from '../src/modules/bookmarks/schemas.js';
import { tagListSchema } from '../src/modules/tags/schemas.js';

describe('tag normalization', () => {
  it('trims, lowercases and deduplicates tags', () => {
    expect(tagListSchema.parse([' TypeScript ', 'typescript', 'Web-Dev', 'web-dev', 'a1'])).toEqual(
      ['typescript', 'web-dev', 'a1'],
    );
  });

  it('counts the limit after deduplication', () => {
    const tags = [...Array.from({ length: 10 }, (_, i) => `tag${i}`), 'TAG0', ' tag1 '];
    expect(tagListSchema.parse(tags)).toHaveLength(10);
    expect(tagListSchema.safeParse([...tags, 'tag10']).success).toBe(false);
  });

  it.each([['with space'], ['under_score'], ['emoji🙂'], [''], ['   '], ['a'.repeat(25)], ['тег']])(
    'rejects %j',
    (tag) => {
      expect(tagListSchema.safeParse([tag]).success).toBe(false);
    },
  );

  it('accepts 24 characters', () => {
    expect(tagListSchema.parse(['a'.repeat(24)])).toEqual(['a'.repeat(24)]);
  });
});

describe('createBookmarkSchema', () => {
  it('normalizes the url and defaults tags', () => {
    expect(createBookmarkSchema.parse({ url: 'HTTPS://Example.com/a/?utm_source=x#top' })).toEqual({
      url: 'https://example.com/a',
      tags: [],
    });
  });

  it('rejects unknown fields', () => {
    expect(createBookmarkSchema.safeParse({ url: 'https://example.com', title: 'x' }).success).toBe(
      false,
    );
  });
});

describe('updateBookmarkSchema', () => {
  it('requires at least one field', () => {
    expect(updateBookmarkSchema.safeParse({}).success).toBe(false);
  });

  it('turns a blank description into null', () => {
    expect(updateBookmarkSchema.parse({ description: '   ' })).toEqual({ description: null });
  });

  it('replaces tags with the normalized list', () => {
    expect(updateBookmarkSchema.parse({ tags: ['B', 'a', 'b'] })).toEqual({ tags: ['b', 'a'] });
  });

  it.each([
    [{ title: '' }],
    [{ title: 'x'.repeat(201) }],
    [{ title: null }],
    [{ description: 'x'.repeat(501) }],
    [{ tags: null }],
  ])('rejects %j', (body) => {
    expect(updateBookmarkSchema.safeParse(body).success).toBe(false);
  });
});

describe('listBookmarksQuerySchema', () => {
  it('applies defaults', () => {
    expect(listBookmarksQuerySchema.parse({})).toEqual({ page: 1, limit: 24 });
  });

  it('parses comma separated tags', () => {
    expect(listBookmarksQuerySchema.parse({ tags: ' Web, docs,,web ' }).tags).toEqual([
      'web',
      'docs',
    ]);
  });

  it.each([
    [{ page: '0' }],
    [{ page: '1e3' }],
    [{ page: '0x10' }],
    [{ page: '10001' }],
    [{ limit: '101' }],
    [{ q: '' }],
    [{ q: 'q'.repeat(101) }],
    [{ tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(',') }],
  ])('rejects %j', (query) => {
    expect(listBookmarksQuerySchema.safeParse(query).success).toBe(false);
  });
});
