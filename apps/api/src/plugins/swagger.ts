import swagger, { type SwaggerTransformObject } from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

const SCHEMA_REF_PREFIX = '#/components/schemas/';

function referencedSchemas(value: unknown): Set<string> {
  const names = new Set<string>();
  JSON.stringify(value, (key, nested: unknown) => {
    if (key === '$ref' && typeof nested === 'string' && nested.startsWith(SCHEMA_REF_PREFIX)) {
      names.add(nested.slice(SCHEMA_REF_PREFIX.length));
    }
    return nested;
  });
  return names;
}

const transformObject: SwaggerTransformObject = (input) => {
  const document = jsonSchemaTransformObject(input);
  const schemas = 'components' in document ? document.components?.schemas : undefined;
  if (!schemas) {
    return document;
  }
  let used = referencedSchemas(document.paths);
  for (let size = -1; size !== used.size; ) {
    size = used.size;
    used = new Set([...used, ...referencedSchemas([...used].map((name) => schemas[name]))]);
  }
  for (const name of Object.keys(schemas)) {
    if (!used.has(name)) {
      delete schemas[name];
    }
  }
  return document;
};

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
      transformObject,
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  },
  { name: 'swagger' },
);
