import fp from 'fastify-plugin';
import type { Db } from '../lib/db.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export const prismaPlugin = fp<{ db: Db }>(
  async (app, { db }) => {
    app.decorate('db', db);
    app.addHook('onClose', async () => {
      await db.$disconnect();
    });
  },
  { name: 'prisma' },
);
