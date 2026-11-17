import { z } from 'zod';

export const errorSchema = z
  .object({
    statusCode: z.int().meta({ example: 404 }),
    error: z.string().meta({ example: 'Not Found' }),
    message: z.union([z.string(), z.array(z.string())]).meta({ example: 'Bookmark not found' }),
    path: z.string().meta({ example: '/api/bookmarks/7f1c9a52-0d7e-4a51-9c63-2a1b3f1d9e10' }),
    timestamp: z.iso.datetime(),
  })
  .meta({ id: 'Error' });

export type ErrorBody = z.infer<typeof errorSchema>;

export function errorResponses<const T extends readonly number[]>(...codes: T) {
  return Object.fromEntries(codes.map((code) => [code, errorSchema])) as Record<
    T[number],
    typeof errorSchema
  >;
}
