# AGENTS.md — `src/components/integrations/`

Area rules for third-party integration UI. Root + `src/components/AGENTS.md` apply;
this adds only what's specific here.

## Scope

The Figma integration's user-facing surface: connect via OAuth, import a Figma
file, and view the extracted design data that feeds the brand coach.

- `FigmaConnectCard.tsx` — orchestrator (status → connect/disconnect, import form).
- `FigmaImportList.tsx` — presentational import history (palette swatches, type, components).
- Hosted by the Settings hub `src/pages/SettingsPage.tsx` (Integrations tab; deep
  link `ROUTES.INTEGRATIONS` = `/settings/integrations`).
- OAuth callback page: `src/pages/FigmaCallback.tsx` (route `ROUTES.FIGMA_CALLBACK`).
- State/actions: `src/hooks/useFigmaIntegration.ts`.
- Backend boundary: `src/services/FigmaIntegrationService.ts` (always via
  `supabase.functions.invoke` — never a raw `fetch` and never a direct DB read of
  the token tables, which are service-role only).

Full design + deploy runbook: [`docs/FIGMA_INTEGRATION.md`](../../../docs/FIGMA_INTEGRATION.md).

## Boundaries

- All Figma reads/writes go through the `figma-*` edge functions; the SPA never
  reads `figma_connections`/`figma_oauth_state` (service-role only).
- Don't render or log tokens — `figma-status` never returns them by design.
- Keep components presentational; connection state lives in `useFigmaIntegration`.

## Testing

- Unit: `npx vitest run --pool=threads src/__tests__/figma-extract.test.ts
  src/__tests__/FigmaIntegrationService.test.ts`
  (the default forks pool can fail to spawn in some sandboxes — use `--pool=threads`).
- The design extractor is pure (`supabase/functions/_shared/figma-extract.ts`) so
  most logic is testable without network or Deno.
- Manual QA needs the shared account (`docs/TEST_ACCOUNT.md`) and live Figma
  secrets/deploy — see the runbook's Testing section.
