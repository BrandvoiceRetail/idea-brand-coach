# Journey Bridge — Failure Modes (errors bucket)

Routing/wiring feature — the failure surface is bad/missing params and the
guest↔auth round-trip. No network calls are added by the bridge itself.

| # | Failure mode | Where | Handling |
|---|--------------|-------|----------|
| E1 | `?gap=` missing on the bridge | JourneyBridge | `parseGapParam` returns null → render a generic "let's build your Signature" framing and route to `/v2/coach` with no gap. No crash, no dead end. |
| E2 | `?gap=` is an unknown/garbage value | JourneyBridge / coach | `parseGapParam` validates against `TRUST_GAP_DIMENSIONS`; unknown → treated as null (E1 path). Prevents reflecting arbitrary input into navigation/UI. |
| E3 | Guest reaches the bridge | JourneyBridge | `useAuth().user` is null → CTA points to `/auth?redirect=<encoded coach url>` (intentional sign-up gate). |
| E4 | Guest lands on `/v2/coach?gap=X` directly (bookmark, refresh, skips bridge) | useBrandCoachV2State:382 | Redirect preserves destination: `/auth?redirect=<encoded pathname+search>` → returns to coach with gap after auth. No context loss, no dead end. |
| E5 | `redirect` param round-trip mangles the nested `?gap=` | buildAuthGateUrl + Auth.tsx | The coach URL is `encodeURIComponent`-ed when embedded as the `redirect` value; Auth reads it via `searchParams.get('redirect')` (auto-decoded) and `navigate()`s the full path. Unit-tested round-trip. |
| E6 | Coach opens with no `?gap=` (existing entry, e.g. nav/menu) | BrandCoachV2 | Banner + opener render only when a valid gap is present. Absent → coach renders exactly as today. **No regression to existing V2 chat.** |
| E7 | Authed-but-unconfirmed new signup returns user w/o session | live project | Known platform behaviour (TEST_ACCOUNT.md): confirm via SQL for QA. Not introduced here; flagged for QA. |
| E8 | Scorecard interpretation edge fn down at results | DiagnosticResults (existing) | Pre-existing graceful "unavailable" + retry; the CTA/bridge still work since gap is computed client-side. Unchanged. |

## Non-goals (explicitly not handled this sprint)
- Guest-ephemeral coach session/persistence (RF-04, Sprint +2).
- Reviews-paste / Signature internals (owned by other agent; not modified).
