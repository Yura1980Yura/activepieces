# Final Plan — P1-PRE-01

## Metadata
- **Step ID:** P1-PRE-01
- **Profile:** standard
- **Date:** 2026-03-27
- **Description:** Add canvasLayout field to FlowVersion type + UPDATE_CANVAS_LAYOUT operation

---

## STOP RULE

If any MODIFY-file's actual structure differs from what this plan describes, Developer MUST STOP immediately and report the divergence to Orchestrator. DO NOT improvise or adapt the plan.

---

## Files

### MODIFY
1. `packages/shared/src/lib/automation/flows/flow-version.ts` — Add CanvasLayout type + canvasLayout field to FlowVersion
2. `packages/shared/src/lib/automation/flows/operations/index.ts` — Add UPDATE_CANVAS_LAYOUT enum, request schema, union member, and switch case

### CREATE
3. `packages/shared/src/lib/automation/flows/__tests__/canvas-layout.test.ts` — Tests for CanvasLayout type and FlowVersion canvasLayout field
4. `packages/shared/src/lib/automation/flows/__tests__/update-canvas-layout.test.ts` — Tests for UPDATE_CANVAS_LAYOUT operation

---

## Implementation Phases

### Phase A: Define CanvasLayout type (flow-version.ts)

**File:** `packages/shared/src/lib/automation/flows/flow-version.ts`

1. Add `CanvasViewport` zod schema:
   ```typescript
   export const CanvasViewport = z.object({
       x: z.number(),
       y: z.number(),
       zoom: z.number(),
   })
   ```

2. Add `CanvasLayout` zod schema:
   ```typescript
   export const CanvasLayout = z.object({
       positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
       viewport: CanvasViewport.optional(),
   })
   ```

3. Export types:
   ```typescript
   export type CanvasViewport = z.infer<typeof CanvasViewport>
   export type CanvasLayout = z.infer<typeof CanvasLayout>
   ```

4. Add `canvasLayout` to `FlowVersion` zod schema (after `notes` field):
   ```typescript
   canvasLayout: Nullable(CanvasLayout).optional(),
   ```

5. Verify: `npx tsc --noEmit` on packages/shared

### Phase B: Add UPDATE_CANVAS_LAYOUT operation (operations/index.ts)

**File:** `packages/shared/src/lib/automation/flows/operations/index.ts`

1. Add to `FlowOperationType` enum:
   ```typescript
   UPDATE_CANVAS_LAYOUT = 'UPDATE_CANVAS_LAYOUT',
   ```

2. Add import for `CanvasLayout` from `flow-version.ts` (update existing import line):
   ```typescript
   import { FlowVersion, FlowVersionState, CanvasLayout } from '../flow-version'
   ```

3. Define `UpdateCanvasLayoutRequest` zod schema (near other request schemas):
   ```typescript
   export const UpdateCanvasLayoutRequest = z.object({
       canvasLayout: Nullable(CanvasLayout),
   })
   export type UpdateCanvasLayoutRequest = z.infer<typeof UpdateCanvasLayoutRequest>
   ```

4. Import `Nullable` already exists. Import `CanvasLayout` added in step 2.

5. Add union member to `FlowOperationRequest` (after the ADD_NOTE entry):
   ```typescript
   z.object({
       type: z.literal(FlowOperationType.UPDATE_CANVAS_LAYOUT),
       request: UpdateCanvasLayoutRequest,
   }).describe('Update Canvas Layout'),
   ```

6. Add case to `flowOperations.apply()` switch statement (before the `default` case):
   ```typescript
   case FlowOperationType.UPDATE_CANVAS_LAYOUT: {
       clonedVersion.canvasLayout = operation.request.canvasLayout
       break
   }
   ```

7. Verify: `npx tsc --noEmit` on packages/shared

### Phase C: Write tests

**File:** `packages/shared/src/lib/automation/flows/__tests__/canvas-layout.test.ts`

Tests:
- `test_canvasLayout_field_nullable` — FlowVersion.parse() with canvasLayout: null succeeds
- `test_canvasLayout_field_with_data` — FlowVersion.parse() with valid CanvasLayout object succeeds
- `test_canvasLayout_field_omitted` — FlowVersion.parse() succeeds when canvasLayout is absent from input (backward compat)
- `test_canvasLayout_validates_position_structure` — CanvasLayout.parse() accepts `{ positions: { 'step_1': { x: 100, y: 200 } } }` and rejects `{ positions: { 'step_1': 'bad' } }`

**File:** `packages/shared/src/lib/automation/flows/__tests__/update-canvas-layout.test.ts`

Tests:
- `test_UPDATE_CANVAS_LAYOUT_sets_canvasLayout` — flowOperations.apply() with UPDATE_CANVAS_LAYOUT sets canvasLayout on FlowVersion
- `test_UPDATE_CANVAS_LAYOUT_replaces_existing` — applying UPDATE_CANVAS_LAYOUT replaces existing canvasLayout
- `test_UPDATE_CANVAS_LAYOUT_does_not_modify_trigger` — applying UPDATE_CANVAS_LAYOUT leaves trigger chain unchanged

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| `flow-version.ts` | `__tests__/canvas-layout.test.ts` | canvasLayout_field_nullable, canvasLayout_field_with_data, canvasLayout_field_omitted, canvasLayout_validates_position_structure |
| `operations/index.ts` | `__tests__/update-canvas-layout.test.ts` | UPDATE_CANVAS_LAYOUT_sets_canvasLayout, UPDATE_CANVAS_LAYOUT_replaces_existing, UPDATE_CANVAS_LAYOUT_does_not_modify_trigger |

---

## Acceptance Criteria

### AC-1: CanvasLayout type exists and is correctly defined
**Command:** `npx tsc --noEmit -p packages/shared/tsconfig.json`
**PASS:** Exit code 0 with no new errors
**FAIL:** New compilation errors

### AC-2: FlowVersion zod schema includes canvasLayout field
**Command:** `grep -n "canvasLayout" packages/shared/src/lib/automation/flows/flow-version.ts`
**PASS:** 1+ matches
**FAIL:** 0 matches

### AC-3: FlowOperationType enum includes UPDATE_CANVAS_LAYOUT
**Command:** `grep -n "UPDATE_CANVAS_LAYOUT" packages/shared/src/lib/automation/flows/operations/index.ts`
**PASS:** 2+ matches (enum + union)
**FAIL:** < 2 matches

### AC-4: UpdateCanvasLayoutRequest zod schema exists
**Command:** `grep -n "UpdateCanvasLayoutRequest" packages/shared/src/lib/automation/flows/operations/index.ts`
**PASS:** 2+ matches (schema + type)
**FAIL:** < 2 matches

### AC-5: flowOperations.apply handles UPDATE_CANVAS_LAYOUT
**Command:** `grep -n "UPDATE_CANVAS_LAYOUT" packages/shared/src/lib/automation/flows/operations/index.ts | grep -i "case"`
**PASS:** 1 match
**FAIL:** 0 matches

### AC-6: CanvasLayout type uses correct structure
**Command:** `grep -A5 "CanvasLayout" packages/shared/src/lib/automation/flows/flow-version.ts | grep -E "positions|viewport"`
**PASS:** 2+ matches
**FAIL:** < 2 matches

### AC-7: Backward compatibility — existing consumers compile
**Command:** `npx tsc --noEmit -p packages/shared/tsconfig.json`
**PASS:** No new errors
**FAIL:** New errors referencing canvasLayout
