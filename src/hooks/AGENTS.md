# src/hooks — AGENTS.md

Root `AGENTS.md` applies; this adds only what's specific here.

Reusable React hooks. `v2/` holds Brand Coach V2 hooks (orchestration, extraction queue, signature reveal, etc.); tests in `__tests__/` (and `v2/__tests__/`).

## Conventions

- `use` prefix; camelCase filenames (e.g. `useTrustGapInterpretation.ts`). `.tsx` only when the hook returns JSX (`use-mobile.tsx`).
- Explicit return types — export an interface for the hook's return shape (see `useTrustGapInterpretation.ts`).
- Tests co-located in `__tests__/` (e.g. `useChat.test.tsx`).

## Persisted-field / sync family

A field-persistence hook family exists — verify which sync backend you need before adding another:

| Hook | Backend | Use |
|------|---------|-----|
| `usePersistedField` | `KnowledgeRepository` + `SupabaseSyncService` | local-first KB-category string field |
| `usePersistedArrayField` / `usePersistedForm` / `usePersistedSessionField` | (variants of above) | arrays / forms / session-scoped |
| `useFieldSync` / `useSimpleFieldSync` | `FieldSyncService` (`src/lib/sync/`) | generic local-first field sync |

Reuse one of these for new persisted fields rather than hand-rolling IndexedDB/Supabase sync.

## Rules

- Extract a hook when a component holds multiple unrelated `useEffect`s or mixes state + sync/business logic.
- Keep network/business logic in `services/` or `lib/`; hooks wire state to those.
