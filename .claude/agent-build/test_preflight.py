#!/usr/bin/env python3
"""
Unit tests for preflight.py — stdlib only (unittest), so they run on a bare host
with `python3 .claude/agent-build/test_preflight.py`, the same constraint as the
script they cover (it runs before `docker-compose up`). Also pytest-discoverable.

Covers the pure logic the party-mode review flagged: the sub-step counter
(false-FAIL regression), the hard-stop ISO parser, the cost-cap bounds, and the
report exit code.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import preflight  # noqa: E402


def _verdict(check_id: str) -> str | None:
    """Status of a recorded check, or None if absent."""
    for r in preflight.RESULTS:
        if r["id"] == check_id:
            return r["status"]
    return None


class ResetMixin(unittest.TestCase):
    def setUp(self) -> None:
        preflight.RESULTS.clear()


class TestSectionBody(unittest.TestCase):
    def test_scopes_to_named_section_only(self):
        content = (
            "# PLAN_1_1\n"
            "## Objective\n1. not a substep\n"
            "## Sub-steps (<=3)\n1. a\n2. b\n3. c\n"
            "## Rollback\n1. git stash\n2. git reset\n3. drop branch\n"
        )
        body = preflight.section_body(content, "Sub-steps")
        # only the 3 real sub-steps, not the numbered Objective/Rollback prose
        import re
        self.assertEqual(len(re.findall(r"(?:^|\s)\d+\.", body)), 3)

    def test_missing_section_returns_empty(self):
        self.assertEqual(preflight.section_body("# X\n## Other\n1. a\n", "Sub-steps"), "")

    def test_inline_substeps_on_heading_line(self):
        body = preflight.section_body("## Sub-steps (<=3)  1. a  2. b  3. c\n## Next\n", "Sub-steps")
        import re
        self.assertEqual(len(re.findall(r"(?:^|\s)\d+\.", body)), 3)


class TestSubStepCounter(ResetMixin):
    """Regression: a spec-compliant 3-sub-step PLAN with numbered prose in
    Rollback/Verification must PASS check 2.2 (the bug was counting all of them)."""

    def _write_plan(self, root: Path, body: str) -> None:
        d = root / ".agent-build" / "objectives" / "obj" / "plans"
        d.mkdir(parents=True, exist_ok=True)
        (d / "PLAN_1_1.md").write_text(body)

    def test_compliant_plan_with_numbered_prose_passes(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_plan(root,
                "# PLAN_1_1 — sample\n"
                "## Objective\nDo a thing.\n"
                "## Sub-steps (<=3)\n1. first\n2. second\n3. third\n"
                "## Definition of Done\n- [ ] check one\n"
                "## Rollback\n1. git stash\n2. git reset --hard <tag>\n3. drop branch\n"
                "## Verification\n1. run tests\n2. spot-check\n")
            preflight.check_phase2(root)
            self.assertEqual(_verdict("2.2"), "PASS")

    def test_over_three_substeps_fails(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_plan(root,
                "# PLAN_1_1\n## Sub-steps (<=3)\n1. a\n2. b\n3. c\n4. d\n5. e\n"
                "## Definition of Done\n- [ ] x\n## Rollback\nrevert\n")
            preflight.check_phase2(root)
            self.assertEqual(_verdict("2.2"), "FAIL")

    def test_no_substeps_section_fails(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_plan(root, "# PLAN_1_1\n## Objective\nthing\n## Rollback\nrevert\n")
            preflight.check_phase2(root)
            self.assertEqual(_verdict("2.2"), "FAIL")


class TestHardStopParser(ResetMixin):
    def test_future_passes(self):
        preflight.check_phase4("2099-01-01T00:00:00Z")
        self.assertEqual(_verdict("4.4"), "PASS")

    def test_past_fails(self):
        preflight.check_phase4("2000-01-01T00:00:00Z")
        self.assertEqual(_verdict("4.4"), "FAIL")

    def test_missing_fails(self):
        preflight.check_phase4(None)
        self.assertEqual(_verdict("4.4"), "FAIL")

    def test_naive_timestamp_treated_as_utc_passes(self):
        preflight.check_phase4("2099-01-01T00:00:00")  # no Z, no offset
        self.assertEqual(_verdict("4.4"), "PASS")

    def test_garbage_fails_without_crashing(self):
        preflight.check_phase4("not-a-date")
        self.assertEqual(_verdict("4.4"), "FAIL")

    def test_double_offset_z_does_not_crash(self):
        # "+00:00Z" used to mangle under rstrip; now a clean FAIL, no exception
        preflight.check_phase4("2099-01-01T00:00:00+00:00Z")
        self.assertEqual(_verdict("4.4"), "FAIL")


class TestCostCap(ResetMixin):
    def _cap(self, val):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            preflight.check_phase5(Path(tmp), val)

    def test_valid_passes(self):
        self._cap("50")
        self.assertEqual(_verdict("5.5"), "PASS")

    def test_zero_fails(self):
        self._cap("0")
        self.assertEqual(_verdict("5.5"), "FAIL")

    def test_over_budget_fails(self):
        self._cap(str(preflight.MONTHLY_BUDGET_USD + 1))
        self.assertEqual(_verdict("5.5"), "FAIL")

    def test_boundary_equals_budget_passes(self):
        self._cap(str(preflight.MONTHLY_BUDGET_USD))
        self.assertEqual(_verdict("5.5"), "PASS")

    def test_non_numeric_fails(self):
        self._cap("fifty")
        self.assertEqual(_verdict("5.5"), "FAIL")

    def test_missing_fails(self):
        self._cap(None)
        self.assertEqual(_verdict("5.5"), "FAIL")


class TestReportExitCode(ResetMixin):
    def test_any_fail_returns_nonzero(self):
        preflight.record("x", "P", "d", "PASS")
        preflight.record("y", "P", "d", "FAIL")
        self.assertEqual(preflight.print_report(), 1)

    def test_all_pass_or_manual_returns_zero(self):
        preflight.record("x", "P", "d", "PASS")
        preflight.record("y", "P", "d", "MANUAL")
        self.assertEqual(preflight.print_report(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
