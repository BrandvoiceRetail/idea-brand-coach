# Feature Factory — IDEA Brand Coach

Durable, file-based memory of the feature-delivery pipeline. Each feature gets a kebab-case folder;
each of the six buckets writes one canonical artifact. The orchestrator skills that write these come
from the shared guide (`skills/feature-factory/`, synced via `bpg-sync` or invoked through the
`mango-tools` MCP server).

Full contract: guide `07-agentic-coding/FEATURE_FACTORY_LAYOUT.md`.

## Layout

```
.feature-factory/
├── README.md                  ← this index (hand-maintained)
├── _template/                 ← copy to <feature-slug>/ to start a feature
│   ├── arch.md  func.md  errors.md  observability.md  review.md  runbook.md
├── _pr-prep/                  ← (reserved) pr-prep skill output, one folder per PR
└── _refactor/                 ← (reserved) refactor-pipeline reports, timestamped per run
```

## Per-feature artifacts (canonical filenames)

| File | Bucket | Orchestrator |
|------|--------|--------------|
| `arch.md` | Architecture | `arch-orchestrator` |
| `func.md` | Functionality | `func-orchestrator` |
| `errors.md` | Error handling | `errors-orchestrator` |
| `observability.md` | Observability | `obsv-orchestrator` |
| `review.md` | Review & refactor | `review-orchestrator` |
| `runbook.md` | Runbook & docs | `docs-orchestrator` |

Not every feature needs all six (tier-dependent) — a bug fix may produce only `func.md` + `review.md`.

## Features

_(none yet — copy `_template/` to `<feature-slug>/` to begin)_
