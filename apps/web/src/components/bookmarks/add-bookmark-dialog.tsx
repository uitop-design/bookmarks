import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getBookmark, useCreateBookmark } from '@/api/bookmarks';
import { conflictingId, errorMessage } from '@/api/client';
import { TagInput } from '@/components/tag-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { MAX_TAGS } from '@/lib/tags';

const MAX_URL_LENGTH = 2048;

function isHttpUrl(value: string) {
  return URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol);
}

const formSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Enter a URL')
    .max(MAX_URL_LENGTH, `URL must be at most ${MAX_URL_LENGTH} characters`)
    .refine(isHttpUrl, 'Enter a full URL starting with http:// or https://'),
  tags: z.array(z.string()).max(MAX_TAGS),
});

type FormValues = z.infer<typeof formSchema>;

async function showDuplicate(id: string) {
  try {
    const existing = await getBookmark(id);
    toast.info('This link is already in your bookmarks', {
      description: existing.title,
      action: {
        label: 'Open',
        onClick: () => window.open(existing.url, '_blank', 'noopener,noreferrer'),
      },
    });
  } catch {
    toast.info('This link is already in your bookmarks');
  }
}

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBookmarkDialog({ open, onOpenChange }: AddBookmarkDialogProps) {
  const createBookmark = useCreateBookmark();
  const [tagError, setTagError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '', tags: [] },
  });
  const pending = createBookmark.isPending;

  function handleOpenChange(next: boolean) {
    if (pending) {
      return;
    }
    if (!next) {
      form.reset();
      setTagError(null);
    }
    onOpenChange(next);
  }

  const onSubmit = form.handleSubmit((values) => {
    createBookmark.mutate(values, {
      onSuccess: (bookmark) => {
        if (bookmark.metadataStatus === 'FAILED') {
          toast.warning('Bookmark added, but the page details could not be fetched');
        } else {
          toast.success('Bookmark added');
        }
        form.reset();
        onOpenChange(false);
      },
      onError: (error) => {
        const id = conflictingId(error);
        if (id) {
          void showDuplicate(id);
        } else {
          toast.error(errorMessage(error));
        }
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add bookmark</DialogTitle>
            <DialogDescription>
              The title, description and icon are fetched from the page.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              control={form.control}
              name="url"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bookmark-url">URL</FieldLabel>
                  <Input
                    {...field}
                    id="bookmark-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/article"
                    autoComplete="off"
                    autoFocus
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="tags"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || tagError !== null}>
                  <FieldLabel htmlFor="bookmark-tags">Tags</FieldLabel>
                  <TagInput
                    id="bookmark-tags"
                    value={field.value}
                    onChange={field.onChange}
                    onErrorChange={setTagError}
                    disabled={pending}
                    invalid={fieldState.invalid || tagError !== null}
                  />
                  {tagError ? (
                    <FieldError>{tagError}</FieldError>
                  ) : (
                    <FieldDescription>
                      Press Enter or comma to add a tag. Up to {MAX_TAGS} tags.
                    </FieldDescription>
                  )}
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Fetching details…' : 'Add bookmark'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
