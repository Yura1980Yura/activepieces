# Final Plan — P1-PRE-02

**Step:** P1-PRE-02 — Create graph<->linked-list converter with tests
**Profile:** full
**Date:** 2026-03-27
**Previous step:** P1-PRE-01 (commit: ae4aa2c8e5)

---

## STOP-RULE

> If the real file structure differs from what this plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise. Do NOT adapt the plan.

---

## Files

| File | Action | Location |
|------|--------|----------|
| graph-converter.ts | CREATE | packages/shared/src/lib/automation/flows/util/graph-converter.ts |
| auto-layout.ts | CREATE | packages/shared/src/lib/automation/flows/util/auto-layout.ts |
| index.ts | MODIFY | packages/shared/src/index.ts |
| graph-converter.test.ts | CREATE | packages/shared/test/flow/graph-converter.test.ts |
| auto-layout.test.ts | CREATE | packages/shared/test/flow/auto-layout.test.ts |
| package.json | MODIFY | packages/shared/package.json (add @dagrejs/dagre) |

---

## Phase A: Install dependency

1. Add `@dagrejs/dagre` to packages/shared/package.json dependencies
2. Run npm install / bun install in project root
3. Verify: `import dagre from '@dagrejs/dagre'` resolves

---

## Phase B: Create graph-converter.ts

### Location: `packages/shared/src/lib/automation/flows/util/graph-converter.ts`

### Types to define:

```typescript
export type GraphNodeData = {
    step: Step              // Original step data (FlowAction | FlowTrigger)
    stepName: string
    actionType: string      // FlowActionType | FlowTriggerType
}

export type GraphNode = {
    id: string              // step.name
    type: string            // 'trigger' | 'action' | 'loop' | 'router'
    position: { x: number, y: number }
    data: GraphNodeData
}

export type GraphEdge = {
    id: string              // unique edge id
    source: string          // source node id (step.name)
    target: string          // target node id (step.name)
    sourceHandle: string    // 'output' | 'loop-output' | 'branch-N'
    targetHandle: string    // 'input'
}

export type GraphConversionResult = {
    nodes: GraphNode[]
    edges: GraphEdge[]
    orphanNodeIds: string[]  // nodes not reachable from trigger
}
```

### Functions to implement:

#### 1. `linkedListToGraph(flowVersion: FlowVersion): GraphConversionResult`

Algorithm (from Architecture §6.1 "On Load"):
1. Traverse trigger -> nextAction -> ... recursively
2. Create nodes[] with step.name as id
3. Create edges[] from:
   - nextAction pointers -> edge from source 'output' to target 'input'
   - Loop.firstLoopAction -> edge from source 'loop-output' to target 'input'
   - Router.children[N] -> edge from source 'branch-N' to target 'input'
4. Node type mapping:
   - FlowTriggerType.EMPTY | PIECE -> 'trigger'
   - FlowActionType.CODE | PIECE -> 'action'
   - FlowActionType.LOOP_ON_ITEMS -> 'loop'
   - FlowActionType.ROUTER -> 'router'
5. Default positions: { x: 0, y: 0 } (auto-layout applies positions separately)

#### 2. `graphToLinkedList(nodes: GraphNode[], edges: GraphEdge[]): FlowTrigger`

Algorithm (from Architecture §6.1 "On Save"):
1. Find trigger node (node with type 'trigger')
2. Walk graph from trigger following outgoing edges
3. For each node, find its outgoing edge from 'output' handle -> that target becomes nextAction
4. For Loop nodes: find edge from 'loop-output' handle -> target becomes firstLoopAction
5. For Router nodes: find edges from 'branch-N' handles -> targets become children[N]
6. Build FlowTrigger with nextAction chain

**Adjudication requirement:** graphToLinkedList must correctly populate:
- Loop.firstLoopAction from 'loop-output' edges
- Router.children[] from 'branch-N' edges with correct length

#### 3. Helper: `findOrphanNodes(nodes: GraphNode[], edges: GraphEdge[]): string[]`

Find nodes with no incoming edges AND not the trigger node.

---

## Phase C: Create auto-layout.ts

### Location: `packages/shared/src/lib/automation/flows/util/auto-layout.ts`

### Function:

```typescript
import dagre from '@dagrejs/dagre'
import { CanvasLayout } from '../flow-version'

export function computeAutoLayout(
    nodes: { id: string, width?: number, height?: number }[],
    edges: { source: string, target: string }[],
    options?: { nodeWidth?: number, nodeHeight?: number, rankSep?: number, nodeSep?: number }
): CanvasLayout
```

Algorithm:
1. Create dagre graph with rankdir: 'TB'
2. Set default node size: width=232, height=60 (from existing FLOW_CANVAS_STEP_WIDTH/HEIGHT)
3. Set ranksep: 80 (vertical), nodesep: 140 (horizontal)
4. Add all nodes and edges
5. Run dagre.layout(graph)
6. Extract positions: node center -> top-left conversion
7. Return CanvasLayout { positions: Record<string, {x,y}> }

**Adjudication requirement:** Test must verify Y positions ascending for linear chain with spacing >= 80px.

---

## Phase D: Export from shared

### MODIFY: `packages/shared/src/index.ts`

Add two lines:
```typescript
export * from './lib/automation/flows/util/graph-converter'
export * from './lib/automation/flows/util/auto-layout'
```

---

## Phase E: Create tests

### Test file 1: `packages/shared/test/flow/graph-converter.test.ts`

Required test cases:

**linkedListToGraph tests:**
- trigger only (empty flow) -> 1 node, 0 edges
- linear chain: trigger -> step_1 -> step_2 -> 3 nodes, 2 edges
- flow with LoopOnItems: trigger -> loop (with firstLoopAction=child) -> 3+ nodes, edges include loop-output
- flow with Router: trigger -> router (with 2 branches, each having children) -> correct node count, edges include branch-0, branch-1
- nested: router inside loop -> correct edge structure

**graphToLinkedList tests:**
- simple chain -> valid FlowTrigger with nextAction chain
- with Loop -> firstLoopAction correctly set
- with Router -> children[] correctly set with correct length
- verify step properties (name, type, settings, displayName) preserved

**Round-trip tests (Adjudication requirement: min 3 patterns):**
- linear 3-step chain: linkedListToGraph -> graphToLinkedList = structurally equivalent original
- flow with LoopOnItems + child: round-trip preserves firstLoopAction
- flow with Router + 2 branches: round-trip preserves children[]

**Edge count verification per pattern (Adjudication requirement):**
- trigger only: 0 edges
- 3-step linear: 2 edges
- loop with 1 child + nextAction: 3 edges (output to next, loop-output to child, child output if exists)
- router with 2 branches: branch-0 + branch-1 + output edges

**Orphan detection:**
- Flow with disconnected node -> orphanNodeIds contains that node

### Test file 2: `packages/shared/test/flow/auto-layout.test.ts`

Required test cases:
- single node -> returns positions with 1 entry
- linear chain (3 nodes) -> positions Y ascending, spacing >= 80px (Adjudication requirement)
- flow with branches -> positions include all nodes
- returns valid CanvasLayout structure (positions record, keys match node ids)

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-converter.ts (CREATE) | test/flow/graph-converter.test.ts (CREATE) | linkedListToGraph_triggerOnly, linkedListToGraph_linearChain, linkedListToGraph_withLoop, linkedListToGraph_withRouter, linkedListToGraph_nested, graphToLinkedList_simpleChain, graphToLinkedList_withLoop, graphToLinkedList_withRouter, roundTrip_linearChain, roundTrip_withLoop, roundTrip_withRouter, edgeCount_*, orphanDetection |
| auto-layout.ts (CREATE) | test/flow/auto-layout.test.ts (CREATE) | autoLayout_singleNode, autoLayout_linearChain_yOrdering, autoLayout_withBranches, autoLayout_canvasLayoutStructure |

---

## Acceptance Criteria (Final)

### AC-1: Linked-list to graph conversion produces correct nodes
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "linked-list to graph"`
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-2: Graph to linked-list conversion produces valid FlowVersion trigger chain
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "graph to linked-list"`
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-3: Round-trip preserves structure (min 3 patterns: linear, loop, router)
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "round-trip"`
- **PASS:** stdout contains "passed", 0 "FAILED", minimum 3 tests in suite
- **FAIL:** Any test fails

### AC-4: Handles all action types with correct child structures
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "action types"`
- **PASS:** Tests verify Loop.firstLoopAction and Router.children[], 0 "FAILED"
- **FAIL:** Any test fails

### AC-5: Auto-layout produces valid positions (Y ascending, spacing >= 80px)
- **Command:** `npx vitest run --root packages/shared test/flow/auto-layout.test.ts`
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-6: Orphan node detection works
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "orphan"`
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-7: No regressions (existing tests still pass)
- **Command:** `npx vitest run --root packages/shared`
- **PASS:** >= 164 passed, 0 failed
- **FAIL:** Any existing test fails or count < 164

### AC-8: TypeScript compilation passes
- **Command:** `npx tsc --noEmit --project packages/shared/tsconfig.json`
- **PASS:** exit code 0
- **FAIL:** Type errors
