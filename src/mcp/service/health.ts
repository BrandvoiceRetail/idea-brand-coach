/**
 * Layer 1 (service) — health.
 *
 * Pure-ish: reports host identity, bound-caller auth state, and whether the asset
 * ledger backend is configured. Emits NO secrets (only the boolean `ledgerConfigured`).
 */
import { SERVER_NAME, SERVER_VERSION } from '../config.js';
import { getIdentity } from '../context/identity.js';

export interface HealthReport {
  server: string;
  version: string;
  status: 'ok';
  authenticated: boolean;
  ledgerConfigured: boolean;
}

export function getHealth(ledgerConfigured: boolean): HealthReport {
  return {
    server: SERVER_NAME,
    version: SERVER_VERSION,
    status: 'ok',
    authenticated: getIdentity().authenticated,
    ledgerConfigured,
  };
}
