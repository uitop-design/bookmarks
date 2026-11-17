import { z } from 'zod';

export const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  siteName: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  metadataStatus: z.enum(['PENDING', 'OK', 'FAILED']),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bookmarkPageSchema = z.object({
  items: z.array(bookmarkSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const tagCountSchema = z.object({
  name: z.string(),
  count: z.number(),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarkPage = z.infer<typeof bookmarkPageSchema>;
export type TagCount = z.infer<typeof tagCountSchema>;

export interface BookmarkFilters {
  q: string;
  tags: string[];
}

export interface CreateBookmarkInput {
  url: string;
  tags: string[];
}

export interface UpdateBookmarkInput {
  title: string;
  description: string | null;
  tags: string[];
}
