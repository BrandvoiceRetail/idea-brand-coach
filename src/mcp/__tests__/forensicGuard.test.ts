// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkForensicBudget, __resetForensicBudget, FORENSIC_TOOLS } from '../forensicGuard.js';

describe('forensicGuard.checkForensicBudget (per-caller cost cap)', () => {
  beforeEach(() => {
    __resetForensicBudget();
    process.env.MCP_FORENSIC_MAX_PER_WINDOW = '3';
    process.env.MCP_FORENSIC_WINDOW_MS = '1000';
  });
  afterEach(() => {
    delete process.env.MCP_FORENSIC_MAX_PER_WINDOW;
    delete process.env.MCP_FORENSIC_WINDOW_MS;
    __resetForensicBudget();
  });

  it('allows up to the cap, then denies with a retry hint', () => {
    const t = 1_000_000;
    expect(checkForensicBudget('u1', t).allowed).toBe(true); // 1
    expect(checkForensicBudget('u1', t).allowed).toBe(true); // 2
    const third = checkForensicBudget('u1', t);
    expect(third.allowed).toBe(true); // 3 (at cap)
    expect(third.remaining).toBe(0);
    const fourth = checkForensicBudget('u1', t);
    expect(fourth.allowed).toBe(false); // over cap
    expect(fourth.retry_after_sec).toBeGreaterThan(0);
  });

  it('is per-caller — one user’s spend does not exhaust another’s', () => {
    const t = 2_000_000;
    checkForensicBudget('u1', t); checkForensicBudget('u1', t); checkForensicBudget('u1', t);
    expect(checkForensicBudget('u1', t).allowed).toBe(false);
    expect(checkForensicBudget('u2', t).allowed).toBe(true); // fresh bucket
  });

  it('rolls off after the window — budget refills', () => {
    const t = 3_000_000;
    checkForensicBudget('u1', t); checkForensicBudget('u1', t); checkForensicBudget('u1', t);
    expect(checkForensicBudget('u1', t).allowed).toBe(false);
    // 1.5s later, the 1s window has rolled off
    expect(checkForensicBudget('u1', t + 1500).allowed).toBe(true);
  });

  it('guards the heavy forensic tools but not cheap deterministic ones', () => {
    expect(FORENSIC_TOOLS.has('run_diagnostic_evidence')).toBe(true);
    expect(FORENSIC_TOOLS.has('identify_decision_trigger')).toBe(true);
    expect(FORENSIC_TOOLS.has('build_avatar_stage')).toBe(true);
    expect(FORENSIC_TOOLS.has('generate_brief')).toBe(true);
    // deterministic / reads are NOT rate-limited
    expect(FORENSIC_TOOLS.has('run_trust_gap')).toBe(false);
    expect(FORENSIC_TOOLS.has('compute_trust_gap_lift')).toBe(false);
    expect(FORENSIC_TOOLS.has('list_avatars')).toBe(false);
  });
});
