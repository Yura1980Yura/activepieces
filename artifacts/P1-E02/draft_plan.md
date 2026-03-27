# Draft Plan -- P1-E02

## Metadata
- **Step:** P1-E02
- **Description:** Context menus (node, edge, canvas)
- **Profile:** standard
- **Date:** 2026-03-27
- **Dependencies:** P1-D04 (GraphCanvas main component)

---

## Phase 0 -- Document Collection

### Loaded Documents
1. architecture/ARCHITECTURE.md -- section 3 (File Structure), section 5 (Step Decomposition P1-E02 row), section 4 (Dependency Map)
2. project_config.yaml -- commands, paths, profiles

### DFC -- Dependency Freshness Check

**MODIFY: graph-canvas/index.tsx**
Actual imports:
- `@activepieces/shared` (buildGraphFromFlowVersion, createIsValidConnection, parsePaletteDragData, PALETTE_DRAG_TYPE, FlowVersion, PaletteDragData)
- `@xyflow/react` (ReactFlow, Background, BackgroundVariant, useReactFlow, OnNodesChange, OnEdgesChange, OnConnect, Node, NodeMouseHandler)
- `./canvas-controls` (GraphCanvasControls)
- `./graph-canvas-provider` (GraphCanvasProvider, useGraphCanvasContext)

Adjacency List declares the same set -- no divergence. DFC: no divergences found.

### RC-1 -- Resource Check
graph-canvas/index.tsx uses no file paths, no config keys, no external URLs. RC-1: no missing resources.

---

## DP-1 -- GAPs from Architecture Documents

| # | Source | Section | Gap Description | Affected Files | Severity |
|---|--------|---------|-----------------|----------------|----------|
| 1 | ARCHITECTURE.md | Section 3, File Structure | `context-menu/node-context-menu.tsx` not yet created | NEW: context-menu/node-context-menu.tsx | BLOCKING |
| 2 | ARCHITECTURE.md | Section 3, File Structure | `context-menu/edge-context-menu.tsx` not yet created | NEW: context-menu/edge-context-menu.tsx | BLOCKING |
| 3 | ARCHITECTURE.md | Section 3, File Structure | `context-menu/canvas-context-menu.tsx` not yet created | NEW: context-menu/canvas-context-menu.tsx | BLOCKING |
| 4 | ARCHITECTURE.md | Section 9, AC-8 | Context menus work for nodes, edges, canvas | All context-menu files | BLOCKING |
| 5 | ARCHITECTURE.md | Section 4, Dep Map | No dependency entry for context-menu/* yet | Architecture doc update needed | NON-BLOCKING |

---

## DP-2 -- Divergences: Spec vs Code

| # | File | Spec Says | Code Does | Resolution |
|---|------|-----------|-----------|------------|
| 1 | context-menu/*.tsx | Architecture doc lists 3 context menu components under graph-canvas/ | Directory does not exist yet | Create directory and files (this step) |
| 2 | graph-canvas/index.tsx | Architecture doc (P1-D04/P1-E02 row) shows context-menu/* as dependency of index.tsx | index.tsx has no context menu integration | Add onContextMenu handlers and context menu components |

No code-spec divergences found for existing files beyond the planned additions.

---

## DP-5 -- Acceptance Criteria

### AC-1: Context menu utilities exist in shared with correct exports
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts`
- **Expected:** All tests pass, 0 failed
- **PASS:** Exit code 0, output contains "passed", 0 "FAILED"
- **FAIL:** Exit code non-zero OR output contains "FAILED"

### AC-2: Node context menu renders with Delete and Duplicate actions
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "node context menu"`
- **Expected:** Tests for node menu actions pass
- **PASS:** Exit code 0, node menu tests pass
- **FAIL:** Exit code non-zero

### AC-3: Edge context menu renders with Delete action
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "edge context menu"`
- **Expected:** Tests for edge menu actions pass
- **PASS:** Exit code 0, edge menu tests pass
- **FAIL:** Exit code non-zero

### AC-4: Canvas context menu renders with Paste and Select All actions
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "canvas context menu"`
- **Expected:** Tests for canvas menu actions pass
- **PASS:** Exit code 0, canvas menu tests pass
- **FAIL:** Exit code non-zero

### AC-5: getNodeContextMenuActions returns correct actions for different node types
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getNodeContextMenuActions"`
- **Expected:** Trigger nodes get fewer actions (no delete), action nodes get full set
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-6: getEdgeContextMenuActions returns delete action
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getEdgeContextMenuActions"`
- **Expected:** Edge menu always returns delete action
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-7: getCanvasContextMenuActions returns paste and select-all actions
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getCanvasContextMenuActions"`
- **Expected:** Canvas menu returns paste + select all actions
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-8: Full test suite passes with 0 failures
- **Command:** `npx vitest run --root packages/shared`
- **Expected:** All existing + new tests pass
- **PASS:** Exit code 0, 0 failed, total count >= 273 (250 + ~23 new)
- **FAIL:** Exit code non-zero OR any failed tests

### AC-9: Context menu action IDs have test IDs for automation
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getContextMenuTestId"`
- **Expected:** Test ID generator produces correct data-testid format
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

---

## DP-TEST -- Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| context-menu-utils.ts (NEW, shared) | test/flow/context-menu-utils.test.ts (NEW) | getNodeContextMenuActions: trigger (fewer actions), action (full), loop (full), router (full); getEdgeContextMenuActions: returns delete; getCanvasContextMenuActions: returns paste + select-all; getContextMenuTestId: format check; NODE_CONTEXT_MENU_ACTIONS constant; EDGE_CONTEXT_MENU_ACTIONS constant; CANVAS_CONTEXT_MENU_ACTIONS constant; action type/id/icon validation |
| node-context-menu.tsx (NEW, web) | No unit test (React component, tested via shared utils) | N/A |
| edge-context-menu.tsx (NEW, web) | No unit test (React component, tested via shared utils) | N/A |
| canvas-context-menu.tsx (NEW, web) | No unit test (React component, tested via shared utils) | N/A |
| graph-canvas/index.tsx (MODIFY, web) | No new tests (existing tests cover; React context menu wiring is integration-level) | N/A |

**Rationale:** Following established pattern (P1-E01, P1-D03, P1-D04): pure-logic utilities in shared/ are extensively unit-tested; React components in web/ are minimal wrappers that reference shared constants and are tested at integration level.

---

## DP-MIGRATE -- Import Chain for MODIFY-files

### graph-canvas/index.tsx (MODIFY)

**Consumers of graph-canvas/index.tsx:**
This file exports `GraphCanvas` and `GraphCanvasProps`. Currently no external consumer imports from it (it will be integrated in P1-F01).

**Planned changes:** Add `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu` callback props + wrap ReactFlow with context menu components.

**Impact analysis:**
- No existing consumers will break (GraphCanvasProps is extended with optional new props)
- GraphCanvas component is standalone until P1-F01 integration
- All new props are optional (backward compatible)

**Migration order:** Not applicable (no consumers to migrate).

### packages/shared/src/index.ts (MODIFY -- add export)

**Consumers:** All packages that import from `@activepieces/shared`.
**Change:** Add `export * from './lib/automation/flows/util/context-menu-utils'`
**Impact:** Additive only (new export, no breaking changes). No migration needed.

---

## STOP RULE

> If the real file structure of graph-canvas/ or packages/shared/util/ differs from what this plan describes, STOP. Do not improvise.

---

## Implementation Summary

### Files to CREATE:
1. `packages/shared/src/lib/automation/flows/util/context-menu-utils.ts` -- Pure-logic context menu action definitions, getNodeContextMenuActions(), getEdgeContextMenuActions(), getCanvasContextMenuActions(), getContextMenuTestId(), constants
2. `packages/shared/test/flow/context-menu-utils.test.ts` -- Unit tests for all shared utils
3. `packages/web/src/app/builder/graph-canvas/context-menu/node-context-menu.tsx` -- React component for node right-click
4. `packages/web/src/app/builder/graph-canvas/context-menu/edge-context-menu.tsx` -- React component for edge right-click
5. `packages/web/src/app/builder/graph-canvas/context-menu/canvas-context-menu.tsx` -- React component for canvas right-click

### Files to MODIFY:
1. `packages/shared/src/index.ts` -- Add export for context-menu-utils
2. `packages/web/src/app/builder/graph-canvas/index.tsx` -- Add context menu event handlers (onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu props to ReactFlow)
