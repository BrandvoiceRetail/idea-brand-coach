/**
 * Layer 1 (service) — Expert Intelligence Loop, weekly digest.
 *
 * Closes the loop back to Trevor: once a week, summarize the corrections that became LIVE coaching
 * updates and post it to the team Slack channel (via the same FeedbackSink `submit_feedback` uses).
 *
 * Reports only APPLIED changes (coach_instructions the human PUBLISHED in the window, with their
 * source-correction counts) — never drafts, never nightly (errors.md #18: the digest follows the
 * human publish step). Non-blocking: a Slack failure returns `{sent:false}`, never throws
 * (errors.md #19). Message composition is pure + testable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedbackSink } from '../slack/feedbackNotifier.js';

export interface AppliedChange {
  instructionId: string;
  whenToUse?: string | null;
  correctionCount: number;
}

/** Pure: compose the Slack digest body. Returns '' when there is nothing to report. */
export function composeDigest(changes: AppliedChange[], sinceLabel = 'this week'): string {
  if (changes.length === 0) return '';
  const totalCorrections = changes.reduce((n, c) => n + c.correctionCount, 0);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const lines = changes.map(
    (c) => `• ${c.whenToUse?.trim() || c.instructionId} (${plural(c.correctionCount, 'correction')})`,
  );
  const correctionsPhrase = `${totalCorrections} of your correction${totalCorrections === 1 ? '' : 's'}`;
  return [
    'IDEA Brand Coach — Expert Intelligence Loop: weekly digest',
    `${plural(changes.length, 'coaching update')} went live ${sinceLabel}, distilled from ${correctionsPhrase}:`,
    ...lines,
    'The coach applies these automatically now. Next up: the nightly distill and in-app capture.',
  ].join('\n');
}

export interface DigestDeps {
  /** APPLIED changes since the cutoff (published instructions + their source-correction counts). */
  readAppliedChanges(sinceIso: string): Promise<AppliedChange[]>;
  notifier: FeedbackSink;
}

export interface DigestResult {
  sent: boolean;
  changeCount: number;
  note?: string;
}

/**
 * Read this period's applied changes and, if any, post the digest. Returns {sent:false} with a note
 * when there is nothing to report or delivery fails — never throws.
 */
export async function sendWeeklyDigest(
  deps: DigestDeps,
  opts: { sinceIso: string; sinceLabel?: string },
): Promise<DigestResult> {
  let changes: AppliedChange[];
  try {
    changes = await deps.readAppliedChanges(opts.sinceIso);
  } catch {
    return { sent: false, changeCount: 0, note: 'could not read applied changes' };
  }
  if (changes.length === 0) return { sent: false, changeCount: 0, note: 'no applied changes this period' };

  const message = composeDigest(changes, opts.sinceLabel);
  const res = await deps.notifier.send({ message, category: 'other', caller: 'expert-intel-loop' });
  return { sent: res.ok, changeCount: changes.length, note: res.note };
}

/** Real deps: read applied changes off the service-role client. */
export function buildDigestDeps(client: SupabaseClient, notifier: FeedbackSink): DigestDeps {
  return {
    notifier,
    async readAppliedChanges(sinceIso) {
      // Instructions the human published in the window...
      const { data: published, error } = await client
        .from('coach_instructions')
        .select('instruction_id, when_to_use')
        .eq('status', 'published')
        .gt('published_at', sinceIso);
      if (error) throw new Error(`coach_instructions: ${error.message}`);
      const changes: AppliedChange[] = [];
      for (const inst of (published ?? []) as Array<{ instruction_id: string; when_to_use: string | null }>) {
        // ...with at least one applied source correction (loop-originated).
        const { count } = await client
          .from('expert_corrections')
          .select('id', { count: 'exact', head: true })
          .eq('proposed_instruction_id', inst.instruction_id)
          .eq('status', 'applied');
        if ((count ?? 0) > 0) {
          changes.push({ instructionId: inst.instruction_id, whenToUse: inst.when_to_use, correctionCount: count ?? 0 });
        }
      }
      return changes;
    },
  };
}
