# Plan Review — P1-F01

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

| AC | Executable Command? | Concrete Expected? | Deterministic PASS/FAIL? | Actually Testable? | Status |
|----|---------------------|-------------------|--------------------------|-------------------|--------|
| AC-1 | YES (grep + wc -l) | YES (0) | YES | YES | OK |
| AC-2 | YES (grep) | YES (>= 1 match) | YES | YES | OK |
| AC-3 | YES (grep) | YES (>= 3 matches) | YES | YES | OK |
| AC-4 | YES (grep) | YES (>= 2 matches) | YES | YES | OK |
| AC-5 | YES (grep) | YES (>= 1 match) | YES | YES | OK |
| AC-6 | YES (grep) | YES (= 3 matches) | YES | YES | OK |
| AC-7 | YES (grep -c) | YES (0) | YES | YES | OK |
| AC-8 | YES (npx vitest run) | YES (0 failed) | YES | YES | OK |
| AC-9 | YES (npx vitest run specific file) | YES (>= 15 tests) | YES | YES | OK |
| AC-10 | YES (grep) | YES (>= 2 matches) | YES | YES | OK |

**Issue R-1:** AC-6 checks for hook usage via grep in builder/index.tsx, but the plan says these hooks come from `flow-canvas/hooks.tsx`. If the plan removes the `flowCanvasHooks` import entirely when removing FlowCanvas, AC-6 would FAIL. The plan must explicitly state that `flowCanvasHooks` import is PRESERVED even though FlowCanvas is removed. Severity: MEDIUM.

**Issue R-2:** AC-9 references `test/flow/builder-graph-wiring.test.ts` with >= 15 tests. The DP-TEST table lists 15 test names. This count is tight. If any test is dropped during implementation, AC-9 fails. Consider >= 12 for margin. Severity: LOW.

**Issue R-3:** AC-3 uses string matching for `graphNodes|graphEdges|...` which would match comments too. This is acceptable for a positive check (confirming presence), but should be noted. Severity: LOW (acceptable).

## Phase 0 Verification

- Phase 0 docs loaded: YES (ARCHITECTURE.md, engine.yaml, project_config.yaml)
- DFC executed: YES — documented for both MODIFY files with import analysis
- DFC-discovered: `flow-canvas/hooks.tsx` (provides builder hooks), `flow-canvas/utils/flow-canvas-utils.ts` (provides determineInitiallySelectedStep)
- RC-1 executed: YES — no missing resources found

## Pre-Mortem Table

| # | What to Cheat | How to Detect | What to Add to Plan |
|---|---------------|---------------|---------------------|
| 1 | **Stub replacement**: Replace `<FlowCanvas>` with `<GraphCanvas>` but pass no props, making it render an empty canvas with no nodes/edges | AC-3 checks for graphNodes/graphEdges in source code, but does not verify they are actually passed as props to GraphCanvas JSX element (grep matches could be in unrelated code) | Add AC that verifies GraphCanvas JSX element receives `flowVersion` or graph data props: `grep '<GraphCanvas' builder/index.tsx` and verify it contains prop assignments |
| 2 | **Dead import**: Import GraphCanvas but leave FlowCanvas rendering in place by renaming it | AC-1 checks for "FlowCanvas" but developer could rename the import. AC-2 checks for "GraphCanvas" which passes | AC-1 is sufficient — it checks for the string "FlowCanvas" in the file. Combined with AC-2 (GraphCanvas present), this covers the rename case. No addition needed. |
| 3 | **Missing node click handler**: Wire GraphCanvas but skip onNodeClick, so clicking nodes does nothing (step settings panel never opens) | AC-4 checks for selectStepByName AND onNodeClick strings, but does not verify they are connected. Developer could have both in different unrelated lines | Add to DP-5: a structural grep that verifies onNodeClick callback references selectStepByName within the same function scope |
| 4 | **Old widgets orphaned**: Keep importing from flow-canvas/widgets but these widgets rely on FlowCanvas internal state that no longer exists | AC-6 verifies hooks are present, but PublishFlowReminderWidget, RunInfoWidget, ViewingOldVersionWidget may break silently | Plan already preserves widgets as siblings of GraphCanvas (not children). These widgets use useBuilderStateContext directly, not FlowCanvas internals. No action needed — widgets are independent. |

## RCC Results

### builder/index.tsx (MODIFY)

| Check | Result | Details |
|-------|--------|---------|
| 6.1 Caller Update | PASS | Consumers (routes/flows/id, routes/runs/id) import `BuilderPage` — no signature change |
| 6.2 Test Update | PASS | DP-TEST lists new test file for builder wiring |
| 6.3 Config Update | PASS | No config files reference builder/index.tsx |
| 6.4 Import Update | PASS | No export changes — BuilderPage still exported |
| 6.5 Backward Compat | PASS | No breaking changes to public interface |

RCC score: 5/5

### flow-state.ts (MODIFY)

| Check | Result | Details |
|-------|--------|---------|
| 6.1 Caller Update | PASS | Consumers (builder-hooks.ts) — no signature change to createFlowState |
| 6.2 Test Update | PASS | DP-TEST says no new tests needed (existing graph-state-utils tests cover sync) |
| 6.3 Config Update | PASS | No config files reference flow-state.ts |
| 6.4 Import Update | PASS | No export changes |
| 6.5 Backward Compat | PASS | FlowState type unchanged; flowCanvasUtils dependency may remain |

RCC score: 5/5

## Findings

1. **R-1 (MEDIUM):** Plan must explicitly state that `flowCanvasHooks` import from `flow-canvas/hooks.tsx` is PRESERVED in builder/index.tsx. The hooks (`useShowBuilderIsSavingWarningBeforeLeaving`, `useSetSocketListener`, `useListenToExistingRun`, `useAnimateSidebar`) are used by BuilderPage and are independent of FlowCanvas rendering.

2. **R-2 (LOW):** AC-9 threshold of >= 15 tests is tight. Consider >= 12 for implementation flexibility.

3. **Pre-mortem item PM-1:** Plan should document that widgets (PublishFlowReminderWidget, RunInfoWidget, ViewingOldVersionWidget) are preserved as siblings of GraphCanvas and work via useBuilderStateContext, not FlowCanvas internals.

4. **Pre-mortem item PM-3:** Plan should add a structural verification that onNodeClick callback is wired to selectStepByName (not just present as separate unrelated strings).

## Verdict

**APPROVED** with recommendations R-1 (MEDIUM), R-2 (LOW), PM-1 (note), PM-3 (recommended).

## Verdict Justification

The plan is structurally sound: all 8 DP sections are present, all 10 ACs are executable with deterministic PASS/FAIL, Phase 0 is documented, DFC and RC-1 were executed. The MODIFY-file list is correct and complete. The migration approach (replace FlowCanvas with GraphCanvas in builder/index.tsx, wire graph state props, preserve hooks and widgets) is architecturally sound.

The MEDIUM finding R-1 is important: the plan must explicitly document that flowCanvasHooks import is preserved. Without this, a developer might remove all flow-canvas imports and break the save-warning, socket, and run listener hooks.

RCC passes 5/5 for both files. No HIGH severity issues.
