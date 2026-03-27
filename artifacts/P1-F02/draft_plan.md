# Draft Plan -- P1-F02: Save/load canvasLayout -- server integration

## Profile: standard

## Step Description
Add server-side persistence for canvasLayout field so that graph canvas positions are saved to the database and loaded when a flow is opened.

## Phase 0 -- Context Files

| File | Purpose |
|------|---------|
| packages/shared/src/lib/automation/flows/flow-version.ts | CanvasLayout type definition + FlowVersion schema |
| packages/shared/src/lib/automation/flows/operations/index.ts | FlowOperationType + ImportFlowRequest + UPDATE_CANVAS_LAYOUT |
| packages/server/api/src/app/flows/flow-version/flow-version-entity.ts | TypeORM entity definition |
| packages/server/api/src/app/flows/flow-version/flow-version.service.ts | Service: applyOperation, createEmptyVersion, USE_AS_DRAFT |
| packages/server/api/src/app/flows/flow-version/flow-version-migration.service.ts | Migration orchestrator |
| packages/server/api/src/app/flows/flow-version/migrations/index.ts | Migration registry |
| packages/server/api/src/app/flows/flow-version/migrations/migrate-v13-add-notes.ts | Reference: how notes migration was done |
| packages/shared/src/lib/automation/flows/operations/import-flow.ts | IMPORT_FLOW operation handler |
| architecture/ARCHITECTURE.md | Architecture constraints |

## DP-1: GAP Analysis

**Current state (from architecture doc and code inspection):**

1. `CanvasLayout` and `CanvasViewport` Zod schemas exist in `flow-version.ts` (P1-PRE-01)
2. `canvasLayout` field exists in `FlowVersion` Zod schema as `Nullable(CanvasLayout).optional()` (P1-PRE-01)
3. `UPDATE_CANVAS_LAYOUT` operation type exists and works in `flowOperations.apply()` (P1-PRE-01)
4. Frontend `graph-state.ts` dispatches `UPDATE_CANVAS_LAYOUT` via `syncGraphToFlow()` and the flow-state sends it to server via `flowsApi.update()` (P1-D05, P1-F01)

**GAPS to close in P1-F02:**

| # | Gap | Resolution |
|---|-----|------------|
| G-1 | `flow-version-entity.ts` has NO `canvasLayout` column -- TypeORM will strip it on save | ADD canvasLayout column (jsonb, nullable) |
| G-2 | No schema migration for existing flows (schemaVersion '18' -> '19') | CREATE migrate-v18-add-canvas-layout.ts |
| G-3 | `LATEST_FLOW_SCHEMA_VERSION` is '18', needs '19' | UPDATE flow-version.ts constant |
| G-4 | `createEmptyVersion()` does not include `canvasLayout` in new FlowVersion | ADD canvasLayout: null |
| G-5 | `USE_AS_DRAFT` handler does not copy `canvasLayout` from previous version | ADD canvasLayout to IMPORT_FLOW request |
| G-6 | `ImportFlowRequest` Zod schema does not include canvasLayout | ADD optional canvasLayout field |
| G-7 | `_importFlow()` does not propagate canvasLayout in its operation sequence | ADD UPDATE_CANVAS_LAYOUT operation at end of import |

## DP-2: Spec vs Code Divergences

| # | Spec (Architecture Doc) | Actual Code | Resolution |
|---|------------------------|-------------|------------|
| D-1 | "Server entity needs canvasLayout column" (sec 3, MODIFY files) | flow-version-entity.ts has NO canvasLayout column | Add column |
| D-2 | "On save: extract positions -> update canvasLayout" (sec 6.1) | Frontend syncGraphToFlow dispatches UPDATE_CANVAS_LAYOUT correctly | Already working (P1-D05) |
| D-3 | "On load: if canvasLayout exists -> use stored positions" (sec 6.1) | graph-converter.ts reads flowVersion.canvasLayout.positions | Already working (P1-PRE-02) |
| D-4 | "canvasLayout=null for all existing flows" (sec 7) | No migration exists to set canvasLayout | Create migration |
| D-5 | "Server stores canvasLayout as JSON field" (sec 7, line 3) | Entity has no such column | Add column |

## DP-5: Acceptance Criteria

| AC | Description | Executable Check | PASS/FAIL |
|----|------------|------------------|-----------|
| AC-1 | canvasLayout column exists in flow_version entity | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "entity column"` | PASS when test passes |
| AC-2 | Schema migration v18->v19 adds canvasLayout=null to flows without it | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "migration"` | PASS when test passes |
| AC-3 | LATEST_FLOW_SCHEMA_VERSION equals '19' | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "schema version"` | PASS when test passes |
| AC-4 | createEmptyVersion includes canvasLayout: null | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "empty version"` | PASS when test passes |
| AC-5 | USE_AS_DRAFT copies canvasLayout from previous version | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "use as draft"` | PASS when test passes |
| AC-6 | ImportFlowRequest accepts optional canvasLayout field | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "import flow"` | PASS when test passes |
| AC-7 | UPDATE_CANVAS_LAYOUT round-trip: set -> save -> load preserves positions | `npx vitest run --root packages/shared test/flow/server-canvas-layout.test.ts -t "round trip"` | PASS when test passes |
| AC-8 | Existing tests continue to pass (no regression) | `npx vitest run --root packages/shared` | PASS when 0 FAILED |

## DP-TEST: Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| flow-version.ts (MODIFY) | test/flow/server-canvas-layout.test.ts (CREATE) | LATEST_FLOW_SCHEMA_VERSION = '19', CanvasLayout schema validation |
| operations/index.ts (MODIFY) | test/flow/server-canvas-layout.test.ts (CREATE) | ImportFlowRequest with canvasLayout, flowOperations.apply IMPORT_FLOW preserves canvasLayout |
| operations/import-flow.ts (MODIFY) | test/flow/server-canvas-layout.test.ts (CREATE) | _importFlow includes UPDATE_CANVAS_LAYOUT operation |
| flow-version-entity.ts (MODIFY) | (no unit test -- entity column verified via integration/schema test) | -- |
| migrate-v18-add-canvas-layout.ts (CREATE) | test/flow/server-canvas-layout.test.ts (CREATE) | Migration sets canvasLayout=null, bumps schemaVersion to '19' |
| flow-version.service.ts (MODIFY) | (no unit test -- requires DB/service layer; verified via shared-level import test) | -- |

## DP-MIGRATE: MODIFY Files with Consumers

### flow-version.ts
```
Import Chain:
  Dependents: operations/index.ts, graph-converter.ts, graph-state-utils.ts, graph-canvas-utils.ts, flow-version-entity.ts, flow-version.service.ts, flow-version-migration.service.ts
  Change: LATEST_FLOW_SCHEMA_VERSION '18' -> '19'
  Risk: LOW (constant value, no signature change)
```

### operations/index.ts
```
Import Chain:
  Dependents: flow-state.ts, graph-state.ts, flow-version.service.ts, import-flow.ts, many UI files
  Change: Add optional canvasLayout to ImportFlowRequest
  Risk: LOW (optional field addition, backward compatible)
```

### operations/import-flow.ts
```
Import Chain:
  Dependents: operations/index.ts (imported as _importFlow)
  Change: Add UPDATE_CANVAS_LAYOUT operation to import operation sequence
  Risk: LOW (additive, no existing behavior changed)
```

### flow-version-entity.ts (server)
```
Import Chain:
  Dependents: flow-version.service.ts, flow-version-migration.service.ts
  Change: Add canvasLayout column (jsonb, nullable)
  Risk: LOW (nullable column addition, no data loss)
```

### flow-version.service.ts (server)
```
Import Chain:
  Dependents: flow.controller.ts, flow.service.ts
  Change: Add canvasLayout to createEmptyVersion and USE_AS_DRAFT
  Risk: LOW (null default, backward compatible)
```

### migrations/index.ts (server)
```
Import Chain:
  Dependents: flow-version-migration.service.ts
  Change: Add migrateV18AddCanvasLayout to migration array
  Risk: LOW (additive, ordered by schema version)
```

## STOP RULE

If any MODIFY file has different structure than described above (e.g., flow-version.ts already has schemaVersion '19', or entity already has canvasLayout column), STOP and report to Orchestrator.

## Test Extension Plan

New test file: `packages/shared/test/flow/server-canvas-layout.test.ts`

Tests to write:
1. LATEST_FLOW_SCHEMA_VERSION equals '19'
2. CanvasLayout schema validates valid positions
3. CanvasLayout schema rejects invalid data
4. ImportFlowRequest accepts optional canvasLayout
5. ImportFlowRequest works without canvasLayout (backward compat)
6. flowOperations.apply(IMPORT_FLOW) with canvasLayout preserves it
7. flowOperations.apply(IMPORT_FLOW) without canvasLayout preserves null
8. Migration v18->v19 adds canvasLayout=null for flows without it
9. Migration v18->v19 preserves existing canvasLayout if present
10. Migration v18->v19 bumps schemaVersion to '19'
11. UPDATE_CANVAS_LAYOUT round-trip: apply + verify positions
12. createEmptyVersion schema: verify FlowVersion without canvasLayout validates (backward compat)
