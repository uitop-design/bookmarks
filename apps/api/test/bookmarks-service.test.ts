import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import type { Db } from '../src/lib/db.js';
import { HttpError } from '../src/lib/http-error.js';
import type { MetadataLoader, PageMetadata } from '../src/metadata/metadata-service.js';
import { createBookmarkService } from '../src/modules/bookmarks/service.js';

const ID = '7f1c9a52-0d7e-4a51-9c63-2a1b3f1d9e10';
const OTHER_ID = '1b6f0f3e-2f1a-4c4c-9d0e-3a2b1c0d9e8f';

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    url: 'https://example.com/',
    title: 'Example',
    description: null,
    siteName: null,
    faviconUrl: 'https://example.com/favicon.ico',
    metadataStatus: 'OK',
    createdAt: new Date('2026-11-17T10:00:00Z'),
    updatedAt: new Date('2026-11-17T11:00:00Z'),
    tags: [{ tag: { name: 'web' } }, { tag: { name: 'docs' } }],
    ...overrides,
  };
}

function createDbMock() {
  const tx = {
    bookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    bookmarkTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    tag: { deleteMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Db, tx };
}

const okMetadata: PageMetadata = {
  title: 'Example Domain',
  description: 'Example description',
  siteName: 'Example',
  faviconUrl: 'https://example.com/favicon.ico',
  status: 'OK',
};

function rawValues(mock: ReturnType<typeof vi.fn>, call = 0): unknown[] {
  return (mock.mock.calls[call] ?? []).slice(1);
}

describe('bookmark service', () => {
  let mocks: ReturnType<typeof createDbMock>;
  let loadMetadata: ReturnType<typeof vi.fn<MetadataLoader>>;

  beforeEach(() => {
    mocks = createDbMock();
    loadMetadata = vi.fn<MetadataLoader>().mockResolvedValue(okMetadata);
  });

  function service() {
    return createBookmarkService({ db: mocks.db, loadMetadata });
  }

  describe('update', () => {
    it('replaces the tag list and removes unused tags', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique
        .mockResolvedValueOnce(record())
        .mockResolvedValueOnce(
          record({ tags: [{ tag: { name: 'new' } }, { tag: { name: 'api' } }] }),
        );
      tx.$queryRaw.mockResolvedValue([{ id: 'tag-1' }, { id: 'tag-2' }]);

      const result = await service().update(ID, { tags: ['new', 'api'] });

      expect(tx.bookmarkTag.deleteMany).toHaveBeenCalledWith({ where: { bookmarkId: ID } });
      expect(rawValues(tx.$queryRaw)).toEqual([['new', 'api']]);
      expect(tx.bookmarkTag.createMany).toHaveBeenCalledWith({
        data: [
          { bookmarkId: ID, tagId: 'tag-1' },
          { bookmarkId: ID, tagId: 'tag-2' },
        ],
      });
      expect(tx.tag.deleteMany).toHaveBeenCalledWith({ where: { bookmarks: { none: {} } } });
      expect(tx.bookmarkTag.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        tx.$queryRaw.mock.invocationCallOrder[0] ?? 0,
      );
      expect(tx.tag.deleteMany.mock.invocationCallOrder[0]).toBeGreaterThan(
        tx.bookmarkTag.createMany.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
      expect(result.tags).toEqual(['api', 'new']);
    });

    it('clears all tags with an empty list', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique.mockResolvedValue(record({ tags: [] }));

      await service().update(ID, { tags: [] });

      expect(tx.bookmarkTag.deleteMany).toHaveBeenCalledWith({ where: { bookmarkId: ID } });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.bookmarkTag.createMany).not.toHaveBeenCalled();
      expect(tx.tag.deleteMany).toHaveBeenCalled();
    });

    it('keeps tags when they are not provided', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique.mockResolvedValue(record());

      const result = await service().update(ID, { title: 'New title', description: null });

      expect(tx.bookmark.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { title: 'New title', description: null, updatedAt: expect.any(Date) },
      });
      expect(tx.bookmarkTag.deleteMany).not.toHaveBeenCalled();
      expect(tx.tag.deleteMany).not.toHaveBeenCalled();
      expect(result.tags).toEqual(['docs', 'web']);
    });

    it('returns 404 for a missing bookmark', async () => {
      mocks.tx.bookmark.findUnique.mockResolvedValue(null);
      await expect(service().update(ID, { title: 'x' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Bookmark not found',
      });
      expect(mocks.tx.bookmark.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('stores fetched metadata and tags', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(record());
      tx.bookmark.create.mockResolvedValue({ id: ID });
      tx.$queryRaw.mockResolvedValue([{ id: 'tag-1' }]);

      const result = await service().create({ url: 'https://example.com/', tags: ['web'] });

      expect(loadMetadata).toHaveBeenCalledWith('https://example.com/');
      expect(tx.bookmark.create).toHaveBeenCalledWith({
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          description: 'Example description',
          siteName: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          metadataStatus: 'OK',
        },
        select: { id: true },
      });
      expect(result).toMatchObject({ id: ID, createdAt: '2026-11-17T10:00:00.000Z' });
    });

    it('rejects a known duplicate without fetching the page', async () => {
      mocks.tx.bookmark.findUnique.mockResolvedValue({ id: OTHER_ID });
      const error = await service()
        .create({ url: 'https://example.com/', tags: [] })
        .catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ statusCode: 409, message: expect.stringContaining(OTHER_ID) });
      expect(loadMetadata).not.toHaveBeenCalled();
    });

    it('turns a unique violation from a concurrent insert into 409', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: OTHER_ID });
      tx.bookmark.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );
      await expect(
        service().create({ url: 'https://example.com/', tags: [] }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining(OTHER_ID),
      });
    });
  });

  describe('remove', () => {
    it('deletes the bookmark and unused tags', async () => {
      mocks.tx.bookmark.deleteMany.mockResolvedValue({ count: 1 });
      await service().remove(ID);
      expect(mocks.tx.bookmark.deleteMany).toHaveBeenCalledWith({ where: { id: ID } });
      expect(mocks.tx.tag.deleteMany).toHaveBeenCalledWith({ where: { bookmarks: { none: {} } } });
    });

    it('returns 404 for a missing bookmark', async () => {
      mocks.tx.bookmark.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service().remove(ID)).rejects.toMatchObject({ statusCode: 404 });
      expect(mocks.tx.tag.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('overwrites metadata with the fetched values', async () => {
      const { tx } = mocks;
      tx.bookmark.findUnique.mockResolvedValue(record({ title: 'Manual title' }));
      loadMetadata.mockResolvedValue({
        title: 'example.com',
        description: null,
        siteName: null,
        faviconUrl: null,
        status: 'FAILED',
      });

      await service().refresh(ID);

      expect(tx.bookmark.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: {
          title: 'example.com',
          description: null,
          siteName: null,
          faviconUrl: null,
          metadataStatus: 'FAILED',
        },
      });
    });
  });
});
