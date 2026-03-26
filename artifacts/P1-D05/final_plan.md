# Final Plan — P1-D05: Graph State Management (Zustand Slice)

## Step Identity
- **Step:** P1-D05
- **Profile:** standard
- **Description:** Graph state management — pure graph state utilities in shared + Zustand slice in web + builder-hooks integration
- **Dependencies:** P1-D04, P1-PRE-02

## STOP RULE
> If the real file structure of `packages/web/src/app/builder/state/` or `packages/web/src/app/builder/builder-hooks.ts` differs from what this plan describes, STOP and report. Do NOT improvise.

## Files

### CREATE files:
1. `packages/shared/src/lib/automation/flows/util/graph-state-utils.ts` — pure graph state manipulation functions (no ReactFlow dependency)
2. `packages/web/src/app/builder/state/graph-state.ts` — Zustand slice wrapping shared utils + ReactFlow change handlers
3. `packages/shared/test/flow/graph-state-utils.test.ts` — tests for shared utils

### MODIFY files:
1. `packages/web/src/app/builder/builder-hooks.ts` — add GraphState to BuilderState type + createBuilderStore
2. `packages/shared/src/index.ts` — add export for graph-state-utils

## Phase 0: Read files

1. `packages/shared/src/lib/automation/flows/util/graph-converter.ts` — linkedListToGraph, graphToLinkedList, extractPositions, GraphNode, GraphEdge types
2. `packages/shared/src/lib/automation/flows/util/graph-canvas-utils.ts` — buildGraphFromFlowVersion, createIsValidConnection
3. `packages/shared/src/lib/automation/flows/util/auto-layout.ts` — computeAutoLayout
4. `packages/shared/src/lib/automation/flows/util/connection-validator.ts` — validateConnection
5. `packages/shared/src/lib/automation/flows/util/graph-edge-utils.ts` — classifyEdges
6. `packages/web/src/app/builder/builder-hooks.ts` — current BuilderState composition
7. `packages/web/src/app/builder/state/flow-state.ts` — operationListeners pattern
8. `packages/web/src/app/builder/state/canvas-state.ts` — Zustand slice pattern

## Phase A: Create graph-state-utils.ts (packages/shared)

**Path:** `packages/shared/src/lib/automation/flows/util/graph-state-utils.ts`

This module provides pure functions for graph state operations. NO ReactFlow imports.
Uses types from graph-converter.ts (GraphNode, GraphEdge) which are ReactFlow-compatible but defined locally.

### Functions:

```typescript
import { FlowVersion } from '../flow-version'
import { GraphNode, GraphEdge, linkedListToGraph, graphToLinkedList, extractPositions, GraphConversionResult } from './graph-converter'
import { computeAutoLayout } from './auto-layout'
import { classifyEdges } from './graph-edge-utils'
import { validateConnection } from './connection-validator'
import { ConnectionParams } from './graph-canvas-utils'

/**
 * Create initial graph data from a FlowVersion.
 * Converts linked-list to graph, classifies edges, auto-layouts if needed.
 */
export function createInitialGraphData(flowVersion: FlowVersion): {
    nodes: GraphNode[]
    edges: Array<GraphEdge & { type: string }>
}

/**
 * Rebuild graph data from a FlowVersion (used when flow state changes externally).
 * Alias for createInitialGraphData (same logic, semantic distinction).
 */
export function syncGraphFromFlowVersion(flowVersion: FlowVersion): {
    nodes: GraphNode[]
    edges: Array<GraphEdge & { type: string }>
}

/**
 * Convert current graph state back to FlowTrigger + CanvasLayout.
 * Used to persist graph changes to the flow state.
 */
export function syncGraphToFlowVersion(nodes: GraphNode[], edges: GraphEdge[]): {
    trigger: FlowTrigger
    canvasLayout: CanvasLayout
}

/**
 * Recompute auto-layout positions for all nodes using Dagre.
 */
export function autoLayoutGraphNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[]

/**
 * Remove nodes by ID and all edges connected to them.
 * Relinks: if deleted node had incoming edge from A and outgoing to B, create A->B edge.
 */
export function removeGraphNodes(
    nodes: GraphNode[],
    edges: GraphEdge[],
    nodeIds: string[],
): { nodes: GraphNode[], edges: GraphEdge[] }

/**
 * Remove edges by ID.
 */
export function removeGraphEdges(edges: GraphEdge[], edgeIds: string[]): GraphEdge[]

/**
 * Add a new graph node from a Step at a given position.
 */
export function addGraphNode(
    nodes: GraphNode[],
    step: Step,
    position: { x: number; y: number },
): GraphNode[]

/**
 * Validate and apply a connection (new edge).
 * Returns null if connection is invalid.
 */
export function applyGraphConnect(
    nodes: GraphNode[],
    edges: GraphEdge[],
    connection: ConnectionParams,
): GraphEdge[] | null
```

## Phase B: Create graph-state.ts (Zustand slice in packages/web)

**Path:** `packages/web/src/app/builder/state/graph-state.ts`

Follows the pattern of `canvas-state.ts` and `flow-state.ts`:
- Receives `(initialState, get, set)` from `createBuilderStore`
- Wraps shared utilities with ReactFlow-specific change handlers
- Registers an operation listener for structural flow operations

```typescript
import { FlowVersion, FlowOperationRequest, FlowOperationType } from '@activepieces/shared'
import { OnNodesChange, OnEdgesChange, OnConnect, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { StoreApi } from 'zustand'
import { BuilderState } from '../builder-hooks'
import {
    createInitialGraphData,
    syncGraphFromFlowVersion,
    syncGraphToFlowVersion,
    autoLayoutGraphNodes,
    removeGraphNodes,
    removeGraphEdges,
    applyGraphConnect,
} from '@activepieces/shared'

export type GraphState = {
    graphNodes: ApGraphNode[]
    graphEdges: ApGraphEdge[]
    onGraphNodesChange: OnNodesChange
    onGraphEdgesChange: OnEdgesChange
    onGraphConnect: OnConnect
    syncGraphFromFlow: () => void
    syncGraphToFlow: () => void
    autoLayoutGraph: () => void
    deleteSelectedGraphNodes: () => void
    deleteSelectedGraphEdges: () => void
}
```

### Operation listener:
The Zustand slice registers a listener on flowState.operationListeners for structural operations:
- `ADD_ACTION`, `DELETE_ACTION`, `MOVE_ACTION`
- `ADD_BRANCH`, `DELETE_BRANCH`, `MOVE_BRANCH`
- `DUPLICATE_ACTION`, `DUPLICATE_BRANCH`
- `IMPORT_FLOW`, `UPDATE_TRIGGER`
- `SET_SKIP_ACTION` (may reorder)

On these operations, call `syncGraphFromFlowVersion(newFlowVersion)` to rebuild the graph.

Non-structural operations (`UPDATE_ACTION`, `UPDATE_NOTE`, `SAVE_SAMPLE_DATA`, `UPDATE_CANVAS_LAYOUT`, `UPDATE_METADATA`, etc.) do NOT trigger graph rebuild.

## Phase C: Wire into builder-hooks.ts

**Changes to `packages/web/src/app/builder/builder-hooks.ts`:**

1. Add import:
```typescript
import { createGraphState, GraphState } from './state/graph-state';
```

2. Add to `BuilderState` type:
```typescript
export type BuilderState = FlowState &
  PieceSelectorState &
  RunState &
  ChatState &
  CanvasState &
  StepFormState &
  NotesState &
  GraphState;  // ADD
```

3. Add to `createBuilderStore`:
```typescript
const graphState = createGraphState(initialState, get, set);
return {
  ...flowState,
  ...notesState,
  ...runState,
  ...pieceSelectorState,
  ...chatState,
  ...canvasState,
  ...stepFormState,
  ...graphState,  // ADD
};
```

## Phase D: Export from shared index.ts

**Add to `packages/shared/src/index.ts`:**
```typescript
export * from './lib/automation/flows/util/graph-state-utils'
```

## Phase E: Write tests

**Path:** `packages/shared/test/flow/graph-state-utils.test.ts`

Tests for pure shared utility functions:

| # | Test | Verifies |
|---|------|----------|
| 1 | createInitialGraphData returns nodes and edges for simple flow | AC-2 |
| 2 | createInitialGraphData applies auto-layout when no canvasLayout | AC-2 |
| 3 | createInitialGraphData uses stored positions when canvasLayout exists | AC-2 |
| 4 | createInitialGraphData classifies edges correctly | AC-2 |
| 5 | syncGraphFromFlowVersion returns same result as createInitialGraphData | AC-5 |
| 6 | syncGraphToFlowVersion produces valid trigger with nextAction chain | AC-6 |
| 7 | syncGraphToFlowVersion produces canvasLayout with positions | AC-6 |
| 8 | syncGraphToFlowVersion round-trip: from -> to -> from matches | AC-6 |
| 9 | autoLayoutGraphNodes repositions all nodes via Dagre | AC-3 (partial) |
| 10 | removeGraphNodes removes node and connected edges | deleteSelectedNodes |
| 11 | removeGraphNodes relinks edges (A->B->C, remove B => A->C) | deleteSelectedNodes |
| 12 | removeGraphEdges removes edges by id | deleteSelectedEdges |
| 13 | addGraphNode adds node at specified position | addNodeFromPalette |
| 14 | addGraphNode preserves existing nodes | addNodeFromPalette |
| 15 | applyGraphConnect validates and adds edge | AC-4 |
| 16 | applyGraphConnect rejects cycle | AC-4 |
| 17 | applyGraphConnect rejects duplicate edge (max 1 per handle) | AC-4 |
| 18 | applyGraphConnect returns null for invalid connection | AC-4 |
| 19 | syncGraphToFlowVersion handles loop with firstLoopAction | AC-6 |
| 20 | syncGraphToFlowVersion handles router with children | AC-6 |

## DP-5: Acceptance Criteria (Executable)

### AC-1: GraphState utility functions are exported from shared
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts` → all pass

### AC-2: createInitialGraphData produces nodes+edges from FlowVersion
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts -t "createInitialGraphData"` → PASS

### AC-3: autoLayoutGraphNodes recomputes positions
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts -t "autoLayoutGraphNodes"` → PASS

### AC-4: applyGraphConnect validates and creates edges
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts -t "applyGraphConnect"` → PASS

### AC-5: syncGraphFromFlowVersion rebuilds graph from FlowVersion
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts -t "syncGraphFromFlowVersion"` → PASS

### AC-6: syncGraphToFlowVersion produces trigger+canvasLayout
- **ESTEP:** `npx vitest run --root packages/shared test/flow/graph-state-utils.test.ts -t "syncGraphToFlowVersion"` → PASS

### AC-7: GraphState is composed into BuilderState in builder-hooks.ts
- **ESTEP:** `grep "GraphState" packages/web/src/app/builder/builder-hooks.ts` → at least 2 matches (import + type)

### AC-8: All existing tests pass (regression)
- **ESTEP:** `npx vitest run --root packages/shared` → all tests pass, total >= 343

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-state-utils.ts (NEW, shared) | test/flow/graph-state-utils.test.ts (NEW) | 20 tests |
