# Draft Plan — P1-D03: Graph edges (default, loop, branch)

## Profile: standard
## Step: P1-D03

---

## DP-1: GAP Analysis

From Architecture doc section 3 (File Structure), P1-D03 must create:

1. `graph-edge.tsx` — Default edge with delete button
2. `graph-loop-edge.tsx` — Loop edge (visual indicator)
3. `graph-branch-edge.tsx` — Branch edge with label

These files live in `packages/web/src/app/builder/graph-canvas/edges/`.

### GAPs to close:
- **GAP-1:** No graph edge components exist in graph-canvas/edges/ — all three must be created
- **GAP-2:** Graph edges must use ReactFlow's `BaseEdge` / `getBezierPath` for path computation (free-form canvas uses bezier curves, unlike the old deterministic layout that uses straight/arc paths)
- **GAP-3:** Default edge needs a delete button rendered via `EdgeLabelRenderer` (ReactFlow pattern for interactive edge elements)
- **GAP-4:** Loop edge needs a visual indicator distinguishing it from default edges (e.g., dashed style, purple color matching GraphLoopOutputHandle)
- **GAP-5:** Branch edge needs a label showing branch name/index, matching router branch handle styling

### Dependencies:
- P1-D01: connection-rules.ts provides HANDLE_IDS, isBranchHandle(), LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES
- graph-converter.ts: provides GraphEdge type (id, source, target, sourceHandle, targetHandle)
- P1-D02: handles.tsx provides handle style conventions (colors: #94a3b8 default, #8b5cf6 loop, #f59e0b branch)

---

## DP-2: Spec vs Code Divergences

### Architecture doc vs current codebase:
1. **Architecture doc section 4** lists edges in dependency map: `graph-canvas/index.tsx → edges/graph-edge.tsx, edges/graph-loop-edge.tsx, edges/graph-branch-edge.tsx`. These files do not exist yet — this step creates them.
2. **Existing flow-canvas edges** use `BaseEdge` + `EdgeProps` from `@xyflow/react` — same pattern will be used.
3. **GraphEdge type** in graph-converter.ts already defines `sourceHandle` and `targetHandle` fields, which the edge components will receive via ReactFlow's edge data.
4. **Architecture doc section 6.2** states max 1 edge per output handle — edge components don't enforce this (that's connection-validator.ts's job), they only render.

### Key insight from existing code:
- The existing flow-canvas edges (straight-line-edge.tsx, loop-start-edge.tsx, router-start-edge.tsx) use computed SVG paths because positions are deterministic. The NEW graph-canvas edges use `getBezierPath` from ReactFlow because nodes are freely positioned.
- Edge components receive `sourceX, sourceY, targetX, targetY` from ReactFlow and compute bezier paths.

---

## DP-5: Acceptance Criteria

| AC | Criteria | Executable Command | PASS/FAIL |
|----|----------|--------------------|-----------|
| AC-1 | graph-edge.tsx exports GraphEdge component using BaseEdge with getBezierPath | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "GraphEdge"` | PASS: tests pass |
| AC-2 | graph-edge.tsx renders a delete button via EdgeLabelRenderer | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "delete button"` | PASS: tests pass |
| AC-3 | graph-loop-edge.tsx exports GraphLoopEdge with dashed/purple visual styling | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "GraphLoopEdge"` | PASS: tests pass |
| AC-4 | graph-branch-edge.tsx exports GraphBranchEdge with branch label display | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "GraphBranchEdge"` | PASS: tests pass |
| AC-5 | All edge components receive EdgeProps-compatible props (sourceX, sourceY, targetX, targetY, etc.) | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "props"` | PASS: tests pass |
| AC-6 | All previous tests still pass (284 total) | `npx vitest run --root packages/shared` | PASS: >= 284 passed, 0 failed |

**NOTE on testing approach:** Since edge components are React components requiring @xyflow/react and DOM, and the shared package tests use vitest without jsdom, we will create a **pure logic utility** `graph-edge-utils.ts` in `packages/shared/src/lib/automation/flows/util/` that exports edge type classification functions and edge data derivation logic. Unit tests will target this utility. The React components (graph-edge.tsx, graph-loop-edge.tsx, graph-branch-edge.tsx) in packages/web/ will import from this utility and render via ReactFlow.

**Revised AC commands** (targeting the shared utility + integration tests):

| AC | Criteria | Executable Command | PASS/FAIL |
|----|----------|--------------------|-----------|
| AC-1 | getEdgeType() returns 'default' for output→input edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "getEdgeType"` | PASS |
| AC-2 | getEdgeType() returns 'loop' for loop-output→input edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "loop"` | PASS |
| AC-3 | getEdgeType() returns 'branch' for branch-N→input edges | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "branch"` | PASS |
| AC-4 | getEdgeLabel() returns branch label for branch edges, empty for others | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "getEdgeLabel"` | PASS |
| AC-5 | GRAPH_EDGE_TYPES constant maps edge type strings for ReactFlow edgeTypes registry | `npx vitest run --root packages/shared test/flow/graph-edges.test.ts -t "GRAPH_EDGE_TYPES"` | PASS |
| AC-6 | graph-edge.tsx, graph-loop-edge.tsx, graph-branch-edge.tsx exist and export React components | File existence check: `test -f packages/web/src/app/builder/graph-canvas/edges/graph-edge.tsx && test -f packages/web/src/app/builder/graph-canvas/edges/graph-loop-edge.tsx && test -f packages/web/src/app/builder/graph-canvas/edges/graph-branch-edge.tsx && echo PASS` | PASS |
| AC-7 | All previous tests still pass (284+ total) | `npx vitest run --root packages/shared` | PASS: >= 284 passed, 0 failed |

---

## DP-TEST: Test Extension Plan

### New test file:
- `packages/shared/test/flow/graph-edges.test.ts` — tests for `graph-edge-utils.ts`

### Runtime files → test files mapping:
| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| `packages/shared/src/lib/automation/flows/util/graph-edge-utils.ts` | `packages/shared/test/flow/graph-edges.test.ts` | ~20 tests |

### Test categories:
1. **getEdgeType()** — classification based on sourceHandle:
   - output handle → 'default'
   - loop-output handle → 'loop'
   - branch-N handle → 'branch'
   - unknown handle → 'default' (fallback)
2. **getEdgeLabel()** — label derivation:
   - branch edge with branchIndex → "Branch N" label
   - non-branch edge → empty string
3. **getEdgeStyle()** — style derivation per edge type:
   - default → solid, standard color
   - loop → dashed, purple (#8b5cf6)
   - branch → solid, amber (#f59e0b)
4. **GRAPH_EDGE_TYPES** — constant mapping for ReactFlow registration
5. **classifyEdges()** — bulk classification of GraphEdge[] with type annotation

---

## DP-MIGRATE: MODIFY-files with consumers

### MODIFY files:
1. `packages/shared/src/index.ts` — ADD export for `graph-edge-utils`
   - **Import Chain:** All consumers of `@activepieces/shared` will gain access to new exports
   - **Risk:** LOW — additive only, no existing exports changed

### CREATE files (no Import Chain needed):
1. `packages/shared/src/lib/automation/flows/util/graph-edge-utils.ts` — NEW pure logic utility
2. `packages/web/src/app/builder/graph-canvas/edges/graph-edge.tsx` — NEW React component
3. `packages/web/src/app/builder/graph-canvas/edges/graph-loop-edge.tsx` — NEW React component
4. `packages/web/src/app/builder/graph-canvas/edges/graph-branch-edge.tsx` — NEW React component
5. `packages/shared/test/flow/graph-edges.test.ts` — NEW test file

---

## STOP RULE

If any of the following occur, STOP and report:
- Files listed in Architecture doc (graph-edge.tsx, etc.) already exist with different structure
- @xyflow/react API changed (EdgeProps, BaseEdge, getBezierPath not available)
- HANDLE_IDS constants in connection-rules.ts changed since P1-D01
- graph-converter.ts GraphEdge type changed since P1-PRE-02
