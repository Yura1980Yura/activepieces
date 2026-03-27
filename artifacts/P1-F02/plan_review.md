# Plan Review -- P1-F02

## Verdict: APPROVED WITH CHANGES

## Findings

### RCC-F1 (MEDIUM): Test file naming
The test file `server-canvas-layout.test.ts` is misleading because tests run in packages/shared (pure logic), not against server/DB. Rename to `canvas-layout-persistence.test.ts`.

### RCC-F2 (HIGH): Migration must handle pre-existing canvasLayout
The migration migrate-v18-add-canvas-layout must handle flows where canvasLayout was already set via UPDATE_CANVAS_LAYOUT before the migration runs. Plan states "sets canvasLayout=null for flows without it" but should explicitly preserve existing canvasLayout values. Use `isNil(flowVersion.canvasLayout) ? null : flowVersion.canvasLayout` pattern.

### RCC-F3 (LOW): createEmptyVersion null serialization
Adding `canvasLayout: null` to createEmptyVersion is correct. TypeORM+sanitizeObjectForPostgresql handles null serialization. No action needed, just noting.

### RCC-F4 (MEDIUM): AC-1 not testable via vitest
The entity column (flow-version-entity.ts) is a TypeORM schema definition, not testable via vitest in packages/shared. AC-1 should be a code-inspection check, not a unit test assertion. Remove the test reference for AC-1 and verify via code review.

## Pre-mortem
- **Risk:** Migration runs on read (lazy migration). If a flow is read but canvasLayout column doesn't exist in entity, TypeORM will silently drop the value. The entity column must be added BEFORE any other changes to ensure persistence works.
- **Risk:** If LATEST_FLOW_SCHEMA_VERSION is bumped but migration is not registered, new flows will have version '19' but old flows will never migrate. Both changes must be atomic.
