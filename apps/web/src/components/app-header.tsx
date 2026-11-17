import { BookmarkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '@/components/theme-toggle';

interface AppHeaderProps {
  search: ReactNode;
  actions: ReactNode;
}

export function AppHeader({ search, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          aria-label="Bookmarks home"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookmarkIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Bookmarks</span>
        </Link>
        <div className="min-w-0 flex-1 sm:max-w-md">{search}</div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
