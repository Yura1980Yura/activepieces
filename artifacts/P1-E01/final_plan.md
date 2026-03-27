# FINAL PLAN -- P1-E01: Piece palette sidebar with drag-and-drop onto canvas

## Step Identity
- **Step:** P1-E01
- **Profile:** standard
- **Phase:** P1 -- Free Canvas Graph Editor
- **Dependencies:** P1-D04 (GraphCanvas), P1-D05 (graph state)
- **Previous step:** P1-D06 (canvas controls)

---

## Phase 0

### DFC (Drift Check): No divergences found.
- DC-1: PASS (P1-D06 status=done)
- DC-2: PASS (0 in_progress)
- DC-3: PASS (CHANGELOG has P1-D06)
- DC-4: PASS (REGRESSION_REGISTRY has P1-D06)

### RC-1: Resource Check
- `piecesHooks.usePiecesSearch()` — exists in `packages/web/src/features/pieces/hooks/pieces-hooks.ts`
- `PieceIcon` — exists in `packages/web/src/features/pieces/components/piece-icon.tsx`
- `StepMetadataWithSuggestions` type — exists in `packages/web/src/features/pieces/types/index.ts`
- `@xyflow/react` — already installed (version 12.3.5)
- `FlowOperationType.ADD_ACTION` — exists in `@activepieces/shared`

---

## File Plan

### CREATE files:
1. `packages/shared/src/lib/automation/flows/util/piece-palette-utils.ts` — Pure-logic utilities for piece palette drag-and-drop
2. `packages/shared/test/flow/piece-palette-utils.test.ts` — Tests for palette utilities
3. `packages/web/src/app/builder/graph-canvas/sidebar/piece-palette.tsx` — Sidebar React component
4. `packages/web/src/app/builder/graph-canvas/sidebar/piece-palette-item.tsx` — Draggable piece item React component

### MODIFY files:
1. `packages/shared/src/index.ts` — Add export for piece-palette-utils
2. `packages/web/src/app/builder/graph-canvas/index.tsx` — Add onDrop/onDragOver handlers for palette drops

---

## Implementation Spec

### Part 1: Shared Utilities (piece-palette-utils.ts)

**File:** `packages/shared/src/lib/automation/flows/util/piece-palette-utils.ts`

This file contains pure-logic functions for palette drag-and-drop, following the established pattern (P1-D01 through P1-D06): pure logic in shared, no React/DOM dependencies.

#### Constants:
```typescript
export const PALETTE_DRAG_TYPE = 'application/x-ap-palette-item';
```

#### Types:
```typescript
export type PaletteDragData = {
  pieceType: string;      // FlowActionType value (e.g., 'PIECE', 'CODE', 'LOOP_ON_ITEMS', 'ROUTER')
  pieceName: string;      // piece package name (e.g., '@activepieces/piece-gmail')
  displayName: string;    // human-readable name (e.g., 'Gmail')
  logoUrl: string;        // piece icon URL
};
```

#### Functions:

1. `createPaletteDragData(pieceType, pieceName, displayName, logoUrl): string`
   - Serializes PaletteDragData to JSON string for HTML5 drag dataTransfer
   - Returns JSON.stringify({ pieceType, pieceName, displayName, logoUrl })

2. `parsePaletteDragData(data: string): PaletteDragData | null`
   - Parses JSON string back to PaletteDragData
   - Returns null if JSON is invalid or missing required fields (pieceType, pieceName, displayName, logoUrl must all be non-empty strings)

3. `createAddActionFromDrop(dragData: PaletteDragData, parentStep: string): { type: FlowOperationType.ADD_ACTION, request: object }`
   - Creates a FlowOperationRequest for adding a new action from dropped palette item
   - For PIECE type: includes pieceName and empty settings
   - For CODE/LOOP_ON_ITEMS/ROUTER types: includes type-specific defaults
   - parentStep is the step name to attach the new action after

4. `filterPaletteItems(items: PaletteDragData[], query: string): PaletteDragData[]`
   - Filters items by displayName substring match
   - Case-insensitive
   - Returns all items when query is empty

5. `getPaletteItemTestId(pieceName: string): string`
   - Returns `palette-item-${pieceName}` for data-testid attributes

### Part 2: Shared Index Export

**File:** `packages/shared/src/index.ts`

Add line:
```typescript
export * from './lib/automation/flows/util/piece-palette-utils'
```

### Part 3: React Components

**File:** `packages/web/src/app/builder/graph-canvas/sidebar/piece-palette-item.tsx`

A draggable piece item that uses HTML5 native drag (`draggable` attribute + `onDragStart` setting dataTransfer).

```
Props:
  - displayName: string
  - logoUrl: string
  - pieceType: string
  - pieceName: string

Behavior:
  - Renders piece icon (PieceIcon) + display name
  - Sets draggable={true}
  - onDragStart: e.dataTransfer.setData(PALETTE_DRAG_TYPE, createPaletteDragData(...))
  - onDragStart: e.dataTransfer.effectAllowed = 'move'
  - data-testid={getPaletteItemTestId(pieceName)}
```

**File:** `packages/web/src/app/builder/graph-canvas/sidebar/piece-palette.tsx`

The sidebar component that lists available pieces.

```
Props:
  - items: Array<{ displayName, logoUrl, pieceType, pieceName }>

Behavior:
  - Renders a container with title "Pieces"
  - Search input for filtering (controlled local state)
  - Maps filtered items to PiecePaletteItem components
  - Uses filterPaletteItems from shared utils
  - data-testid="piece-palette-sidebar"
```

### Part 4: GraphCanvas Drop Integration

**File:** `packages/web/src/app/builder/graph-canvas/index.tsx`

Add to GraphCanvasProps:
```typescript
onPieceDrop?: (dragData: PaletteDragData, position: { x: number; y: number }) => void;
```

Add to ReactFlow element:
```typescript
onDragOver={(event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}}
onDrop={(event) => {
  event.preventDefault();
  const data = event.dataTransfer.getData(PALETTE_DRAG_TYPE);
  if (!data) return;
  const dragData = parsePaletteDragData(data);
  if (!dragData) return;
  // use ReactFlow's screenToFlowPosition to convert
  const position = reactFlowInstance.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });
  onPieceDrop?.(dragData, position);
}}
```

Note: `reactFlowInstance` is obtained via `useReactFlow()` inside GraphCanvasInner (which is already inside ReactFlowProvider). Need to add `useReactFlow()` call.

---

## STOP RULE

> If any file listed above does not exist at the expected path, or if the existing code structure differs significantly from what this plan describes, STOP immediately and report the divergence. Do NOT improvise or adapt.

---

## DP-5: Acceptance Criteria

### AC-E01-1: Piece palette shared utilities exist with complete API
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts
Expected: All tests pass, count >= 14
PASS/FAIL: grep 'passed' in output, 0 'FAILED', count >= 14
```

### AC-E01-2: createPaletteDragData produces valid JSON with all required fields
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "createPaletteDragData"
Expected: Tests verify pieceType, pieceName, displayName, logoUrl are present and non-empty
PASS/FAIL: test passes
```

### AC-E01-3: parsePaletteDragData correctly parses and validates drag data
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "parsePaletteDragData"
Expected: Tests verify parsing valid JSON + rejecting invalid/incomplete JSON
PASS/FAIL: test passes
```

### AC-E01-4: createAddActionFromDrop creates correct operation for each piece type
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "createAddActionFromDrop"
Expected: 4 tests pass (PIECE, CODE, LOOP_ON_ITEMS, ROUTER)
PASS/FAIL: test passes
```

### AC-E01-5: filterPaletteItems correctly filters by search query
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "filterPaletteItems"
Expected: Tests verify filtering, empty query returns all, case-insensitive
PASS/FAIL: test passes
```

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| packages/shared/src/lib/automation/flows/util/piece-palette-utils.ts | packages/shared/test/flow/piece-palette-utils.test.ts | 14+ |

### Test List:
1. PALETTE_DRAG_TYPE constant has expected value
2. getPaletteItemTestId returns correct format
3. createPaletteDragData produces valid JSON string
4. createPaletteDragData includes all required fields (pieceType, pieceName, displayName, logoUrl)
5. createPaletteDragData fields are non-empty strings
6. parsePaletteDragData parses valid JSON back to PaletteDragData
7. parsePaletteDragData returns null for invalid JSON
8. parsePaletteDragData returns null for JSON missing required fields
9. createAddActionFromDrop creates ADD_ACTION for PIECE type
10. createAddActionFromDrop creates ADD_ACTION for CODE type
11. createAddActionFromDrop creates ADD_ACTION for LOOP_ON_ITEMS type
12. createAddActionFromDrop creates ADD_ACTION for ROUTER type
13. filterPaletteItems returns all items when query is empty
14. filterPaletteItems filters by displayName case-insensitive
15. Full pipeline: createPaletteDragData -> parsePaletteDragData -> createAddActionFromDrop round-trip

Total new tests: >= 15
Expected total after step: 238+ (previous: 227)

---

## DP-MIGRATE: MODIFY files with consumers

### MODIFY: packages/web/src/app/builder/graph-canvas/index.tsx
- **Change:** Add onPieceDrop prop, onDragOver/onDrop handlers, useReactFlow() call
- **Import Chain:**
  - Consumers: standalone (P1-F01 will integrate)
  - Imports from: @activepieces/shared (add parsePaletteDragData, PALETTE_DRAG_TYPE), @xyflow/react (add useReactFlow)
- **Risk:** LOW — additive changes, no existing behavior modified

### MODIFY: packages/shared/src/index.ts
- **Change:** Add export for piece-palette-utils
- **Import Chain:**
  - All @activepieces/shared consumers
- **Risk:** LOW — additive export only
