# mcpjam suite (optional external runner)

[mcpjam](https://github.com/MCPJam/inspector) is an interactive inspector + evals platform for MCP servers. It's **optional** — our native suite (`npm run evals`) and behavioural tier (`npm run evals:live`) cover the same cases. mcpjam is useful when you want to drive the **deployed** coach MCP interactively or with mcpjam's multi-model runner.

> **Two suites are generated here.** `mcpjam-suite.generated.json` (this file's runbook) is the
> BEHAVIOURAL suite from the curated cases. `mcpjam-image-suite.generated.json` is the
> **image output-quality E2E suite** — it needs BOTH connectors attached (IDEA Brand Coach +
> Higgsfield) and pairs with a vision-judge scorer; see [`../image/README.md`](../image/README.md).

## Generate the suite

```bash
npm run evals:mcpjam      # → mcpjam-suite.generated.json (from the curated cases)
# overrides: MCPJAM_PROVIDER=anthropic MCPJAM_MODEL=claude-sonnet-4-6
```

Each case becomes an mcpjam test: `{ title, query, runs, model, provider, expectedToolCalls[], advancedConfig.system }`. The `query` is the case's opening user turn; `advancedConfig.system` is the supplied context + seeded memory; `expectedToolCalls` are the registered tools the case should invoke. mcpjam passes a test when every `expectedToolCall` appears in the actual tool calls (it also reports `missing` / `unexpected`).

## Run against the coach MCP

1. Point mcpjam at the brand-coach MCP server (the deployed streamable-HTTP endpoint, or a local `npm run mcp:dev`).
2. Load `mcpjam-suite.generated.json` into mcpjam's Evals (UI import or its API) and run.

## Caveats

- **Safety/refusal cases** (e.g. `safety-injection-fabrication`) carry **no** `expectedToolCalls`, so mcpjam's tool-call matcher passes them trivially. Refusal + no-fabrication is judged by our **behavioural tier** (`npm run evals:live`), not by tool-call matching — use that for safety cases.
- mcpjam exercises the **deployed** tools for real (needs the server reachable + provider keys configured in mcpjam). Our `npm run evals:live` runs the same cases in-process with synthetic tool results (selection-only) — cheaper, no DB/auth.

Sources: [mcpjam evals architecture](https://docs.mcpjam.com/contributing/evals-architecture) · [mcpjam inspector](https://github.com/MCPJam/inspector) · [evaluating MCP servers](https://www.mcpjam.com/blog/mcp-evals)
