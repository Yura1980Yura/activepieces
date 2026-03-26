# Final Plan -- P1-D02

**Step:** P1-D02 -- GraphStepNode + GraphTriggerNode with handles
**Profile:** standard
**Date:** 2026-03-27
**Dependencies:** P1-D01 (connection-rules.ts), P1-PRE-02 (graph-converter.ts)
**Previous step:** P1-D01, commit ee6d66c83a

---

## Files Plan

| File | Action | Location |
|------|--------|----------|
| graph-node-handles.ts | CREATE | packages/shared/src/lib/automation/flows/util/graph-node-handles.ts |
| handles.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/handles.tsx |
| graph-step-node.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/graph-step-node.tsx |
| graph-trigger-node.tsx | CREATE | packages/web/src/app/builder/graph-canvas/nodes/graph-trigger-node.tsx |
| graph-node-handles.test.ts | CREATE | packages/shared/test/flow/graph-node-handles.test.ts |

**Architectural note:** graph-node-handles.ts is a new shared utility not in the original Architecture doc file structure. This extracts pure handle configuration logic to packages/shared, enabling unit testing without React/DOM. The Architecture doc will be updated in Phase 2 (commit stage).

---

## STOP-RULE

If the real file structure differs from what this plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise.

---

## Implementation Phases

### Phase A: Create shared handle configuration logic (graph-node-handles.ts)

**File:** `packages/shared/src/lib/automation/flows/util/graph-node-handles.ts`

1. Import HANDLE_IDS, LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES, branchHandle from connection-rules.ts
2. Import FlowActionType from actions/action, FlowTriggerType from triggers/trigger
3. Define HandleConfig type:
   ```typescript
   type HandleConfig = {
       id: string
       type: 'source' | 'target'
       position: 'top' | 'bottom' | 'right' | 'left'
   }
   ```
4. Export function `getHandlesForNodeType(actionType: string, branchCount?: number): HandleConfig[]`
   - For trigger types (EMPTY, PIECE): return [output handle at bottom] -- NO input handle
   - For CODE/PIECE action: return [input at top, output at bottom]
   - For LOOP_ON_ITEMS: return [input at top, output at bottom, loop-output at right]
   - For ROUTER: return [input at top, output at bottom, branch-0..branch-(branchCount-1) at right]
   - Default: return [input at top, output at bottom]

### Phase B: Create React handle components (handles.tsx)

**File:** `packages/web/src/app/builder/graph-canvas/nodes/handles.tsx`

1. Import Handle, Position from @xyflow/react
2. Import HANDLE_IDS, branchHandle from @activepieces/shared (or direct path)
3. Export components:
   - `GraphInputHandle`: Handle type="target", position=Position.Top, id=HANDLE_IDS.INPUT
   - `GraphOutputHandle`: Handle type="source", position=Position.Bottom, id=HANDLE_IDS.OUTPUT
   - `GraphLoopOutputHandle`: Handle type="source", position=Position.Right, id=HANDLE_IDS.LOOP_OUTPUT
   - `GraphBranchHandle({index})`: Handle type="source", position=Position.Right, id=branchHandle(index)
4. All handles have visible styling (not opacity:0 like old canvas)
5. CSS: small colored circles at handle positions with hover state

### Phase C: Create GraphStepNode (graph-step-node.tsx)

**File:** `packages/web/src/app/builder/graph-canvas/nodes/graph-step-node.tsx`

1. Import React, memo from react
2. Import NodeProps, type Node from @xyflow/react
3. Import GraphNodeData from graph-converter.ts types (via @activepieces/shared)
4. Import FlowActionType from @activepieces/shared
5. Import GraphInputHandle, GraphOutputHandle, GraphLoopOutputHandle, GraphBranchHandle from handles.tsx
6. Import LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES from @activepieces/shared
7. Define component:
   - Props: NodeProps with data: GraphNodeData
   - Renders:
     a. GraphInputHandle (top)
     b. Node body: wrapper div with step.displayName and step name
     c. GraphOutputHandle (bottom)
     d. If actionType in LOOP_OUTPUT_TYPES: GraphLoopOutputHandle
     e. If actionType in BRANCH_OUTPUT_TYPES: GraphBranchHandle for each branch
        (branchCount from step.settings.branches.length if RouterAction)
8. Use React.memo for performance
9. Set displayName = 'GraphStepNode'

### Phase D: Create GraphTriggerNode (graph-trigger-node.tsx)

**File:** `packages/web/src/app/builder/graph-canvas/nodes/graph-trigger-node.tsx`

1. Import React, memo from react
2. Import NodeProps from @xyflow/react
3. Import GraphNodeData from graph-converter.ts
4. Import GraphOutputHandle from handles.tsx
5. NO GraphInputHandle (triggers have no input per NO_INPUT_TYPES)
6. Define component:
   - Props: NodeProps with data: GraphNodeData
   - Renders:
     a. NO input handle
     b. Trigger badge/indicator
     c. Node body: wrapper div with step.displayName
     d. GraphOutputHandle (bottom)
7. Use React.memo for performance
8. Set displayName = 'GraphTriggerNode'

### Phase E: Create tests (graph-node-handles.test.ts)

**File:** `packages/shared/test/flow/graph-node-handles.test.ts`

Tests for getHandlesForNodeType:
1. CODE action type returns [input, output] (2 handles)
2. PIECE action type returns [input, output] (2 handles)
3. LOOP_ON_ITEMS returns [input, output, loop-output] (3 handles)
4. ROUTER with 2 branches returns [input, output, branch-0, branch-1] (4 handles)
5. ROUTER with 3 branches returns [input, output, branch-0, branch-1, branch-2] (5 handles)
6. ROUTER with 0 branches returns [input, output] (2 handles)
7. EMPTY trigger returns [output] only (1 handle, NO input)
8. PIECE trigger returns [output] only (1 handle, NO input)
9. Handle IDs match HANDLE_IDS constants (not hardcoded strings)
10. Handle positions are correct (input=top, output=bottom, loop-output=right, branch=right)
11. Handle types are correct (input=target, output/loop-output/branch=source)
12. Default/unknown action type returns [input, output]
13. Branch handle IDs match branchHandle() function output
14. HandleConfig type is exported and usable

### Phase F: Self-check
1. Run syntax check: `npx tsc --noEmit` on new files
2. Run full test suite: `npx vitest run --root packages/shared`

---

## DP-5 -- Acceptance Criteria (Final)

### AC-1: getHandlesForNodeType returns correct handles for CODE action
- **Command:** `npx vitest run packages/shared/test/flow/graph-node-handles.test.ts --reporter=verbose`
- **Expected:** All tests pass, exit code 0
- **PASS:** "X passed" with X > 0, 0 failed
- **FAIL:** Exit code != 0 or any test FAILED

### AC-2: getHandlesForNodeType returns 3 handles for LOOP_ON_ITEMS (input + output + loop-output)
- **Command:** `npx vitest run packages/shared/test/flow/graph-node-handles.test.ts --reporter=verbose`
- **Expected:** LOOP_ON_ITEMS test passes
- **PASS:** 0 FAILED
- **FAIL:** LOOP_ON_ITEMS test fails

### AC-3: getHandlesForNodeType returns correct branch handles for ROUTER
- **Command:** `npx vitest run packages/shared/test/flow/graph-node-handles.test.ts --reporter=verbose`
- **Expected:** ROUTER tests pass
- **PASS:** 0 FAILED
- **FAIL:** ROUTER test fails

### AC-4: Trigger types return output handle only (no input)
- **Command:** `npx vitest run packages/shared/test/flow/graph-node-handles.test.ts --reporter=verbose`
- **Expected:** Trigger tests pass, verify no input handle in result
- **PASS:** 0 FAILED
- **FAIL:** Trigger test fails

### AC-5: Handle IDs use HANDLE_IDS constants from connection-rules.ts
- **Command:** `npx vitest run packages/shared/test/flow/graph-node-handles.test.ts --reporter=verbose`
- **Expected:** Handle ID consistency tests pass
- **PASS:** 0 FAILED
- **FAIL:** Handle ID test fails

### AC-6: All existing tests still pass (no regression)
- **Command:** `npx vitest run --root packages/shared --reporter=verbose`
- **Expected:** All tests pass, total >= 251 (previous), 0 failed
- **PASS:** 0 FAILED, total >= 251
- **FAIL:** Any FAILED or total < 251

### AC-7: React component files exist at correct paths
- **Command:** `test -f "packages/web/src/app/builder/graph-canvas/nodes/handles.tsx" && test -f "packages/web/src/app/builder/graph-canvas/nodes/graph-step-node.tsx" && test -f "packages/web/src/app/builder/graph-canvas/nodes/graph-trigger-node.tsx" && echo PASS`
- **Expected:** PASS
- **PASS:** Output is "PASS"
- **FAIL:** Any file missing

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| packages/shared/src/lib/automation/flows/util/graph-node-handles.ts | packages/shared/test/flow/graph-node-handles.test.ts | 14 tests: handle config for CODE, PIECE, LOOP, ROUTER (2/3 branches), triggers (EMPTY, PIECE), position correctness, type correctness, ID consistency with HANDLE_IDS, default behavior, HandleConfig export |
| packages/web/.../graph-canvas/nodes/handles.tsx | (React component -- tested via graph-node-handles.test.ts logic + future E2E) | Logic tested through shared utility |
| packages/web/.../graph-canvas/nodes/graph-step-node.tsx | (React component -- future E2E) | Component rendering tested at integration level in P1-D04 |
| packages/web/.../graph-canvas/nodes/graph-trigger-node.tsx | (React component -- future E2E) | Component rendering tested at integration level in P1-D04 |

---

## DP-MIGRATE -- Import Chain

No MODIFY files. All files are CREATE. No migration required.

New files establish these import relationships:
- graph-node-handles.ts imports from: connection-rules.ts, actions/action.ts, triggers/trigger.ts
- handles.tsx imports from: @xyflow/react, connection-rules.ts (via @activepieces/shared)
- graph-step-node.tsx imports from: @xyflow/react, handles.tsx, graph-converter.ts types, connection-rules.ts
- graph-trigger-node.tsx imports from: @xyflow/react, handles.tsx, graph-converter.ts types
