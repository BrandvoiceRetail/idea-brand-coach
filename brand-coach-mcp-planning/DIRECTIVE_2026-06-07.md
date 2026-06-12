# Dev Agent Directive — Output-engine review verdict: iterate Avatar 2.0, then harden, then commit
(Verbatim from Matthew, 2026-06-07. This is the controlling instruction for the current fix pass.)

## Verdict: iterate-prompts -> harden -> commit. NOT accept-as-is.

What's excellent (verified): Diagnostic beats gold (tagged real evidence); Avatar S1 vocabulary is real ingested-review language; fabrication gate held (no invented 30-DAY GUARANTEE); Brand Canvas + Workbook B at full depth with deterministic numbers.

## The one true output blocker: Avatar 2.0 ships 2 of 5 stages
Generated Avatar sheet contains ONLY Stage 1 (Vocabulary Forensics) and Stage 5 (Signature). Stages 2 (Job Map: functional/emotional/identity/villain), 3 (Decision Triggers: moment/feeling/search/volume), 4 (Hesitations & Objections: hesitation/verbatim/resolution) are MISSING entirely. Gold has all five (41 rows); generated has two (19 rows). Stages 2-4 are where the strategic insight lives. Almost certainly a generator/assembler coverage gap, not architecture. Fix so all five stages emit, each grounded to the Stage-1 standard (S2-S4 cells trace to real evidence where evidence exists; carry grounding flag where inference).

## Sequence (strict)
1. **Fix R1 FIRST** (artifactStore insert-then-supersede silently blocks same-avatar regeneration; export re-renders STALE chain). The Avatar fix REQUIRES same-avatar regeneration — without R1 we debug blind. Fix R1, confirm regeneration produces fresh output, THEN iterate Avatar.
2. **Iterate Avatar 2.0 generator** -> all five stages, grounded. Re-run the same fresh-avatar rehearsal.
3. **Re-export and re-review (MATTHEW'S GATE).** Send regenerated Workbook A. Checks: all five stages present, S2-S4 grounded to S1 standard, fabrication gate still holds. DO NOT COMMIT before this passes.
4. Then harden R2-R3 (tool-level retry on canvas/brief; mkdir out_dir).
5. Then commit per gap report §5.2 (one PR).

## Minor (fold into Avatar pass, non-blocking)
Brand Canvas duplicated "Story spine" (rows 16/17 then repeated 18/19) — assembler glitch, dedupe.

## R4 parallel — NOT a code fix: diagnose the 6/06 credit burn
$50/mo email NOTIFICATION now set (total-threshold notice only — would not catch a fast burn). Find what mechanism actually drained credits on 6/06. Suspects: unbounded loop, retry storm without backoff, anon-callable function hammered. Report cause + whether still live in code. Note if Anthropic console offers a hard spend cap (cutoff, not notification).

## NOT asked for
No new capabilities/tools/phases. No commit before re-review. Don't touch at-bar parts (Diagnostic, Canvas content, Workbook B) except the Canvas dedupe.
