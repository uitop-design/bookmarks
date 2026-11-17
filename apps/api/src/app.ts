import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import type { Db } from './lib/db.js';
import { createMetadataLoader, type MetadataLoader } from './metadata/metadata-service.js';
import { bookmarkRoutes } from './modules/bookmarks/routes.js';
import { createBookmarkService } from './modules/bookmarks/service.js';
import { healthRoutes } from './modules/health/routes.js';
import { createHealthService } from './modules/health/service.js';
import { tagRoutes } from './modules/tags/routes.js';
import { createTagService } from './modules/tags/service.js';
import { errorsPlugin } from './plugins/errors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { swaggerPlugin } from './plugins/swagger.js';

export interface AppDependencies {
  env: Env;
  db: Db;
  loadMetadata?: MetadataLoader;
}

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: env.LOG_LEVEL };
}

export async function buildApp({ env, db, loadMetadata }: AppDependencies) {
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 64 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorsPlugin);
  await app.register(prismaPlugin, { db });
  await app.register(swaggerPlugin);

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { service: createHealthService(db) });
      await api.register(bookmarkRoutes, {
        service: createBookmarkService({
          db,
          loadMetadata:
            loadMetadata ??
            createMetadataLoader({
              allowPrivateAddresses: env.ALLOW_PRIVATE_URLS,
              logger: app.log,
            }),
        }),
      });
      await api.register(tagRoutes, { service: createTagService(db) });
    },
    { prefix: '/api' },
  );

  return app;
}
