# Draft Plan — P1-D05: Graph State Management (Zustand Slice)

## Step Identity
- **Step:** P1-D05
- **Profile:** standard
- **Description:** Graph state management (Zustand slice) — graph-state.ts, builder-hooks.ts
- **Dependencies:** P1-D04, P1-PRE-02

## DP-1: GAP Analysis

### What needs to be closed:
1. **graph-state.ts does not exist** — Architecture doc (section 3, section 5.5) specifies `packages/web/src/app/builder/state/graph-state.ts` as a NEW file containing the `GraphState` Zustand slice.
2. **builder-hooks.ts not updated** — Must import and compose the new `GraphState` slice into the existing `BuilderState` type union and `createBuilderStore` factory.
3. **Graph-to-flow sync not implemented** — Architecture doc section 6.5 specifies `syncToFlowState()` (graph -> linked-list + update flow) and `syncFromFlowState()` (linked-list -> graph on flow load).
4. **Operation listener not implemented** — Architecture doc section 6.6 specifies that graph state subscribes to flow operations via `operationListeners` (existing pattern in flow-state.ts) to sync linked-list changes back to the graph.
5. **GraphCanvas not yet connected to state** — Currently GraphCanvas takes `flowVersion` as prop and computes graph inline. After P1-D05, it should be wirable to the Zustand store (actual wiring in P1-F01).

### What already exists:
- `buildGraphFromFlowVersion()` in graph-canvas-utils.ts (P1-D04) — converts FlowVersion to nodes+edges
- `linkedListToGraph()` and `graphToLinkedList()` in graph-converter.ts (P1-PRE-02)
- `extractPositions()` in graph-converter.ts — extracts node positions for canvasLayout
- `computeAutoLayout()` in auto-layout.ts (P1-PRE-02)
- `classifyEdges()` in graph-edge-utils.ts (P1-D03)
- `validateConnection()` in connection-validator.ts (P1-D01)
- Existing Zustand state pattern in canvas-state.ts, flow-state.ts, notes-state.tsx
- `operationListeners` pattern already in flow-state.ts
- `FlowOperationType.UPDATE_CANVAS_LAYOUT` operation (P1-PRE-01)

## DP-2: Spec vs Code Discrepancies

1. **Architecture doc section 6.5** specifies `addNodeFromPalette` and `deleteSelectedNodes/Edges` — these involve DnD from palette (P1-E01) and context menus (P1-E02). For P1-D05 scope, we implement the state actions but actual palette drag is out of scope.
2. **Architecture doc section 6.6** lists all FlowOperationType mappings — P1-D05 implements the operation listener that responds to these, but does not implement the UI that triggers them (P1-F01).
3. The existing `CanvasState` in canvas-state.ts handles `selectedStep`, `selectedNodes`, `panningMode` etc. `GraphState` will NOT duplicate these — it manages only the ReactFlow nodes/edges/onNodesChange/onEdgesChange/onConnect + sync functions.

## DP-5: Acceptance Criteria

### AC-1: GraphState type is exported from graph-state.ts
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "GraphState"` → PASS
- **Verification:** Test imports `createGraphState` or `GraphState` from the new module and verifies it is a valid function/type.

### AC-2: createGraphState produces valid initial state from FlowVersion
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "initial state"` → PASS
- **Verification:** Given a FlowVersion, `createGraphState` returns an object with `graphNodes`, `graphEdges`, `onNodesChange`, `onEdgesChange`, `onConnect` functions.

### AC-3: onNodesChange updates node positions (drag)
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "onNodesChange"` → PASS
- **Verification:** Calling `onNodesChange` with a position change event updates node positions in the state.

### AC-4: onConnect creates a new edge with validation
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "onConnect"` → PASS
- **Verification:** Valid connection creates edge; invalid connection (cycle, max edges) is rejected.

### AC-5: syncFromFlowState rebuilds graph from FlowVersion
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "syncFromFlowState"` → PASS
- **Verification:** After calling `syncFromFlowState(flowVersion)`, nodes and edges match the linked-list structure.

### AC-6: syncToFlowState produces valid FlowTrigger + canvasLayout
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state.test.ts -t "syncToFlowState"` → PASS
- **Verification:** Returns `{ trigger, canvasLayout }` from current graph nodes/edges. Round-trip: sync from -> modify -> sync to -> verify linked-list.

### AC-7: GraphState is composed into BuilderState in builder-hooks.ts
- **ESTEP:** Grep check: `grep "GraphState" packages/web/src/app/builder/builder-hooks.ts` → returns match
- **Verification:** `BuilderState` type includes `GraphState` and `createBuilderStore` invokes `createGraphState`.

### AC-8: All existing tests pass (regression)
- **ESTEP:** `npx vitest run --root packages/shared` → all tests pass, 0 failed
- **Verification:** Total passed >= 343 (previous total).

## DP-TEST: Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-state.ts (NEW, packages/shared) | test/flow/graph-state.test.ts (NEW) | ~20 tests: initial state from FlowVersion, onNodesChange position updates, onEdgesChange edge removal, onConnect valid/invalid, syncFromFlowState rebuilds graph, syncToFlowState produces trigger+layout, autoLayout recomputes positions, deleteSelectedNodes removes nodes+edges, deleteSelectedEdges removes edges, addNodeFromPalette adds node at position |

## DP-MIGRATE: MODIFY files with consumers

### MODIFY: builder-hooks.ts
**Path:** `packages/web/src/app/builder/builder-hooks.ts`
**Import Chain:**
- Currently imports: `CanvasState`, `ChatState`, `FlowState`, `NotesState`, `PieceSelectorState`, `RunState`, `StepFormState`
- Will ADD: `GraphState` from `./state/graph-state`
- Consumers of `BuilderState`: all builder components via `useBuilderStateContext()`
- Risk: LOW — additive change only (new slice added to intersection type)

**Changes:**
1. Add import: `import { createGraphState, GraphState } from './state/graph-state';`
2. Add `GraphState` to `BuilderState` type: `& GraphState`
3. Add `createGraphState` call in `createBuilderStore`
4. Spread result into returned state object

## STOP RULE
> If the real file structure of `packages/web/src/app/builder/state/` or `packages/web/src/app/builder/builder-hooks.ts` differs from what this plan describes (e.g., missing imports, different Zustand pattern), STOP and report to Orchestrator. Do NOT improvise.

## Implementation Phases

### Phase A: Create graph-state.ts (pure logic in packages/shared)
Extract the pure graph state logic (nodes/edges management, sync functions) into `packages/shared/src/lib/automation/flows/util/graph-state-utils.ts` — following the established pattern from P1-D01 through P1-D04 of keeping pure logic in shared for testability.

Functions to implement:
- `createInitialGraphState(flowVersion: FlowVersion)` — builds initial nodes+edges
- `applyNodesChange(nodes, changes)` — applies ReactFlow NodeChange array
- `applyEdgesChange(edges, changes)` — applies ReactFlow EdgeChange array
- `applyConnect(nodes, edges, connection)` — validates and adds new edge
- `syncFromFlowVersion(flowVersion)` — rebuilds from FlowVersion
- `syncToFlowVersion(nodes, edges)` — produces trigger + canvasLayout
- `autoLayoutNodes(nodes, edges)` — recomputes Dagre positions
- `removeNodes(nodes, edges, nodeIds)` — removes nodes and connected edges
- `removeEdges(edges, edgeIds)` — removes edges by id
- `addGraphNode(nodes, step, position)` — adds a new node

### Phase B: Create graph-state.ts (Zustand slice in packages/web)
Create `packages/web/src/app/builder/state/graph-state.ts` that wraps the shared utilities into a Zustand slice following the existing pattern (canvas-state.ts, flow-state.ts).

### Phase C: Wire into builder-hooks.ts
Add `GraphState` to the `BuilderState` type union and `createBuilderStore` factory.

### Phase D: Write tests
Create `packages/shared/test/flow/graph-state.test.ts` testing the pure shared utilities.
