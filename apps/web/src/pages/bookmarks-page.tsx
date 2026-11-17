import { AppHeader } from '@/components/app-header';
import { SearchInput } from '@/components/search-input';
import { useBookmarkFilters } from '@/hooks/use-bookmark-filters';

export function BookmarksPage() {
  const { filters, setQuery } = useBookmarkFilters();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        search={<SearchInput query={filters.q} onQueryChange={setQuery} />}
        actions={null}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6" />
    </div>
  );
}
