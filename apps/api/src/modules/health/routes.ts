import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { healthSchema } from './schemas.js';
import type { HealthService } from './service.js';

export const healthRoutes: FastifyPluginAsyncZod<{ service: HealthService }> = async (
  app,
  { service },
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Check API and database health',
        response: { 200: healthSchema, 503: healthSchema },
      },
    },
    async (_request, reply) => {
      const health = await service.check();
      return reply.code(health.status === 'ok' ? 200 : 503).send(health);
    },
  );
};
