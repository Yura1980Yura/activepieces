# Plan Review -- P1-D04

## Verdict: APPROVED with minor changes

## Review Summary

The plan is well-structured with clear GAP analysis, proper DFC/RC-1 checks, and sensible test strategy. The approach of extracting pure logic to shared utility for testability is consistent with P1-D02 and P1-D03 patterns.

## Findings

### R-1: Shared utility naming clarity (LOW)
The plan mentions creating `graph-canvas-utils.ts` in shared, but the exact functions to extract are not fully enumerated. The plan lists `createNodeTypes`, `createEdgeTypes`, `buildGraphFromFlowVersion`, and `isValidConnectionCallback` but the boundaries between what lives in the shared utility vs. the React component are not precisely defined.

**Recommendation:** Clearly define which functions go to shared utility (pure logic, no React imports) vs. which stay in the React components.

### R-2: Test strategy focuses on shared but React components lack coverage (LOW)
AC-1 through AC-6 reference `test/flow/graph-canvas.test.ts` in packages/shared, but some ACs (e.g., AC-1: "GraphCanvas component renders ReactFlow with Background", AC-6: "Nodes are draggable") are really React rendering concerns that cannot be tested as pure logic.

**Recommendation:** Reframe ACs to test the configuration functions (pure logic) rather than claiming to test React rendering behavior. The React rendering is integration-level and should be tested in P1-F01.

### R-3: DP-MIGRATE claims no MODIFY files but index.ts export must be added (MEDIUM)
The plan states "No MODIFY files" but also mentions "Export: Added to packages/shared/src/index.ts." This is a MODIFY to index.ts. The DP-MIGRATE section should list this.

**Recommendation:** Add `packages/shared/src/index.ts` as a MODIFY file with consumer analysis.

### R-4: Pre-mortem risk: GraphCanvas component may be tightly coupled to builder state (LOW)
The existing FlowCanvas deeply integrates with builder-hooks.ts and builder state. The new GraphCanvas will eventually need the same integration. The plan correctly defers this to P1-D05/P1-F01, but should explicitly state that GraphCanvas in P1-D04 is a standalone component that does NOT import builder state.

**Recommendation:** Add explicit constraint: "GraphCanvas in P1-D04 does NOT import from builder-hooks.ts or state/ directory."

## RCC (Review Correctness Check)

- DP-1 GAPs: Complete and accurate. All 5 gaps are real.
- DP-2 Divergences: Accurate. No phantom file references.
- DP-3 OSS: Complete.
- DP-5 ACs: Executable commands present but some conflate React rendering with pure logic testing (see R-2).
- DP-TEST: Consistent with the extraction pattern.
- DP-MIGRATE: Missing index.ts MODIFY (see R-3).
