/**
 * config/config.ts
 *
 * Application-level configuration that is NOT covered by env.ts.
 *
 * IMPORTANT: env.ts is the primary configuration source for environment
 * variables (API_URL, SYNC_INTERVAL, DEBUG, etc.).  This file only
 * contains truly unique config that does not belong in env.ts, such as
 * storage keys and derived values.
 *
 * For API_URL, sync interval, timeout, debug, or mock settings,
 * import from env.ts instead:
 *
 *   import { ENV } from './env';
 *   console.log(ENV.API_URL, ENV.SYNC_INTERVAL, ENV.DEBUG);
 */

import { ENV } from './env';

export const CONFIG = {
  // ── Storage keys (MUST match AuthContext) ────────────────────────────
  tokenStorageKey: '@cobrancas:token',
  userStorageKey: '@cobrancas:user',
  deviceKeyStorageKey: '@cobrancas:device',

  // ── Derived from env.ts ──────────────────────────────────────────────
  // Re-exported here for backward compatibility with existing consumers
  // that import CONFIG instead of ENV.
  get API_URL()       { return ENV.API_URL; },
  get syncIntervalMs() { return ENV.SYNC_INTERVAL * 60 * 1000; },
  get syncTimeout()    { return ENV.TIMEOUT; },
  get debug()          { return ENV.DEBUG; },
  get useMock()        { return ENV.USE_MOCK; },
};
