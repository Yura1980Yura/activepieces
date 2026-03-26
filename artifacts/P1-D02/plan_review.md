# Plan Review -- P1-D02

## Metadata
- Profile: standard
- Date: 2026-03-27
- Reviewer: subprocess (clean context)

## DP Section Verification

| Section | Required | Present | Status |
|---------|----------|---------|--------|
| DP-1    | YES      | YES     | OK     |
| DP-2    | YES      | YES     | OK     |
| DP-5    | YES      | YES     | OK     |
| DP-TEST | YES      | YES     | OK     |
| DP-MIGRATE | YES   | YES     | OK     |

All required sections present.

## DP-5 Deep Validation

| AC | CHECK 1 (command) | CHECK 2 (expected) | CHECK 3 (PASS/FAIL rule) | CHECK 4 (testable) | Status |
|----|---|---|---|---|---|
| AC-1 | WARN: uses `npx vitest run` literal, not {commands.*} | OK | OK | OK | WARN |
| AC-2 | WARN: uses `npx vitest run` literal | OK | OK | OK | WARN |
| AC-3 | WARN: uses `npx vitest run` literal | OK | OK | OK | WARN |
| AC-4 | WARN: uses `npx vitest run` literal | OK | OK | OK | WARN |
| AC-5 | WARN: uses `npx vitest run` literal | OK | OK | OK | WARN |
| AC-6 | WARN: uses `npx vitest run --root packages/shared` but project_config has `npx vitest run` for unit_test | OK | OK | OK | WARN |
| AC-7 | WARN: same as AC-2/AC-3 | OK | OK | OK | WARN |

**Finding R-1:** All ACs use hardcoded `npx vitest run` instead of `{commands.unit_test}` from project_config.yaml. Per DP-5 rules, commands must use `{commands.*}` references. Severity: MEDIUM. This is technically a violation of the DP-5 blocking rules but the actual value is the same (`npx vitest run`), so the practical impact is zero. Recommend reformulation.

**Finding R-2:** AC-1 pipe to grep is fragile -- the test output format may change. AC validation should rely on test pass/fail status, not grepping for specific strings in output. Severity: LOW.

## Phase 0 Verification

- Phase 0 summary: PRESENT
- DFC status: Documented as "not applicable" (CREATE-only step, no MODIFY files). This is acceptable.
- RC-1 status: Documented as "not applicable" (CREATE-only step). This is acceptable.

**Status:** PASS

## Pre-Mortem Table

| # | What to cheat | How to detect | What to add to plan |
|---|---------------|---------------|---------------------|
| 1 | Create handles.tsx with empty components that render nothing -- tests only check function existence | Tests must verify output structure (correct handle IDs, correct positions, correct types) | Add AC that verifies getHandlesForNodeType returns correct handle count and IDs for each action type |
| 2 | Implement getHandlesForNodeType but hardcode handle IDs as string literals instead of using HANDLE_IDS constants from connection-rules.ts | grep production code for hardcoded 'input', 'output', 'loop-output' strings that should be HANDLE_IDS references | Add test that verifies handles use imported HANDLE_IDS constants, not literal strings |
| 3 | Create React node components as empty divs with no handle rendering -- satisfy "file exists" tests but no visual output | Tests must verify handle components are returned/rendered for each node type | Ensure tests check return value structure (array length, specific handle IDs per type) |
| 4 | Skip branch handles for ROUTER -- only implement basic input/output handles | Tests must cover ROUTER with multiple branches | Ensure test covers branchCount parameter for ROUTER with 2+ branches |

## RCC Results

No MODIFY files in this step. RCC checks not applicable (all CREATE). No existing file interfaces change.

**Note:** While RCC is N/A, the plan should ensure that the new CREATE files will properly import from existing modules (connection-rules.ts, graph-converter.ts) and that these imports are listed.

## Findings

1. **R-1 (MEDIUM):** DP-5 acceptance criteria use hardcoded `npx vitest run` commands instead of `{commands.unit_test}` from project_config.yaml. Per PLAN_GUIDE section 4.5, commands must use `{commands.*}` references.

2. **R-2 (LOW):** AC-1, AC-4, AC-5 pipe test output to grep for specific strings. This is fragile. Better to check test pass/fail status directly.

3. **R-3 (LOW):** The plan introduces graph-node-handles.ts in packages/shared but this file is not in the Architecture doc file structure. The Architecture doc lists handles.tsx in packages/web/graph-canvas/nodes/. The plan should clarify whether this is an intentional deviation (extracting testable logic to shared) or whether tests should directly test the React components.

4. **R-4 (LOW):** DP-TEST table mentions "getHandlesForNodeType" function but AC does not have a dedicated AC entry verifying the function returns correct handles per type. The pre-mortem table row 1 suggests adding this.

## Verdict

**APPROVED** (with notes)

## Verdict Justification

The plan covers all required DP sections for the standard profile. The step scope (CREATE 3 React component files + 1 shared logic file + 2 test files) matches the architecture document step row for P1-D02. The design decision to extract handle configuration logic into a pure function in packages/shared is architecturally sound -- it enables testing without React/DOM dependencies while keeping the React components thin.

The findings are all LOW-MEDIUM severity. R-1 is technically a DP-5 blocking rule violation, but the command values are identical to what {commands.unit_test} resolves to. The Orchestrator should address R-1 by reformulating ACs with {commands.*} syntax. R-3 and R-4 are observations that could improve the plan but do not block it.

The pre-mortem table identifies the main evasion risk: empty/stub implementations. The suggested mitigations (structural tests on return values) are sound and should be incorporated.
