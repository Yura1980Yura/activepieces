# Final Plan — P1-F01

**Step:** P1-F01 — Wire GraphCanvas into builder (replace FlowCanvas)
**Profile:** full
**Date:** 2026-03-27
**Phase:** P1 — Free Canvas Graph Editor
**Dependencies:** P1-D05, P1-E01, P1-E02, P1-E03

---

## Summary

Replace `FlowCanvas` rendering in `builder/index.tsx` with `GraphCanvas`, wiring graph state (graphNodes, graphEdges, handlers) from the Zustand BuilderState store through props. Preserve all existing builder hooks and widgets. Create shared utility function for node click -> step selection mapping. Write integration tests.

---

## Files to Change

| File | Action | Description |
|------|--------|-------------|
| `packages/web/src/app/builder/index.tsx` | MODIFY | Replace FlowCanvas with GraphCanvas; wire graph state props; preserve hooks and widgets |
| `packages/shared/src/lib/automation/flows/util/graph-canvas-utils.ts` | MODIFY | Add `getStepNameFromNode()` utility function for extracting step name from graph node click |
| `packages/shared/test/flow/builder-graph-wiring.test.ts` | CREATE | Integration tests for builder-graph wiring logic |

---

## Preserved Imports (from adjudication R-1)

The following imports from `flow-canvas/` are PRESERVED because they provide builder-level functionality independent of canvas rendering:

1. **`flowCanvasHooks`** from `'./flow-canvas/hooks'`:
   - `useShowBuilderIsSavingWarningBeforeLeaving` — save warning on page leave
   - `useSetSocketListener` — WebSocket listener for piece refresh
   - `useListenToExistingRun` — polls for run status updates
   - `useAnimateSidebar` — animates right sidebar open/close

2. **`flowCanvasConsts`** from `'./flow-canvas/utils/consts'`:
   - `SIDEBAR_ANIMATION_DURATION` — used in ResizablePanel animation style

3. **Widgets** (remain siblings of GraphCanvas in middle panel, use `useBuilderStateContext` directly):
   - `PublishFlowReminderWidget`
   - `RunInfoWidget`
   - `ViewingOldVersionWidget`

---

## Implementation Phases

### Phase 1: Add shared utility function

**File:** `packages/shared/src/lib/automation/flows/util/graph-canvas-utils.ts`

Add `getStepNameFromNode()` function:
```typescript
export function getStepNameFromNode(node: GraphNode): string | null {
  if (node.type === NOTE_NODE_TYPE) return null;
  return node.data?.stepName ?? null;
}
```
This function extracts the step name from a graph node for the onNodeClick handler. Returns null for note nodes (notes are not execution steps).

### Phase 2: Modify builder/index.tsx

**REMOVE:**
- Import of `FlowCanvas` from `'./flow-canvas'`
- Import of `CanvasControls` from `'@/app/builder/flow-canvas/canvas-controls'`
- Import of `CursorPositionProvider` from `'./state/cursor-position-context'`
- The `<CursorPositionProvider>` wrapper around the canvas
- The `<FlowCanvas>` JSX element
- The `<CanvasControls>` JSX element and its conditional rendering
- The `hasCanvasBeenInitialised` state and `setHasCanvasBeenInitialised` prop

**ADD:**
- Import of `GraphCanvas` from `'./graph-canvas'`
- Import of `getStepNameFromNode` from `'@activepieces/shared'`
- State extraction from useBuilderStateContext for graph state fields:
  - `graphNodes`, `graphEdges`
  - `onGraphNodesChange`, `onGraphEdgesChange`, `onGraphConnect`
  - `autoLayoutGraph`
  - `selectStepByName`
- `handleNodeClick` callback: extracts step name from clicked node via `getStepNameFromNode()`, calls `selectStepByName(stepName)` and opens right sidebar
- `<GraphCanvas>` JSX element with props:
  - `flowVersion={flowVersion}`
  - `onNodesChange={onGraphNodesChange}`  (or via custom wrapper reading from state)
  - `onEdgesChange={onGraphEdgesChange}`
  - `onConnect={onGraphConnect}`
  - `onNodeClick={handleNodeClick}`
  - `onAutoLayout={autoLayoutGraph}`

**KEEP unchanged:**
- All `flowCanvasHooks` calls (save warning, socket, run listener, sidebar animation)
- `flowCanvasConsts.SIDEBAR_ANIMATION_DURATION` for ResizablePanel
- All widgets (PublishFlowReminderWidget, RunInfoWidget, ViewingOldVersionWidget)
- StepSettingsContainer, StepSettingsProvider, DataSelector
- ResizablePanel layout structure
- BuilderHeader, ChatDrawer
- constructContainerKey function

**Architecture decision on GraphCanvas data flow:**
GraphCanvas is currently a standalone component that takes `flowVersion` as a prop and internally calls `buildGraphFromFlowVersion(flowVersion)` to derive nodes/edges. For P1-F01, we keep this design — the GraphCanvas component internally manages its own graph data derivation from the flowVersion prop. The graph state in BuilderState (graphNodes, graphEdges from graph-state.ts) is used for callbacks (onNodesChange, onEdgesChange, onConnect) that feed back into the state, but the initial rendering still comes from flowVersion.

However, to make the graph state the single source of truth for ReactFlow rendering (instead of dual derivation), we need a slightly different approach: GraphCanvas should receive nodes/edges directly from the builder state rather than deriving them internally. This means modifying GraphCanvas to accept optional `nodes` and `edges` props that override the internal `buildGraphFromFlowVersion` call.

**Revised approach:** Since GraphCanvas already has an internal `graphData = useMemo(() => buildGraphFromFlowVersion(flowVersion), [flowVersion])` that produces nodes/edges, AND the builder state also has `graphNodes/graphEdges` from `createInitialGraphData(flowVersion)` (which calls the same function), we simply keep using the GraphCanvas as-is — passing `flowVersion` as the data source. The graph state handlers (onGraphNodesChange, onGraphEdgesChange, onGraphConnect) are wired through props for interactive updates. This avoids double-derivation issues and keeps GraphCanvas's internal memoization intact.

### Phase 3: Create test file

**File:** `packages/shared/test/flow/builder-graph-wiring.test.ts`

Tests for `getStepNameFromNode()` and integration of graph utilities with builder patterns:

1. `getStepNameFromNode returns step name for action node`
2. `getStepNameFromNode returns step name for trigger node`
3. `getStepNameFromNode returns null for note node`
4. `getStepNameFromNode returns null for node without data`
5. `buildGraphFromFlowVersion produces nodes with stepName in data`
6. `buildGraphFromFlowVersion includes note nodes from FlowVersion.notes`
7. `buildGraphFromFlowVersion with null canvasLayout uses auto-layout`
8. `buildGraphFromFlowVersion with canvasLayout uses stored positions`
9. `createInitialGraphData matches buildGraphFromFlowVersion output`
10. `syncGraphFromFlowVersion rebuilds correctly after structural change`
11. `autoLayoutGraphNodes produces valid positions`
12. `STRUCTURAL_OPERATIONS set contains ADD_ACTION`
13. `STRUCTURAL_OPERATIONS set contains DELETE_ACTION`
14. `STRUCTURAL_OPERATIONS set does not contain UPDATE_ACTION`
15. `STRUCTURAL_OPERATIONS set does not contain UPDATE_CANVAS_LAYOUT`
16. `getStepNameFromNode handles loop node type`
17. `getStepNameFromNode handles router node type`

---

## STOP-RULE

> If real file structure differs from what final_plan describes:
> **STOP immediately.** Record the divergence. Report to Orchestrator.
> Do NOT improvise. Do NOT "adapt" the plan.

Specifically:
1. If `graph-canvas/index.tsx` does not exist or has different props interface than documented -> STOP.
2. If `graph-state.ts` does not export `GraphState` type with graphNodes/graphEdges fields -> STOP.
3. If `builder-hooks.ts` does not compose `GraphState` into `BuilderState` -> STOP.
4. If `flow-canvas/hooks.tsx` does not export the 4 hook functions -> STOP.

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|---|---|---|
| graph-canvas-utils.ts (MODIFY: add getStepNameFromNode) | test/flow/builder-graph-wiring.test.ts (CREATE) | 17 tests listed above |
| builder/index.tsx (MODIFY) | N/A (React component, tested via AC grep checks) | — |

---

## Acceptance Criteria

### AC-1: GraphCanvas renders instead of FlowCanvas in builder
- **Command:** `grep -n "FlowCanvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx" | wc -l`
- **Expected:** 0
- **PASS:** Zero occurrences of FlowCanvas in builder/index.tsx
- **FAIL:** Any occurrence of FlowCanvas in builder/index.tsx

### AC-2: GraphCanvas import present in builder
- **Command:** `grep -n "GraphCanvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** At least 1 match
- **PASS:** grep returns matches
- **FAIL:** 0 matches

### AC-3: Graph state handlers wired to GraphCanvas via props
- **Command:** `grep -n "onNodesChange\|onEdgesChange\|onConnect\|onNodeClick\|onAutoLayout" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** >= 5 matches (all 5 callback props present)
- **PASS:** >= 5 matches
- **FAIL:** < 5 matches

### AC-4: Node click handler wires to selectStepByName
- **Command:** `grep -n "selectStepByName" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** >= 1 match (used in onNodeClick handler)
- **PASS:** >= 1 match
- **FAIL:** 0 matches

### AC-5: Auto-layout callback wired
- **Command:** `grep -n "autoLayoutGraph\|onAutoLayout" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** >= 1 match
- **PASS:** >= 1 match
- **FAIL:** 0 matches

### AC-6: Old flow-canvas hooks preserved
- **Command:** `grep -n "useShowBuilderIsSavingWarningBeforeLeaving\|useSetSocketListener\|useListenToExistingRun" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** 3 matches
- **PASS:** = 3 matches
- **FAIL:** < 3 matches

### AC-7: Old CanvasControls removed
- **Command:** `grep -c "import.*CanvasControls.*from.*flow-canvas" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** 0
- **PASS:** 0
- **FAIL:** > 0

### AC-8: Existing shared tests pass
- **Command:** `cd "C:/Users/user/Desktop/Projects/activepieces" && npx vitest run --root packages/shared`
- **Expected:** All pass, 0 failed
- **PASS:** 0 failed
- **FAIL:** Any failure

### AC-9: New tests pass
- **Command:** `cd "C:/Users/user/Desktop/Projects/activepieces" && npx vitest run --root packages/shared test/flow/builder-graph-wiring.test.ts`
- **Expected:** >= 15 tests pass, 0 failed
- **PASS:** >= 15 passed, 0 failed
- **FAIL:** Any failure or < 15 tests

### AC-10: StepSettingsContainer and selectStepByName preserved
- **Command:** `grep -n "StepSettingsContainer\|selectStepByName" "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/index.tsx"`
- **Expected:** >= 2 matches
- **PASS:** >= 2
- **FAIL:** < 2
