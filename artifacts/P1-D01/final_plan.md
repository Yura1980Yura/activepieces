# FINAL PLAN — P1-D01: Graph types + connection rules + connection validator

## Step Identity
- **Step:** P1-D01
- **Profile:** standard
- **Phase:** P1 (Free Canvas Graph Editor)
- **Previous step:** P1-PRE-02 (commit: 61893e2951)

---

## Phase 0: Context Files

Read before implementation:
1. `packages/shared/src/lib/automation/flows/util/graph-converter.ts` — existing GraphNode, GraphEdge types
2. `packages/shared/src/lib/automation/flows/actions/action.ts` — FlowActionType enum
3. `packages/shared/src/lib/automation/flows/triggers/trigger.ts` — FlowTriggerType enum
4. `packages/shared/src/lib/automation/flows/util/flow-structure-util.ts` — flowStructureUtil, Step type
5. `packages/shared/src/index.ts` — barrel exports
6. `packages/shared/test/flow/graph-converter.test.ts` — test pattern reference

---

## File Operations

| # | File | Operation | Description |
|---|------|-----------|-------------|
| 1 | `packages/shared/src/lib/automation/flows/util/connection-rules.ts` | CREATE | Handle type constants, ConnectionRule type, DEFAULT_CONNECTION_RULES, branchHandle() helper |
| 2 | `packages/shared/src/lib/automation/flows/util/connection-validator.ts` | CREATE | validateConnection(), detectCycle() — validates proposed edges |
| 3 | `packages/shared/src/index.ts` | MODIFY | Add 2 export lines for connection-rules and connection-validator |
| 4 | `packages/shared/test/flow/connection-rules.test.ts` | CREATE | Tests for types, handle constants, default rules, branchHandle() |
| 5 | `packages/shared/test/flow/connection-validator.test.ts` | CREATE | Tests for cycle detection, max connections, trigger protection, self-connection, valid connections |

---

## Implementation Spec

### File 1: connection-rules.ts

```typescript
// Handle type constants
export const HANDLE_IDS = {
    INPUT: 'input',
    OUTPUT: 'output',
    LOOP_OUTPUT: 'loop-output',
} as const

export function branchHandle(index: number): string {
    return `branch-${index}`
}

export type HandleType = typeof HANDLE_IDS[keyof typeof HANDLE_IDS] | `branch-${number}`

// Connection validation result
export type ConnectionValidationResult = {
    valid: boolean
    reason?: string
}

// Connection rule definition (from Architecture doc 6.2)
export type ConnectionRule = {
    sourceType: string   // FlowActionType | FlowTriggerType | '*'
    sourceHandle: string // handle ID
    targetType: string   // FlowActionType | FlowTriggerType | '*'
    targetHandle: string // always 'input'
    maxConnections: number // default 1 for ALL handles
}

// Default connection rules implementing Architecture doc 6.2
export const DEFAULT_CONNECTION_RULES: ConnectionRule[] = [
    // Trigger: output only (no input handle). Output → any action input
    { sourceType: '*', sourceHandle: HANDLE_IDS.OUTPUT, targetType: '*', targetHandle: HANDLE_IDS.INPUT, maxConnections: 1 },
    // Loop: loop-output → any action input (firstLoopAction)
    { sourceType: 'LOOP_ON_ITEMS', sourceHandle: HANDLE_IDS.LOOP_OUTPUT, targetType: '*', targetHandle: HANDLE_IDS.INPUT, maxConnections: 1 },
    // Router: branch-N → any action input (children[N])
    // Dynamic: each branch-N handle allows max 1 connection
]
```

### File 2: connection-validator.ts

```typescript
import { GraphNode, GraphEdge } from './graph-converter'
import { ConnectionValidationResult, HANDLE_IDS } from './connection-rules'

/**
 * Detect if adding an edge from sourceId to targetId would create a cycle.
 * Algorithm: BFS from targetId following existing edges. If sourceId is
 * reachable from targetId, adding the edge creates a cycle.
 */
export function detectCycle(
    sourceId: string,
    targetId: string,
    existingEdges: GraphEdge[]
): boolean

/**
 * Validate whether a proposed connection is valid.
 * Rules (from Architecture doc 6.2):
 * 1. No self-connections
 * 2. No cycles
 * 3. Max 1 edge per input handle (target cannot already have an incoming edge on same handle)
 * 4. Max 1 edge per output handle (source cannot already have an outgoing edge on same handle)
 * 5. Trigger node cannot be a target (no input handle)
 * 6. Source handle and target handle must exist on respective nodes
 */
export function validateConnection(
    sourceId: string,
    targetId: string,
    sourceHandle: string,
    targetHandle: string,
    nodes: GraphNode[],
    existingEdges: GraphEdge[]
): ConnectionValidationResult
```

### File 3: index.ts (MODIFY)

Add after existing graph-converter/auto-layout exports:
```typescript
export * from './lib/automation/flows/util/connection-rules'
export * from './lib/automation/flows/util/connection-validator'
```

---

## Acceptance Criteria (DP-5)

### AC-1: Connection rule types exported
- **Command:** `npx vitest run --root packages/shared test/flow/connection-rules.test.ts`
- **Expected:** All tests pass confirming ConnectionRule type, HANDLE_IDS constant, DEFAULT_CONNECTION_RULES array, and branchHandle() exist and are correctly typed.

### AC-2: Handle type safety
- **Command:** `npx vitest run --root packages/shared test/flow/connection-rules.test.ts -t "handle"`
- **Expected:** HANDLE_IDS.INPUT='input', OUTPUT='output', LOOP_OUTPUT='loop-output', branchHandle(0)='branch-0'.

### AC-3: Connection validator rejects cycles
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "cycle"`
- **Expected:** Validator returns { valid: false, reason: contains "cycle" }.

### AC-4: Connection validator enforces max 1 edge per input handle
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "max connections input"`
- **Expected:** Second edge to same input handle rejected.

### AC-5: Connection validator enforces max 1 edge per output handle
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "max connections output"`
- **Expected:** Second edge from same output handle rejected.

### AC-6: Connection validator rejects connection TO trigger
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "trigger"`
- **Expected:** Any connection targeting a trigger node rejected.

### AC-7: Connection validator rejects self-connections
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "self"`
- **Expected:** Edge from node to itself rejected.

### AC-8: Connection validator accepts valid connections
- **Command:** `npx vitest run --root packages/shared test/flow/connection-validator.test.ts -t "valid"`
- **Expected:** Standard trigger→action and action→action connections accepted.

### AC-9: All new types exported from packages/shared
- **Command:** `npx vitest run --root packages/shared test/flow/connection-rules.test.ts -t "exports"`
- **Expected:** All types importable from shared src index.

### AC-10: Router branch handle helper
- **Command:** `npx vitest run --root packages/shared test/flow/connection-rules.test.ts -t "branchHandle"`
- **Expected:** branchHandle(0)='branch-0', branchHandle(1)='branch-1', branchHandle(5)='branch-5'.

---

## Test Extension Plan

| Runtime file | Test file | New tests |
|-------------|-----------|-----------|
| `packages/shared/src/lib/automation/flows/util/connection-rules.ts` | `packages/shared/test/flow/connection-rules.test.ts` | ~8 tests: handle constants, branchHandle(), ConnectionRule type, DEFAULT_CONNECTION_RULES |
| `packages/shared/src/lib/automation/flows/util/connection-validator.ts` | `packages/shared/test/flow/connection-validator.test.ts` | ~15 tests: cycle detection (direct, indirect, no cycle), max connections (input, output), trigger protection, self-connection, valid connections, missing nodes |

**Estimated new tests:** ~23
**Existing tests (regression):** 196

---

## STOP-RULE

> If real file structure differs from what this plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise. Do NOT "adapt" the plan.
