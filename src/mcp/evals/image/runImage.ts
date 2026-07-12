/**
 * `npm run evals:image` — score the IMAGE deliverables an E2E run produced.
 *
 * Input: a produced-images artifacts JSON (default: src/mcp/evals/image/artifacts.json, or
 * pass a path as argv[2], or set IMAGE_ARTIFACTS). Shape: { "<caseId>": { "url": "https://…" } }
 * — the image URLs the Higgsfield generate_image calls returned in the MCPJam / connector run.
 *
 * Output: a scorecard (stdout) + a JSON report next to the artifacts. Gated on
 * ANTHROPIC_API_KEY (the vision judge). Exit code is non-zero if any produced image fails,
 * so CI can gate on deliverable quality.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultVisionJudge, type VisionJudge } from './visionJudge.js';
import { scoreSuite, formatScorecard, type ProducedImages } from './scorecard.js';

function loadArtifacts(): { path: string; images: ProducedImages } {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(process.argv[2] || process.env.IMAGE_ARTIFACTS || resolve(here, 'artifacts.json'));
  if (!existsSync(path)) {
    throw new Error(
      `No artifacts file at ${path}. Produce one from an MCPJam/connector run (caseId → {url}), ` +
        'or pass a path: `npm run evals:image -- path/to/artifacts.json`.',
    );
  }
  return { path, images: JSON.parse(readFileSync(path, 'utf8')) as ProducedImages };
}

async function main(): Promise<void> {
  let judge: VisionJudge;
  try {
    judge = defaultVisionJudge();
  } catch (e) {
    console.error(`[evals:image] gated — ${(e as Error).message}`);
    process.exitCode = 2;
    return;
  }

  const { path, images } = loadArtifacts();
  const sc = await scoreSuite(images, judge);
  console.log(formatScorecard(sc));

  const reportPath = path.replace(/\.json$/, '') + '.scorecard.json';
  writeFileSync(reportPath, `${JSON.stringify(sc, null, 2)}\n`, 'utf8');
  console.log(`\nReport: ${reportPath}`);

  if (sc.failed > 0 || sc.missing > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exitCode = 1;
});
