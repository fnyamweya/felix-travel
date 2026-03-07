/**
 * Hono context type helpers.
 *
 * Every route handler receives a typed context that includes Worker bindings
 * and the session (injected by requireAuth middleware).
 */
import type { Context } from 'hono';
import type { Env } from './bindings.js';
import type { SessionContext } from '@felix-travel/types';

export type AppContext = Context<{
  Bindings: Env;
  Variables: {
    session: SessionContext;
  };
}>;
