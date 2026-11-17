import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../lib/db.js';
import { conflict, notFound } from '../../lib/http-error.js';
import type { MetadataLoader, PageMetadata } from '../../metadata/metadata-service.js';
import type {
  BookmarkDto,
  BookmarkPage,
  CreateBookmarkInput,
  ListBookmarksQuery,
  UpdateBookmarkInput,
} from './schemas.js';

type Tx = Prisma.TransactionClient;

const bookmarkInclude = {
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.BookmarkInclude;

type BookmarkRecord = Prisma.BookmarkGetPayload<{ include: typeof bookmarkInclude }>;

export interface BookmarkService {
  list(query: ListBookmarksQuery): Promise<BookmarkPage>;
  get(id: string): Promise<BookmarkDto>;
  create(input: CreateBookmarkInput): Promise<BookmarkDto>;
  update(id: string, input: UpdateBookmarkInput): Promise<BookmarkDto>;
  remove(id: string): Promise<void>;
  refresh(id: string): Promise<BookmarkDto>;
}

interface BookmarkServiceDependencies {
  db: Db;
  loadMetadata: MetadataLoader;
}

export function toBookmarkDto(record: BookmarkRecord): BookmarkDto {
  return {
    id: record.id,
    url: record.url,
    title: record.title,
    description: record.description,
    siteName: record.siteName,
    faviconUrl: record.faviconUrl,
    metadataStatus: record.metadataStatus,
    tags: record.tags.map(({ tag }) => tag.name).sort(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function metadataFields({ status, ...metadata }: PageMetadata) {
  return { ...metadata, metadataStatus: status };
}

function bookmarkNotFound() {
  return notFound('Bookmark not found');
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function attachTags(tx: Tx, bookmarkId: string, names: readonly string[]): Promise<void> {
  if (names.length === 0) {
    return;
  }
  const tags = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO tags (name)
    SELECT unnest(${names}::text[])
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  await tx.bookmarkTag.createMany({ data: tags.map(({ id }) => ({ bookmarkId, tagId: id })) });
}

async function deleteUnusedTags(tx: Tx): Promise<void> {
  await tx.tag.deleteMany({ where: { bookmarks: { none: {} } } });
}

function buildFilter({ q, tags }: ListBookmarksQuery) {
  const tsQuery = q ? Prisma.sql`websearch_to_tsquery('simple', ${q})` : null;
  const conditions: Prisma.Sql[] = [];
  if (tsQuery) {
    conditions.push(Prisma.sql`b.search @@ ${tsQuery}`);
  }
  if (tags && tags.length > 0) {
    conditions.push(Prisma.sql`b.id IN (
      SELECT bt.bookmark_id
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.name = ANY(${tags}::text[])
      GROUP BY bt.bookmark_id
      HAVING count(*) = ${tags.length}::int
    )`);
  }
  return {
    where:
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty,
    orderBy: tsQuery
      ? Prisma.sql`ts_rank(b.search, ${tsQuery}) DESC, b.created_at DESC, b.id DESC`
      : Prisma.sql`b.created_at DESC, b.id DESC`,
  };
}

export function createBookmarkService({
  db,
  loadMetadata,
}: BookmarkServiceDependencies): BookmarkService {
  async function findIdByUrl(url: string): Promise<string | undefined> {
    const bookmark = await db.bookmark.findUnique({ where: { url }, select: { id: true } });
    return bookmark?.id;
  }

  function duplicate(id: string) {
    return conflict(`A bookmark with this URL already exists (id: ${id})`);
  }

  async function getRecord(tx: Tx, id: string): Promise<BookmarkRecord> {
    const bookmark = await tx.bookmark.findUnique({ where: { id }, include: bookmarkInclude });
    if (!bookmark) {
      throw bookmarkNotFound();
    }
    return bookmark;
  }

  return {
    async list(query) {
      const { where, orderBy } = buildFilter(query);
      const offset = (query.page - 1) * query.limit;
      const [countRows, idRows] = await Promise.all([
        db.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM bookmarks b ${where}`,
        db.$queryRaw<{ id: string }[]>`
          SELECT b.id FROM bookmarks b ${where}
          ORDER BY ${orderBy}
          LIMIT ${query.limit}::int OFFSET ${offset}::int
        `,
      ]);
      const ids = idRows.map(({ id }) => id);
      const records =
        ids.length > 0
          ? await db.bookmark.findMany({ where: { id: { in: ids } }, include: bookmarkInclude })
          : [];
      const byId = new Map(records.map((record) => [record.id, record]));
      const items = ids.flatMap((id) => {
        const record = byId.get(id);
        return record ? [toBookmarkDto(record)] : [];
      });
      return { items, total: countRows[0]?.total ?? 0, page: query.page, limit: query.limit };
    },

    async get(id) {
      return toBookmarkDto(await getRecord(db, id));
    },

    async create({ url, tags }) {
      const existingId = await findIdByUrl(url);
      if (existingId) {
        throw duplicate(existingId);
      }
      const metadata = await loadMetadata(url);
      try {
        const record = await db.$transaction(async (tx) => {
          const { id } = await tx.bookmark.create({
            data: { url, ...metadataFields(metadata) },
            select: { id: true },
          });
          await attachTags(tx, id, tags);
          return getRecord(tx, id);
        });
        return toBookmarkDto(record);
      } catch (error) {
        if (isUniqueViolation(error)) {
          const id = await findIdByUrl(url);
          if (id) {
            throw duplicate(id);
          }
        }
        throw error;
      }
    },

    async update(id, { title, description, tags }) {
      const record = await db.$transaction(async (tx) => {
        await getRecord(tx, id);
        await tx.bookmark.update({
          where: { id },
          data: { title, description, updatedAt: new Date() },
        });
        if (tags) {
          await tx.bookmarkTag.deleteMany({ where: { bookmarkId: id } });
          await attachTags(tx, id, tags);
          await deleteUnusedTags(tx);
        }
        return getRecord(tx, id);
      });
      return toBookmarkDto(record);
    },

    async remove(id) {
      await db.$transaction(async (tx) => {
        const { count } = await tx.bookmark.deleteMany({ where: { id } });
        if (count === 0) {
          throw bookmarkNotFound();
        }
        await deleteUnusedTags(tx);
      });
    },

    async refresh(id) {
      const { url } = await getRecord(db, id);
      const metadata = await loadMetadata(url);
      const record = await db.$transaction(async (tx) => {
        await getRecord(tx, id);
        await tx.bookmark.update({ where: { id }, data: metadataFields(metadata) });
        return getRecord(tx, id);
      });
      return toBookmarkDto(record);
    },
  };
}
