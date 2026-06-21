/**
 * A2 behavioural runner (CLI) — `npm run evals:live [caseId]`.
 *
 * GATED: replays each curated eval case through the real coach (Anthropic Messages-API
 * tool-use loop over the in-process MCP tools) and LLM-judges actual-vs-expected. Requires
 * ANTHROPIC_API_KEY. Prints per-case scores; does NOT mutate the deterministic committed
 * report (that stays A1-only). Optional model overrides: ANTHROPIC_EVAL_MODEL / _JUDGE_MODEL.
 */
import { EVAL_CASES, getEvalCase } from './cases/catalog.js';
import { runBehaviouralJudge } from './liveTier.js';

const line = '─'.repeat(64);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'A2 behavioural tier is gated. Set ANTHROPIC_API_KEY (+ BRAND_COACH_MCP_HOST=1) then re-run `npm run evals:live`.',
  );
  process.exitCode = 1;
} else {
  const only = process.argv[2];
  const cases = only ? [getEvalCase(only)].filter(Boolean) : EVAL_CASES;
  if (only && cases.length === 0) {
    console.error(`Unknown case "${only}". Known: ${EVAL_CASES.map((c) => c.id).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(line);
    console.log('IDEA Brand Coach — A2 behavioural eval (live)');
    console.log(line);
    let total = 0;
    let n = 0;
    for (const c of cases) {
      try {
        const score = await runBehaviouralJudge(c!.id);
        total += score.composite;
        n++;
        console.log(`\n[${(score.composite * 100).toFixed(0)}%] ${c!.title}`);
        for (const m of score.metrics) {
          console.log(`   ${m.display.padStart(8)}  ${m.label}${m.detail ? ` — ${m.detail}` : ''}`);
        }
      } catch (e) {
        console.error(`\n  FAILED ${c!.id}: ${(e as Error).message}`);
      }
    }
    if (n > 0) console.log(`\nMean composite: ${((total / n) * 100).toFixed(0)}% over ${n} case(s)`);
    console.log(line);
  }
}
