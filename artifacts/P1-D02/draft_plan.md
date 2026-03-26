# Draft Plan — P1-D02

**Step:** P1-D02 — GraphStepNode + GraphTriggerNode with handles
**Profile:** standard
**Date:** 2026-03-27
**Dependencies:** P1-D01 (connection-rules.ts, connection-validator.ts), P1-PRE-02 (graph-converter.ts)

---

## Phase 0 — Document Collection

### Loaded Documents
- architecture/ARCHITECTURE.md (primary)
- connection-rules.ts (P1-D01 output)
- graph-converter.ts (P1-PRE-02 output, defines GraphNodeData, GraphNode types)

### DFC — Dependency Freshness Check
No MODIFY files in this step — all files are CREATE. DFC not applicable.

### RC-1 — Resource Check
No MODIFY files. RC-1 not applicable for CREATE-only steps.

### Files Plan
| File | Action | Location |
|------|--------|----------|
| handles.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/handles.tsx |
| graph-step-node.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/graph-step-node.tsx |
| graph-trigger-node.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/graph-trigger-node.tsx |
| graph-step-node.test.ts | CREATE | packages/shared/test/flow/graph-step-node.test.ts |
| graph-trigger-node.test.ts | CREATE | packages/shared/test/flow/graph-trigger-node.test.ts |

---

## DP-1 — GAPs from Architecture Documents

| # | Source | Section | GAP Description | Affected Files | Severity |
|---|--------|---------|-----------------|----------------|----------|
| G1 | ARCHITECTURE.md | 6.3 Handle Layout | Handle components not yet implemented. Architecture specifies: input (top-center), output (bottom-center), loop-output (right), branch-N (right) | handles.tsx | BLOCKING |
| G2 | ARCHITECTURE.md | 3 File Structure | graph-step-node.tsx listed in file structure but not yet created | graph-step-node.tsx | BLOCKING |
| G3 | ARCHITECTURE.md | 3 File Structure | graph-trigger-node.tsx listed in file structure but not yet created | graph-trigger-node.tsx | BLOCKING |
| G4 | ARCHITECTURE.md | 6.3 Handle Layout | Step node needs input handle (top-center) + output handle (bottom-center) + optional loop-output (right for loops) + optional branch-N (right for routers) based on node type | graph-step-node.tsx, handles.tsx | BLOCKING |
| G5 | ARCHITECTURE.md | 6.3 Handle Layout | Trigger node needs output handle only (no input), per connection rules NO_INPUT_TYPES | graph-trigger-node.tsx | BLOCKING |

---

## DP-2 — Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| D1 | graph-converter.ts | stepTypeToNodeType returns 'trigger', 'loop', 'router', 'action' | Confirmed: returns these exact strings | Align node components — use these as ReactFlow node type keys |
| D2 | graph-converter.ts | GraphNodeData has {step, stepName, actionType} | Confirmed: matches type definition | Node components receive NodeProps<GraphNode> with this data shape |
| D3 | connection-rules.ts | HANDLE_IDS: INPUT='input', OUTPUT='output', LOOP_OUTPUT='loop-output' | Confirmed: exact string values | handles.tsx must use these exact IDs for Handle id props |
| D4 | existing step-node/index.tsx | Uses Handle with HANDLE_STYLING (opacity:0, cursor:default) — handles are invisible in old canvas | Old canvas hides handles | New graph-canvas nodes need VISIBLE handles for user interaction (drag connections) |

---

## DP-5 — Acceptance Criteria

### AC-1: handles.tsx exports handle components with correct handle IDs
- **Command:** `npx vitest run packages/shared/test/flow/graph-step-node.test.ts --reporter=verbose 2>&1 | grep -E "HANDLE_IDS|handle"`
- **Expected:** Tests validate handle IDs match HANDLE_IDS constants
- **PASS:** Tests containing handle ID validation pass
- **FAIL:** No handle tests or handle ID mismatch

### AC-2: GraphStepNode renders with input and output handles
- **Command:** `npx vitest run packages/shared/test/flow/graph-step-node.test.ts --reporter=verbose`
- **Expected:** All tests pass, 0 failed
- **PASS:** Exit code 0, "X passed" with X > 0
- **FAIL:** Exit code != 0 or "FAIL" in output

### AC-3: GraphTriggerNode renders with output handle only (no input)
- **Command:** `npx vitest run packages/shared/test/flow/graph-trigger-node.test.ts --reporter=verbose`
- **Expected:** All tests pass, 0 failed
- **PASS:** Exit code 0, "X passed" with X > 0
- **FAIL:** Exit code != 0 or "FAIL" in output

### AC-4: GraphStepNode renders loop-output handle for LOOP_ON_ITEMS nodes
- **Command:** `npx vitest run packages/shared/test/flow/graph-step-node.test.ts --reporter=verbose 2>&1 | grep -i "loop"`
- **Expected:** Loop-output handle test passes
- **PASS:** Test mentioning loop passes
- **FAIL:** No loop test or loop test fails

### AC-5: GraphStepNode renders branch-N handles for ROUTER nodes
- **Command:** `npx vitest run packages/shared/test/flow/graph-step-node.test.ts --reporter=verbose 2>&1 | grep -i "branch\|router"`
- **Expected:** Branch handle tests pass
- **PASS:** Tests mentioning branch/router pass
- **FAIL:** No branch test or branch test fails

### AC-6: All existing tests still pass (no regression)
- **Command:** `npx vitest run --root packages/shared --reporter=verbose`
- **Expected:** All X tests pass, 0 failed (X >= 251, previous total)
- **PASS:** 0 FAILED, total >= 251
- **FAIL:** Any FAILED or total < 251

### AC-7: Handle components use HANDLE_IDS constants from connection-rules.ts (no hardcoded strings)
- **Command:** `npx vitest run packages/shared/test/flow/graph-step-node.test.ts packages/shared/test/flow/graph-trigger-node.test.ts --reporter=verbose`
- **Expected:** All tests pass
- **PASS:** Exit code 0, all pass
- **FAIL:** Exit code != 0

---

## DP-TEST — Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-canvas/nodes/handles.tsx | packages/shared/test/flow/graph-step-node.test.ts | Tests for handle component generation: getHandlesForNodeType returns correct handles for each action type (CODE, PIECE, LOOP, ROUTER, trigger types) |
| graph-canvas/nodes/graph-step-node.tsx | packages/shared/test/flow/graph-step-node.test.ts | Tests for: step node type mapping, handle configuration per action type, node data shape, displayName rendering logic |
| graph-canvas/nodes/graph-trigger-node.tsx | packages/shared/test/flow/graph-trigger-node.test.ts | Tests for: trigger node has no input handle, trigger node has output handle, trigger visual indicator |

**Note:** Since graph-step-node.tsx and graph-trigger-node.tsx are React components (TSX), and the testing framework is vitest in packages/shared, we create pure logic tests for the handle configuration functions extracted to a shared utility. The visual React components will be tested at E2E level. The shared logic (handle configuration per node type) is testable in packages/shared.

**Design decision:** Extract the handle configuration logic (which handles to render for which node type) into a pure function in `packages/shared/src/lib/automation/flows/util/graph-node-handles.ts`. This enables unit testing without DOM/React dependencies while keeping the React components thin wrappers.

---

## DP-MIGRATE — Import Chain for MODIFY-files

No MODIFY files in this step. All files are CREATE.

**New file consumers (forward-looking):**
- handles.tsx will be imported by graph-step-node.tsx, graph-trigger-node.tsx
- graph-step-node.tsx will be registered as nodeType in graph-canvas-provider.tsx (P1-D04)
- graph-trigger-node.tsx will be registered as nodeType in graph-canvas-provider.tsx (P1-D04)
- graph-node-handles.ts (shared logic) will be imported by the React components and tests

No migration required for existing files.

---

## STOP-RULE

If any CREATE file cannot be placed in its target directory (directory does not exist and cannot be created), STOP and report to Orchestrator.

---

## Implementation Phases

### Phase A: Create shared handle logic (graph-node-handles.ts)
1. Create `packages/shared/src/lib/automation/flows/util/graph-node-handles.ts`
2. Export `getHandlesForNodeType(actionType: string, branchCount?: number): HandleConfig[]`
3. HandleConfig type: `{ id: string, type: 'source' | 'target', position: 'top' | 'bottom' | 'right' | 'left' }`
4. Uses HANDLE_IDS, LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES from connection-rules.ts
5. Update index exports if needed

### Phase B: Create React handle components (handles.tsx)
1. Create `packages/web/src/app/builder/graph-canvas/nodes/handles.tsx`
2. GraphInputHandle: renders Handle type="target" at Position.Top with id=HANDLE_IDS.INPUT
3. GraphOutputHandle: renders Handle type="source" at Position.Bottom with id=HANDLE_IDS.OUTPUT
4. GraphLoopOutputHandle: renders Handle type="source" at Position.Right with id=HANDLE_IDS.LOOP_OUTPUT
5. GraphBranchHandle: renders Handle type="source" at Position.Right with id=branchHandle(index)
6. All handles visible (not hidden like old canvas)

### Phase C: Create GraphStepNode (graph-step-node.tsx)
1. Create `packages/web/src/app/builder/graph-canvas/nodes/graph-step-node.tsx`
2. React.memo component receiving NodeProps
3. Renders: input handle (top), node body (logo + displayName), output handle (bottom)
4. Conditional: loop-output handle for LOOP_ON_ITEMS, branch handles for ROUTER
5. Uses GraphNodeData from graph-converter.ts
6. Click handler: selectStepByName from builder state

### Phase D: Create GraphTriggerNode (graph-trigger-node.tsx)
1. Create `packages/web/src/app/builder/graph-canvas/nodes/graph-trigger-node.tsx`
2. React.memo component receiving NodeProps
3. Renders: node body (logo + displayName + trigger badge), output handle (bottom)
4. NO input handle (trigger is root, per NO_INPUT_TYPES)

### Phase E: Create tests
1. Create tests for getHandlesForNodeType in packages/shared/test/flow/
2. Test all node types: CODE, PIECE, LOOP_ON_ITEMS, ROUTER, EMPTY trigger, PIECE trigger
3. Test branch count parametrization for ROUTER

### Phase F: Self-check
1. Verify all new files exist
2. Run full test suite for packages/shared
