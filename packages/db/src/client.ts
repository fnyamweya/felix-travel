import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema/index.js';

export type DbClient = ReturnType<typeof createDbClient>;

/**
 * Create a Drizzle D1 client bound to a specific request's D1 binding.
 * D1 is request-scoped — never cache across requests.
 */
export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}

export { schema };
