# Final Plan -- P1-D04

**Step:** P1-D04
**Profile:** full
**Date:** 2026-03-27
**Description:** GraphCanvas main component -- ReactFlow with free positioning + edges

---

## Files to Create

### 1. packages/shared/src/lib/automation/flows/util/graph-canvas-utils.ts (CREATE)
Pure-logic utility for graph canvas configuration. No React imports.

Functions:
- `createNodeTypesConfig()` -- returns `{ trigger: 'trigger', action: 'action', loop: 'loop', router: 'router' }` mapping node type IDs used by graph-converter.ts `stepTypeToNodeType()` to ReactFlow nodeTypes registry keys
- `createEdgeTypesConfig()` -- returns `{ default: GRAPH_EDGE_TYPES.DEFAULT, loop: GRAPH_EDGE_TYPES.LOOP, branch: GRAPH_EDGE_TYPES.BRANCH }` mapping edge type keys to values from graph-edge-utils.ts
- `buildGraphFromFlowVersion(flowVersion: FlowVersion)` -- orchestrates: linkedListToGraph -> classifyEdges -> computeAutoLayout (when canvasLayout is null). Returns `{ nodes, edges }` ready for ReactFlow.
- `createIsValidConnection(nodes: GraphNode[], edges: GraphEdge[])` -- returns a callback `(connection: {source, target, sourceHandle, targetHandle}) => boolean` that delegates to validateConnection from connection-validator.ts

Imports:
- `FlowVersion` from `../flow-version`
- `linkedListToGraph, GraphNode, GraphEdge, GraphConversionResult` from `./graph-converter`
- `classifyEdges` from `./graph-edge-utils`
- `computeAutoLayout` from `./auto-layout`
- `validateConnection` from `./connection-validator`
- `GRAPH_EDGE_TYPES` from `./graph-edge-utils`

### 2. packages/web/src/app/builder/graph-canvas/graph-canvas-provider.tsx (CREATE)
React context provider that registers nodeTypes and edgeTypes for ReactFlow.

Provides:
- `nodeTypes`: maps 'trigger' -> GraphTriggerNode, 'action'/'loop'/'router' -> GraphStepNode
- `edgeTypes`: maps GRAPH_EDGE_TYPES.DEFAULT -> GraphEdge, GRAPH_EDGE_TYPES.LOOP -> GraphLoopEdge, GRAPH_EDGE_TYPES.BRANCH -> GraphBranchEdge
- Wraps children in ReactFlowProvider

Imports:
- react (createContext, useContext, useMemo, ReactNode)
- @xyflow/react (ReactFlowProvider)
- GraphStepNode from ./nodes/graph-step-node
- GraphTriggerNode from ./nodes/graph-trigger-node
- GraphEdge from ./edges/graph-edge
- GraphLoopEdge from ./edges/graph-loop-edge
- GraphBranchEdge from ./edges/graph-branch-edge
- GRAPH_EDGE_TYPES from @activepieces/shared

### 3. packages/web/src/app/builder/graph-canvas/index.tsx (CREATE)
Main GraphCanvas component. Standalone, receives data via props.

**Constraint:** Does NOT import from builder-hooks.ts or state/ directory. All data via props.

Props:
- `flowVersion: FlowVersion` -- the flow to render
- `onNodesChange?: OnNodesChange` -- node position change callback
- `onEdgesChange?: OnEdgesChange` -- edge change callback
- `onConnect?: OnConnect` -- new connection callback
- `onNodeClick?: (event, node) => void` -- node click handler

Behavior:
- Calls `buildGraphFromFlowVersion(flowVersion)` to convert linked-list to graph
- Passes `createIsValidConnection(nodes, edges)` to ReactFlow's `isValidConnection`
- Sets `nodesDraggable={true}`, `nodesConnectable={true}` (free canvas mode)
- Renders Background with dots pattern
- Uses nodeTypes and edgeTypes from GraphCanvasProvider

### 4. packages/shared/test/flow/graph-canvas-utils.test.ts (CREATE)
Unit tests for graph-canvas-utils.ts pure logic.

Tests:
- createNodeTypesConfig returns correct 4 keys (trigger, action, loop, router)
- createEdgeTypesConfig returns correct 3 keys (default, loop, branch)
- buildGraphFromFlowVersion converts flow with trigger+action to nodes+edges
- buildGraphFromFlowVersion applies auto-layout when canvasLayout is null
- buildGraphFromFlowVersion uses stored positions when canvasLayout exists
- buildGraphFromFlowVersion classifies edges correctly (default, loop, branch)
- createIsValidConnection rejects self-connections
- createIsValidConnection rejects cycles
- createIsValidConnection accepts valid connections
- createIsValidConnection rejects trigger as target

### 5. packages/shared/src/index.ts (MODIFY)
Add export: `export * from './lib/automation/flows/util/graph-canvas-utils'`

---

## Acceptance Criteria (Revised)

### AC-1: createNodeTypesConfig returns keys matching graph-converter node types
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas-utils.test.ts -t "createNodeTypesConfig"`
- **Expected:** Test passes, nodeTypes keys = {trigger, action, loop, router}
- **PASS:** Test passes
- **FAIL:** Test fails

### AC-2: createEdgeTypesConfig returns keys matching GRAPH_EDGE_TYPES
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas-utils.test.ts -t "createEdgeTypesConfig"`
- **Expected:** Test passes, edgeTypes keys = {default, loop, branch}
- **PASS:** Test passes
- **FAIL:** Test fails

### AC-3: buildGraphFromFlowVersion converts FlowVersion to nodes+edges
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas-utils.test.ts -t "buildGraphFromFlowVersion"`
- **Expected:** Tests pass for trigger+action, loop, router flows
- **PASS:** All tests pass
- **FAIL:** Any test fails

### AC-4: buildGraphFromFlowVersion applies auto-layout when canvasLayout is null
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas-utils.test.ts -t "auto-layout"`
- **Expected:** Nodes have non-zero positions when canvasLayout is null
- **PASS:** Test passes
- **FAIL:** Test fails

### AC-5: createIsValidConnection wraps validateConnection correctly
- **Command:** `npx vitest run --root packages/shared test/flow/graph-canvas-utils.test.ts -t "createIsValidConnection"`
- **Expected:** Valid connections return true, invalid return false
- **PASS:** All tests pass
- **FAIL:** Any test fails

### AC-6: All existing tests continue to pass (regression)
- **Command:** `npx vitest run --root packages/shared`
- **Expected:** >= 317 passed, 0 failed
- **PASS:** All tests pass
- **FAIL:** Any existing test fails

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-canvas-utils.ts | test/flow/graph-canvas-utils.test.ts (NEW) | createNodeTypesConfig keys, createEdgeTypesConfig keys, buildGraphFromFlowVersion (3 flow types), auto-layout applied, canvasLayout positions used, classifyEdges integration, createIsValidConnection (4 scenarios) |

---

## DP-MIGRATE

### packages/shared/src/index.ts (MODIFY)
- **Change:** Add `export * from './lib/automation/flows/util/graph-canvas-utils'`
- **Consumers:** graph-canvas/index.tsx, graph-canvas-provider.tsx (both NEW in this step, no existing consumer impact)
- **Migration order:** 1) Create graph-canvas-utils.ts, 2) Add export to index.ts, 3) Create React components

---

## STOP-RULE

> If real file structure differs from what this plan describes, STOP immediately.
> Record the divergence. Report to Orchestrator. Do NOT improvise.

---

## Execution Order

1. Create `graph-canvas-utils.ts` (shared utility, pure logic)
2. Add export to `packages/shared/src/index.ts`
3. Create `graph-canvas-utils.test.ts` (tests for pure logic)
4. Run tests: verify graph-canvas-utils passes
5. Create `graph-canvas-provider.tsx` (React provider)
6. Create `graph-canvas/index.tsx` (React component)
7. Run full test suite: verify >= 317 + new tests pass, 0 failed
