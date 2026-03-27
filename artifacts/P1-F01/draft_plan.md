# Draft Plan — P1-F01

**Step:** P1-F01 — Wire GraphCanvas into builder (replace FlowCanvas)
**Profile:** full
**Date:** 2026-03-27
**Phase:** P1 — Free Canvas Graph Editor
**Dependencies:** P1-D05, P1-E01, P1-E02, P1-E03

---

## Phase 0 — Document Collection

### Loaded Documents
1. `architecture/ARCHITECTURE.md` — Phase 1 architecture (primary)
2. `engine/engine.yaml` — Pipeline definition
3. `projects/activepieces/project_config.yaml` — Commands, paths

### DFC — Dependency Freshness Check

**MODIFY file: `packages/web/src/app/builder/index.tsx`**
- Actual imports: `@activepieces/shared`, `react`, `builder-hooks`, `data-selector`, `flow-canvas/canvas-controls`, `step-settings-context`, `types`, `chat-drawer`, `show-powered-by`, `resizable-panel`, `piecesHooks`, `platformHooks`, `useElementSize`, `cn`, `builder-header`, `flow-canvas`, `flow-canvas/hooks`, `flow-canvas/utils/consts`, `flow-canvas/widgets/*`, `flow-versions`, `run-list`, `cursor-position-context`, `step-settings`, `resizable-vertical-panels-context`
- Adjacency List deps: `graph-canvas/index.tsx` (via arch doc), `state/flow-state.ts`
- DFC divergence: None (file imports flow-canvas which will be replaced by graph-canvas)
- DFC-discovered: `flow-canvas/hooks.tsx` (provides `useAnimateSidebar`, `useShowBuilderIsSavingWarningBeforeLeaving`, `useSetSocketListener`, `useListenToExistingRun` hooks needed by builder page)

**MODIFY file: `packages/web/src/app/builder/state/flow-state.ts`**
- Actual imports: `@activepieces/shared`, `@tanstack/react-query`, `zustand`, `types`, `flowsApi`, `sampleDataHooks`, `pieceSelectorUtils`, `PromiseQueue`, `BuilderState`, `flowCanvasUtils`
- Adjacency List deps: `state/graph-state.ts`
- DFC divergence: `flowCanvasUtils` import from `flow-canvas/utils/flow-canvas-utils` — this is legacy, will be evaluated for replacement
- DFC-discovered: `flow-canvas/utils/flow-canvas-utils.ts` — used for `determineInitiallySelectedStep()` only in `setVersion()`. Evaluate whether this can remain or needs migration.

### RC-1 — Resource Check
- `builder/index.tsx`: All imported modules resolve. No external resource refs (no file paths, configs, URLs).
- `flow-state.ts`: All imported modules resolve. `flowCanvasUtils.determineInitiallySelectedStep` is the only reference to flow-canvas/utils. This function is simple step selection logic unrelated to the canvas rendering.
- RC-1: No missing resources.

---

## DP-1 — GAPs from Architecture Documents

| # | Source | Section | Gap Description | Affected Files | Severity |
|---|--------|---------|----------------|---------------|----------|
| 1 | ARCHITECTURE.md | Section 3 (MODIFY) | `builder/index.tsx` — "REPLACE FlowCanvas with GraphCanvas in ResizablePanel / KEEP ResizablePanel layout + StepSettingsContainer sidebar" | builder/index.tsx | BLOCKING |
| 2 | ARCHITECTURE.md | Section 3 (MODIFY) | `state/flow-state.ts` — "ADD canvasLayout to flow state + operationListener for graph sync" — graph sync listener already in graph-state.ts | flow-state.ts | NON-BLOCKING |
| 3 | ARCHITECTURE.md | Section 6.5 | GraphState slice already created in P1-D05, but not fully wired: graph state data (nodes/edges) not flowing through builder/index.tsx to GraphCanvas via props | builder/index.tsx | BLOCKING |
| 4 | ARCHITECTURE.md | Section 5 | P1-F01 row says "Wire GraphCanvas into builder (replace FlowCanvas)" with files "builder/index.tsx, flow-state.ts" | both | BLOCKING |

---

## DP-2 — Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | builder/index.tsx | Should render GraphCanvas | Renders FlowCanvas with old flow-canvas hooks | Replace FlowCanvas import with GraphCanvas, wire graph state props |
| 2 | builder/index.tsx | Should use graph-canvas controls | Uses old CanvasControls from flow-canvas | Replace with GraphCanvasControls (already embedded in GraphCanvas component) |
| 3 | flow-state.ts | "ADD operationListener for graph sync" | Operation listener for graph already exists in graph-state.ts (registered in createGraphState) | flow-state.ts needs minimal changes — the graph sync listener is already wired in graph-state.ts. Only evaluate whether flowCanvasUtils dependency should be replaced |
| 4 | GraphCanvas (graph-canvas/index.tsx) | Currently standalone, takes all data as props | Needs to receive data from builder state (graphNodes, graphEdges, handlers) | Wire props in builder/index.tsx from useBuilderStateContext |

---

## DP-3 — OSS References with Licenses

| Library | Version | License | Usage |
|---------|---------|---------|-------|
| @xyflow/react | 12.3.5 | MIT | Graph rendering (existing) |
| @dagrejs/dagre | (existing) | MIT | Auto-layout (added in P1-PRE-02) |
| zustand | 4.5.4 | MIT | State management (existing) |
| react | (existing) | MIT | UI framework (existing) |
| react-resizable-panels | (existing) | MIT | ResizablePanel (existing) |

No new dependencies. No copyleft licenses. No REVIEW-REQUIRED items.

---

## DP-4 — Product Documents

No product documents referenced for P1-F01. This is a pure integration step wiring existing components.

---

## DP-5 — Acceptance Criteria

### AC-1: GraphCanvas renders instead of FlowCanvas in builder
- **Command:** `grep -n "FlowCanvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx" | wc -l`
- **Expected:** 0
- **PASS:** Zero occurrences of FlowCanvas in builder/index.tsx
- **FAIL:** Any occurrence of FlowCanvas in builder/index.tsx

### AC-2: GraphCanvas import present in builder
- **Command:** `grep -n "GraphCanvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** At least 1 match with import or JSX usage
- **PASS:** grep returns matches containing GraphCanvas import and/or JSX usage
- **FAIL:** 0 matches

### AC-3: Graph state (nodes/edges) wired to GraphCanvas via props
- **Command:** `grep -n "graphNodes\|graphEdges\|onGraphNodesChange\|onGraphEdgesChange\|onGraphConnect" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** At least 3 matches (graphNodes, graphEdges, and at least one handler)
- **PASS:** >= 3 matches
- **FAIL:** < 3 matches

### AC-4: Node click handler wires to selectStepByName
- **Command:** `grep -n "selectStepByName\|onNodeClick" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** Both selectStepByName reference and onNodeClick prop present
- **PASS:** >= 2 matches
- **FAIL:** < 2 matches

### AC-5: Auto-layout callback wired to autoLayoutGraph
- **Command:** `grep -n "autoLayoutGraph\|onAutoLayout" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** >= 1 match showing autoLayoutGraph from state wired to GraphCanvas
- **PASS:** >= 1 matches
- **FAIL:** 0 matches

### AC-6: Old flow-canvas hooks preserved (save warning, socket, run listeners)
- **Command:** `grep -n "useShowBuilderIsSavingWarningBeforeLeaving\|useSetSocketListener\|useListenToExistingRun" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** 3 matches (all three hooks preserved)
- **PASS:** = 3 matches
- **FAIL:** < 3 matches

### AC-7: Old CanvasControls removed (GraphCanvasControls embedded in GraphCanvas)
- **Command:** `grep -c "import.*CanvasControls.*from.*flow-canvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** 0 (old import removed; GraphCanvasControls is internal to GraphCanvas)
- **PASS:** 0 matches
- **FAIL:** > 0 matches

### AC-8: Existing unit tests pass
- **Command:** `cd "C:/Users/user/Desktop/Projects/activepieces" && npx vitest run --root packages/shared`
- **Expected:** All tests pass, 0 failed
- **PASS:** Exit code 0, output contains "passed", 0 "failed"
- **FAIL:** Any test fails or exit code != 0

### AC-9: New integration tests for builder-graph wiring
- **Command:** `cd "C:/Users/user/Desktop/Projects/activepieces" && npx vitest run --root packages/shared test/flow/builder-graph-wiring.test.ts`
- **Expected:** All new tests pass, >= 15 tests
- **PASS:** Exit code 0, all passed, count >= 15
- **FAIL:** Any fail or < 15 tests

### AC-10: StepSettingsContainer still functional (selectStepByName preserved)
- **Command:** `grep -n "StepSettingsContainer\|selectStepByName" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** Both present
- **PASS:** >= 2 matches
- **FAIL:** < 2 matches

---

## DP-6 — Test Requirements

### Unit Tests (packages/shared)
- **New file:** `test/flow/builder-graph-wiring.test.ts`
  - Tests for the wiring logic between builder state and GraphCanvas:
    - `buildGraphFromFlowVersion` receives flowVersion from builder state and produces correct nodes/edges
    - Graph state functions (createInitialGraphData, syncGraphFromFlowVersion) work correctly with FlowVersion objects from builder state
    - `onNodeClick` handler correctly extracts step name from node data for `selectStepByName`
    - Auto-layout callback (`autoLayoutGraphNodes`) produces valid positions
    - Graph operation listener correctly rebuilds on structural operations
    - GraphCanvas props type checks: all required props present and correctly typed

### Integration Tests
- Verify that GraphCanvas receives proper prop types from builder state hooks
- Verify that node click → step selection flow works through the chain

### Edge Cases
- Empty flow (trigger only, no actions) renders correctly in GraphCanvas
- Flow with notes renders note nodes
- Flow with loops and routers produces correct node/edge structure
- FlowVersion with canvasLayout=null triggers auto-layout
- FlowVersion with canvasLayout produces stored positions

---

## DP-TEST — Test Extension Plan

| Runtime File | Test File | New Tests |
|---|---|---|
| builder/index.tsx (MODIFY) | test/flow/builder-graph-wiring.test.ts (CREATE) | test_graphCanvas_receives_flowVersion, test_graphNodes_from_state, test_graphEdges_from_state, test_onNodeClick_extracts_stepName, test_autoLayout_callback_wired, test_empty_flow_renders, test_notes_included_in_graph, test_loop_router_flow_graph, test_canvasLayout_null_autoLayout, test_canvasLayout_stored_positions, test_structural_operation_rebuilds_graph, test_nonStructural_operation_no_rebuild, test_selectStepByName_preserved, test_saveWarning_hook_preserved, test_graph_state_init_from_flowVersion |
| flow-state.ts (MODIFY) | test/flow/graph-state-utils.test.ts (existing) | No new tests needed — graph sync listener already tested in P1-D05 |

---

## DP-MIGRATE — Import Chain for MODIFY-files

### builder/index.tsx
- **Consumers:** `routes/flows/id/index.tsx`, `routes/runs/id/index.tsx` — both import `BuilderPage` from `@/app/builder`
- **Impact:** No signature changes. `BuilderPage` component signature unchanged. Only internal rendering changes (FlowCanvas -> GraphCanvas).
- **Required consumer changes:** None. Consumers import `BuilderPage` which is still exported with same name/props.
- **Migration order:** builder/index.tsx only (leaf in the dependency chain for this change).

### flow-state.ts
- **Consumers:** `builder-hooks.ts` (imports createFlowState), `canvas-state.ts` (imports flowCanvasUtils)
- **Impact:** Minimal changes to flow-state.ts (flowCanvasUtils import may remain). No export signature changes.
- **Required consumer changes:** None. createFlowState, FlowState types unchanged.
- **Migration order:** flow-state.ts only.

---

## STOP-RULE

> If real file structure differs from what final_plan describes:
> **STOP immediately.** Record the divergence. Report to Orchestrator.
> Do NOT improvise. Do NOT "adapt" the plan.

Specifically:
1. If `graph-canvas/index.tsx` does not exist or has different props interface than documented — STOP.
2. If `graph-state.ts` does not export `GraphState` type with graphNodes/graphEdges fields — STOP.
3. If `builder-hooks.ts` does not compose `GraphState` into `BuilderState` — STOP.
4. If `flow-canvas/hooks.tsx` does not export `useShowBuilderIsSavingWarningBeforeLeaving`, `useSetSocketListener`, `useListenToExistingRun` — STOP.
