# Subagent identity

**The canonical identifier of a unit of hands-off work is its task directory path:**
`.agent-build/objectives/<objective>/<task>/`. It's unique, already on disk, and already
appears in every HALT file path and routing.md entry. When you need to refer to "which
run did this," use that path.

## `subagent_id` is an optional human-facing label

For Slack messages and logs it's convenient to have a short tag. Phase 2 may generate a
synthetic one at spawn time:

```
SA-<YYYYMMDD>-<HHMMSS>-<4hex>      e.g. SA-20260525-104213-a3f7
```

That's all it is — a **label**, not a runtime handle. In v1 it is **not** a real Claude Code
session ID, **not** queryable ("what is SA-… doing now?"), **not** interruptible by ID, and
**not** authoritative. The task directory is the source of truth; the label is a convenience.

## Consumer contract (one rule)

Treat `subagent_id` as an **opaque string**: display it, store it, exact-match on it — but
never parse it, regex it, or assume its format. If Claude Code later exposes a real,
queryable subagent identifier, drop it into this same field; because nothing parses the
format, that swap is invisible to every consumer. No migration plan needed beyond "change
the generation point in `build.md` Phase 2."

> Why this file is short: an earlier draft specified a 150-line opaque-ID contract plus a
> v2 upgrade plan for a runtime registry that doesn't exist. Per the architecture review,
> that was ceremony for a no-op label — the folder path was already the real identity.
