# DRAFT PLAN — P1-D01: Graph types + connection rules + connection validator

## Step Identity
- **Step:** P1-D01
- **Profile:** standard
- **Phase:** P1 (Free Canvas Graph Editor)
- **Previous step:** P1-PRE-02 (commit: 61893e2951)

---

## DP-1: GAP-ы шага

From ARCHITECTURE.md sections 6.2 and 6.3:

1. **Graph-specific TypeScript types** — The graph-converter.ts already defines `GraphNode`, `GraphEdge`, `GraphNodeData`, `GraphConversionResult` but these are converter-level types. The architecture doc section 6.2 specifies a `ConnectionRule` type and connection validation rules that don't exist yet.

2. **Connection validation logic** — No code exists to validate whether a connection between two nodes is allowed. The architecture requires:
   - No cycles
   - Max 1 edge per input handle
   - Max 1 edge per output handle
   - Trigger has no input handle
   - Type-based validation (what can connect to what)

3. **Handle type definitions** — The architecture specifies handle IDs (`output`, `loop-output`, `branch-{N}`, `input`) and their semantics. These need formal type definitions.

4. **ApGraphNode / ApGraphEdge** — Architecture section 6.5 references `ApGraphNode` and `ApGraphEdge` types for the Zustand state. These should be defined here as the canonical graph types, extending/wrapping the existing `GraphNode`/`GraphEdge` from graph-converter.ts.

---

## DP-2: Расхождения spec vs код

1. **graph-converter.ts already defines basic types** — `GraphNode`, `GraphEdge`, `GraphNodeData` exist. P1-D01 must NOT duplicate them. Instead, P1-D01 should:
   - Re-export existing types from graph-converter.ts where needed
   - Define NEW types (ConnectionRule, handle types, validation results) that complement them
   - Define `ApGraphNode` and `ApGraphEdge` as React-Flow-compatible wrappers

2. **Architecture doc places files in `graph-canvas/utils/`** — But P1-PRE-02 placed converter in `packages/shared/src/lib/automation/flows/util/`. For consistency and because connection-rules depend on `FlowActionType`/`FlowTriggerType` from shared, files should be in `packages/shared/src/lib/automation/flows/util/`.

3. **Handle IDs already used** — graph-converter.ts uses string literals `'output'`, `'loop-output'`, `'branch-${index}'`, `'input'`. Types should formalize these.

---

## DP-5: Acceptance Criteria

### AC-1: Connection rule types exported
- **Command:** `vitest run --root packages/shared test/flow/connection-rules.test.ts`
- **Expected:** Tests pass confirming ConnectionRule type, HANDLE_TYPES constant, and DEFAULT_CONNECTION_RULES array exist and are correctly typed.

### AC-2: Handle type safety
- **Command:** `vitest run --root packages/shared test/flow/connection-rules.test.ts -t "handle types"`
- **Expected:** Tests verify handle type constants (INPUT, OUTPUT, LOOP_OUTPUT, branchHandle()) produce correct string values matching graph-converter.ts usage.

### AC-3: Connection validator rejects cycles
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "cycle"`
- **Expected:** Validator returns `{ valid: false, reason: ... }` when connection would create a cycle.

### AC-4: Connection validator enforces max 1 edge per input handle
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "max connections input"`
- **Expected:** Second edge to same input handle is rejected.

### AC-5: Connection validator enforces max 1 edge per output handle
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "max connections output"`
- **Expected:** Second edge from same output handle is rejected.

### AC-6: Connection validator rejects connection TO trigger
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "trigger no input"`
- **Expected:** Any connection targeting a trigger node is rejected.

### AC-7: Connection validator rejects self-connections
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "self connection"`
- **Expected:** Edge from node to itself is rejected.

### AC-8: Connection validator accepts valid connections
- **Command:** `vitest run --root packages/shared test/flow/connection-validator.test.ts -t "valid connection"`
- **Expected:** Standard trigger→action and action→action connections accepted.

### AC-9: All new types exported from packages/shared
- **Command:** `vitest run --root packages/shared test/flow/connection-rules.test.ts -t "exports"`
- **Expected:** All types importable from `@activepieces/shared` (or the shared src index).

---

## DP-TEST: Test Extension Plan

| Runtime file | Test file | New tests |
|-------------|-----------|-----------|
| `packages/shared/src/lib/automation/flows/util/connection-rules.ts` | `packages/shared/test/flow/connection-rules.test.ts` | Type existence, handle constants, default rules, branchHandle() |
| `packages/shared/src/lib/automation/flows/util/connection-validator.ts` | `packages/shared/test/flow/connection-validator.test.ts` | Cycle detection, max connections, trigger protection, self-connection, valid connections |

**Estimated new tests:** ~20-25
**Existing tests (regression):** 196

---

## DP-MIGRATE: MODIFY-файлы с consumers

### MODIFY: `packages/shared/src/index.ts`
- **Change:** Add exports for connection-rules.ts and connection-validator.ts
- **Import Chain:** This is the main barrel export. ALL consumers of @activepieces/shared use this.
- **Risk:** LOW (additive only, no existing exports change)

### No other MODIFY files. All runtime files are CREATE.

---

## File Operations Summary

| File | Operation | Description |
|------|-----------|-------------|
| `packages/shared/src/lib/automation/flows/util/connection-rules.ts` | CREATE | Handle types, ConnectionRule type, DEFAULT_CONNECTION_RULES |
| `packages/shared/src/lib/automation/flows/util/connection-validator.ts` | CREATE | validateConnection(), detectCycle() |
| `packages/shared/src/index.ts` | MODIFY | Add 2 export lines |
| `packages/shared/test/flow/connection-rules.test.ts` | CREATE | Tests for types and rules |
| `packages/shared/test/flow/connection-validator.test.ts` | CREATE | Tests for validator |

---

## STOP-RULE

> If real file structure differs from what the plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise.
