# Final Plan -- P1-F03

**Step:** P1-F03
**Profile:** standard
**Date:** 2026-03-27
**Description:** Migration: auto-layout for existing flows (null positions)

---

## STOP RULE
If real file structure differs from what this plan describes, STOP immediately. Record the divergence. Report to Orchestrator. Do NOT improvise or adapt the plan.

---

## Implementation Phases

### Phase 1: Add migrateCanvasLayout() to graph-converter.ts

**MODIFY:** `packages/shared/src/lib/automation/flows/util/graph-converter.ts`

Add a new exported function `migrateCanvasLayout()` that:
1. Takes nodes[], edges[], and canvasLayout (nullable)
2. When canvasLayout is null: compute full auto-layout via Dagre, return computed positions + `shouldPersistLayout: true`
3. When canvasLayout exists but some nodes are missing from positions: compute Dagre layout for ALL nodes, fill only the missing positions, preserve existing positions. Return merged positions + `shouldPersistLayout: true`
4. When canvasLayout exists and all nodes have positions: return existing positions + `shouldPersistLayout: false`
5. When canvasLayout exists but positions is empty `{}`: compute full auto-layout, return `shouldPersistLayout: true`

Return type:
```typescript
export type MigrationResult = {
    positions: Record<string, { x: number; y: number }>
    shouldPersistLayout: boolean
}
```

Import `computeAutoLayout` from `./auto-layout`.

### Phase 2: Update buildGraphFromFlowVersion() in graph-canvas-utils.ts

**MODIFY:** `packages/shared/src/lib/automation/flows/util/graph-canvas-utils.ts`

1. Replace inline auto-layout logic (lines 99-107) with call to `migrateCanvasLayout()`.
2. Extend `GraphCanvasData` type to include `shouldPersistLayout: boolean`.
3. Return the flag from `buildGraphFromFlowVersion()`.

Before (current):
```typescript
if (!flowVersion.canvasLayout) {
    const layout = computeAutoLayout(nodes, edges)
    for (const node of nodes) { ... }
}
```

After:
```typescript
const migration = migrateCanvasLayout(nodes, edges, flowVersion.canvasLayout ?? null)
for (const node of nodes) {
    const pos = migration.positions[node.id]
    if (pos) { node.position = { x: pos.x, y: pos.y } }
}
// return { nodes: allNodes, edges: typedEdges, shouldPersistLayout: migration.shouldPersistLayout }
```

### Phase 3: Update createInitialGraphData() and syncGraphFromFlowVersion() in graph-state-utils.ts

**MODIFY:** `packages/shared/src/lib/automation/flows/util/graph-state-utils.ts`

1. Replace inline auto-layout logic (lines 53-61) with call to `migrateCanvasLayout()`.
2. Extend `GraphStateData` type to include `shouldPersistLayout: boolean`.
3. Return the flag from both `createInitialGraphData()` and `syncGraphFromFlowVersion()`.

### Phase 4: Write tests

**CREATE:** `packages/shared/test/flow/migration-auto-layout.test.ts`

Tests to write:
1. **migrateCanvasLayout -- null canvasLayout**: verify positions are computed (non-zero) and shouldPersistLayout=true
2. **migrateCanvasLayout -- complete canvasLayout**: verify existing positions preserved and shouldPersistLayout=false
3. **migrateCanvasLayout -- partial canvasLayout (missing nodes)**: verify existing positions preserved, missing get Dagre positions, shouldPersistLayout=true
4. **migrateCanvasLayout -- empty positions record**: verify full auto-layout, shouldPersistLayout=true
5. **migrateCanvasLayout -- trigger-only flow**: verify single node gets position
6. **migrateCanvasLayout -- loop flow**: verify all nodes including loop children get positions
7. **migrateCanvasLayout -- router flow**: verify all nodes including branch children get positions
8. **migrateCanvasLayout -- nested flow (router inside loop)**: all nodes get positions
9. **buildGraphFromFlowVersion -- null layout signals shouldPersistLayout=true**: verify flag
10. **buildGraphFromFlowVersion -- complete layout signals shouldPersistLayout=false**: verify flag
11. **buildGraphFromFlowVersion -- partial layout signals shouldPersistLayout=true**: verify flag
12. **createInitialGraphData -- null layout signals shouldPersistLayout=true**: verify flag
13. **createInitialGraphData -- complete layout signals shouldPersistLayout=false**: verify flag
14. **syncGraphFromFlowVersion -- null layout signals shouldPersistLayout=true**: verify flag
15. **Partial canvasLayout preserves existing positions (pre-mortem-2)**: explicit assertion that existing saved positions are unchanged after migration

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| graph-converter.ts | test/flow/migration-auto-layout.test.ts | migrateCanvasLayout: null layout, complete layout, partial layout, empty positions, trigger-only, loop, router, nested, preservation of existing positions |
| graph-canvas-utils.ts | test/flow/migration-auto-layout.test.ts | buildGraphFromFlowVersion: null/complete/partial shouldPersistLayout flag |
| graph-state-utils.ts | test/flow/migration-auto-layout.test.ts | createInitialGraphData/syncGraphFromFlowVersion: shouldPersistLayout flag |

---

## Acceptance Criteria

### AC-1: Partial canvasLayout fills missing positions while preserving existing ones
**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** Tests pass verifying that existing positions are UNCHANGED and missing positions get non-zero Dagre-computed values
**PASS:** Exit code 0, "passed", 0 "FAILED"
**FAIL:** Exit code != 0 OR "FAILED" in output

### AC-2: Null canvasLayout triggers auto-layout with shouldPersistLayout=true
**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** Tests pass verifying shouldPersistLayout=true for null canvasLayout
**PASS:** Exit code 0
**FAIL:** Exit code != 0 OR "FAILED"

### AC-3: Complete canvasLayout returns shouldPersistLayout=false
**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** Tests pass verifying shouldPersistLayout=false
**PASS:** Exit code 0
**FAIL:** Exit code != 0 OR "FAILED"

### AC-4: All flow patterns handled (trigger-only, linear, loop, router, nested)
**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** Tests pass for all patterns
**PASS:** Exit code 0
**FAIL:** Exit code != 0 OR "FAILED"

### AC-5: Empty positions record triggers full auto-layout
**Command:** `npx vitest run packages/shared/test/flow/migration-auto-layout.test.ts`
**Expected:** Tests pass
**PASS:** Exit code 0
**FAIL:** Exit code != 0 OR "FAILED"

### AC-6: No regression in existing tests
**Command:** `npx vitest run packages/shared/test/flow/`
**Expected:** All previously passing tests still pass
**PASS:** Exit code 0, 0 "FAILED"
**FAIL:** Exit code != 0 OR "FAILED"
