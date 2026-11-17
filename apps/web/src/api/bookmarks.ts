import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from './client';
import {
  type BookmarkFilters,
  bookmarkPageSchema,
  bookmarkSchema,
  type CreateBookmarkInput,
  tagCountSchema,
  type UpdateBookmarkInput,
} from './schemas';

const PAGE_SIZE = 24;

export const queryKeys = {
  bookmarks: ['bookmarks'] as const,
  bookmarkList: (filters: BookmarkFilters) => ['bookmarks', 'list', filters] as const,
  tags: ['tags'] as const,
};

function listPath({ q, tags }: BookmarkFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (q) {
    params.set('q', q);
  }
  if (tags.length > 0) {
    params.set('tags', tags.join(','));
  }
  return `/bookmarks?${params}`;
}

export function getBookmark(id: string) {
  return request(`/bookmarks/${id}`, bookmarkSchema);
}

export function useBookmarks(filters: BookmarkFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.bookmarkList(filters),
    queryFn: ({ pageParam, signal }) =>
      request(listPath(filters, pageParam), bookmarkPageSchema, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: ({ signal }) => request('/tags', z.array(tagCountSchema), { signal }),
  });
}

function useInvalidateBookmarks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tags }),
    ]);
}

export function useCreateBookmark() {
  const invalidate = useInvalidateBookmarks();
  return useMutation({
    mutationFn: (input: CreateBookmarkInput) =>
      request('/bookmarks', bookmarkSchema, { method: 'POST', body: input }),
    onSuccess: invalidate,
    meta: { handlesErrors: true },
  });
}

export function useUpdateBookmark(id: string) {
  const invalidate = useInvalidateBookmarks();
  return useMutation({
    mutationFn: (input: UpdateBookmarkInput) =>
      request(`/bookmarks/${id}`, bookmarkSchema, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useRefreshBookmark() {
  const invalidate = useInvalidateBookmarks();
  return useMutation({
    mutationFn: (id: string) =>
      request(`/bookmarks/${id}/refresh`, bookmarkSchema, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteBookmark() {
  const invalidate = useInvalidateBookmarks();
  return useMutation({
    mutationFn: (id: string) => request(`/bookmarks/${id}`, z.undefined(), { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
