# Autonomous build-out — `/loop` + `/goal` for the Deploy & Ops plan

Two paste-ready commands that work together to build out `docs/DEPLOY_AND_OPS_PLAN.md`
(P1→P4) autonomously, **halting before any AWS cost**.

- **`/goal`** = the persistent contract (definition of done + guardrails + lanes). Its Stop
  hook keeps the agent from declaring done early.
- **`/loop`** = the self-paced engine that re-invokes "do the next safe step" each turn.
- **The HALT overrides both:** at any AWS-cost or Ask-First gate the agent **stops and asks**
  (does not reschedule the loop) until you respond. Reaching a HALT is a *valid* checkpoint,
  not a failure — so the goal is satisfiable without ever spending.

---

## 1) Paste this first — `/goal`

```
/goal Build out docs/DEPLOY_AND_OPS_PLAN.md (P1→P4) for ideabrandcoach.icodemybusiness.com.

DONE-WHEN: every AWS-cost-free task across P1–P4 is implemented, verified, and ticked in the plan; every AWS-billable step (P3 CloudWatch/CloudTrail and any new AWS resource) is fully authored as ready-to-apply code/IaC + a HALT note, but NOT applied. Reaching a HALT and asking me is a valid stopping point — not a failure.

TOOLING: source of truth = docs/DEPLOY_AND_OPS_PLAN.md + AGENTS.md. Deploy = build dist + rsync to /opt/ideabrandcoach on the existing mango Lightsail box (54.243.53.44) via ~/.ssh/lightsail-mango.pem (SSH port 22 is IP-firewalled — needs home WiFi; if blocked, HALT and tell me). PostHog = EU project 195536. Use the Supabase MCP for schema/edge-fn awareness. Restore Supabase if it's auto-paused before any DB/edge work.

GAP (current state): live site is the static SPA on the existing box; origin/main has this session's fixes (#5–#11); feature branches are unmerged; there is no admin-role model; PostHog is fully wired; the AWS `BrandWebsiteAccess` user CANNOT create CloudWatch dashboards / CloudTrail; the MCP gateway + feat/onboard-skeleton are being built by ANOTHER agent.

PLANNED WORK (in order):
- P1: reconcile branches to main in the LOCKED order (fix/diagnostic-interpretation-abuse-controls → feat/product-data-hookup → feat/alpha-instrumentation[push+commit its output-engine files to feat/output-engine first] → feat/feature-status-tracker → feature/intelligent-memory) via PRs; add the `regression` script (lint && typecheck && test && test:e2e) + a playwright.config + ~5 critical-flow specs; add the admin model (profiles.is_admin + tighten feature_flags RLS) and an admin-gated /admin/ops page linking to PostHog 195536; write a one-page tester guide.
- P2: support_tickets table + /admin/support-tickets page + "escalate feedback → ticket".
- P3 (AUTHOR ONLY — HALT before apply): Terraform for a least-privilege IdeaBrandCoachOpsRole, the CloudWatch dashboard JSON, CloudTrail setup, and metric-emit code.
- P4: versioned dist snapshots on the box (/opt/ideabrandcoach-releases/<ts>) + a rollback script; feature-flag instant-rollback; a GitHub Actions workflow_dispatch for deploy-next + run-regression; wire the /admin/ops control buttons (AWS-touching ones HALT).

LANES (ownership): you OWN docs/, src/ (app + admin), supabase/migrations & functions, scripts/, .github/workflows, infra/terraform (author only), and /opt/ideabrandcoach on the box. DO NOT TOUCH the onboarding worktree (.claude/worktrees/onboarding), /opt/mango, or the MCP gateway — the OTHER agent owns those; do not merge feat/onboard-skeleton or feat/brand-coach-mcp-host (parked/owned).

GUARDRAILS:
- HARD HALT — AWS COST: STOP and ask before ANYTHING that could add cost to the AWS account — any mutating `aws` CLI call, `terraform apply`, creating/enabling CloudWatch dashboards/alarms, CloudTrail trails, custom-metric emission, new Lightsail/EC2/ALB/S3 resources, or increased Bedrock/data-egress usage. AUTHORING IaC/code is fine; APPLYING it is the HALT. (Creating the IAM role also HALTs — it enables billable services; surface the est. $/mo.)
- ASK-FIRST (pause, not necessarily AWS): Supabase edge-function deploys; DB schema migrations; the production SPA deploy; and the high-conflict merges (feat/product-data-hookup, feat/alpha-instrumentation) — open the PR + run regression, then HALT for my review before merging to main.
- FLAG (don't HALT): if a step risks crossing the Supabase free→Pro tier, note it.
- Never commit secrets. Follow AGENTS.md. On any HALT: stop the loop, summarize what's staged + the exact approval needed (with est. cost), and wait.

DONE GATE: plan checklist ticked for all cost-free items; `npm run regression` green on merged main; /admin/ops live behind the admin gate with the PostHog link; support tickets working end-to-end; P3 AWS authored-not-applied with an "approve to apply (~$X/mo)" note; finish with a STATUS summary of what's live, what's staged, and every pending HALT/approval.
```

## 2) Then paste this — `/loop` (self-paced)

```
/loop Continue executing the IDEA Brand Coach deploy/ops plan per the active goal. Each turn: re-read docs/DEPLOY_AND_OPS_PLAN.md, pick the next incomplete AWS-cost-free task (respect the P1→P4 phase order and the locked branch merge order), implement it end-to-end, verify it (build/tests/regression as relevant), and tick its checkbox in the plan. Stay in your lanes — never touch the onboarding worktree, /opt/mango, or the MCP gateway. Before ANY action that could add AWS cost, or any Ask-First action (edge-fn deploy, DB migration, prod SPA deploy, the product-data/alpha merges), STOP and ask me — do not reschedule. When all cost-free work is done and the AWS-billable parts are authored-not-applied, post the STATUS summary and stop.
```

---

## Notes
- **Order matters:** run `/goal` first (sets the contract), then `/loop` (starts iterating against it).
- **Self-paced** (no interval) is intentional — steps are long and gated; the agent paces itself and stops at HALTs rather than firing on a clock.
- **What it will and won't do unattended:** it will reconcile branches (via PRs), build the admin gate + `/admin/ops` PostHog link, support tickets, the regression harness, versioned-rollback + CI plumbing, and *author* all the AWS IaC. It will **stop and ask** before merging the big branches, deploying edge functions, deploying the prod SPA, and — hard stop — before anything that bills AWS.
- **To stop early:** `/goal clear`.
```
