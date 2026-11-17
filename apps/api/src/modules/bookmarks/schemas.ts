import { z } from 'zod';
import { InvalidUrlError, MAX_URL_LENGTH, normalizeUrl } from '../../lib/normalize-url.js';
import { MAX_TAGS_PER_FILTER, tagListSchema, tagNameSchema, uniqueTags } from '../tags/schemas.js';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 500;
export const QUERY_MAX_LENGTH = 100;
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 10_000;

const urlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, `URL must be at most ${MAX_URL_LENGTH} characters`)
  .meta({ format: 'uri', example: 'https://developer.mozilla.org/en-US/docs/Web/HTTP' })
  .transform((value, ctx) => {
    try {
      return normalizeUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof InvalidUrlError ? error.message : 'Invalid URL',
      });
      return z.NEVER;
    }
  });

function intParam(defaultValue: number, min: number, max: number) {
  return z
    .string()
    .regex(/^\d{1,9}$/, 'Must be a positive integer')
    .transform(Number)
    .pipe(z.int().min(min).max(max))
    .default(defaultValue)
    .meta({ type: 'integer', minimum: min, maximum: max, default: defaultValue });
}

export const bookmarkIdParamsSchema = z.object({
  id: z.uuid('Bookmark id must be a valid UUID'),
});

export const listBookmarksQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query must not be empty')
    .max(QUERY_MAX_LENGTH, `Search query must be at most ${QUERY_MAX_LENGTH} characters`)
    .optional()
    .meta({
      description: 'Full-text query in web search syntax: "exact phrase", -exclude, a or b',
    }),
  tags: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(tagNameSchema)
        .max(MAX_TAGS_PER_FILTER, `At most ${MAX_TAGS_PER_FILTER} tags can be used in a filter`),
    )
    .transform(uniqueTags)
    .optional()
    .meta({ description: 'Comma-separated tags; bookmarks must have all of them' }),
  page: intParam(1, 1, MAX_PAGE),
  limit: intParam(DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
});

export const createBookmarkSchema = z
  .strictObject({
    url: urlSchema,
    tags: tagListSchema.default([]),
  })
  .meta({ id: 'CreateBookmark' });

export const updateBookmarkSchema = z
  .strictObject({
    title: z
      .string()
      .trim()
      .min(1, 'Title must not be empty')
      .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`)
      .optional(),
    description: z
      .string()
      .trim()
      .max(
        DESCRIPTION_MAX_LENGTH,
        `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
      )
      .nullable()
      .transform((value) => value || null)
      .optional(),
    tags: tagListSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'At least one of title, description or tags must be provided',
  )
  .meta({ id: 'UpdateBookmark' });

export const bookmarkSchema = z
  .object({
    id: z.uuid(),
    url: z.string().meta({ example: 'https://developer.mozilla.org/en-US/docs/Web/HTTP' }),
    title: z.string().meta({ example: 'HTTP | MDN' }),
    description: z.string().nullable(),
    siteName: z.string().nullable().meta({ example: 'MDN Web Docs' }),
    faviconUrl: z.string().nullable(),
    metadataStatus: z.enum(['PENDING', 'OK', 'FAILED']),
    tags: z.array(z.string()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Bookmark' });

export const bookmarkPageSchema = z
  .object({
    items: z.array(bookmarkSchema),
    total: z.int(),
    page: z.int(),
    limit: z.int(),
  })
  .meta({ id: 'BookmarkPage' });

export type ListBookmarksQuery = z.infer<typeof listBookmarksQuerySchema>;
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;
export type BookmarkDto = z.infer<typeof bookmarkSchema>;
export type BookmarkPage = z.infer<typeof bookmarkPageSchema>;
