import { existsSync } from 'node:fs';
import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createDb } from './lib/db.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = parseEnv(process.env);
const app = await buildApp({ env, db: createDb(env.DATABASE_URL) });

let closing = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'Shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'Graceful shutdown failed');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start server');
  process.exit(1);
}
