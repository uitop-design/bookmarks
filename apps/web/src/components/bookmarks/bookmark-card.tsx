import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Bookmark } from '@/api/schemas';
import { BookmarkFavicon } from '@/components/bookmarks/bookmark-favicon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { hostOf } from '@/lib/url';
import { cn } from '@/lib/utils';

interface BookmarkCardProps {
  bookmark: Bookmark;
  selectedTags: string[];
  onTagClick: (tag: string) => void;
  menu?: ReactNode;
}

export function BookmarkCard({ bookmark, selectedTags, onTagClick, menu }: BookmarkCardProps) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="flex items-start gap-3">
        <BookmarkFavicon src={bookmark.faviconUrl} />
        <div className="min-w-0 flex-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-medium leading-snug break-words hover:underline"
            title={bookmark.title}
          >
            {bookmark.title}
          </a>
          <p className="truncate text-xs text-muted-foreground">{hostOf(bookmark.url)}</p>
        </div>
        {menu}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p
          className={cn(
            'line-clamp-2 text-sm break-words text-muted-foreground',
            !bookmark.description && 'italic opacity-70',
          )}
        >
          {bookmark.description ?? 'No description'}
        </p>
        {(bookmark.metadataStatus === 'FAILED' || bookmark.tags.length > 0) && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {bookmark.metadataStatus === 'FAILED' && (
              <Badge variant="destructive" title="The page could not be fetched">
                <TriangleAlertIcon />
                metadata failed
              </Badge>
            )}
            {bookmark.tags.map((tag) => (
              <Badge
                key={tag}
                asChild
                variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
              >
                <button
                  type="button"
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onTagClick(tag)}
                >
                  #{tag}
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
