import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function SearchInput({ query, onQueryChange }: SearchInputProps) {
  const [value, setValue] = useState(query);
  const debounced = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  const applied = useRef(query);

  useEffect(() => {
    const next = debounced.trim();
    if (next !== applied.current) {
      applied.current = next;
      onQueryChange(next);
    }
  }, [debounced, onQueryChange]);

  useEffect(() => {
    if (query !== applied.current) {
      applied.current = query;
      setValue(query);
    }
  }, [query]);

  return (
    <div className="relative w-full">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setValue('');
          }
        }}
        placeholder="Search bookmarks"
        aria-label="Search bookmarks"
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => setValue('')}
          aria-label="Clear search"
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
