import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { AddBookmarkDialog } from '@/components/bookmarks/add-bookmark-dialog';
import { BookmarkCard } from '@/components/bookmarks/bookmark-card';
import { BookmarkList } from '@/components/bookmarks/bookmark-list';
import { TagFilter } from '@/components/bookmarks/tag-filter';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { useBookmarkFilters } from '@/hooks/use-bookmark-filters';

export function BookmarksPage() {
  const { filters, setQuery, toggleTag, clearTags, clearAll } = useBookmarkFilters();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        search={<SearchInput query={filters.q} onQueryChange={setQuery} />}
        actions={
          <Button onClick={() => setAddOpen(true)} aria-label="Add bookmark">
            <PlusIcon />
            <span className="hidden sm:inline">Add bookmark</span>
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:w-56 lg:shrink-0 lg:self-start">
          <TagFilter selected={filters.tags} onToggle={toggleTag} onClear={clearTags} />
        </aside>
        <main className="min-w-0 flex-1">
          <BookmarkList
            filters={filters}
            onClearFilters={clearAll}
            emptyAction={
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon />
                Add your first bookmark
              </Button>
            }
            renderCard={(bookmark) => (
              <BookmarkCard
                bookmark={bookmark}
                selectedTags={filters.tags}
                onTagClick={toggleTag}
              />
            )}
          />
        </main>
      </div>
      <AddBookmarkDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
