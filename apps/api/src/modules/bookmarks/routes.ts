import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../../lib/error-schema.js';
import {
  bookmarkIdParamsSchema,
  bookmarkPageSchema,
  bookmarkSchema,
  createBookmarkSchema,
  listBookmarksQuerySchema,
  updateBookmarkSchema,
} from './schemas.js';
import type { BookmarkService } from './service.js';

export const bookmarkRoutes: FastifyPluginAsyncZod<{ service: BookmarkService }> = async (
  app,
  { service },
) => {
  app.get(
    '/bookmarks',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Search and filter bookmarks',
        description:
          'Without `q` the newest bookmarks come first; with `q` results are ordered by relevance.',
        querystring: listBookmarksQuerySchema,
        response: { 200: bookmarkPageSchema, ...errorResponses(400, 500) },
      },
    },
    (request) => service.list(request.query),
  );

  app.post(
    '/bookmarks',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Add a bookmark',
        description:
          'Fetches the page title, description and favicon before responding. The bookmark is ' +
          'created even if the page cannot be fetched; its metadataStatus is then FAILED.',
        body: createBookmarkSchema,
        response: { 201: bookmarkSchema, ...errorResponses(400, 409, 500) },
      },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
  );

  app.get(
    '/bookmarks/:id',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Get a bookmark',
        params: bookmarkIdParamsSchema,
        response: { 200: bookmarkSchema, ...errorResponses(400, 404, 500) },
      },
    },
    (request) => service.get(request.params.id),
  );

  app.patch(
    '/bookmarks/:id',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Edit a bookmark',
        description: 'Updates title and description; `tags` replaces the whole tag list.',
        params: bookmarkIdParamsSchema,
        body: updateBookmarkSchema,
        response: { 200: bookmarkSchema, ...errorResponses(400, 404, 500) },
      },
    },
    (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    '/bookmarks/:id',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Delete a bookmark',
        params: bookmarkIdParamsSchema,
        response: {
          204: z.undefined().describe('Bookmark deleted'),
          ...errorResponses(400, 404, 500),
        },
      },
    },
    async (request, reply) => {
      await service.remove(request.params.id);
      return reply.code(204).send();
    },
  );

  app.post(
    '/bookmarks/:id/refresh',
    {
      schema: {
        tags: ['bookmarks'],
        summary: 'Fetch page metadata again',
        description:
          'Overwrites title, description, site name and favicon, including manual edits.',
        params: bookmarkIdParamsSchema,
        response: { 200: bookmarkSchema, ...errorResponses(400, 404, 500) },
      },
    },
    (request) => service.refresh(request.params.id),
  );
};
