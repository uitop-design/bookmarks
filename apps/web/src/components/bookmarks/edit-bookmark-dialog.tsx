import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useUpdateBookmark } from '@/api/bookmarks';
import type { Bookmark } from '@/api/schemas';
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
import { Textarea } from '@/components/ui/textarea';
import { MAX_TAGS } from '@/lib/tags';

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 500;

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a title')
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
    ),
  tags: z.array(z.string()).max(MAX_TAGS),
});

type FormValues = z.infer<typeof formSchema>;

interface EditBookmarkDialogProps {
  bookmark: Bookmark;
  onClose: () => void;
}

export function EditBookmarkDialog({ bookmark, onClose }: EditBookmarkDialogProps) {
  const updateBookmark = useUpdateBookmark(bookmark.id);
  const [tagError, setTagError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: bookmark.title,
      description: bookmark.description ?? '',
      tags: bookmark.tags,
    },
  });
  const pending = updateBookmark.isPending;

  const onSubmit = form.handleSubmit((values) => {
    updateBookmark.mutate(
      { title: values.title, description: values.description || null, tags: values.tags },
      {
        onSuccess: () => {
          toast.success('Bookmark updated');
          onClose();
        },
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit bookmark</DialogTitle>
            <DialogDescription className="truncate">{bookmark.url}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-title">Title</FieldLabel>
                  <Input
                    {...field}
                    id="edit-title"
                    maxLength={TITLE_MAX_LENGTH}
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                  <Textarea
                    {...field}
                    id="edit-description"
                    rows={4}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    className="max-h-48"
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
                  <FieldLabel htmlFor="edit-tags">Tags</FieldLabel>
                  <TagInput
                    id="edit-tags"
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
