import type { Db } from '../../lib/db.js';
import type { TagCount } from './schemas.js';

export interface TagService {
  list(): Promise<TagCount[]>;
}

export function createTagService(db: Db): TagService {
  return {
    list() {
      return db.$queryRaw<TagCount[]>`
        SELECT t.name, count(*)::int AS count
        FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        GROUP BY t.id, t.name
        ORDER BY count DESC, t.name ASC
      `;
    },
  };
}
