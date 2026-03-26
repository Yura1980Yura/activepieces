# Final Plan — P1-D03: Graph edges (default, loop, branch)

## Profile: standard
## Step: P1-D03
## Dependencies: P1-D01 (connection-rules.ts)

---

## Phase 0: Context Files to Read

1. `packages/shared/src/lib/automation/flows/util/connection-rules.ts` — HANDLE_IDS, isBranchHandle()
2. `packages/shared/src/lib/automation/flows/util/graph-converter.ts` — GraphEdge type
3. `packages/web/src/app/builder/graph-canvas/nodes/handles.tsx` — style conventions
4. `packages/web/src/app/builder/flow-canvas/edges/straight-line-edge.tsx` — existing edge pattern
5. `architecture/ARCHITECTURE.md` — section 3, 4, 6.3

---

## Phase 1: CREATE graph-edge-utils.ts (shared utility)

**File:** `packages/shared/src/lib/automation/flows/util/graph-edge-utils.ts`

### Purpose
Pure logic utility for edge type classification, label derivation, and style derivation. No React dependencies — testable with plain vitest.

### Exports

```typescript
/**
 * Edge type classification based on sourceHandle.
 * Maps to ReactFlow edgeTypes registry keys.
 */
export type GraphEdgeType = 'default' | 'loop' | 'branch'

/**
 * Constants for registering edge types with ReactFlow.
 * Used by graph-canvas-provider.tsx in P1-D04.
 */
export const GRAPH_EDGE_TYPES = {
    DEFAULT: 'default' as const,
    LOOP: 'loop' as const,
    BRANCH: 'branch' as const,
}

/**
 * Style configuration for each edge type.
 * Colors match handle styles from handles.tsx:
 * - default: #94a3b8 (slate)
 * - loop: #8b5cf6 (purple, matches GraphLoopOutputHandle)
 * - branch: #f59e0b (amber, matches GraphBranchHandle)
 */
export type GraphEdgeStyle = {
    stroke: string
    strokeWidth: number
    strokeDasharray?: string
}

/**
 * Classify an edge by its sourceHandle.
 * - 'output' → 'default'
 * - 'loop-output' → 'loop'
 * - 'branch-N' → 'branch'
 * - unknown → 'default' (fallback)
 */
export function getEdgeType(sourceHandle: string): GraphEdgeType

/**
 * Get display label for an edge.
 * - branch edges: "Branch {index + 1}" (1-based for display)
 * - other edges: '' (empty)
 */
export function getEdgeLabel(sourceHandle: string): string

/**
 * Get style for an edge based on its type.
 * - default: solid, #94a3b8, 2px
 * - loop: dashed, #8b5cf6, 2px
 * - branch: solid, #f59e0b, 2px
 */
export function getEdgeStyle(edgeType: GraphEdgeType): GraphEdgeStyle

/**
 * Annotate a GraphEdge array with computed type information.
 * Returns edges with an additional 'type' field for ReactFlow registration.
 */
export function classifyEdges(edges: GraphEdge[]): Array<GraphEdge & { type: GraphEdgeType }>
```

### Implementation Details

- `getEdgeType()`: Check sourceHandle against HANDLE_IDS.OUTPUT → 'default', HANDLE_IDS.LOOP_OUTPUT → 'loop', isBranchHandle() → 'branch', fallback → 'default'
- `getEdgeLabel()`: If isBranchHandle(sourceHandle) → extract index, return `Branch ${index + 1}`. Else return ''.
- `getEdgeStyle()`: Lookup table by GraphEdgeType.
- `classifyEdges()`: Map over edges, call getEdgeType(edge.sourceHandle), spread onto edge.

---

## Phase 2: CREATE graph-edge.tsx (default edge)

**File:** `packages/web/src/app/builder/graph-canvas/edges/graph-edge.tsx`

### Purpose
Default edge component for the graph canvas. Renders a bezier curve between nodes with an optional delete button.

### Implementation
```typescript
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'
import React from 'react'
import { getEdgeStyle, GRAPH_EDGE_TYPES } from '@activepieces/shared'

type GraphEdgeData = {
    onDelete?: (edgeId: string) => void
}

const GraphEdge = React.memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps & { data?: GraphEdgeData }) => {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    const style = getEdgeStyle('default')

    return (
        <>
            <BaseEdge path={edgePath} style={{ stroke: style.stroke, strokeWidth: style.strokeWidth }} />
            <EdgeLabelRenderer>
                <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="nodrag nopan">
                    {data?.onDelete && (
                        <button onClick={() => data.onDelete?.(id)} className="...">×</button>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    )
})

GraphEdge.displayName = 'GraphEdge'
export { GraphEdge }
```

---

## Phase 3: CREATE graph-loop-edge.tsx (loop edge)

**File:** `packages/web/src/app/builder/graph-canvas/edges/graph-loop-edge.tsx`

### Purpose
Edge component for loop-output → input connections. Visually distinguished by dashed purple stroke.

### Implementation
```typescript
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'
import React from 'react'
import { getEdgeStyle } from '@activepieces/shared'

const GraphLoopEdge = React.memo(({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) => {
    const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    const style = getEdgeStyle('loop')

    return <BaseEdge path={edgePath} style={{ stroke: style.stroke, strokeWidth: style.strokeWidth, strokeDasharray: style.strokeDasharray }} />
})

GraphLoopEdge.displayName = 'GraphLoopEdge'
export { GraphLoopEdge }
```

---

## Phase 4: CREATE graph-branch-edge.tsx (branch edge)

**File:** `packages/web/src/app/builder/graph-canvas/edges/graph-branch-edge.tsx`

### Purpose
Edge component for branch-N → input connections. Shows branch label and amber color.

### Implementation
```typescript
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'
import React from 'react'
import { getEdgeStyle } from '@activepieces/shared'

type GraphBranchEdgeData = {
    label?: string
}

const GraphBranchEdge = React.memo(({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps & { data?: GraphBranchEdgeData }) => {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    const style = getEdgeStyle('branch')

    return (
        <>
            <BaseEdge path={edgePath} style={{ stroke: style.stroke, strokeWidth: style.strokeWidth }} />
            {data?.label && (
                <EdgeLabelRenderer>
                    <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', fontSize: '12px', background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: '4px' }} className="nodrag nopan">
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
})

GraphBranchEdge.displayName = 'GraphBranchEdge'
export { GraphBranchEdge }
```

---

## Phase 5: MODIFY index.ts (shared exports)

**File:** `packages/shared/src/index.ts`
**Change:** Add export line after existing graph-node-handles export.

```typescript
export * from './lib/automation/flows/util/graph-edge-utils'
```

---

## Phase 6: CREATE tests

**File:** `packages/shared/test/flow/graph-edges.test.ts`

### Test cases (~20 tests):

**getEdgeType:**
1. returns 'default' for 'output' sourceHandle
2. returns 'loop' for 'loop-output' sourceHandle
3. returns 'branch' for 'branch-0' sourceHandle
4. returns 'branch' for 'branch-1' sourceHandle
5. returns 'branch' for 'branch-99' sourceHandle
6. returns 'default' for unknown sourceHandle
7. returns 'default' for empty string sourceHandle

**getEdgeLabel:**
8. returns '' for 'output' sourceHandle
9. returns '' for 'loop-output' sourceHandle
10. returns 'Branch 1' for 'branch-0' sourceHandle
11. returns 'Branch 2' for 'branch-1' sourceHandle
12. returns 'Branch 10' for 'branch-9' sourceHandle

**getEdgeStyle:**
13. returns solid stroke for 'default' type
14. returns dashed stroke for 'loop' type
15. returns solid stroke for 'branch' type
16. default style has stroke #94a3b8
17. loop style has stroke #8b5cf6
18. branch style has stroke #f59e0b
19. all styles have strokeWidth 2

**GRAPH_EDGE_TYPES:**
20. has DEFAULT, LOOP, BRANCH keys
21. DEFAULT value is 'default'
22. LOOP value is 'loop'
23. BRANCH value is 'branch'

**classifyEdges:**
24. classifies output edges as 'default'
25. classifies loop-output edges as 'loop'
26. classifies branch-N edges as 'branch'
27. handles empty edge array
28. preserves original edge properties

---

## STOP RULE

If any of the following occur, STOP and report to Orchestrator:
- Files listed in Architecture doc already exist with different structure
- @xyflow/react API changed (EdgeProps, BaseEdge, getBezierPath not available)
- HANDLE_IDS constants in connection-rules.ts changed since P1-D01
- graph-converter.ts GraphEdge type changed since P1-PRE-02

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| `packages/shared/src/lib/automation/flows/util/graph-edge-utils.ts` | `packages/shared/test/flow/graph-edges.test.ts` | ~28 tests |

---

## Acceptance Criteria (DP-5)

| AC | Criteria | Executable Command | Expected |
|----|----------|--------------------|----------|
| AC-1 | getEdgeType() returns 'default' for output edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "getEdgeType"` | tests pass |
| AC-2 | getEdgeType() returns 'loop' for loop-output edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "loop"` | tests pass |
| AC-3 | getEdgeType() returns 'branch' for branch-N edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "branch"` | tests pass |
| AC-4 | getEdgeLabel() returns correct labels | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "getEdgeLabel"` | tests pass |
| AC-5 | getEdgeStyle() returns correct styles per type | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "getEdgeStyle"` | tests pass |
| AC-6 | GRAPH_EDGE_TYPES has correct constants | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "GRAPH_EDGE_TYPES"` | tests pass |
| AC-7 | classifyEdges() annotates edges with type | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "classifyEdges"` | tests pass |
| AC-8 | React edge components exist as files | `test -f "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/graph-canvas/edges/graph-edge.tsx" && test -f "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/graph-canvas/edges/graph-loop-edge.tsx" && test -f "C:/Users/user/Desktop/Projects/activepieces/packages/web/src/app/builder/graph-canvas/edges/graph-branch-edge.tsx" && echo PASS` | PASS |
| AC-9 | All previous tests still pass (284+ total) | `npx vitest run --root packages/shared` | >= 284 passed, 0 failed |
