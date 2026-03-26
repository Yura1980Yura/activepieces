# Plan Review — P1-PRE-02

## Metadata
- Profile: full
- Date: 2026-03-27
- Reviewer: subprocess (clean context)

## DP Section Verification

| Section | Required | Present | Status |
|---------|----------|---------|--------|
| DP-1 | YES | YES | OK |
| DP-2 | YES | YES | OK |
| DP-3 | YES | YES | OK |
| DP-4 | YES | YES | OK |
| DP-5 | YES | YES | OK |
| DP-6 | YES | YES | OK |
| DP-TEST | YES | YES | OK |
| DP-MIGRATE | YES | YES | OK |

All required sections present.

## DP-5 Deep Validation

| AC | CHECK 1 (executable command) | CHECK 2 (expected output) | CHECK 3 (deterministic PASS/FAIL) | CHECK 4 (testable) |
|----|-----|-----|-----|-----|
| AC-1 | PASS — uses vitest run with specific test file and filter | PASS — exit code 0, "passed" in stdout | PASS — 0 FAILED | PASS |
| AC-2 | PASS — uses vitest run with specific test file and filter | PASS — exit code 0 | PASS — 0 FAILED | PASS |
| AC-3 | PASS — uses vitest run with filter "round-trip" | PASS — exit code 0 | PASS — 0 FAILED | PASS |
| AC-4 | PASS — uses vitest run with filter "action types" | PASS — tests for all types | PASS — 0 FAILED | PASS |
| AC-5 | PASS — uses vitest run on auto-layout.test.ts | PASS — exit code 0 | PASS — 0 FAILED | PASS |
| AC-6 | PASS — uses vitest run with filter "orphan" | PASS — tests pass | PASS — 0 FAILED | PASS |
| AC-7 | PASS — uses vitest run on entire shared package | PASS — >= 164 tests | PASS — deterministic count | PASS |
| AC-8 | PASS — uses tsc --noEmit | PASS — exit code 0 | PASS — 0 errors | PASS |

All ACs pass deep validation.

## Phase 0 Verification

- DFC executed: YES — documented as "No divergences found" for index.ts
- RC-1 executed: YES — documented 1 discovery (@dagrejs/dagre needs installation)

## Pre-Mortem Table

| # | What to cheat | How to detect | What to add to plan |
|---|---------------|---------------|---------------------|
| 1 | Stub converter that returns empty arrays instead of real conversion | AC-3 round-trip test would catch this — but only if test uses non-trivial flows. Ensure tests include flows with loops AND routers, not just trigger-only | REQUIRED: AC-3 round-trip tests must include at minimum: (a) linear 3-step chain, (b) flow with loop, (c) flow with router with 2+ branches |
| 2 | Auto-layout returns hardcoded positions instead of computing via Dagre | AC-5 tests must verify positions are DIFFERENT for different flow structures, not just that positions exist | RECOMMENDED: AC-5 test should verify that a 3-node linear chain has node Y positions in ascending order and correct spacing |
| 3 | graphToLinkedList ignores Loop/Router children — only follows nextAction chain | AC-4 tests for Loop/Router types — but detection requires the tests to verify firstLoopAction and children[] are populated | REQUIRED: AC-4 test for Loop must verify firstLoopAction is set; AC-4 test for Router must verify children[] has correct length |
| 4 | Converter silently drops edges for handles it doesn't recognize | No current AC covers edge type validation | RECOMMENDED: Add test verifying edge count matches expected for each flow pattern |
| 5 | Package not properly exported — tests pass locally but other packages can't import | AC-8 (tsc --noEmit) covers this | N/A — already covered |

## RCC Results

### packages/shared/src/index.ts (MODIFY)

| Check | Result |
|-------|--------|
| 6.1 Caller Update | PASS — additive change, no callers broken |
| 6.2 Test Update | PASS — no existing tests affected |
| 6.3 Config Update | PASS — no config references affected |
| 6.4 Import Update | PASS — new exports only, no removed symbols |
| 6.5 Backward Compat | PASS — purely additive |

RCC score: 5/5

## Findings

1. **(Pre-mortem #1, REQUIRED):** Round-trip tests (AC-3) must use non-trivial flows including loops and routers, not just trigger-only flows
2. **(Pre-mortem #3, REQUIRED):** AC-4 tests must verify firstLoopAction for Loop and children[] for Router are correctly populated in graphToLinkedList
3. **(Pre-mortem #2, RECOMMENDED):** AC-5 auto-layout tests should verify spatial ordering (Y positions ascending for linear chain)
4. **(Pre-mortem #4, RECOMMENDED):** Add edge count verification in converter tests
5. **(Observation):** Architecture doc places converter in `packages/web/src/app/builder/graph-canvas/utils/` but plan places it in `packages/shared/src/lib/automation/flows/util/`. The shared placement is architecturally superior (pure data transformation, reusable by server), but diverges from the architecture doc. This should be documented.

## Verdict
**APPROVED**

## Verdict Justification

The plan is structurally complete with all 8 required DP sections present and properly formatted. All acceptance criteria pass deep validation with executable commands and deterministic PASS/FAIL rules. Phase 0 documentation is thorough. The pre-mortem reveals testable risks that are largely already mitigated by the AC structure, with two required additions to strengthen round-trip and action-type testing. The file placement divergence from the architecture doc is a reasonable architectural improvement that should be documented. RCC shows clean results since the only MODIFY file is an additive barrel export.
