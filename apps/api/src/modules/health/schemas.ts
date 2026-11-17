import { z } from 'zod';

export const healthSchema = z
  .object({
    status: z.enum(['ok', 'error']),
    database: z.enum(['up', 'down']),
  })
  .meta({ id: 'Health' });

export type Health = z.infer<typeof healthSchema>;
