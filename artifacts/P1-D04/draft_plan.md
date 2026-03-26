# Draft Plan — P1-D04

**Step:** P1-D04
**Profile:** full
**Date:** 2026-03-27
**Description:** GraphCanvas main component -- ReactFlow with free positioning + edges

---

## Phase 0 — Document Collection

### Loaded Documents
- architecture/ARCHITECTURE.md -- Primary architecture doc
- STEP_REGISTRY.md -- Previous steps verified (P1-D03 done, 317 tests passing)
- REGRESSION_REGISTRY.md -- 5 REG entries (REG-001..REG-005)

### DFC — Dependency Freshness Check

**CREATE file: graph-canvas/index.tsx**
Planned imports:
- `@xyflow/react` (ReactFlow, Background, BackgroundVariant, SelectionMode) -- exists in node_modules
- `@activepieces/shared` (linkedListToGraph, classifyEdges, computeAutoLayout, validateConnection, GRAPH_EDGE_TYPES) -- exported from shared/index.ts
- `./graph-canvas-provider` (GraphCanvasProvider, useGraphCanvasContext) -- NEW, created in this step
- `../graph-canvas/nodes/graph-step-node` -- exists (P1-D02)
- `../graph-canvas/nodes/graph-trigger-node` -- exists (P1-D02)
- `../graph-canvas/edges/graph-edge` -- exists (P1-D03)
- `../graph-canvas/edges/graph-loop-edge` -- exists (P1-D03)
- `../graph-canvas/edges/graph-branch-edge` -- exists (P1-D03)

DFC divergence: NONE. All dependencies exist or are created in this step.

**CREATE file: graph-canvas/graph-canvas-provider.tsx**
Planned imports:
- `react` (createContext, useContext, useMemo) -- exists
- `@activepieces/shared` (GRAPH_EDGE_TYPES) -- exported from shared/index.ts
- `./nodes/graph-step-node` (GraphStepNode) -- exists (P1-D02)
- `./nodes/graph-trigger-node` (GraphTriggerNode) -- exists (P1-D02)
- `./edges/graph-edge` (GraphEdge) -- exists (P1-D03)
- `./edges/graph-loop-edge` (GraphLoopEdge) -- exists (P1-D03)
- `./edges/graph-branch-edge` (GraphBranchEdge) -- exists (P1-D03)

DFC divergence: NONE.

### RC-1 — Resource Check
No runtime resources (fetch, readFile, etc.) used in CREATE files. RC-1: CLEAN.

---

## DP-1 — GAPs from Architecture Documents

| # | Source | Section | Gap Description | Affected Files | Severity |
|---|--------|---------|----------------|----------------|----------|
| 1 | ARCHITECTURE.md | 3 File Structure | `graph-canvas/index.tsx` not yet created | graph-canvas/index.tsx | BLOCKING |
| 2 | ARCHITECTURE.md | 3 File Structure | `graph-canvas-provider.tsx` not yet created | graph-canvas-provider.tsx | BLOCKING |
| 3 | ARCHITECTURE.md | 6.2 Connection Rules | Connection validation during handle-to-handle drag not yet wired to ReactFlow `isValidConnection` | graph-canvas/index.tsx | BLOCKING |
| 4 | ARCHITECTURE.md | 6.3 Handle Layout | nodeTypes registry with trigger/action/loop/router mappings not yet defined | graph-canvas-provider.tsx | BLOCKING |
| 5 | ARCHITECTURE.md | 5 Step Decomposition | P1-D04 row: "ReactFlow with free positioning + edges" -- nodes must be draggable, edges must be visible | graph-canvas/index.tsx | BLOCKING |

---

## DP-2 — Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | graph-canvas/index.tsx | Architecture 3: "Main GraphCanvas component with ReactFlow" | File does not exist yet | CREATE per spec |
| 2 | graph-canvas-provider.tsx | Architecture 3: "Context: nodeTypes, edgeTypes, connection rules" | File does not exist yet | CREATE per spec |
| 3 | existing flow-canvas/index.tsx | Architecture: deprecate behind feature flag | Current builder uses FlowCanvas with `nodesDraggable={false}`, `nodesConnectable={false}` | No change in P1-D04 -- wiring to builder deferred to P1-F01 |

---

## DP-3 — OSS References with Licenses

| Library | Version | License | Usage |
|---------|---------|---------|-------|
| @xyflow/react | 12.3.5 | MIT | ReactFlow graph rendering, Background, edge rendering |
| @dagrejs/dagre | (added in P1-PRE-02) | MIT | Auto-layout for initial node positioning |
| react | existing | MIT | React components, context |
| zustand | 4.5.4 | MIT | State management (future P1-D05, not yet used in D04) |

No copyleft licenses. REVIEW-REQUIRED: NONE.

---

## DP-4 — Product Documents

No product documents defined in project_config.yaml (`product_docs: []`). Section is empty per configuration.

---

## DP-5 — Acceptance Criteria

### AC-1: GraphCanvas component renders ReactFlow with Background
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts`
- **Expected:** Tests for GraphCanvas provider and nodeTypes/edgeTypes configuration pass
- **PASS:** All tests pass, 0 failed
- **FAIL:** Any test fails

### AC-2: nodeTypes registry maps 'trigger' to GraphTriggerNode and 'action'/'loop'/'router' to GraphStepNode
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts -t "nodeTypes"`
- **Expected:** nodeTypes contains exactly trigger, action, loop, router keys
- **PASS:** Test verifying nodeTypes keys passes
- **FAIL:** Missing or incorrect nodeTypes mapping

### AC-3: edgeTypes registry maps GRAPH_EDGE_TYPES constants to edge components
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts -t "edgeTypes"`
- **Expected:** edgeTypes contains exactly default, loop, branch keys
- **PASS:** Test verifying edgeTypes keys passes
- **FAIL:** Missing or incorrect edgeTypes mapping

### AC-4: GraphCanvasProvider supplies nodeTypes and edgeTypes via context
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts -t "context"`
- **Expected:** Context provides nodeTypes and edgeTypes to children
- **PASS:** Test passes
- **FAIL:** Context not available

### AC-5: Connection validation is integrated via isValidConnection callback
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts -t "isValidConnection"`
- **Expected:** Tests pass for valid/invalid connections
- **PASS:** All connection validation tests pass
- **FAIL:** Any connection validation test fails

### AC-6: Nodes are draggable (nodesDraggable={true})
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas.test.ts -t "draggable"`
- **Expected:** GraphCanvas sets nodesDraggable=true
- **PASS:** Test confirms draggable configuration
- **FAIL:** nodesDraggable not set correctly

### AC-7: All existing tests continue to pass (regression)
- **Command:** `npx vitest run --root packages/shared`
- **Expected:** >= 317 passed, 0 failed
- **PASS:** All tests pass
- **FAIL:** Any existing test fails

---

## DP-6 — Test Requirements

| File | Test Level | Test File | Edge Cases |
|------|-----------|-----------|------------|
| graph-canvas-provider.tsx | unit | test/flow/graph-canvas.test.ts (NEW) | nodeTypes keys, edgeTypes keys, context values |
| graph-canvas/index.tsx | unit | test/flow/graph-canvas.test.ts (NEW) | GraphCanvas props configuration, isValidConnection logic, initial node conversion |

New test file: `packages/shared/test/flow/graph-canvas.test.ts`
- Pure logic tests for the configuration functions (nodeTypes map, edgeTypes map, isValidConnection wrapper)
- React component rendering tests would require jsdom (deferred to integration tests in P1-F01)
- Focus on testable pure logic: configuration objects and validation wiring

---

## DP-TEST — Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-canvas-provider.tsx | test/flow/graph-canvas.test.ts (NEW) | test_createNodeTypes_returns_correct_keys, test_createEdgeTypes_returns_correct_keys, test_nodeTypes_maps_trigger_to_component, test_nodeTypes_maps_action_loop_router |
| graph-canvas/index.tsx | test/flow/graph-canvas.test.ts (NEW) | test_buildGraphFromFlowVersion_returns_nodes_and_edges, test_isValidConnection_delegates_to_validateConnection, test_isValidConnection_rejects_invalid, test_classifyEdges_integration, test_auto_layout_applied_when_no_canvasLayout |

Strategy: Extract pure-logic functions from provider/component (createNodeTypes, createEdgeTypes, buildGraphFromFlowVersion, isValidConnectionCallback) into shared utility `graph-canvas-utils.ts` to enable unit testing without React/DOM, following the same pattern as P1-D02 (graph-node-handles.ts) and P1-D03 (graph-edge-utils.ts).

---

## DP-MIGRATE — Import Chain for MODIFY-files

No MODIFY files in this step. All files are CREATE:
- `packages/web/src/app/builder/graph-canvas/index.tsx` (CREATE)
- `packages/web/src/app/builder/graph-canvas/graph-canvas-provider.tsx` (CREATE)

No existing consumers to update.

**Note on shared utility extraction:**
A new shared utility file `graph-canvas-utils.ts` will be created in `packages/shared/src/lib/automation/flows/util/` to extract testable pure logic (createNodeTypes config, createEdgeTypes config, buildGraphFromFlowVersion function). This follows the pattern established in P1-D02 and P1-D03.

Consumers: graph-canvas/index.tsx and graph-canvas-provider.tsx will import from `@activepieces/shared`.
Export: Added to `packages/shared/src/index.ts`.

---

## STOP-RULE

> If real file structure differs from what this plan describes, STOP immediately.
> Record the divergence. Report to Orchestrator. Do NOT improvise.
