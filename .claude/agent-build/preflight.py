#!/usr/bin/env python3
"""
preflight.py — Hands-off harness pre-flight auto-checker (stdlib only).

Automates the environment-verifiable subset of the 25 pre-flight checks from
.claude/agent-build/handsoff-mode.md § Pre-Flight. Prints a PASS / FAIL / MANUAL
report with remediation hints. Exits non-zero if any automatable check FAILs.

Usage:
    python3 .claude/agent-build/preflight.py \\
        --hard-stop 2026-05-24T02:00:00Z \\
        --cost-cap 50

    Options:
        --hard-stop   ISO-8601 timestamp (UTC). Required for PASS.
        --cost-cap    Max dollar spend for this run (numeric). Required for PASS.
        --repo-root   Path to repo root (default: cwd).
        --help        Show this message and exit.
"""

import argparse
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Monthly Claude budget; Gate 8 (cost cap) is a fraction of this. Single source
# of truth — keep in sync with handsoff-mode.md § Hard Gates (Gate 8).
MONTHLY_BUDGET_USD = 200


# ---------------------------------------------------------------------------
# Result accumulator
# ---------------------------------------------------------------------------

RESULTS: list[dict] = []


def record(check_id: str, phase: str, description: str, status: str, detail: str = "", remediation: str = "") -> None:
    """Append a check result."""
    RESULTS.append({
        "id": check_id,
        "phase": phase,
        "description": description,
        "status": status,  # PASS | FAIL | MANUAL
        "detail": detail,
        "remediation": remediation,
    })


def run_git(args: list[str], cwd: Path) -> tuple[int, str]:
    """Run a git command, return (returncode, stdout+stderr)."""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=str(cwd),
        )
        return result.returncode, (result.stdout + result.stderr).strip()
    except FileNotFoundError:
        return 1, "git not found in PATH"


def section_body(content: str, heading_contains: str) -> str:
    """Return the text of the first markdown section whose heading line contains
    `heading_contains`, from that heading up to (not including) the next `## `
    heading. Returns '' if no matching heading. Used to scope checks to one
    section instead of scanning a whole PLAN file (avoids counting numbered
    prose in Rollback/Verification as sub-steps)."""
    lines = content.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.lstrip().startswith("#") and heading_contains in line:
            start = i
            break
    if start is None:
        return ""
    body = [lines[start]]
    for line in lines[start + 1:]:
        if line.lstrip().startswith("## "):
            break
        body.append(line)
    return "\n".join(body)


# ---------------------------------------------------------------------------
# Phase 1 — Environment
# ---------------------------------------------------------------------------

def check_phase1(repo_root: Path) -> None:
    phase = "Phase 1 — Environment"

    # Check 1: Harness Mode declared. CLAUDE.md is often a thin "@AGENTS.md" import,
    # so scan BOTH files' content (the '## Harness Mode' pointer lives in AGENTS.md).
    docs = [p for p in (repo_root / "CLAUDE.md", repo_root / "AGENTS.md") if p.exists()]
    if not docs:
        record("1.1", phase, "CLAUDE.md or AGENTS.md present", "FAIL",
               "Neither CLAUDE.md nor AGENTS.md found in repo root.",
               "Add the '## Harness Mode' pointer to AGENTS.md (see .claude/agent-build/README.md step 4).")
    else:
        combined = "\n".join(p.read_text(errors="replace") for p in docs)
        names = ", ".join(p.name for p in docs)
        # Correct install = the '## Harness Mode' pointer; the full gate appendix
        # lives in handsoff-mode.md, deliberately NOT pasted into AGENTS.md (kept lean per ADR-002).
        if "## Harness Mode" in combined or "Hands-Off Mode Appendix" in combined:
            record("1.1", phase, "Harness Mode declared in CLAUDE.md/AGENTS.md", "PASS",
                   f"Found harness-mode pointer in {names}.")
        else:
            record("1.1", phase, "Harness Mode pointer in CLAUDE.md/AGENTS.md", "FAIL",
                   f"{names} present but no '## Harness Mode' section found.",
                   "Add the '## Harness Mode' pointer (see .claude/agent-build/README.md step 4).")

    # Check 2: agent-build harness installed
    harness_dir = Path(__file__).parent
    if harness_dir.exists() and (harness_dir / "handsoff-mode.md").exists():
        record("1.2", phase, "agent-build harness installed", "PASS",
               f"Harness directory: {harness_dir}")
    else:
        record("1.2", phase, "agent-build harness installed", "FAIL",
               "handsoff-mode.md not found in agent-build directory.",
               "Ensure .claude/agent-build/handsoff-mode.md exists.")

    # Check 3: Repo at clean known commit
    rc, status_output = run_git(["status", "--porcelain"], repo_root)
    if rc != 0:
        record("1.3", phase, "Repo git status readable", "FAIL",
               f"git status failed: {status_output}",
               "Ensure you are inside a git repository.")
    elif status_output == "":
        record("1.3", phase, "Working tree clean (git status --porcelain)", "PASS",
               "No uncommitted changes detected.")
    else:
        dirty_lines = status_output.splitlines()
        # A hands-off run needs a clean baseline to attribute changes — any
        # uncommitted file fails this check.
        record("1.3", phase, "Working tree clean (git status --porcelain)", "FAIL",
               f"{len(dirty_lines)} dirty file(s):\n    " + "\n    ".join(dirty_lines[:10]),
               "Commit, stash, or revert to a clean state before starting a hands-off run.")

    # Check 4: On a non-main/non-staging/non-master branch
    rc, branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"], repo_root)
    if rc != 0:
        record("1.4", phase, "Working branch is a feature branch", "FAIL",
               f"Could not determine branch: {branch}",
               "Ensure you are in a git repository with at least one commit.")
    elif branch in ("main", "master", "staging", "HEAD"):
        record("1.4", phase, f"Working branch isolated (not main/master/staging)", "FAIL",
               f"Current branch is '{branch}' — protected branch.",
               "git checkout -b feature/<name> before running hands-off.")
    else:
        record("1.4", phase, f"Working branch is feature branch: '{branch}'", "PASS",
               f"Branch: {branch}")

    # Check 5: Backup — manual (can't automate the act of taking a backup)
    record("1.5", phase, "Backup of repo state taken", "MANUAL",
           "Cannot automate backup creation.",
           "Run: git tag pre-handsoff-$(date +%Y%m%d) && git push origin --tags\n"
           "  OR: tar -czf ../<repo>-backup-$(date +%Y%m%d).tar.gz .")


# ---------------------------------------------------------------------------
# Phase 2 — Task Atomization
# ---------------------------------------------------------------------------

def check_phase2(repo_root: Path) -> None:
    phase = "Phase 2 — Task Atomization"

    # Plans live per-objective: .agent-build/objectives/<obj>/plans/PLAN_<n>_<m>.md
    plan_files = sorted(repo_root.glob(".agent-build/objectives/*/plans/PLAN_*.md"))

    # Check 1: Safe Task Catalog — manual
    record("2.1", phase, "Every queued task matches Safe Task Catalog", "MANUAL",
           "Cannot automate: requires human judgment against handsoff-mode.md § Safe Task Catalog.",
           "Walk your task list. Each one must match a SAFE pattern. If not — manual-mode task.")

    # Check 2: Each task has ≤3 sub-steps
    if not plan_files:
        record("2.2", phase, "PLAN_*.md files present under .agent-build/objectives/*/plans/", "FAIL",
               "No PLAN_*.md files found under .agent-build/objectives/*/plans/.",
               "Create PLAN files per the template in handsoff-mode.md § Task Atomization.")
    else:
        violations = []
        for pf in plan_files:
            content = pf.read_text(errors="replace")
            # Count numbered items only within the Sub-steps section, not numbered
            # prose elsewhere (Rollback/Verification/Objective). Matches both the
            # inline form ("## Sub-steps (<=3)  1. ... 2. ...") and a numbered list.
            substeps_block = section_body(content, "Sub-steps")
            n_substeps = len(re.findall(r"(?:^|\s)\d+\.", substeps_block)) if substeps_block else 0
            if n_substeps > 3:
                violations.append(f"{pf.name}: {n_substeps} sub-steps (max 3)")
            elif n_substeps == 0:
                violations.append(f"{pf.name}: no '## Sub-steps' section found")
        if violations:
            record("2.2", phase, "Each PLAN has ≤3 sub-steps", "FAIL",
                   "Sub-step violations:\n    " + "\n    ".join(violations),
                   "Split plans with >3 sub-steps into separate PLAN files.")
        else:
            record("2.2", phase, f"All {len(plan_files)} PLAN file(s) have ≤3 sub-steps", "PASS",
                   f"Plans checked: {', '.join(p.name for p in plan_files)}")

    # Check 3: Each task has DoD checkboxes
    if plan_files:
        missing_dod = []
        for pf in plan_files:
            content = pf.read_text(errors="replace")
            has_dod_section = "Definition of Done" in content or "## DoD" in content
            has_checkboxes = "- [ ]" in content or "- [x]" in content or "- [X]" in content
            if not (has_dod_section and has_checkboxes):
                missing_dod.append(pf.name)
        if missing_dod:
            record("2.3", phase, "Each PLAN has concrete DoD checkboxes", "FAIL",
                   "Missing DoD checkboxes in: " + ", ".join(missing_dod),
                   "Add '## Definition of Done' with '- [ ]' checkboxes to each PLAN file.")
        else:
            record("2.3", phase, "All PLAN files have DoD checkboxes", "PASS")
    else:
        record("2.3", phase, "DoD checkboxes in PLAN files", "FAIL",
               "No PLAN files found.", "Create PLAN files under .agent-build/objectives/<obj>/plans/ first.")

    # Check 4: Each task has rollback path
    if plan_files:
        missing_rollback = [pf.name for pf in plan_files
                            if "rollback" not in pf.read_text(errors="replace").lower()]
        if missing_rollback:
            record("2.4", phase, "Each PLAN has a Rollback section", "FAIL",
                   "Missing Rollback in: " + ", ".join(missing_rollback),
                   "Add '## Rollback' with concrete commands to each PLAN file.")
        else:
            record("2.4", phase, "All PLAN files have Rollback section", "PASS")
    else:
        record("2.4", phase, "Rollback sections in PLAN files", "FAIL",
               "No PLAN files found.", "Create PLAN files first.")

    # Check 5: Task dependencies declared — manual (logic check)
    record("2.5", phase, "Task dependencies declared (Depends-on lines)", "MANUAL",
           "Cannot automate dependency graph validation.",
           "Verify each PLAN that depends on another has 'Depends-on: PLAN_<n>_<m>' in its header.")


# ---------------------------------------------------------------------------
# Phase 3 — Hard Gates
# ---------------------------------------------------------------------------

def check_phase3(repo_root: Path) -> None:
    phase = "Phase 3 — Hard Gates"

    # All hard-gate checks are config/runner checks — mark MANUAL with instructions
    record("3.1", phase, "Failing-test gate (TDD iron law) active", "MANUAL",
           "Cannot automate: depends on runner configuration flag.",
           "Confirm runner is invoked with TDD gate ON. See handsoff-mode.md § Hard Gates (Gate 1).")

    record("3.2", phase, "Design-approval gate active for spec-changing tasks", "MANUAL",
           "Cannot automate: depends on task content and runner config.",
           "If any PLAN creates new modules / changes APIs: design-approval gate must be ON.")

    # Protected-path gate — check that protected dirs exist (proxy for gate relevance)
    protected_paths = [
        "backend/auth",
        "backend/billing",
        "backend/middleware",
        "infrastructure",
        "alembic/migrations",
    ]
    existing_protected = [p for p in protected_paths if (repo_root / p).exists()]
    record("3.3", phase, "Protected-path gate active", "MANUAL",
           f"Protected paths present in repo: {existing_protected if existing_protected else 'none found (may be in subdir)'}",
           "Confirm runner config lists protected paths from handsoff-mode.md § Hard Gates (Gate 3).")

    record("3.4", phase, "Destructive-op gate active", "MANUAL",
           "Cannot automate: runner configuration.",
           "Confirm runner blocks: git reset --hard, force-push, DROP TABLE, delete >10 files. See Gate 4.")

    record("3.5", phase, "Network-egress gate active for tests", "MANUAL",
           "Cannot automate: depends on test suite configuration.",
           "Ensure test runs use --network none where possible; production endpoints mocked.")


# ---------------------------------------------------------------------------
# Phase 4 — Slack HALT
# ---------------------------------------------------------------------------

def check_phase4(hard_stop_str: str | None) -> None:
    phase = "Phase 4 — Slack HALT"

    # Check 1: Slack webhook — manual
    record("4.1", phase, "Slack webhook / bot token configured", "MANUAL",
           "Cannot automate webhook reachability.",
           "Test manually: echo 'pre-flight ping' | <slack-send-script>. Confirm message arrives.")

    # Check 2: Phone notifications — manual
    record("4.2", phase, "Phone has Slack notifications enabled", "MANUAL",
           "Cannot automate phone notification check.",
           "Send a test ping to yourself. Confirm it arrives on your phone within 30 seconds. NOT muted, NOT in DND.")

    # Check 3: HALT routing table loaded — manual
    record("4.3", phase, "HALT routing table loaded", "MANUAL",
           "Cannot automate: runner configuration.",
           "Confirm runner has cause→recipient mapping per SKILL.md § Routing Table.")

    # Check 4: Hard stop time declared — automatable via --hard-stop arg
    if hard_stop_str is None:
        record("4.4", phase, "--hard-stop time declared", "FAIL",
               "No --hard-stop argument provided.",
               "Provide --hard-stop <ISO-timestamp>, e.g. --hard-stop 2026-05-24T02:00:00Z")
    else:
        try:
            # Parse ISO-8601; normalize a single trailing 'Z' to +00:00.
            # Slice one char (not rstrip, which strips a char-set and mangles
            # inputs already carrying an offset).
            ts_str = hard_stop_str[:-1] + "+00:00" if hard_stop_str.endswith("Z") else hard_stop_str
            hard_stop_dt = datetime.fromisoformat(ts_str)
            now = datetime.now(timezone.utc)
            if hard_stop_dt.tzinfo is None:
                hard_stop_dt = hard_stop_dt.replace(tzinfo=timezone.utc)
            if hard_stop_dt <= now:
                record("4.4", phase, "--hard-stop time in the future", "FAIL",
                       f"--hard-stop {hard_stop_str!r} is in the past (now={now.isoformat()}).",
                       "Provide a future ISO-8601 timestamp for --hard-stop.")
            else:
                delta_hours = (hard_stop_dt - now).total_seconds() / 3600
                record("4.4", phase, f"--hard-stop declared: {hard_stop_str}", "PASS",
                       f"Runs for up to {delta_hours:.1f} hours from now.")
        except ValueError as exc:
            record("4.4", phase, "--hard-stop parses as ISO-8601", "FAIL",
                   f"Could not parse '{hard_stop_str}': {exc}",
                   "Use ISO-8601 format, e.g. 2026-05-24T02:00:00Z")

    # Check 5: Severity prefix rules — manual
    record("4.5", phase, "Severity prefix rules active (🛑 / ‼️)", "MANUAL",
           "Cannot automate: runner configuration.",
           "Confirm runner applies 🛑 for normal HALTs and ‼️ for destructive-op HALTs with CC routing.")


# ---------------------------------------------------------------------------
# Phase 5 — State & Resumption
# ---------------------------------------------------------------------------

def check_phase5(repo_root: Path, cost_cap_str: str | None) -> None:
    phase = "Phase 5 — State & Resumption"

    agent_build_dir = repo_root / ".agent-build"

    # Check 1: .agent-build/ initialized with its root structure
    required_subdirs = ["objectives", "sessions"]
    if not agent_build_dir.exists():
        record("5.1", phase, ".agent-build/ directory exists", "FAIL",
               ".agent-build/ does not exist.",
               "mkdir -p .agent-build/objectives .agent-build/sessions")
    else:
        missing_subdirs = [s for s in required_subdirs if not (agent_build_dir / s).exists()]
        created = []
        errors = []
        for sub in missing_subdirs:
            try:
                (agent_build_dir / sub).mkdir(parents=True, exist_ok=True)
                created.append(sub)
            except OSError as exc:
                errors.append(f"{sub}: {exc}")
        still_missing = [s for s in required_subdirs if not (agent_build_dir / s).exists()]
        if still_missing:
            detail = f"Missing subdirs: {still_missing}"
            if errors:
                detail += "\n    mkdir errors: " + "; ".join(errors)
            record("5.1", phase, ".agent-build/ subdirectories present", "FAIL",
                   detail,
                   f"mkdir -p {' '.join('.agent-build/' + s for s in still_missing)}")
        else:
            label = f" (created: {created})" if created else ""
            record("5.1", phase, f".agent-build/ initialized{label}", "PASS",
                   f"Root subdirs present: {required_subdirs}")

    # Check 2: .agent-build/ is writable (per-task state.md lives under objectives/<obj>/<task>/)
    if not agent_build_dir.exists():
        record("5.2", phase, ".agent-build/ writable", "FAIL",
               ".agent-build/ doesn't exist.", "Create .agent-build/ first.")
    else:
        probe = agent_build_dir / ".write-probe"
        try:
            probe.touch(exist_ok=True)
            probe.unlink()
            record("5.2", phase, ".agent-build/ exists and writable", "PASS",
                   f"Path: {agent_build_dir}")
        except OSError as exc:
            record("5.2", phase, ".agent-build/ writable", "FAIL",
                   f"Write test failed: {exc}",
                   "Fix permissions: chmod u+w .agent-build/")

    # Check 3: .agent-build/RESUME.md exists — partial auto
    resume_md = agent_build_dir / "RESUME.md"
    if resume_md.exists():
        record("5.3", phase, ".agent-build/RESUME.md (pickup map) ready", "PASS",
               f"Found: {resume_md}")
    else:
        record("5.3", phase, ".agent-build/RESUME.md (pickup map) ready", "MANUAL",
               "RESUME.md not found — it may not exist yet for a fresh run.",
               "Write .agent-build/RESUME.md with the resume command before walking away.\n"
               "  E.g.: 'authorize hands-off run, queue from .agent-build/objectives/, hard-stop <time>, Slack HALT to Matthew'")

    # Check 4: Last session notes loaded — manual
    record("5.4", phase, "Last manual session notes loaded into state", "MANUAL",
           "Cannot automate: requires human knowledge of prior session.",
           "If continuing from a manual session: add its 'Next-turn intent' to the objective's state.md header.")

    # Check 5: Cost cap declared
    if cost_cap_str is None:
        record("5.5", phase, "Cost cap declared (--cost-cap)", "FAIL",
               "No --cost-cap argument provided.",
               f"Provide --cost-cap <dollars>, e.g. --cost-cap {MONTHLY_BUDGET_USD // 4} "
               f"(${MONTHLY_BUDGET_USD}/mo budget: 25% = ${MONTHLY_BUDGET_USD // 4}/run).")
    else:
        try:
            cap = float(cost_cap_str)
            if cap <= 0:
                record("5.5", phase, "Cost cap > 0", "FAIL",
                       f"--cost-cap {cap} is not positive.",
                       "Provide a positive dollar amount for --cost-cap.")
            elif cap > MONTHLY_BUDGET_USD:
                record("5.5", phase, f"Cost cap ${cap:.2f} declared", "FAIL",
                       f"--cost-cap {cap} exceeds the ${MONTHLY_BUDGET_USD}/mo monthly budget.",
                       f"Set --cost-cap to at most ${MONTHLY_BUDGET_USD} "
                       f"(25% of monthly = ${MONTHLY_BUDGET_USD // 4} is the recommended single-run cap).")
            else:
                record("5.5", phase, f"Cost cap ${cap:.2f} declared", "PASS",
                       f"${cap:.2f} per run ({cap / MONTHLY_BUDGET_USD * 100:.0f}% of ${MONTHLY_BUDGET_USD}/mo budget).")
        except ValueError:
            record("5.5", phase, "Cost cap parses as a number", "FAIL",
                   f"Could not parse '{cost_cap_str}' as a number.",
                   "Use a numeric dollar amount, e.g. --cost-cap 50")


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_report() -> int:
    """Print the full report. Returns 1 if any FAIL, 0 if all PASS or MANUAL."""
    passes = [r for r in RESULTS if r["status"] == "PASS"]
    fails = [r for r in RESULTS if r["status"] == "FAIL"]
    manuals = [r for r in RESULTS if r["status"] == "MANUAL"]

    print()
    print("=" * 70)
    print("  HANDS-OFF PRE-FLIGHT REPORT")
    print("=" * 70)
    print(f"  PASS: {len(passes)}  FAIL: {len(fails)}  MANUAL: {len(manuals)}")
    print("=" * 70)
    print()

    current_phase = None
    for r in RESULTS:
        if r["phase"] != current_phase:
            current_phase = r["phase"]
            print(f"\n--- {current_phase} ---")

        icon = {"PASS": "[PASS]", "FAIL": "[FAIL]", "MANUAL": "[MANUAL]"}[r["status"]]
        print(f"  {icon}  {r['id']}  {r['description']}")
        if r["detail"]:
            for line in r["detail"].splitlines():
                print(f"         {line}")
        if r["status"] in ("FAIL", "MANUAL") and r["remediation"]:
            print(f"         >> {r['remediation'].splitlines()[0]}")
            for line in r["remediation"].splitlines()[1:]:
                print(f"            {line}")

    print()
    print("=" * 70)

    if fails:
        print(f"  RESULT: FAIL ({len(fails)} check(s) failed — fix before walking away)")
        print()
        print("  Failed checks:")
        for r in fails:
            print(f"    [{r['id']}] {r['description']}")
            if r["remediation"]:
                print(f"          >> {r['remediation'].splitlines()[0]}")
    else:
        # No FAILs is NOT "cleared to launch". This script verifies the
        # environment only; the behavioral gates that actually contain a
        # misbehaving agent (protected paths, destructive ops, self-merge, TDD)
        # are MANUAL here and unconfirmed. Do not imply safety we haven't proven.
        print(f"  RESULT: {len(passes)} automated check(s) PASS — "
              f"{len(manuals)} MANUAL check(s) UNCONFIRMED")
        print("  NOT CLEARED TO LAUNCH. Automated checks cover the environment only;")
        print("  the behavioral gates (protected paths, destructive ops, self-merge,")
        print("  TDD) are NOT machine-checked — the always-on security hook is their")
        print("  real backstop. Confirm every MANUAL check below by hand first.")

    print()
    if not fails and manuals:
        print(f"  Manual checks to confirm before launch: {', '.join(r['id'] for r in manuals)}")
        print("  Once ALL are confirmed by hand, authorize the run:")
        print("    authorize hands-off run, queue from .agent-build/objectives/,")
        print("    hard-stop <ISO-time>, Slack HALT to <recipient>")

    print("=" * 70)
    print()

    return 1 if fails else 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Hands-off harness pre-flight checker. Automates ~11 of the 25 pre-flight "
            "checks (the environment-verifiable subset); the other ~14 are MANUAL and "
            "must be confirmed by hand. Prints PASS/FAIL/MANUAL with remediation hints. "
            "Exits non-zero if any automatable check FAILs. NOTE: a clean run is NOT "
            "'cleared to launch' — it only means the environment checks passed."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Example:\n"
            "  python3 .claude/agent-build/preflight.py \\\n"
            "      --hard-stop 2026-05-24T02:00:00Z \\\n"
            "      --cost-cap 50\n"
        ),
    )
    parser.add_argument(
        "--hard-stop",
        metavar="ISO_TIMESTAMP",
        help="Hard stop time in ISO-8601 format (UTC), e.g. 2026-05-24T02:00:00Z. Required for PASS.",
    )
    parser.add_argument(
        "--cost-cap",
        metavar="DOLLARS",
        help=f"Maximum dollar spend for this run (numeric). Required for PASS. "
             f"${MONTHLY_BUDGET_USD}/mo budget: 25%% = ${MONTHLY_BUDGET_USD // 4}/run.",
    )
    parser.add_argument(
        "--repo-root",
        metavar="PATH",
        default=None,
        help="Path to repository root (default: current working directory).",
    )

    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve() if args.repo_root else Path.cwd()

    # `.git` is a dir in a normal checkout and a file in a worktree — `.exists()`
    # handles both. If neither, try to discover the toplevel.
    repo_root_ok = True
    if not (repo_root / ".git").exists():
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, cwd=str(repo_root)
        )
        if result.returncode == 0:
            repo_root = Path(result.stdout.strip())
        else:
            repo_root_ok = False

    print(f"\nRepo root : {repo_root}")
    print(f"Hard-stop : {args.hard_stop or '(not provided)'}")
    print(f"Cost cap  : ${args.cost_cap or '(not provided)'}")

    # Unresolvable repo root is a hard FAIL — every path check below would be
    # meaningless, so don't let the run look clean.
    if not repo_root_ok:
        record("1.0", "Phase 1 — Environment", "Repository root resolved", "FAIL",
               f"Could not resolve a git repo root from {repo_root}; all path checks are unreliable.",
               "Run from inside the repo, or pass --repo-root <path>.")

    check_phase1(repo_root)
    check_phase2(repo_root)
    check_phase3(repo_root)
    check_phase4(args.hard_stop)
    check_phase5(repo_root, args.cost_cap)

    return print_report()


if __name__ == "__main__":
    sys.exit(main())
