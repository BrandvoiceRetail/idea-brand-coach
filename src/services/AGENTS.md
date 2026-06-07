# AGENTS.md — `src/services/`

Area rules for the service layer. Root `AGENTS.md` applies; this adds only what's specific here.

## Pattern: interface-first, orchestrator + specialized services

- Every service implements a contract in `interfaces/` (e.g. `IChatService`, `IAuthService`). Define
  the interface first; depend on the interface, not the concrete class.
- Compose, don't accumulate. A domain orchestrator delegates to focused services:
  `SupabaseChatService` (orchestrator) coordinates `chat/ChatMessageService`, `chat/ChatSessionService`,
  `chat/ChatTitleService`, `chat/ChatEdgeFunctionService`, `chat/ChatStreamParser` via constructor injection.
- Wire dependencies through `ServiceProvider.tsx` — keep construction in the composition root, not inside components.

## When to extract (smell thresholds)

- A service over **~300 lines** or with **>10 public methods** is a red flag — split it.
- Method names with multiple concerns (`saveAndSyncAndNotify`) signal a missing seam.
- Duplicated logic across services → extract a shared service (see the `field/` sync services as precedent).

Use the guide skills `refactor-detector` → `refactor-planner` → `refactor-executor` for non-trivial splits.

## Conventions

- Async methods return a typed `Result`-style object (`{ data, error }` or the service's `*Result<T>`),
  never throw across the service boundary; surface user-facing errors via `sonner` in the caller.
- All Supabase access goes through `src/integrations/supabase/client.ts` with generated types.
- New service ⇒ new interface in `interfaces/` ⇒ register in `ServiceProvider` ⇒ tests in `__tests__/`.
- Database schema changes go through migrations / the `database-migrator` guide agent — never DDL from a service.
