# AGENTS.md — `src/components/`

Area rules for React components. Root `AGENTS.md` applies; this adds only what's specific here.

## Child Areas

| Area | Focus |
|------|-------|
| `diagnostic/` | Trust Gap scorecard + journey bridge (F-059) — local AGENTS.md |
| `v2/signature/` | Signature reveal engine, end-to-end testing — local AGENTS.md |

## Pattern: composition over large components

Split a component that mixes UI + state + orchestration into focused pieces. Precedent — `AIAssistant`:
- `AIButton` — presentational trigger (props: `onGenerate`, `isLoading`).
- `AISuggestionHandler` — owns generation state + edge-function call; exposes an imperative handle via
  `forwardRef` + `useImperativeHandle`.
- `AISuggestionPreview` — renders the pending suggestion with accept/reject.
- `AIAssistant` — thin orchestrator that wires them together.

## When to extract (smell thresholds)

- A component over **~150 lines**, with **>3 levels of nested JSX**, **>10 props**, or business logic
  mixed into render → decompose.
- Multiple `useEffect`s with unrelated concerns → split or move logic into a custom hook in `src/hooks/`.

## Conventions

- Reuse shadcn-ui primitives from `ui/` before building new UI. Check existing components/hooks first.
- Functional components only; explicit prop interface + explicit return type (`: JSX.Element`).
- Group by domain: `ai/`, `brand/`, `chat/`, `research/`, `avatar/`, `document/`, `export/`, `v2/`, `templates/`.
- Memoize (`useMemo`/`useCallback`) only when a real re-render cost exists — not by default.
- Accessibility: label interactive elements; ensure keyboard paths work. Wrap risky subtrees in `ErrorBoundary`.
- Prefer Context (`BrandContext`) over prop drilling; don't add new global state without checking it first.
