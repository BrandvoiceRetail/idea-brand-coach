/**
 * Structured logging with redaction (MF-5 contract).
 *
 * The host must NEVER emit PII, raw prompts, tool inputs, tokens, or KB content to
 * logs. Callers pass a structured record of *whitelisted scalars* (event, tool,
 * status, ms, userIdHash). `redact()` is the defensive backstop: any record routed
 * through `safeLog()` has sensitive keys stripped before serialization, so an
 * accidental `{ token, prompt, ... }` can never reach the sink.
 */

/** Keys whose VALUES must never be logged, at any nesting depth. */
const SENSITIVE_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'api_key',
  'password',
  'secret',
  'prompt',
  'content',
  'conversation',
  'messages',
  'fields',
  'args',
  'arguments',
  'input',
  'inputs',
  'email',
  'phone',
  'jwt',
]);

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSink = (line: string) => void;

export interface LogRecord {
  level?: LogLevel;
  event: string;
  [field: string]: unknown;
}

let sink: LogSink = (line) => {
  // stderr keeps logs off the MCP stdout/transport channel.
  console.error(line);
};

/** Test seam: swap the sink to capture emitted lines. Returns the previous sink. */
export function setLogSink(next: LogSink): LogSink {
  const prev = sink;
  sink = next;
  return prev;
}

export function safeLog(record: LogRecord): void {
  const { level = 'info', ...rest } = record;
  const safe = redact(rest) as Record<string, unknown>;
  sink(JSON.stringify({ level, ...safe }));
}
