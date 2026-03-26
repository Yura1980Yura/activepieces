# Draft Plan — P1-PRE-02

**Step:** P1-PRE-02 — Create graph<->linked-list converter with tests
**Profile:** full
**Date:** 2026-03-27
**Previous step:** P1-PRE-01 (commit: ae4aa2c8e5)

---

## Phase 0 — Document Collection

### Loaded Documents
- `architecture/ARCHITECTURE.md` — Phase 1 architecture document
- `engine/engine.yaml` — Pipeline definition

### DFC — Dependency Freshness Check

This step creates NEW files only. No MODIFY files to check for DFC divergence.

New files to create:
1. `packages/shared/src/lib/automation/flows/util/graph-converter.ts` — CREATE
2. `packages/shared/src/lib/automation/flows/util/auto-layout.ts` — CREATE

Files that need MODIFY for exports:
3. `packages/shared/src/index.ts` — MODIFY (add exports for new utils)

DFC for `packages/shared/src/index.ts`:
- Imports: re-exports from `./lib/automation/flows/util/flow-structure-util`, `./lib/automation/flows/util/flow-piece-util`, `./lib/automation/flows/util/flow-canvas-util`
- No divergence from Adjacency List. The file is a barrel export.

DFC result: **No divergences found.**

### RC-1 — Resource Check

New files have no runtime resources (no file I/O, no external URLs, no DB tables).
The converter imports from `@activepieces/shared` types which are local.
The auto-layout depends on `@dagrejs/dagre` which is NOT installed yet.

RC-1 result: **1 item discovered — @dagrejs/dagre needs to be installed in packages/shared.**

---

## DP-1 — GAPs from Architecture Documents

| # | Source | Section | Gap Description | Affected Files | Severity |
|---|--------|---------|----------------|----------------|----------|
| 1 | ARCHITECTURE.md | §6.1 | Graph<->linked-list converter not implemented | graph-converter.ts | BLOCKING |
| 2 | ARCHITECTURE.md | §6.4 | Auto-layout (Dagre) not implemented | auto-layout.ts | BLOCKING |
| 3 | ARCHITECTURE.md | §4 | Converter not in Adjacency List (new utility) | architecture doc | NON-BLOCKING |

---

## DP-2 — Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | graph-converter.ts | Must convert linked-list->graph and graph->linked-list (§6.1) | File does not exist | Create file implementing both directions |
| 2 | auto-layout.ts | Must use Dagre with TB direction, 80px v-sep, 140px h-sep (§6.4) | File does not exist | Create file with Dagre layout |
| 3 | flow-canvas-util.ts | Computes step positions using custom recursive algorithm | Exists with buildPositions/getFlowBBox | No conflict — auto-layout.ts is a new alternative using Dagre |

---

## DP-3 — OSS References with Licenses

| Library | Version | License | Usage Context | Review |
|---------|---------|---------|---------------|--------|
| @dagrejs/dagre | latest | MIT | Auto-layout graph positioning (TB direction) | OK — MIT is permissive |
| zod | (existing) | MIT | Schema validation for converter types | Already in use |
| @xyflow/react types | 12.3.5 (existing) | MIT | Node/Edge type interfaces | Already in use in web package |

No copyleft (GPL/AGPL) licenses. No review required.

---

## DP-4 — Product Documents

No product documents referenced for this step. The step implements pure data transformation utilities defined in the architecture document.

---

## DP-5 — Acceptance Criteria

### AC-1: Linked-list to graph conversion produces correct nodes
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "linked-list to graph"`
- **Expected:** All tests pass, exit code 0
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails or exit code != 0

### AC-2: Graph to linked-list conversion produces valid FlowVersion trigger chain
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "graph to linked-list"`
- **Expected:** All tests pass, exit code 0
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails or exit code != 0

### AC-3: Round-trip conversion preserves flow structure (linked-list -> graph -> linked-list = original)
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "round-trip"`
- **Expected:** All tests pass, exit code 0
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails or exit code != 0

### AC-4: Converter handles all action types (Code, Piece, Loop, Router)
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "action types"`
- **Expected:** Tests for Code, Piece, Loop, Router all pass
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-5: Auto-layout produces valid positions for all nodes (TB direction, correct spacing)
- **Command:** `npx vitest run --root packages/shared test/flow/auto-layout.test.ts`
- **Expected:** All tests pass, exit code 0
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails or exit code != 0

### AC-6: Converter detects orphan nodes (nodes not reachable from trigger)
- **Command:** `npx vitest run --root packages/shared test/flow/graph-converter.test.ts -t "orphan"`
- **Expected:** Tests pass verifying orphan detection
- **PASS:** stdout contains "passed", 0 "FAILED"
- **FAIL:** Any test fails

### AC-7: Existing flow tests still pass (no regressions)
- **Command:** `npx vitest run --root packages/shared`
- **Expected:** All tests pass, >= 164 tests (P1-PRE-01 baseline)
- **PASS:** stdout shows >= 164 passed, 0 failed
- **FAIL:** Any existing test fails or total < 164

### AC-8: New utilities are exported from @activepieces/shared
- **Command:** `npx tsc --noEmit --project packages/shared/tsconfig.json`
- **Expected:** No type errors, exit code 0
- **PASS:** exit code 0, no error output
- **FAIL:** TypeScript compilation errors

---

## DP-6 — Test Requirements

| File | Test Level | New Test Files | Existing Test Files | Min Coverage | Edge Cases |
|------|-----------|----------------|-------------------|-------------|------------|
| graph-converter.ts | unit + integration | graph-converter.test.ts | — | 100% of public functions | Empty flow (trigger only), linear chain, loop with children, router with branches, nested router-in-loop, orphan nodes, empty branch (null child) |
| auto-layout.ts | unit | auto-layout.test.ts | — | 100% of public functions | Single node, linear chain, branching, loop, large flow (10+ nodes), empty flow |

---

## DP-TEST — Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-converter.ts (CREATE) | test/flow/graph-converter.test.ts (CREATE) | test_linkedListToGraph_triggerOnly, test_linkedListToGraph_linearChain, test_linkedListToGraph_withLoop, test_linkedListToGraph_withRouter, test_linkedListToGraph_nestedRouterInLoop, test_graphToLinkedList_simpleChain, test_graphToLinkedList_withLoop, test_graphToLinkedList_withRouter, test_roundTrip_preservesStructure, test_roundTrip_withAllActionTypes, test_orphanDetection, test_edgeCreation_loopOutput, test_edgeCreation_branchHandles |
| auto-layout.ts (CREATE) | test/flow/auto-layout.test.ts (CREATE) | test_autoLayout_singleNode, test_autoLayout_linearChain, test_autoLayout_withLoop, test_autoLayout_withRouter, test_autoLayout_spacingCorrect, test_autoLayout_returnsCanvasLayout |

---

## DP-MIGRATE — Import Chain for MODIFY-files

### packages/shared/src/index.ts (MODIFY)

**Change:** Add 2 new export lines:
```
export * from './lib/automation/flows/util/graph-converter'
export * from './lib/automation/flows/util/auto-layout'
```

**Consumers:** Every package that imports from `@activepieces/shared`. This is an ADDITIVE change (new exports only, no removed/renamed symbols). No consumer breakage possible.

**Migration order:** Not applicable — additive export.

---

## STOP-RULE

> If the real file structure differs from what this plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise.

---

## Implementation Summary

### Phase A: Install dependency
1. Install `@dagrejs/dagre` and `@types/dagre` (if needed) in packages/shared

### Phase B: Create graph-converter.ts
1. Define GraphNode and GraphEdge interfaces (plain objects matching xyflow shape)
2. Implement `linkedListToGraph(flowVersion: FlowVersion): { nodes: GraphNode[], edges: GraphEdge[] }`
3. Implement `graphToLinkedList(nodes: GraphNode[], edges: GraphEdge[], trigger: FlowTrigger): FlowTrigger`
4. Handle all action types: Code, Piece, Loop, Router
5. Handle edge cases: orphan nodes, empty branches, nested structures

### Phase C: Create auto-layout.ts
1. Import dagre
2. Implement `computeAutoLayout(nodes: GraphNode[], edges: GraphEdge[]): CanvasLayout`
3. Use TB direction, 80px vertical separation, 140px horizontal separation
4. Return CanvasLayout (positions + optional viewport)

### Phase D: Export from shared
1. Add export lines to packages/shared/src/index.ts

### Phase E: Create tests
1. graph-converter.test.ts with comprehensive test suite
2. auto-layout.test.ts with layout verification tests
