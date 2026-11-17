import { z } from 'zod';

export const MAX_TAGS_PER_BOOKMARK = 10;
export const MAX_TAGS_PER_FILTER = 10;

export const tagNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9-]{1,24}$/,
    'Tag must be 1-24 characters long and contain only letters, digits and hyphens',
  )
  .meta({ example: 'typescript' });

export function uniqueTags(names: readonly string[]): string[] {
  return [...new Set(names)];
}

export const tagListSchema = z
  .array(tagNameSchema)
  .transform(uniqueTags)
  .pipe(
    z
      .array(z.string())
      .max(MAX_TAGS_PER_BOOKMARK, `A bookmark can have at most ${MAX_TAGS_PER_BOOKMARK} tags`),
  )
  .meta({
    description: `Up to ${MAX_TAGS_PER_BOOKMARK} tags; names are lowercased and deduplicated`,
    example: ['typescript', 'docs'],
  });

export const tagCountSchema = z
  .object({
    name: z.string().meta({ example: 'typescript' }),
    count: z.int().meta({ example: 3 }),
  })
  .meta({ id: 'TagCount' });

export type TagCount = z.infer<typeof tagCountSchema>;
