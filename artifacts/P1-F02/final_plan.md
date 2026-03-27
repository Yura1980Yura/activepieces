# Final Plan -- P1-F02: Save/load canvasLayout -- server integration

## Profile: standard

## STOP RULE
If any MODIFY file has a different structure than described (e.g., flow-version.ts already has schemaVersion '19', entity already has canvasLayout column), STOP and report to Orchestrator.

## Implementation Order

### Phase A: Server Entity (persistence foundation)

**A1. MODIFY `packages/server/api/src/app/flows/flow-version/flow-version-entity.ts`**
Add `canvasLayout` column after `notes`:
```typescript
canvasLayout: {
    type: 'jsonb',
    nullable: true,
},
```

### Phase B: Schema Migration

**B1. CREATE `packages/server/api/src/app/flows/flow-version/migrations/migrate-v18-add-canvas-layout.ts`**
```typescript
import { FlowVersion, isNil } from '@activepieces/shared'
import { Migration } from '.'

export const migrateV18AddCanvasLayout: Migration = {
    targetSchemaVersion: '18',
    migrate: async (flowVersion: FlowVersion): Promise<FlowVersion> => {
        return {
            ...flowVersion,
            canvasLayout: isNil(flowVersion.canvasLayout) ? null : flowVersion.canvasLayout,
            schemaVersion: '19',
        }
    },
}
```

**B2. MODIFY `packages/server/api/src/app/flows/flow-version/migrations/index.ts`**
- Add import: `import { migrateV18AddCanvasLayout } from './migrate-v18-add-canvas-layout'`
- Add to migrations array (after migrateV17AddLastUpdatedDate): `migrateV18AddCanvasLayout`

### Phase C: Schema Version Constant

**C1. MODIFY `packages/shared/src/lib/automation/flows/flow-version.ts`**
- Change `LATEST_FLOW_SCHEMA_VERSION = '18'` to `LATEST_FLOW_SCHEMA_VERSION = '19'`

### Phase D: Import Flow with canvasLayout

**D1. MODIFY `packages/shared/src/lib/automation/flows/operations/index.ts`**
- Update `ImportFlowRequest` to include optional canvasLayout:
```typescript
export const ImportFlowRequest = z.object({
    displayName: z.string(),
    trigger: FlowTrigger,
    schemaVersion: Nullable(z.string()),
    notes: Nullable(z.array(Note)),
    canvasLayout: Nullable(CanvasLayout).optional(),
})
```

**D2. MODIFY `packages/shared/src/lib/automation/flows/operations/import-flow.ts`**
- At the end of `_importFlow()`, after the notes operations, add an UPDATE_CANVAS_LAYOUT operation if canvasLayout is present in the request:
```typescript
// After notes operations, before return:
if (!isNil(request.canvasLayout)) {
    operations.push({
        type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
        request: { canvasLayout: request.canvasLayout },
    })
}
```
- Add imports: `FlowOperationType, UpdateCanvasLayoutRequest` (FlowOperationType already imported, add canvasLayout check)

### Phase E: Service Layer

**E1. MODIFY `packages/server/api/src/app/flows/flow-version/flow-version.service.ts`**
- In `createEmptyVersion()`, add `canvasLayout: null` to the `flowVersion` object (after `notes`).
- In `USE_AS_DRAFT` handler, add `canvasLayout: previousVersion.canvasLayout` to the IMPORT_FLOW request.

### Phase F: Tests

**F1. CREATE `packages/shared/test/flow/canvas-layout-persistence.test.ts`**

Tests (all pure-logic, no DB/server):
1. `LATEST_FLOW_SCHEMA_VERSION equals 19` -- import and assert
2. `CanvasLayout schema validates valid positions` -- z.safeParse with valid data
3. `CanvasLayout schema rejects non-object positions` -- z.safeParse with invalid data
4. `ImportFlowRequest accepts optional canvasLayout` -- z.safeParse with canvasLayout
5. `ImportFlowRequest works without canvasLayout (backward compat)` -- z.safeParse without it
6. `flowOperations.apply IMPORT_FLOW with canvasLayout preserves it` -- apply import with canvasLayout, verify result
7. `flowOperations.apply IMPORT_FLOW without canvasLayout leaves it unchanged` -- apply import without, verify null
8. `migration v18->v19 adds canvasLayout null for flows without it` -- call migrate function directly
9. `migration v18->v19 preserves existing canvasLayout` -- call migrate with canvasLayout present
10. `migration v18->v19 bumps schemaVersion to 19` -- verify schemaVersion in result
11. `UPDATE_CANVAS_LAYOUT round-trip: set and verify` -- apply UPDATE_CANVAS_LAYOUT, verify positions
12. `FlowVersion schema validates with canvasLayout null` -- safeParse with null canvasLayout

## DP-5: Acceptance Criteria (revised per adjudication)

| AC | Description | Executable Check | PASS/FAIL |
|----|------------|------------------|-----------|
| AC-1 | Schema migration v18->v19 adds canvasLayout null | `npx vitest run --root packages/shared test/flow/canvas-layout-persistence.test.ts -t "migration"` | PASS |
| AC-2 | LATEST_FLOW_SCHEMA_VERSION equals '19' | `npx vitest run --root packages/shared test/flow/canvas-layout-persistence.test.ts -t "LATEST_FLOW_SCHEMA_VERSION"` | PASS |
| AC-3 | ImportFlowRequest accepts optional canvasLayout | `npx vitest run --root packages/shared test/flow/canvas-layout-persistence.test.ts -t "ImportFlowRequest"` | PASS |
| AC-4 | flowOperations.apply IMPORT_FLOW with canvasLayout preserves it | `npx vitest run --root packages/shared test/flow/canvas-layout-persistence.test.ts -t "IMPORT_FLOW"` | PASS |
| AC-5 | UPDATE_CANVAS_LAYOUT round-trip preserves positions | `npx vitest run --root packages/shared test/flow/canvas-layout-persistence.test.ts -t "round-trip"` | PASS |
| AC-6 | Entity canvasLayout column exists (code inspection) | Verified by code review of flow-version-entity.ts | PASS |
| AC-7 | All existing tests pass (no regression) | `npx vitest run --root packages/shared` | PASS |

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| flow-version.ts (MODIFY) | test/flow/canvas-layout-persistence.test.ts (CREATE) | LATEST_FLOW_SCHEMA_VERSION, CanvasLayout validation |
| operations/index.ts (MODIFY) | test/flow/canvas-layout-persistence.test.ts (CREATE) | ImportFlowRequest with/without canvasLayout |
| operations/import-flow.ts (MODIFY) | test/flow/canvas-layout-persistence.test.ts (CREATE) | flowOperations.apply IMPORT_FLOW preserves canvasLayout |
| migrate-v18-add-canvas-layout.ts (CREATE) | test/flow/canvas-layout-persistence.test.ts (CREATE) | Migration function tests |

## Files Summary

| # | File | Action | Description |
|---|------|--------|------------|
| 1 | flow-version-entity.ts | MODIFY | Add canvasLayout jsonb column |
| 2 | migrate-v18-add-canvas-layout.ts | CREATE | Migration v18->v19 |
| 3 | migrations/index.ts | MODIFY | Register migration |
| 4 | flow-version.ts | MODIFY | Bump LATEST_FLOW_SCHEMA_VERSION to '19' |
| 5 | operations/index.ts | MODIFY | Add canvasLayout to ImportFlowRequest |
| 6 | operations/import-flow.ts | MODIFY | Add UPDATE_CANVAS_LAYOUT to import sequence |
| 7 | flow-version.service.ts | MODIFY | createEmptyVersion + USE_AS_DRAFT |
| 8 | canvas-layout-persistence.test.ts | CREATE | 12 tests |
