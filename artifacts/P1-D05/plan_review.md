# Plan Review — P1-D05

## Verdict: CHANGES REQUIRED

## Pre-mortem Analysis

### RCC-1: Scope creep risk — addNodeFromPalette in shared utils
**Severity:** MEDIUM
**Issue:** The draft plan includes `addGraphNode(nodes, step, position)` in Phase A (shared utils). However, the full `addNodeFromPalette` requires `PieceMetadata` type which lives in packages/web, not packages/shared. The shared utility should NOT depend on web-specific types.
**Recommendation:** Keep `addGraphNode` in shared but parameterize on `Step` (which is in shared), not `PieceMetadata`. The conversion from PieceMetadata to Step happens in the Zustand slice (Phase B), not in shared.

### RCC-2: ReactFlow types in shared package
**Severity:** HIGH
**Issue:** Phase A proposes `applyNodesChange(nodes, changes)` and `applyEdgesChange(edges, changes)` in packages/shared. These functions accept `NodeChange[]` and `EdgeChange[]` from `@xyflow/react` — a web-only dependency. packages/shared should NOT import from `@xyflow/react`.
**Recommendation:** Do NOT put `applyNodesChange` and `applyEdgesChange` in shared. These must live in the Zustand slice (packages/web) which already has `@xyflow/react` as a dependency. The shared utility should only contain pure graph data operations (add/remove nodes, sync from/to FlowVersion, auto-layout).

### RCC-3: Operation listener architecture
**Severity:** LOW
**Issue:** The plan mentions that GraphState subscribes to flow operations via operationListeners but does not specify WHICH operations trigger graph resync. From architecture doc section 6.6, structural operations (ADD_ACTION, DELETE_ACTION, MOVE_ACTION, ADD_BRANCH, DELETE_BRANCH, MOVE_BRANCH, DUPLICATE_ACTION, IMPORT_FLOW, UPDATE_TRIGGER) require graph rebuild. Non-structural operations (UPDATE_ACTION, SAVE_SAMPLE_DATA, UPDATE_NOTE) do NOT.
**Recommendation:** Explicitly list which FlowOperationType values trigger syncFromFlowState in the operation listener.

### RCC-4: Test file location
**Severity:** LOW
**Issue:** Plan says tests go in `packages/shared/test/flow/graph-state.test.ts` but the shared utility file is named `graph-state-utils.ts`. Test file should match: `graph-state-utils.test.ts`.
**Recommendation:** Rename test file to match the source file pattern.

### RCC-5: BuilderInitialState may need update
**Severity:** LOW
**Issue:** `createGraphState` needs `flowVersion` from initial state. The existing `createCanvasState` receives `initialState` that includes `flowVersion`. However, `createGraphState` will also need `get` to access `flowVersion` and `applyOperation`. The plan should clarify the exact signature following the pattern of `createFlowState(initialState, get, set)`.
**Recommendation:** Specify that `createGraphState` follows the same pattern as `createFlowState`: receives `(initialState, get, set)` where `initialState` provides `flowVersion`.

## Completeness Check

- DP-1: Adequate GAP analysis. Covers existing utilities.
- DP-2: Identifies scope boundaries correctly.
- DP-5: 8 acceptance criteria, all with executable commands. AC-7 uses grep (acceptable for wiring check).
- DP-TEST: Covers the main test areas but count (~20) should be verified after RCC-2 adjustment.
- DP-MIGRATE: Correctly identifies builder-hooks.ts as the only MODIFY file. Import chain is LOW risk.

## Summary

The plan is structurally sound but has one HIGH-severity issue (RCC-2: ReactFlow types in shared). The fix is straightforward: split the responsibilities so that shared utils handle only pure graph data (no ReactFlow imports), while the Zustand slice in packages/web handles ReactFlow-specific change application.
