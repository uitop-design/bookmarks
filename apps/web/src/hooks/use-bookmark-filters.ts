import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { BookmarkFilters } from '@/api/schemas';

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return [...new Set(value.split(',').map((tag) => tag.trim().toLowerCase()))].filter(Boolean);
}

export function useBookmarkFilters() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const tagsParam = params.get('tags');

  const filters = useMemo<BookmarkFilters>(
    () => ({ q, tags: parseTags(tagsParam) }),
    [q, tagsParam],
  );

  const update = useCallback(
    (next: Partial<BookmarkFilters>) => {
      setParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next.q !== undefined) {
            if (next.q.trim()) {
              params.set('q', next.q.trim());
            } else {
              params.delete('q');
            }
          }
          if (next.tags !== undefined) {
            if (next.tags.length > 0) {
              params.set('tags', next.tags.join(','));
            } else {
              params.delete('tags');
            }
          }
          return params;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const toggleTag = useCallback(
    (tag: string) =>
      update({
        tags: filters.tags.includes(tag)
          ? filters.tags.filter((selected) => selected !== tag)
          : [...filters.tags, tag],
      }),
    [filters.tags, update],
  );

  const setQuery = useCallback((q: string) => update({ q }), [update]);

  return {
    filters,
    setQuery,
    toggleTag,
    clearTags: () => update({ tags: [] }),
    clearAll: () => update({ q: '', tags: [] }),
  };
}
