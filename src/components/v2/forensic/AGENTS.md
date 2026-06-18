# src/components/v2/forensic — AGENTS.md

Root + `src/components/` AGENTS.md apply; this adds only the forensic-builder specifics (§4.2).

## What this is

The SPA forensic-avatar builder: a stepper dialog that runs the S1→S4 forensic
build (vocabulary → job map → triggers → objections) against the **deployed edge
fns** (`avatar-vocabulary` / `-jobmap` / `-triggers` / `-objections`) — the SPA
NEVER calls `/mcp`. It mirrors the MCP `avatarPipeline` contracts.

| Piece | File |
|-------|------|
| Service (edge invoke + artifact chain + build-state) | `src/services/ForensicBuildService.ts` |
| Hook (stepper run state, avatar-scoped reads) | `src/hooks/useForensicAvatarBuild.ts` |
| Dialog (intake → readiness → run → review → approve) | `ForensicAvatarBuilder.tsx` |
| Read-only artifact render | `ForensicArtifactReview.tsx` |
| Domain types (mirror Phase-0 contracts) | `src/types/forensicBuild.ts` |

Opened from the `AvatarHeaderDropdown` kebab → `onForensicBuild` →
`useBrandCoachV2State.forensicBuildAvatarId` → mounted in `BrandCoachV2.tsx`.

## Contracts that must hold (parity with `src/mcp/service/avatarPipeline.ts`)

- Edge body is `{ reviews, prior }`; `reviews` is the verbatim corpus string.
- `prior` is keyed **BY STAGE ID** (`prior.s1`, `prior.s2`), NOT artifact kind —
  keying by kind makes the edge fns never find the prior and short-circuit to
  `needs_input` (the "Avatar sheet has only S1" symptom).
- Stage order: s1 → s2 → {s3, s4 in parallel}. S5/signature is D2/R-015 gated and
  intentionally NOT surfaced in the SPA.
- An edge `{ needs_input: [...] }` HTTP-200 body is a grounding gap (surface it),
  not a transient failure. Retry transient failures max 2 (exp backoff).
- Persist via the `save_artifact_atomic` RPC → a re-run **supersedes** the prior
  current artifact (the artifact chain). Build progress → `avatar_build_state`
  (RLS upsert, `draft`/`built`/`approved`).

## Bleed firewall

All hook reads (build-state + persisted artifacts) use `avatarScopedKey('artifacts', …)`
from `src/lib/queryKeys.ts` so the single switch-invalidation predicate nukes them
on an avatar switch. Any new avatar-scoped query key MUST use that namespace.

## Manual-edit override

Forensic re-runs are machine writes (`field_source != 'manual'`). The
`enforce_avatar_field_lock` DB trigger on `avatar_field_values` protects a user's
manual edits from being overwritten by a re-run. The builder writes its own
artifact rows and never clears a locked field.

## Testing

`src/services/__tests__/ForensicBuildService.test.ts` covers the load-bearing
contracts (edge `{reviews,prior}` body, prior-by-stage-id, needs_input surface,
in-body-error retry, build-state approve). Uses the global `vi.mock` supabase
client (`functions.invoke` + `rpc` + `from`).
