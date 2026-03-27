# Plan Review -- P1-F03

## Metadata
- Profile: standard
- Date: 2026-03-27
- Reviewer: subprocess (clean context)

## DP Section Verification

| Section | Required | Present | Status |
|---------|----------|---------|--------|
| DP-1 | YES | YES | OK |
| DP-2 | YES | YES | OK |
| DP-5 | YES | YES | OK |
| DP-TEST | YES | YES | OK |
| DP-MIGRATE | YES | YES | OK |

All required sections present.

## DP-5 Deep Validation

| AC | Has Command? | Has Expected Output? | PASS/FAIL Deterministic? | Testable? |
|----|-------------|---------------------|--------------------------|-----------|
| AC-1 | YES (npx vitest run ...) | YES (all pass, 0 failed) | YES | YES |
| AC-2 | YES | YES (shouldPersistLayout=true) | YES | YES |
| AC-3 | YES | YES (shouldPersistLayout=false) | YES | YES |
| AC-4 | YES | YES (covers all patterns) | YES | YES |
| AC-5 | YES | YES | YES | YES |
| AC-6 | YES (npx vitest run packages/shared/test/flow/) | YES (0 FAILED) | YES | YES |

All ACs pass deep validation. Commands use executable paths. Expected outputs are concrete.

## Phase 0 Verification
- DFC executed: YES (3 MODIFY-files checked, no divergences)
- RC-1 executed: YES (no missing resources)

## Pre-Mortem Table

| # | What to cheat | How to detect | What to add to plan |
|---|---------------|---------------|---------------------|
| 1 | Return shouldPersistLayout=true always (even for complete canvasLayout) -- would cause unnecessary writes on every load | AC-3 specifically tests shouldPersistLayout=false for complete canvasLayout | Already covered by AC-3 |
| 2 | Implement partial layout fill by setting ALL positions to Dagre output (overwriting user-saved positions) instead of only filling MISSING positions | AC-1 should explicitly test that existing positions are PRESERVED while missing are filled | RECOMMENDED: Add explicit assertion in AC-1 tests that existing position values are unchanged |
| 3 | Add migrateCanvasLayout as a no-op stub that returns the same data unchanged | AC-1 tests with partial canvasLayout would fail if positions still {0,0} for missing nodes, but tests must assert non-zero computed positions | Already detectable by AC-1 tests verifying non-zero positions |

## RCC Results

### graph-converter.ts (5/5)
- Caller Update: PASS (additive function, no caller changes needed)
- Test Update: PASS (new test file covers new function)
- Config Update: PASS (no config references)
- Import Update: PASS (additive export, no removed/renamed symbols)
- Backward Compat: PASS (existing function unchanged)

### graph-canvas-utils.ts (5/5)
- Caller Update: PASS (additive field, existing destructuring still works)
- Test Update: PASS (new tests cover new behavior)
- Config Update: PASS (no config references)
- Import Update: PASS (additive field on return type)
- Backward Compat: PASS (GraphCanvasData type extended, not replaced)

### graph-state-utils.ts (5/5)
- Caller Update: PASS (additive field on return type)
- Test Update: PASS (new tests cover new behavior)
- Config Update: PASS (no config references)
- Import Update: PASS (no removed/renamed exports)
- Backward Compat: PASS (additive change only)

## Findings

1. **[PRE-MORTEM-2, RECOMMENDED]** AC-1 tests should explicitly assert that pre-existing position values in a partial canvasLayout are PRESERVED (not overwritten by Dagre). The current AC-1 description says "missing nodes should receive Dagre-computed positions" but does not explicitly state "existing positions must be unchanged."

2. **[NOTE]** The plan references `migrateCanvasLayout()` as a new function in graph-converter.ts, but the DP-2 section mentions extending `buildGraphFromFlowVersion()` return type. The implementation should ensure `migrateCanvasLayout()` is called BY buildGraphFromFlowVersion, not duplicated.

## Verdict
**APPROVED**

## Verdict Justification
The plan is well-structured with all required DP sections present. DP-5 acceptance criteria are executable and machine-verifiable. DFC and RC-1 are documented. The migration approach (partial canvasLayout fill + shouldPersistLayout flag) is sound and additive, minimizing regression risk. The single recommended finding (pre-mortem #2) should be incorporated but does not block approval.
