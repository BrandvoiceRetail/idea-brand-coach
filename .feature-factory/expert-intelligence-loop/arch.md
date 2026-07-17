# arch.md — Expert Intelligence Loop

Phase 1 (arch) of the `/goal` in `_bmad-output/goal-prompt-expert-intelligence-loop.md`.
Status: seam locked; **build blocked on a host disk-full incident** (see bottom). Build MUST happen in a
worktree off `main` tip `0e2f88a` (the primary checkout `feat/v4-diagnose-glass` is 109 behind and lacks
`coach_instructions` / harvest / `profiles.is_admin`).

## The 5-stage seam

```
capture ──▶ expert_corrections ──▶ distill (nightly) ──▶ apply (hybrid) ──▶ review + digest (weekly)
```

1. **capture (BOTH surfaces).** Two feeders into one `expert_corrections` table:
   - Feeder 1 — MCP tool `capture_correction` (expert-gated on `profiles.is_admin`, `source='mcp'`), which
     the coach auto-calls when the expert overrules/corrects it. Driven by a `global.expert_capture`
     coach_instruction + one line in `SERVER_INSTRUCTIONS`. Must also be exposed to the in-app tool-loop
     (flag `coach-mcp-tool-loop`) so in-app redirects are captured live.
   - Feeder 2 — service-role harvest sweep over `chat_messages` for expert users (`source='chat'`), the
     "in-app also" coverage.
2. **distill (nightly).** Deterministic `scripts/harvest-expert.*` clusters/dedupes `status='new'` rows;
   a nightly session drafts one `coach_instructions` row per instruction-level cluster and opens a PR per
   structural cluster. **Never auto-publishes.**
3. **apply (HYBRID — Matthew's Q2 answer).** Instruction-level → `coach_instructions` draft (Studio review,
   publish = no redeploy). Structural → PR editing `_manifest.json` / `SERVER_INSTRUCTIONS` (`config.ts`) /
   edge-fn `prompt.ts` / guardrail regexes.
4. **review + digest (weekly).** Studio shows each draft's source corrections (provenance); a weekly
   APPLIED-changes digest goes to Trevor via `src/mcp/slack/feedbackNotifier.ts`. Nightly=draft;
   weekly=human publish/merge + digest.
5. **schedule.** Nightly distill = a Claude Code scheduled cloud agent; weekly digest on its own cadence.

## Preconditions — verified in the worktree on `main` tip (0e2f88a)

| Precondition | Finding | Consequence |
|---|---|---|
| `coach_instructions` read wired into the MCP coach | YES — `server.ts:120-125` calls `composeCoachPreamble` + `tier1GroundingPreamble`, gated on `process.env.COACH_INSTRUCTIONS_ENABLED === 'true'` | "publish draft → live connector coach, no redeploy" holds **iff** the flag is `'true'` in the box's Docker env (verify at deploy — not readable from here; default is OFF). |
| `coach_instructions` read wired into the **in-app** consultant | **NO** — `coachInstructionsHelper.ts` is referenced only by `supabase/functions/avatar-vocabulary/index.example.ts` (an *example*, not a live fn). `idea-framework-consultant-claude` does not read it. | **In-scope gap:** to make the in-app coach reflect published drafts, wire the helper into `idea-framework-consultant-claude` (edge-fn deploy = ASK-FIRST). Otherwise DONE-WHEN "changes the live coach" is connector-only. |
| `profiles.is_admin` seeded for Trevor | YES — migration `20260707211007_coach_instructions.sql` adds the column and seeds `trevor@brandvoice.co.uk` + `trevor.bradford@brandvoice.co.uk` + Matthew's two. | `capture_correction` expert-gate and `expert_corrections` admin-read RLS both key off `profiles.is_admin`. |
| Harvest engine | Half-built at `src/mcp/evals/harvest/` (classify→screen→candidates); **no Supabase adapter**, runs on JSON samples; shape `role:'coach'`/`text` ≠ DB `role:'assistant'`/`content`. | Feeder 2 adds a service-role reader + the `assistant→coach` / `content→text` map. Existing read tools (`list/getCoachConversation`) are RLS-locked to the caller, so a **new service-role read path** is required to read a nominated expert's rows. |
| Connector transcripts | NOT persisted anywhere (gateway logs redacted tool metadata only — content-discipline MF-5). | Why Feeder 1 (capture tool) exists — pure passive harvest can't see the connector where Trevor actually works. |

## Prod verification (2026-07-17, read-only via Supabase MCP)

Turned the "verify in prod" preconditions into confirmed facts:

- **Admin gate LIVE:** `profiles.is_admin = true` for `trevor@brandvoice.co.uk` and
  `matthew@icodemybusiness.com` **only**. ⚠️ `trevor.bradford@brandvoice.co.uk` and
  `matthew@arisegroup.ai` are in the `admin.ts` UI allowlist but are **NOT** seeded `is_admin` in prod
  (likely no account, or unseeded). **Build implication:** the `capture_correction` expert-gate keys off
  `profiles.is_admin`, so it only fires for the accounts above. If Trevor uses the brand-alias account,
  either seed `is_admin` for it or the capture silently no-ops. Confirm Trevor's actual sign-in email.
- **`coach_instructions` is LIVE + populated in prod** — 3 published rows: `global.tier_a_terminology`,
  `global.forbidden_ip_vocabulary`, `generate_listing_image_brief.artifact_scope`. Confirms the apply
  substrate works, the `global.*` namespace convention, and that **no `global.expert_capture` exists yet**
  (the seed slots in with no conflict). Populated rows strongly imply `COACH_INSTRUCTIONS_ENABLED` is on in
  the prod MCP env (still verify the Docker env at deploy — server.ts is the only reader).
- **Harvest-adapter schema confirmed:** `chat_messages(id uuid, user_id uuid, chatbot_type text, role text,
  content text, created_at tstz, session_id uuid, metadata jsonb)`; `chat_sessions` also has `avatar_id`,
  `brand_id`, `context_avatar_ids`. ⚠️ `session_id`/`chat_sessions.id` are **uuid** (not text) — staged
  migration comment corrected; `expert_corrections.session_id` stays `text` to hold both a uuid-string and
  an MCP token.
- **Migration timestamp clean:** latest prod migration is `20260712075050`; staged `20260716000000` sorts
  after it, and `expert_corrections` does not exist in prod. (Prod's coach_instructions migration is
  `20260708052208_coach_instructions_substrate_is_admin` — table confirmed present regardless of the
  git-branch naming.)

## Key decisions

- **Dual-feeder capture** into one `expert_corrections` table (Matthew's note: "must apply to in-app chats also").
- **Hybrid apply** (drafts + PRs), routed per cluster by the nightly pass.
- **In-app coach_instructions wiring is IN SCOPE** (the gap above) — else the goal's "live coach reflects it"
  is only true for the connector.
- **New service-role read path** for expert `chat_messages` (the RLS tools can't do it).
- `expert_corrections`: admin-read RLS + service-role write; register in `_shared/gdprData.ts` + redeploy
  gdpr fns. Verbatim corrections never enter general telemetry (MF-5).

## Human-gated / ASK-FIRST (cannot be done autonomously)

Migration apply, edge-fn deploy (in-app wiring + gdpr redeploy), MCP redeploy, Studio publish, and the
Trevor digest send. Build + unit-test to green autonomously; stop at these gates for authorization.

## BLOCKER (environmental, 2026-07-16)

Host disk-full incident during setup: `ENOSPC` wedged Bash entirely; recovered to ~4.4 GiB then actively
dropping (2.9 GiB) due to other concurrent `claude` sessions + a hung Docker daemon (22 GiB footprint,
`docker system df` times out). Build phases (worktree recreate + `npm install` + vitest/esbuild) are
deferred until the disk is stabilized (Docker prune needs the daemon un-wedged, which needs host ≥5 GiB
free). No implementation started beyond this doc.

## Final design + team-review outcomes (2026-07-17, built)

Deviations from the pre-build sketch above, and how the security-auditor + technical-architect
findings were resolved (DONE GATE: "fix findings"):

**Write path.** Capture writes via the caller's JWT under an **admin-insert RLS policy**, NOT
service-role — the prod gateway has no service-role key by design (verified). The offline harvest
(Feeder 2) keeps service-role (runs off-gateway).

**Expert gate.** A dedicated **email allowlist** (`experts.ts`, default Trevor, `EXPERT_EMAILS`-overridable),
narrower than `is_admin`, gates both feeders. A test asserts an admin (Matthew) is rejected.

**Security CRITICAL (fixed in-migration).** The expert gate rests on `profiles.is_admin` + `profiles.email`,
which the pre-existing self-update policy left client-writable → any user could self-elevate and forge/read
corrections. Added `trg_profiles_block_privilege_self_edit` (BEFORE UPDATE on profiles) blocking
authenticated/anon from changing those two columns. Repo-wide hardening beyond this feature.

**Loop closure HIGH (fixed in-migration).** Nothing owned `drafted→applied`, so the digest would be
permanently empty. Added `trg_mark_expert_corrections_applied` (SECURITY DEFINER, AFTER UPDATE OF status
on coach_instructions) that marks source corrections `applied` on publish — closes the loop via the DB,
no frontend needed.

**Schema honesty.** Dropped the dead `clustered` status + `cluster_id` column/index (clustering is
in-memory in `expertDistill`).

### Accepted MVP scope (owners named — not silent gaps)
- **Distill `new→drafted` runner = the nightly Claude Code scheduled agent** (Layer 2), using
  `clusterCorrections` + `writeDraftInstruction`. NOT a pure script (LLM body composition). When built,
  its read of `new` corrections needs an `INTERNAL_PROMPT_*` const from `contextBudgets.ts`.
- **Studio provenance PANEL deferred to post-migration** (SPA is typed against generated `types.ts`;
  `expert_corrections` isn't in it until the migration is applied + types regenerated). The DB publish
  trigger already handles `drafted→applied`, so the digest works without the panel.
- avatar_id not ownership-checked (data-quality, never used for authz). No rate limiting (internal,
  low-volume). RLS gates on `is_admin` (now trustworthy post-guard); the allowlist narrows at the app
  layer; a real admin could direct-insert their own rows (trusted). Digest reuses the feedback Slack
  chrome (cosmetic). Draft accumulation (multiple open drafts per instruction_id) — product/UX debt to
  watch once the distill runner exists.
