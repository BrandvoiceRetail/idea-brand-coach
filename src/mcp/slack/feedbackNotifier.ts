/**
 * Slack notifier for user feedback — the brand-coach MCP's feedback-delivery seam.
 *
 * `submit_feedback` is the only caller. It posts a formatted message to the team's
 * #idea-brand-coach channel via Slack's Web API (`chat.postMessage`), authenticated with
 * the `SLACK_BOT_TOKEN` bot token (`chat:write`; the bot must be a member of the channel).
 *
 * Mirrors EdgeFnClient's discipline: `fetchImpl` is injectable for tests, every send is
 * logged via redaction-gated `safeLog` (METADATA ONLY — never the feedback text), and it
 * degrades gracefully — an unconfigured token or an unreachable Slack yields
 * `{ ok:false, note }`, never a throw.
 *
 * GOTCHA: Slack's Web API returns HTTP 200 even on logical failures (e.g. not_in_channel,
 * channel_not_found, invalid_auth) — the real status is in the JSON body's `ok` field. We
 * parse the body and treat `ok:false` as a delivery failure.
 */
import { loadConfig, type HostConfig } from '../config.js';
import { safeLog } from '../logging/redact.js';

const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

export interface FeedbackInput {
  /** The user's feedback text. Sent to Slack verbatim; never logged. */
  message: string;
  /** Optional feedback kind (bug | idea | praise | question | other). */
  category?: string;
  /** Optional free-text context (what the user was doing). */
  context?: string;
  /** Non-reversible caller tag (userTag) for attribution — never raw PII. */
  caller: string;
}

export interface NotifyResult {
  ok: boolean;
  note?: string;
}

/** What `submit_feedback` depends on (DIP seam — lets tests inject a fake sink). */
export interface FeedbackSink {
  send(input: FeedbackInput): Promise<NotifyResult>;
}

/** Build the chat.postMessage body (Block Kit + a plain-text fallback). */
function buildMessage(channel: string, input: FeedbackInput): Record<string, unknown> {
  const category = input.category ?? 'other';
  const context = input.context?.trim() ? input.context.trim() : '—';
  return {
    channel,
    // Fallback text shown in notifications / where blocks aren't rendered.
    text: `New IDEA Brand Coach feedback (${category})`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `:speech_balloon: *New IDEA Brand Coach feedback* — \`${category}\`` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `>>> ${input.message}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `*Context:* ${context}  ·  *From:* ${input.caller} · via MCP` }],
      },
    ],
  };
}

export class FeedbackNotifier implements FeedbackSink {
  constructor(
    private readonly config: Pick<HostConfig, 'slackBotToken' | 'slackFeedbackChannelId'> = loadConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** True when a bot token is configured — `health`/diagnostics can surface readiness. */
  get configured(): boolean {
    return this.config.slackBotToken !== null;
  }

  async send(input: FeedbackInput): Promise<NotifyResult> {
    const token = this.config.slackBotToken;
    if (!token) {
      safeLog({ level: 'warn', event: 'feedback.unconfigured' });
      return { ok: false, note: 'feedback channel not configured (SLACK_BOT_TOKEN unset)' };
    }
    try {
      const res = await this.fetchImpl(SLACK_POST_MESSAGE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildMessage(this.config.slackFeedbackChannelId, input)),
      });
      // Slack returns HTTP 200 even on logical errors — the truth is in body.ok.
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      safeLog({
        event: 'feedback.sent',
        caller: input.caller,
        category: input.category ?? 'none',
        status: res.status,
        slack_ok: data.ok === true,
      });
      if (!res.ok) return { ok: false, note: `Slack API failed (HTTP ${res.status})` };
      if (data.ok !== true) return { ok: false, note: `Slack API error (${data.error ?? 'unknown'})` };
      return { ok: true };
    } catch {
      safeLog({ level: 'warn', event: 'feedback.unreachable', caller: input.caller });
      return { ok: false, note: 'feedback channel unreachable' };
    }
  }
}
