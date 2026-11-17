import { BookmarkIcon, RefreshCwIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBookmarks } from '@/api/bookmarks';
import { errorMessage } from '@/api/client';
import type { Bookmark, BookmarkFilters } from '@/api/schemas';
import { BookmarkCardSkeleton } from '@/components/bookmarks/bookmark-card-skeleton';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

interface BookmarkListProps {
  filters: BookmarkFilters;
  renderCard: (bookmark: Bookmark) => ReactNode;
  emptyAction: ReactNode;
  onClearFilters: () => void;
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function BookmarkList({
  filters,
  renderCard,
  emptyAction,
  onClearFilters,
}: BookmarkListProps) {
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useBookmarks(filters);
  const filtered = filters.q !== '' || filters.tags.length > 0;

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {SKELETON_KEYS.map((key) => (
          <BookmarkCardSkeleton key={key} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Could not load bookmarks</EmptyTitle>
          <EmptyDescription>{errorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCwIcon />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const bookmarks = data.pages.flatMap((page) => page.items);
  const total = data.pages[0]?.total ?? 0;

  if (bookmarks.length === 0) {
    return filtered ? (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Nothing found</EmptyTitle>
          <EmptyDescription>
            No bookmarks match your search or selected tags. Try other words or fewer tags.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    ) : (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookmarkIcon />
          </EmptyMedia>
          <EmptyTitle>No bookmarks yet</EmptyTitle>
          <EmptyDescription>
            Add a link and its title, description and icon will be fetched automatically.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{emptyAction}</EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered ? `${pluralize(total, 'result')} found` : pluralize(total, 'bookmark')}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id}>{renderCard(bookmark)}</li>
        ))}
      </ul>
      {hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage && <Spinner />}
          Load more
        </Button>
      )}
    </div>
  );
}
