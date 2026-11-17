import { EllipsisIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteBookmark, useRefreshBookmark } from '@/api/bookmarks';
import type { Bookmark } from '@/api/schemas';
import { EditBookmarkDialog } from '@/components/bookmarks/edit-bookmark-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

export function BookmarkActions({ bookmark }: { bookmark: Bookmark }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const refreshBookmark = useRefreshBookmark();
  const deleteBookmark = useDeleteBookmark();

  function refresh() {
    refreshBookmark.mutate(bookmark.id, {
      onSuccess: (updated) => {
        if (updated.metadataStatus === 'FAILED') {
          toast.warning('The page could not be fetched', { description: updated.url });
        } else {
          toast.success('Metadata refreshed');
        }
      },
    });
  }

  function remove() {
    deleteBookmark.mutate(bookmark.id, {
      onSuccess: () => {
        toast.success('Bookmark deleted');
        setDeleting(false);
      },
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mt-1 -mr-2 shrink-0"
            aria-label={`Actions for ${bookmark.title}`}
          >
            {refreshBookmark.isPending ? <Spinner /> : <EllipsisIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={refresh} disabled={refreshBookmark.isPending}>
            <RefreshCwIcon />
            Refresh metadata
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <EditBookmarkDialog bookmark={bookmark} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete bookmark?"
        description={
          <>
            <span className="font-medium text-foreground">{bookmark.title}</span> will be removed.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        pending={deleteBookmark.isPending}
        onConfirm={remove}
      />
    </>
  );
}
