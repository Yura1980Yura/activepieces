# Draft Plan — P1-PRE-01

## Metadata
- **Step ID:** P1-PRE-01
- **Profile:** standard
- **Date:** 2026-03-27
- **Description:** Add canvasLayout field to FlowVersion type + UPDATE_CANVAS_LAYOUT operation
- **Phase Document:** architecture/ARCHITECTURE.md

## Phase 0 — Document Collection

### Loaded Documents
1. `architecture/ARCHITECTURE.md` — Phase 1 architecture document (loaded)
2. `packages/shared/src/lib/automation/flows/flow-version.ts` — MODIFY file (loaded, 46 lines)
3. `packages/shared/src/lib/automation/flows/operations/index.ts` — MODIFY file (loaded, 431 lines)

### DFC — Dependency Freshness Check

**flow-version.ts** actual imports:
- `zod` (z)
- `../../core/common/base-model` (BaseModelSchema, Nullable)
- `../../core/common/id-generator` (ApId)
- `../../core/user` (UserWithMetaInformation)
- `./note` (Note)
- `./triggers/trigger` (FlowTrigger)

Architecture doc Adjacency List does not cover flow-version.ts dependencies (it describes the NEW graph-canvas layer). No divergence from existing code — all imports resolve correctly.

DFC result: **No divergences found.**

**operations/index.ts** actual imports:
- `zod`, various action schemas, FlowVersion, FlowVersionState, Note, SampleDataSetting, flowPieceUtil, flowStructureUtil, and all operation modules.

DFC result: **No divergences found.**

### RC-1 — Resource Check

**flow-version.ts:** No runtime resource references (fetch, readFile, writeFile, open).
**operations/index.ts:** No runtime resource references.

RC-1 result: **No missing resources.**

---

## DP-1 — GAPs from Architecture Documents

| # | Source | Section | GAP Description | Affected Files | Severity |
|---|--------|---------|-----------------|----------------|----------|
| 1 | ARCHITECTURE.md | Section 2 (Dual-Layer Model) | `canvasLayout` field not present in `FlowVersion` type | `flow-version.ts` | BLOCKING |
| 2 | ARCHITECTURE.md | Section 5 (Step Decomposition, P1-PRE-01) | `UPDATE_CANVAS_LAYOUT` operation not present in `FlowOperationType` enum or `FlowOperationRequest` union | `operations/index.ts` | BLOCKING |
| 3 | ARCHITECTURE.md | Section 2 (canvasLayout field) | `CanvasLayout` type definition not present anywhere | `flow-version.ts` | BLOCKING |
| 4 | ARCHITECTURE.md | Section 6.6 (Operation-to-Graph Mapping) | No handler for `UPDATE_CANVAS_LAYOUT` in `flowOperations.apply()` | `operations/index.ts` | BLOCKING |
| 5 | ARCHITECTURE.md | Section 2 | Server entity `FlowVersionEntity` does not have `canvasLayout` column | `flow-version-entity.ts` — but this is P1-F02 scope, NOT this step | NON-BLOCKING |

---

## DP-2 — Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | `flow-version.ts` | `FlowVersion` should include `canvasLayout: CanvasLayout | null` field (ARCHITECTURE.md Section 2) | No `canvasLayout` field exists. Zod schema has 11 fields: flowId, displayName, trigger, updatedBy, valid, schemaVersion, agentIds, state, connectionIds, backupFiles, notes | ADD `canvasLayout` as `Nullable(CanvasLayout)` to FlowVersion zod schema |
| 2 | `operations/index.ts` | `FlowOperationType` enum should include `UPDATE_CANVAS_LAYOUT` (ARCHITECTURE.md Section 6.6) | Enum has 24 members, no `UPDATE_CANVAS_LAYOUT` | ADD enum member |
| 3 | `operations/index.ts` | `FlowOperationRequest` union should include `UPDATE_CANVAS_LAYOUT` request type | Union has 24 members, no `UPDATE_CANVAS_LAYOUT` | ADD union member with `UpdateCanvasLayoutRequest` schema |
| 4 | `operations/index.ts` | `flowOperations.apply()` should handle `UPDATE_CANVAS_LAYOUT` | Switch statement has 17 cases, no `UPDATE_CANVAS_LAYOUT` case | ADD case to switch |

---

## DP-5 — Acceptance Criteria

### AC-1: CanvasLayout type exists and is correctly defined
**Command:** `npx tsc --noEmit -p "C:/Users/user/Desktop/Projects/activepieces/packages/shared/tsconfig.json" 2>&1 | head -5`
**Expected:** Exit code 0 (or only pre-existing errors, no new errors related to canvasLayout)
**PASS:** TypeScript compilation succeeds with no new errors
**FAIL:** New compilation errors referencing canvasLayout or CanvasLayout

### AC-2: FlowVersion zod schema includes canvasLayout field
**Command:** `grep -n "canvasLayout" "C:/Users/user/Desktop/Projects/activepieces/packages/shared/src/lib/automation/flows/flow-version.ts"`
**Expected:** At least 1 match showing `canvasLayout` in the FlowVersion zod object
**PASS:** grep returns 1+ matches with exit code 0
**FAIL:** grep returns 0 matches (exit code 1)

### AC-3: FlowOperationType enum includes UPDATE_CANVAS_LAYOUT
**Command:** `grep -n "UPDATE_CANVAS_LAYOUT" "C:/Users/user/Desktop/Projects/activepieces/packages/shared/src/lib/automation/flows/operations/index.ts"`
**Expected:** At least 2 matches: one in enum definition, one in FlowOperationRequest union
**PASS:** grep returns 2+ matches
**FAIL:** grep returns fewer than 2 matches

### AC-4: UpdateCanvasLayoutRequest zod schema exists
**Command:** `grep -n "UpdateCanvasLayoutRequest" "C:/Users/user/Desktop/Projects/activepieces/packages/shared/src/lib/automation/flows/operations/index.ts"`
**Expected:** At least 2 matches: schema definition and type export
**PASS:** grep returns 2+ matches
**FAIL:** grep returns fewer than 2 matches

### AC-5: flowOperations.apply handles UPDATE_CANVAS_LAYOUT
**Command:** `grep -n "UPDATE_CANVAS_LAYOUT" "C:/Users/user/Desktop/Projects/activepieces/packages/shared/src/lib/automation/flows/operations/index.ts" | grep -i "case"`
**Expected:** 1 match showing a case clause in the switch statement
**PASS:** grep returns 1 match
**FAIL:** grep returns 0 matches

### AC-6: CanvasLayout type uses correct structure (positions record + optional viewport)
**Command:** `grep -A5 "CanvasLayout" "C:/Users/user/Desktop/Projects/activepieces/packages/shared/src/lib/automation/flows/flow-version.ts" | grep -E "positions|viewport"`
**Expected:** Both `positions` and `viewport` appear in the CanvasLayout definition
**PASS:** grep returns 2 matches (positions + viewport)
**FAIL:** grep returns fewer than 2 matches

### AC-7: Existing FlowVersion consumers compile without changes (backward compatibility)
**Command:** `npx tsc --noEmit -p "C:/Users/user/Desktop/Projects/activepieces/packages/shared/tsconfig.json" 2>&1 | grep -c "error TS"`
**Expected:** 0 new TypeScript errors (canvasLayout is nullable/optional, so existing code should not break)
**PASS:** Error count is 0 or same as pre-existing baseline
**FAIL:** New errors appear referencing canvasLayout or CanvasLayout

---

## DP-TEST — Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| `flow-version.ts` | `packages/shared/src/lib/automation/flows/__tests__/flow-version.test.ts` (CREATE if not exists) | `test_canvasLayout_field_nullable` — FlowVersion.parse() with canvasLayout: null succeeds; `test_canvasLayout_field_with_data` — FlowVersion.parse() with valid CanvasLayout object succeeds; `test_canvasLayout_field_omitted` — FlowVersion without canvasLayout field handles gracefully |
| `operations/index.ts` | `packages/shared/src/lib/automation/flows/__tests__/operations.test.ts` (CREATE if not exists) | `test_UPDATE_CANVAS_LAYOUT_sets_canvasLayout` — flowOperations.apply() with UPDATE_CANVAS_LAYOUT sets canvasLayout on FlowVersion; `test_UPDATE_CANVAS_LAYOUT_replaces_existing` — applying UPDATE_CANVAS_LAYOUT replaces existing canvasLayout; `test_UPDATE_CANVAS_LAYOUT_does_not_modify_trigger` — applying UPDATE_CANVAS_LAYOUT leaves trigger chain unchanged |

---

## DP-MIGRATE — Import Chain for MODIFY-files

### flow-version.ts

**Consumers (files importing from flow-version.ts):**
1. `operations/index.ts` — imports `FlowVersion`, `FlowVersionState` (in-scope, modified in this step)
2. `operations/add-action.ts` — imports `FlowVersion` (no interface change, backward compatible)
3. `operations/add-action-util.ts` — imports `FlowVersion`
4. `operations/add-branch.ts` — imports `FlowVersion`
5. `operations/delete-action.ts` — imports `FlowVersion`
6. `operations/delete-branch.ts` — imports `FlowVersion`
7. `operations/duplicate-step.ts` — imports `FlowVersion`
8. `operations/import-flow.ts` — imports `FlowVersion`
9. `operations/move-action.ts` — imports `FlowVersion`
10. `operations/move-branch.ts` — imports `FlowVersion`
11. `operations/notes-operations.ts` — imports `FlowVersion`
12. `operations/copy-action-operations.ts` — imports `FlowVersion`
13. `operations/paste-operations.ts` — imports `FlowVersion`
14. `operations/skip-action.ts` — imports `FlowVersion`
15. `operations/update-action.ts` — imports `FlowVersion`
16. `operations/update-sample-data-info.ts` — imports `FlowVersion`
17. `operations/update-trigger.ts` — imports `FlowVersion`
18. `flow.ts` — imports `FlowVersion`
19. `util/flow-structure-util.ts` — imports `FlowVersion`
20. `util/flow-piece-util.ts` — imports `FlowVersion`
21. `dto/list-flows-request.ts` — imports `FlowVersionState`
22. `../../core/common/activepieces-error.ts` — imports `FlowVersionId` (type only)
23. `../../automation/engine/engine-operation.ts` — imports `FlowVersion`
24. `../../automation/engine/engine-constants.ts` — imports `FlowVersionState`
25. `../../automation/workers/worker-contract.ts` — imports `FlowVersion`
26. `../../automation/workers/job-data.ts` — imports `FlowVersion`
27. `../../management/template/template.ts` — imports `FlowVersion`
28. `../../ee/audit-events/index.ts` — imports `FlowVersion`
29. `packages/shared/src/index.ts` — re-exports all from flow-version.ts
30. `packages/server/api/src/app/flows/flow-version/flow-version-entity.ts` — uses `FlowVersion` type
31. `packages/server/api/src/app/flows/flow-version/flow-version.service.ts` — uses `FlowVersion`

**Impact analysis:** Adding `canvasLayout` as a **nullable optional** field to the zod schema means:
- The `FlowVersion` type gains a new optional property `canvasLayout: CanvasLayout | null`
- **No consumer requires changes** because canvasLayout defaults to `null` and is optional in the zod schema
- Existing code that creates FlowVersion objects (deep clones via `JSON.parse(JSON.stringify())`) will naturally include the field if present
- Server entity (`flow-version-entity.ts`) does NOT need a column yet — that is P1-F02 scope

**Migration order:** Not applicable. No consumer changes needed (additive, nullable field).

### operations/index.ts

**Consumers (files importing from operations/index.ts):**
- All files importing `FlowOperationType`, `FlowOperationRequest`, `flowOperations`, etc.
- Re-exported via `packages/shared/src/index.ts`
- Used by server-side flow services and web UI builder

**Impact analysis:** Adding `UPDATE_CANVAS_LAYOUT` to the enum and union:
- New enum member is additive, no existing code breaks
- New union member in `FlowOperationRequest` extends the union, no narrowing issues
- New switch case in `flowOperations.apply()` handles the new type, existing cases unchanged
- **No consumer requires changes** because the new operation is purely additive

**Migration order:** Not applicable. No consumer changes needed.

---

## STOP RULE

If any MODIFY-file's actual structure differs from what this plan describes, Developer MUST STOP immediately and report the divergence to Orchestrator. DO NOT improvise or adapt the plan.

---

## Implementation Phases

### Phase A: Define CanvasLayout type (flow-version.ts)
1. Add `CanvasLayout` zod schema defining `positions: Record<string, { x: number; y: number }>` and optional `viewport: { x: number; y: number; zoom: number }`
2. Add `canvasLayout` field to `FlowVersion` zod schema as `Nullable(CanvasLayout).optional()`
3. Verify: `npx tsc --noEmit`

### Phase B: Add UPDATE_CANVAS_LAYOUT operation (operations/index.ts)
1. Add `UPDATE_CANVAS_LAYOUT = 'UPDATE_CANVAS_LAYOUT'` to `FlowOperationType` enum
2. Define `UpdateCanvasLayoutRequest` zod schema with `canvasLayout` field
3. Add `UpdateCanvasLayoutRequest` type export
4. Add union member to `FlowOperationRequest` for `UPDATE_CANVAS_LAYOUT`
5. Add case to `flowOperations.apply()` switch statement to set `canvasLayout` on the cloned version
6. Verify: `npx tsc --noEmit`

### Phase C: Write tests
1. Create test file(s) for FlowVersion canvasLayout parsing
2. Create test file(s) for UPDATE_CANVAS_LAYOUT operation
3. Run tests: `npx vitest run` (relevant test files)
