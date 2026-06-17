/**
 * Layer 1 (service) — health.
 *
 * Pure-ish: reports host identity, bound-caller auth state, and whether the IV-OS
 * ledger consumer is configured. Emits NO secrets (only the boolean `ivosConfigured`).
 */
import { SERVER_NAME, SERVER_VERSION } from '../config.js';
import { getIdentity } from '../context/identity.js';

export interface HealthReport {
  server: string;
  version: string;
  status: 'ok';
  authenticated: boolean;
  ivosConfigured: boolean;
}

export function getHealth(ivosConfigured: boolean): HealthReport {
  return {
    server: SERVER_NAME,
    version: SERVER_VERSION,
    status: 'ok',
    authenticated: getIdentity().authenticated,
    ivosConfigured,
  };
}
