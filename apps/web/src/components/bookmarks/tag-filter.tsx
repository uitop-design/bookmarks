import { XIcon } from 'lucide-react';
import { useTags } from '@/api/bookmarks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({ selected, onToggle, onClear }: TagFilterProps) {
  const { data: tags, isPending, isError } = useTags();

  return (
    <nav aria-label="Filter by tag" className="flex flex-col gap-2">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tags</h2>
        {selected.length > 0 && (
          <Button variant="ghost" size="xs" onClick={onClear}>
            <XIcon />
            Clear
          </Button>
        )}
      </div>
      {isPending && (
        <div className="flex gap-1.5 lg:flex-col">
          {['w-20', 'w-24', 'w-16', 'w-28'].map((width) => (
            <Skeleton key={width} className={cn('h-8', width, 'lg:w-full')} />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-muted-foreground">Could not load tags.</p>}
      {tags?.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
      {tags && tags.length > 0 && (
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {tags.map((tag) => {
            const active = selected.includes(tag.name);
            return (
              <li key={tag.name} className="shrink-0">
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => onToggle(tag.name)}
                  className={cn(
                    'w-full justify-between gap-3 border lg:border-transparent',
                    active ? 'border-transparent font-semibold' : 'text-muted-foreground',
                  )}
                >
                  <span className="truncate">#{tag.name}</span>
                  <span className="text-xs tabular-nums opacity-70">{tag.count}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
