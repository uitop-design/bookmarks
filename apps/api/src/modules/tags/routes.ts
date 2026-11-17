import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../../lib/error-schema.js';
import { tagCountSchema } from './schemas.js';
import type { TagService } from './service.js';

export const tagRoutes: FastifyPluginAsyncZod<{ service: TagService }> = async (
  app,
  { service },
) => {
  app.get(
    '/tags',
    {
      schema: {
        tags: ['tags'],
        summary: 'List tags that have bookmarks, most used first',
        response: { 200: z.array(tagCountSchema), ...errorResponses(500) },
      },
    },
    () => service.list(),
  );
};
