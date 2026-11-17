import type { Db } from '../../lib/db.js';
import type { Health } from './schemas.js';

export interface HealthService {
  check(): Promise<Health>;
}

export function createHealthService(db: Db): HealthService {
  return {
    async check() {
      try {
        await db.$queryRaw`SELECT 1`;
        return { status: 'ok', database: 'up' };
      } catch {
        return { status: 'error', database: 'down' };
      }
    },
  };
}
