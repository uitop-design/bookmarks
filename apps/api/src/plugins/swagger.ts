import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

export const swaggerPlugin = fp(
  async (app) => {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'Bookmarks API',
          description:
            'Bookmark manager that fetches page metadata, with tags and full-text search.',
          version: '1.0.0',
        },
        tags: [
          { name: 'bookmarks', description: 'Create, search, edit and refresh bookmarks' },
          { name: 'tags', description: 'Tags with bookmark counts' },
          { name: 'health', description: 'Service health' },
        ],
      },
      transform: jsonSchemaTransform,
      transformObject: jsonSchemaTransformObject,
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  },
  { name: 'swagger' },
);
