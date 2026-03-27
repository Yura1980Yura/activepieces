# Draft Plan -- P1-F03

**Step:** P1-F03
**Profile:** standard
**Date:** 2026-03-27
**Description:** Migration: auto-layout for existing flows (null positions)

---

## Phase 0 -- Document Collection

### Loaded Documents
- engine.yaml
- project_config.yaml
- ARCHITECTURE.md (primary)
- STEP_REGISTRY.md, CHANGELOG.md, REGRESSION_REGISTRY.md, TECH_DEBT.md

### DFC -- Dependency Freshness Check

**MODIFY-file: graph-converter.ts**
Declared deps (Adjacency List):
- FlowAction, FlowActionType, LoopOnItemsAction, RouterAction
- FlowVersion
- FlowTrigger, FlowTriggerType
- flowStructureUtil, Step

Actual imports (from file):
- FlowAction, FlowActionType, LoopOnItemsAction, RouterAction (from ../actions/action)
- FlowVersion (from ../flow-version)
- FlowTrigger, FlowTriggerType (from ../triggers/trigger)
- flowStructureUtil, Step (from ./flow-structure-util)

DFC divergence: NONE. All actual imports match declared dependencies.

**MODIFY-file: graph-canvas-utils.ts**
Declared deps: FlowVersion, computeAutoLayout, validateConnection, classifyEdges, GRAPH_EDGE_TYPES, linkedListToGraph, GraphNode, GraphEdge, notesToGraphNodes, NOTE_NODE_TYPE.
Actual imports match. DFC divergence: NONE.

**MODIFY-file: graph-state-utils.ts**
Declared deps: FlowActionType, CanvasLayout, FlowVersion, FlowTrigger, computeAutoLayout, validateConnection, ConnectionParams, GraphNode, GraphEdge, linkedListToGraph, graphToLinkedList, extractPositions, classifyEdges, GraphEdgeType, flowStructureUtil, Step.
Actual imports match. DFC divergence: NONE.

### RC-1 -- Resource Check
No runtime resource references (fetch, readFile, writeFile, open) found in MODIFY-files. RC-1: no missing resources.

---

## DP-1 -- GAPs from Architecture Documents

| # | Source | Section | Gap Description | Affected Files | Severity |
|---|--------|---------|-----------------|---------------|----------|
| 1 | ARCHITECTURE.md 7.1 | Migration Strategy | "On first open in graph editor -> auto-layout computes positions -> saved to canvasLayout on first edit" -- the auto-layout is computed on load but not persisted unless user edits. Need to ensure that when canvasLayout is null, the auto-computed layout triggers UPDATE_CANVAS_LAYOUT to persist positions. | graph-canvas-utils.ts, graph-state-utils.ts | BLOCKING |
| 2 | ARCHITECTURE.md 6.1 | On Load (4) | "If canvasLayout exists -> apply stored positions" -- partial canvasLayout (positions missing for some nodes) not handled. New nodes added after canvasLayout was saved get {0,0} position. | graph-converter.ts | BLOCKING |
| 3 | ARCHITECTURE.md 7.4 | Backward compatibility | "if canvasLayout is stripped (e.g., API consumer doesn't send it) -> auto-layout regenerates" -- this path exists in buildGraphFromFlowVersion but needs explicit test coverage. | graph-canvas-utils.ts | NON-BLOCKING |

---

## DP-2 -- Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | graph-converter.ts linkedListToGraph() | Apply stored positions when canvasLayout exists; auto-layout applied separately when null | Applies stored positions correctly when canvasLayout.positions exists. Returns {0,0} for nodes missing from positions. No handling of partial canvasLayout. | Add: compute auto-layout positions for nodes missing from canvasLayout.positions (partial migration) |
| 2 | graph-canvas-utils.ts buildGraphFromFlowVersion() | "When canvasLayout is null -> auto-layout computes initial positions" + "saved to canvasLayout on first edit" (Architecture 7.1) | Computes auto-layout when canvasLayout is null. Returns a `shouldPersistLayout` flag: NO (missing). Graph state must trigger persistence. | Add: return `shouldPersistLayout: true` flag when auto-layout was computed, to enable caller to dispatch UPDATE_CANVAS_LAYOUT |
| 3 | graph-state-utils.ts createInitialGraphData() | Same as above | Same gap as #2 | Add: return `shouldPersistLayout` flag |

---

## DP-5 -- Acceptance Criteria

### AC-1: Partial canvasLayout fills missing node positions via auto-layout
When a FlowVersion has canvasLayout with positions for SOME nodes but not all, the missing nodes should receive Dagre-computed positions instead of {x:0, y:0}.

**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** All tests pass, 0 failed
**PASS:** Exit code 0, output contains "passed", 0 "FAILED"
**FAIL:** Exit code != 0 OR output contains "FAILED"

### AC-2: Null canvasLayout triggers auto-layout and signals persistence
When a FlowVersion has canvasLayout=null, buildGraphFromFlowVersion and createInitialGraphData should compute Dagre layout AND signal that the layout should be persisted (shouldPersistLayout=true).

**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** All tests pass
**PASS:** Exit code 0, tests verify shouldPersistLayout=true for null canvasLayout
**FAIL:** Exit code != 0 OR output contains "FAILED"

### AC-3: Existing canvasLayout with all positions does NOT trigger persistence signal
When a FlowVersion has a complete canvasLayout, shouldPersistLayout should be false (no unnecessary writes).

**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** All tests pass
**PASS:** Exit code 0, tests verify shouldPersistLayout=false for complete canvasLayout
**FAIL:** Exit code != 0 OR output contains "FAILED"

### AC-4: Migration handles all flow patterns (linear, loop, router, nested, trigger-only)
Auto-layout migration produces valid non-overlapping positions for all standard flow patterns.

**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** All tests pass covering trigger-only, linear chain, loop, router, and nested flows
**PASS:** Exit code 0, output contains "passed", 0 "FAILED"
**FAIL:** Exit code != 0 OR output contains "FAILED"

### AC-5: Empty positions record treated as needing auto-layout
When canvasLayout exists but positions is an empty object {}, auto-layout should be computed for all nodes.

**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** All tests pass
**PASS:** Exit code 0
**FAIL:** Exit code != 0 OR output contains "FAILED"

### AC-6: Existing tests still pass (no regression)
All existing tests in packages/shared continue to pass after the migration changes.

**Command:** `npx vitest run packages/shared/test/flow/`
**Expected:** All previously passing tests still pass (487+ tests)
**PASS:** Exit code 0, 0 "FAILED"
**FAIL:** Exit code != 0 OR output contains "FAILED"

---

## DP-TEST -- Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-converter.ts | test/flow/migration-auto-layout.test.ts (NEW) | test_partial_canvasLayout_fills_missing_positions, test_partial_canvasLayout_preserves_existing_positions, test_partial_canvasLayout_with_loop_nodes, test_partial_canvasLayout_with_router_nodes |
| graph-canvas-utils.ts | test/flow/migration-auto-layout.test.ts (NEW) | test_buildGraph_null_layout_shouldPersist_true, test_buildGraph_complete_layout_shouldPersist_false, test_buildGraph_partial_layout_shouldPersist_true, test_buildGraph_empty_positions_shouldPersist_true |
| graph-state-utils.ts | test/flow/migration-auto-layout.test.ts (NEW) | test_createInitialGraphData_null_layout_shouldPersist_true, test_createInitialGraphData_complete_layout_shouldPersist_false, test_syncGraphFromFlowVersion_null_layout_shouldPersist_true, test_createInitialGraphData_all_patterns |

---

## DP-MIGRATE -- Import Chain for MODIFY-files

### graph-converter.ts
Consumers (files that import from graph-converter.ts):
- graph-canvas-utils.ts (imports: linkedListToGraph, GraphNode, GraphEdge)
- graph-state-utils.ts (imports: GraphNode, GraphEdge, linkedListToGraph, graphToLinkedList, extractPositions)
- connection-validator.ts (imports: GraphNode, GraphEdge)
- graph-edge-utils.ts (imports: GraphEdge)
- graph-note-node-utils.ts (imports: GraphNode)
- index.ts (re-exports all)

Impact: linkedListToGraph signature unchanged. Adding a new exported function `migrateCanvasLayout()` is additive -- no consumer breakage. No migration needed.

### graph-canvas-utils.ts
Consumers:
- graph-state-utils.ts (imports: ConnectionParams)
- index.ts (re-exports all)
- Various web components (import from @activepieces/shared)

Impact: Changing return type of buildGraphFromFlowVersion() from `GraphCanvasData` to `GraphCanvasDataWithMigration` (adding `shouldPersistLayout` boolean field). This is additive -- existing consumers that destructure `{nodes, edges}` will not break. New field simply ignored if not used.

### graph-state-utils.ts
Consumers:
- graph-state.ts (Zustand slice in packages/web)
- index.ts (re-exports all)

Impact: Changing return type of `createInitialGraphData()` and `syncGraphFromFlowVersion()` to include `shouldPersistLayout` boolean. Additive change. Zustand slice can optionally use the flag. No migration needed.

---

## STOP RULE
If real file structure differs from what this plan describes, STOP immediately and report to Orchestrator. Do NOT improvise.
