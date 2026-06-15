// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { redact, safeLog, setLogSink } from '../logging/redact.js';

describe('redact (MF-5 log-redaction contract)', () => {
  it('strips sensitive values at any depth', () => {
    const out = redact({
      event: 'x',
      token: 'super-secret-jwt',
      nested: { prompt: 'do not leak me', email: 'a@b.com', ok: 'keep' },
      list: [{ password: 'pw' }],
    }) as Record<string, unknown>;
    const s = JSON.stringify(out);
    expect(s).not.toContain('super-secret-jwt');
    expect(s).not.toContain('do not leak me');
    expect(s).not.toContain('a@b.com');
    expect(s).not.toContain('pw');
    expect(s).toContain('keep');
    expect(s).toContain('[redacted]');
  });

  it('safeLog never emits PII / prompts / tokens / tool args to the sink', () => {
    const lines: string[] = [];
    const prev = setLogSink((l) => lines.push(l));
    try {
      safeLog({
        event: 'tool.call',
        token: 'BEARER-LEAK',
        args: { conversation: ['secret turn'], email: 'user@x.com' },
        prompt: 'sensitive prompt body',
        caller: 'u_abc',
      });
    } finally {
      setLogSink(prev);
    }
    expect(lines).toHaveLength(1);
    const line = lines[0];
    for (const leak of ['BEARER-LEAK', 'secret turn', 'user@x.com', 'sensitive prompt body']) {
      expect(line).not.toContain(leak);
    }
    // whitelisted scalars still present
    expect(line).toContain('tool.call');
    expect(line).toContain('u_abc');
  });
});

afterEach(() => {
  // ensure no sink leakage between tests
  setLogSink((l) => void l);
});
