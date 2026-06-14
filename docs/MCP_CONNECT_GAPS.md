# MCP Connect — what's missing to make the onboarding instructions real

The onboarding page (`public/onboard.html`, live at
**ideabrandcoach.icodemybusiness.com/onboard.html**) now tells users to add the
**IDEA Brand Coach** to Claude as a custom connector at:

```
https://ideabrandcoach.icodemybusiness.com/mcp
```

We reuse the **existing** static-site domain (no new subdomain/DNS) — the gateway is
exposed via a **Caddy path route** on the current vhost: `/mcp*` reverse-proxies to the
gateway; every other path stays the static `file_server`.

Those are the *final* instructions — the intended end state. **Today they will not
work yet:** the gateway isn't hosted and the two paths are stubs. This is the build list
to make them true. (The copy-paste prompt on the page is the working path in the meantime.)

---

## 1. Host the MCP gateway behind the existing domain — hard blocker
- **Today:** `brand-coach-mcp` (`src/mcp/`) runs **local-only** — streamable-HTTP
  `POST /mcp`, `GET /healthz`, port `8787` (`MCP_PORT`), **no TLS**. Started with
  `npm run mcp:dev` / `npm run mcp:start`. **The gateway code (host + http transport +
  the `onboard` front door + the `mcp:*` scripts) lives on `feat/alpha-instrumentation`,
  NOT on `main`** — main has only the static site. The `onboard` tool is also still
  uncommitted in the onboarding worktree; reconcile a single source before deploying.
- **Why it matters:** Claude Desktop / claude.ai custom connectors are **HTTPS-only** —
  `localhost` won't work for end users.
- **Build (chosen approach — same domain, no new DNS):** run the gateway on the mango
  Lightsail box (`54.243.53.44`) as a long-lived process (Docker like mango, or
  node+systemd) on `localhost:8787`, then add a **path route** to the EXISTING
  `ideabrandcoach.icodemybusiness.com` Caddy vhost:
  ```
  ideabrandcoach.icodemybusiness.com {
      encode gzip
      handle /mcp* { reverse_proxy localhost:8787 }   # MCP gateway
      handle      { root * /srv/ideabrandcoach
                    try_files {path} /index.html
                    file_server }                       # static site
  }
  ```
  The domain's TLS cert already exists; no Namecheap change. (Ensure Caddy doesn't buffer
  the streamable-HTTP response.)
- **Env to set server-side:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (JWT verification),
  optional `IVOS_MCP_URL` / token. Decide single-tenant vs multi-tenant.
- Power-user fallback to document if helpful: the `mcp-remote` stdio bridge (some Desktop
  setups are stdio-only).

## 2. Build the two onboarding paths (currently stubs)
The `onboard` prompt + `onboard_choose` tool render the branded fork, but both paths are
**walking-skeleton stubs** (`src/mcp/service/onboard.ts`) — they only describe what's coming.
- **Simple Diagnostic:** conversational gather across the four pillars (Insight,
  Distinctive, Empathetic, Authentic) → reflect the **Trust Gap**. The story → Trust-Gap
  mapping is not built.
- **Full Contextual Upload:** ingest listings / reviews / brand materials → grounded
  coaching. No ingestion, parsing, or evidence store is wired to the gateway.

## 3. Wire the coaching brain (skill library + generators)
The `idea` skill library (158 book-traceable skills) and the generators that consume it
are **not connected** to the gateway. The diagnostic/upload engines need them to produce
workbook-grade output.

## 4. Identity, persistence, "continue with context"
The front door is anonymous (correct). Saving a profile / resuming with full context needs
the Supabase-auth path (already scaffolded for the IV-OS ledger writes) extended to
coaching state.

## 5. Public-endpoint hardening
- Rate limiting / abuse controls / cost caps for an anonymous, LLM-backed public MCP.
- Structured logging + alerting (reuse the existing `safeLog` / redact seam).

## 6. Known client limitation
The MCP Apps (`io.modelcontextprotocol/ui`) interactive HTML panel does **not** render in
Claude Desktop yet (upstream bug) — ship the **markdown** surface as the front door.
See memory `project_mcp_apps_render`.

---

### TL;DR
Until **#1** ships, the URL on the page will not resolve or connect. Order of work:
**1 (host) → 2 (paths) → 3 (brain) → 4 (persistence) → 5 (hardening)**.
