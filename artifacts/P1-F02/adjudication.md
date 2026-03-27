# Adjudication -- P1-F02

## RCC-F1 (MEDIUM): Test file naming
**Decision: ACCEPT.** Rename test file to `canvas-layout-persistence.test.ts`. Reviewer is correct that "server" is misleading when tests run in packages/shared.

## RCC-F2 (HIGH): Migration must handle pre-existing canvasLayout
**Decision: ACCEPT.** The migration must use `isNil(flowVersion.canvasLayout) ? null : flowVersion.canvasLayout` to preserve any canvasLayout that was already set. This is critical because users may have dispatched UPDATE_CANVAS_LAYOUT before the migration runs.

## RCC-F3 (LOW): createEmptyVersion null serialization
**Decision: ACKNOWLEDGED.** No plan change needed.

## RCC-F4 (MEDIUM): AC-1 not testable via vitest
**Decision: ACCEPT.** Remove AC-1 test reference. The entity column will be verified via code inspection during result_review. Renumber remaining ACs.

## Pre-mortem responses
- **Entity column before other changes:** Correct. The implementation order will be: 1) entity column, 2) migration, 3) constant bump, 4) import flow, 5) service changes. This ensures persistence works before any other logic depends on it.
- **Migration + constant atomicity:** Both are in the same commit (Phase 1), so they are atomic from git perspective. The migration registry entry and constant are updated together.
