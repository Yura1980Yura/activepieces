# Final Plan -- P1-E02: Context Menus (Node, Edge, Canvas)

## Metadata
- **Step:** P1-E02
- **Description:** Context menus (node, edge, canvas)
- **Profile:** standard
- **Date:** 2026-03-27
- **Dependencies:** P1-D04

---

## STOP RULE

> If the real file structure of graph-canvas/ or packages/shared/util/ differs from what this plan describes, STOP immediately. Do not improvise.

---

## Context Menu Action Definitions

### Node Context Menu Actions
- **delete** -- Delete the selected node (disabled for trigger nodes)
- **duplicate** -- Duplicate the selected node (disabled for trigger nodes)

### Edge Context Menu Actions
- **delete** -- Delete the selected edge

### Canvas Context Menu Actions
- **select-all** -- Select all nodes on canvas
- **paste** -- Paste previously copied nodes (if clipboard has data)

---

## Files to CREATE

### 1. packages/shared/src/lib/automation/flows/util/context-menu-utils.ts

Pure-logic shared utility. No React, no DOM dependencies.

**Exports:**
- `ContextMenuActionType` enum: 'node' | 'edge' | 'canvas'
- `ContextMenuAction` type: { id: string; label: string; icon: string; disabled?: boolean; destructive?: boolean; separator?: boolean }
- `NODE_CONTEXT_MENU_ACTIONS` constant: { DELETE: 'node-delete', DUPLICATE: 'node-duplicate' }
- `EDGE_CONTEXT_MENU_ACTIONS` constant: { DELETE: 'edge-delete' }
- `CANVAS_CONTEXT_MENU_ACTIONS` constant: { SELECT_ALL: 'canvas-select-all', PASTE: 'canvas-paste' }
- `getNodeContextMenuActions(isTrigger: boolean): ContextMenuAction[]` -- Returns actions for node context menu. Trigger nodes get empty array (no delete/duplicate on trigger). Action nodes get [duplicate, separator, delete].
- `getEdgeContextMenuActions(): ContextMenuAction[]` -- Returns [delete].
- `getCanvasContextMenuActions(): ContextMenuAction[]` -- Returns [select-all, paste].
- `getContextMenuTestId(actionId: string): string` -- Returns `context-menu-{actionId}` for data-testid.

### 2. packages/shared/test/flow/context-menu-utils.test.ts

Tests covering all exports from context-menu-utils.ts.

### 3. packages/web/src/app/builder/graph-canvas/context-menu/node-context-menu.tsx

React component wrapping Radix ContextMenu for node right-click.
- Imports: `@activepieces/shared` (getNodeContextMenuActions, getContextMenuTestId, NODE_CONTEXT_MENU_ACTIONS)
- Imports: `@/components/ui/context-menu` (ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator)
- Imports: `lucide-react` (Trash, CopyPlus)
- Props: `{ children: React.ReactNode; isTrigger: boolean; stepName: string; onDelete?: (stepName: string) => void; onDuplicate?: (stepName: string) => void }`

### 4. packages/web/src/app/builder/graph-canvas/context-menu/edge-context-menu.tsx

React component wrapping Radix ContextMenu for edge right-click.
- Imports: `@activepieces/shared` (getEdgeContextMenuActions, getContextMenuTestId, EDGE_CONTEXT_MENU_ACTIONS)
- Imports: `@/components/ui/context-menu`
- Imports: `lucide-react` (Trash)
- Props: `{ children: React.ReactNode; edgeId: string; onDelete?: (edgeId: string) => void }`

### 5. packages/web/src/app/builder/graph-canvas/context-menu/canvas-context-menu.tsx

React component wrapping Radix ContextMenu for canvas right-click.
- Imports: `@activepieces/shared` (getCanvasContextMenuActions, getContextMenuTestId, CANVAS_CONTEXT_MENU_ACTIONS)
- Imports: `@/components/ui/context-menu`
- Imports: `lucide-react` (MousePointerSquareDashed, ClipboardPaste)
- Props: `{ children: React.ReactNode; onSelectAll?: () => void; onPaste?: () => void }`

---

## Files to MODIFY

### 1. packages/shared/src/index.ts
Add: `export * from './lib/automation/flows/util/context-menu-utils'`

### 2. packages/web/src/app/builder/graph-canvas/index.tsx
- Add new optional props to GraphCanvasProps:
  - `onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void`
  - `onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void`
  - `onPaneContextMenu?: (event: React.MouseEvent) => void`
- Pass these callbacks to ReactFlow component
- Import context menu components and wrap appropriate elements

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| context-menu-utils.ts (NEW) | context-menu-utils.test.ts (NEW) | NODE_CONTEXT_MENU_ACTIONS constant values; EDGE_CONTEXT_MENU_ACTIONS constant values; CANVAS_CONTEXT_MENU_ACTIONS constant values; getNodeContextMenuActions(false) returns 3 items (duplicate, separator, delete); getNodeContextMenuActions(true) returns empty array for trigger; getEdgeContextMenuActions() returns 1 item (delete); getCanvasContextMenuActions() returns 2 items (select-all, paste); getContextMenuTestId format; action objects have required fields (id, label, icon); delete actions are marked destructive |

**Estimated new tests:** ~20
**Estimated total after step:** ~270 (250 existing + ~20 new)

---

## Acceptance Criteria (Updated per Adjudication)

### AC-1: Context menu utilities exist in shared with correct exports
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts`
- **Expected:** All tests pass, 0 failed
- **PASS:** Exit code 0, output contains "passed", 0 "FAILED"
- **FAIL:** Exit code non-zero OR output contains "FAILED"

### AC-2: Node context menu returns actions with Delete and Duplicate for action nodes
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getNodeContextMenuActions"`
- **Expected:** Tests verify action nodes get duplicate + delete
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-3: Node context menu returns empty for trigger nodes
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "trigger"`
- **Expected:** Trigger nodes get no actions (no delete/duplicate on trigger)
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-4: Edge context menu returns Delete action with id 'edge-delete'
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getEdgeContextMenuActions"`
- **Expected:** Edge menu returns exactly delete action
- **PASS:** Exit code 0, tests pass, action id = 'edge-delete'
- **FAIL:** Exit code non-zero

### AC-5: Canvas context menu returns Select All and Paste actions
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getCanvasContextMenuActions"`
- **Expected:** Canvas menu returns select-all + paste
- **PASS:** Exit code 0, tests pass, action ids include 'canvas-select-all' and 'canvas-paste'
- **FAIL:** Exit code non-zero

### AC-6: Test ID generator produces correct format
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "getContextMenuTestId"`
- **Expected:** Format is 'context-menu-{actionId}'
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-7: All delete actions marked as destructive
- **Command:** `npx vitest run --root packages/shared test/flow/context-menu-utils.test.ts -t "destructive"`
- **Expected:** delete actions have destructive: true
- **PASS:** Exit code 0, tests pass
- **FAIL:** Exit code non-zero

### AC-8: Full test suite passes with 0 failures
- **Command:** `npx vitest run --root packages/shared`
- **Expected:** All existing + new tests pass, total >= 270
- **PASS:** Exit code 0, 0 failed
- **FAIL:** Exit code non-zero OR any failed

### AC-9: React context menu components exist and import from shared
- **Verification:** Files exist at expected paths and contain imports from @activepieces/shared
- **Command:** `grep -l "getNodeContextMenuActions\|getEdgeContextMenuActions\|getCanvasContextMenuActions" packages/web/src/app/builder/graph-canvas/context-menu/*.tsx`
- **Expected:** 3 files found
- **PASS:** grep returns 3 file paths
- **FAIL:** fewer than 3 files OR files don't exist

### AC-10: GraphCanvas index.tsx passes context menu events to ReactFlow
- **Verification:** index.tsx contains onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu
- **Command:** `grep -c "onNodeContextMenu\|onEdgeContextMenu\|onPaneContextMenu" packages/web/src/app/builder/graph-canvas/index.tsx`
- **Expected:** count >= 3
- **PASS:** count >= 3
- **FAIL:** count < 3
