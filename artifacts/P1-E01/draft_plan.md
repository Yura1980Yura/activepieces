# DRAFT PLAN — P1-E01: Piece palette sidebar with drag-and-drop onto canvas

## Step Identity
- **Step:** P1-E01
- **Profile:** standard
- **Phase:** P1 — Free Canvas Graph Editor
- **Dependencies:** P1-D04 (GraphCanvas), P1-D05 (graph state)
- **Previous step:** P1-D06 (canvas controls)

---

## DP-1: GAP-s of the step

### From Architecture Doc:

1. **Sidebar file structure:** Architecture doc (section 3) specifies:
   - `graph-canvas/sidebar/piece-palette.tsx` — Draggable pieces sidebar
   - `graph-canvas/sidebar/piece-palette-item.tsx` — Single draggable piece

2. **Dependency map (section 4)** specifies:
   - `graph-canvas/index.tsx → sidebar/piece-palette.tsx`
   - Piece palette uses drag-and-drop to add nodes to canvas

3. **Architecture doc section 6.5** specifies `addNodeFromPalette: (piece: PieceMetadata, position: XYPosition) => void` in GraphState.

4. **Technology decision (section 10):** `@dnd-kit/core 6.1.0 (existing)` for palette drag-and-drop.

5. **Acceptance Criteria AC-5 (section 9):** "Piece palette sidebar: drag piece onto canvas creates node"

### GAPs to close:
- G1: Pure-logic utilities for piece palette (data transformation, drag constants, palette item types) — to be placed in `packages/shared/util/` following established pattern (P1-D01 through P1-D06).
- G2: React component `PiecePalette` — sidebar component that lists available pieces with search/filter.
- G3: React component `PiecePaletteItem` — individual draggable piece item.
- G4: Integration of drag-and-drop from sidebar to GraphCanvas using ReactFlow's built-in `onDrop`/`onDragOver` handlers (NOT @dnd-kit — see DP-2).
- G5: GraphCanvas needs `onDrop` + `onDragOver` handlers to receive dragged items and convert screen position to flow position via `screenToFlowPosition()`.

---

## DP-2: Spec vs Code Divergences

### D1: DnD mechanism — Architecture doc says @dnd-kit, but ReactFlow's native HTML5 DnD is better.
- **Architecture doc section 10:** Lists `@dnd-kit/core 6.1.0 (existing)` for palette DnD.
- **Reality:** The existing `flow-canvas/flow-drag-layer.tsx` uses @dnd-kit for intra-canvas node reordering (MOVE_ACTION) within the old deterministic layout. For the new graph canvas, piece palette drag-and-drop onto a ReactFlow canvas is best implemented using standard HTML5 drag-and-drop with ReactFlow's `screenToFlowPosition()`. This is the documented ReactFlow pattern for external drag-and-drop (see ReactFlow examples). @dnd-kit collision detection doesn't naturally map to ReactFlow's viewport coordinate system.
- **Decision:** Use HTML5 native drag (`draggable`, `onDragStart`, `dataTransfer`) on palette items + ReactFlow `onDrop`/`onDragOver` on the canvas. This avoids complex coordinate mapping between @dnd-kit and ReactFlow viewports.

### D2: addNodeFromPalette function location
- **Architecture doc section 6.5:** Shows `addNodeFromPalette` as a method on `GraphState`.
- **Reality:** The existing `graph-state.ts` (P1-D05) does not yet implement `addNodeFromPalette`. The shared `graph-state-utils.ts` has `addGraphNode(nodes, step, position)` which adds a node to the array.
- **Decision:** The palette will NOT directly add a node via graph state. Instead, it will dispatch a `FlowOperationType.ADD_ACTION` to the flow state, which then triggers the operation listener to rebuild the graph (already wired in P1-D05). This ensures the linked-list remains the source of truth per Architecture doc section 6.6. The `onDrop` handler in GraphCanvas will: (1) extract piece metadata from dataTransfer, (2) convert screen position to flow position, (3) dispatch ADD_ACTION. The operation listener already handles graph rebuild.

### D3: Piece metadata vs full piece data
- **Architecture doc section 6.5:** Shows `PieceMetadata` as the type.
- **Reality:** The web app uses `StepMetadataWithSuggestions` (from `@/features/pieces`) which wraps piece metadata with display info. For the palette sidebar we need a simpler representation: piece name, display name, logo URL, and piece type. We will use the existing `piecesHooks.usePiecesSearch()` hook which returns `CategorizedStepMetadataWithSuggestions`.

---

## DP-5: Acceptance Criteria

### AC-E01-1: Piece palette sidebar renders with available pieces
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts
Expected: All tests pass, count > 0
PASS/FAIL: grep 'passed' in output, 0 'FAILED'
```

### AC-E01-2: Palette items are draggable (set draggable attribute + onDragStart sets dataTransfer)
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "drag data"
Expected: createPaletteDragData produces valid JSON with pieceType, pieceName
PASS/FAIL: test passes
```

### AC-E01-3: GraphCanvas accepts drops and converts screen position to flow position
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "parsePaletteDragData"
Expected: parsePaletteDragData extracts piece metadata from drag data string
PASS/FAIL: test passes
```

### AC-E01-4: Dropped piece creates correct ADD_ACTION operation payload
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "createAddActionFromDrop"
Expected: createAddActionFromDrop returns FlowOperationType.ADD_ACTION with correct stepLocationRelativeToParent
PASS/FAIL: test passes
```

### AC-E01-5: Palette search/filter works correctly
```
Command: npx vitest run packages/shared/test/flow/piece-palette-utils.test.ts -t "filter"
Expected: filterPaletteItems filters pieces by search query
PASS/FAIL: test passes
```

---

## DP-TEST: Test Extension Plan

### Shared utility tests (NEW file):
- **Runtime file:** `packages/shared/src/lib/automation/flows/util/piece-palette-utils.ts`
- **Test file:** `packages/shared/test/flow/piece-palette-utils.test.ts`
- **New tests:**
  1. `createPaletteDragData` — produces valid JSON with required fields (pieceType, pieceName, displayName, logoUrl)
  2. `parsePaletteDragData` — parses JSON string back to PaletteDragData, returns null for invalid JSON
  3. `createAddActionFromDrop` — creates FlowOperationType.ADD_ACTION request with correct operation type and settings for PIECE type
  4. `createAddActionFromDrop` — creates FlowOperationType.ADD_ACTION request for CODE type
  5. `createAddActionFromDrop` — creates FlowOperationType.ADD_ACTION request for LOOP_ON_ITEMS type
  6. `createAddActionFromDrop` — creates FlowOperationType.ADD_ACTION request for ROUTER type
  7. `filterPaletteItems` — filters array of PaletteDragData by displayName substring
  8. `filterPaletteItems` — returns all items when query is empty
  9. `filterPaletteItems` — case-insensitive matching
  10. `PALETTE_DRAG_TYPE` — constant equals expected string
  11. `getPaletteItemTestId` — returns data-testid string from piece name

### Estimated test count: >= 11 new tests

---

## DP-MIGRATE: MODIFY files with consumers

### MODIFY: `packages/web/src/app/builder/graph-canvas/index.tsx`
- **Change:** Add `onDrop`, `onDragOver` props to ReactFlow to accept palette drops. Import `parsePaletteDragData` from `@activepieces/shared`.
- **Import Chain:**
  - Used by: any component that renders `<GraphCanvas>` — currently standalone, will be used by builder in P1-F01.
  - Imports from: `@activepieces/shared`, `@xyflow/react`, `./canvas-controls`, `./graph-canvas-provider`
  - New imports from: `@activepieces/shared` (parsePaletteDragData, PALETTE_DRAG_TYPE, createAddActionFromDrop)
- **Risk:** LOW — adding new event handlers to existing ReactFlow element, no existing behavior changes.

### MODIFY: `packages/shared/src/index.ts`
- **Change:** Add `export * from './lib/automation/flows/util/piece-palette-utils'`
- **Import Chain:** All consumers of `@activepieces/shared` gain access to new exports.
- **Risk:** LOW — additive export only.

---

## STOP RULE

> If any file listed above does not exist at the expected path, or if the existing code structure differs significantly from what this plan describes, STOP immediately and report the divergence. Do NOT improvise or adapt.

---

## Test Extension Plan

| Runtime File | Test File | New Tests |
|-------------|-----------|-----------|
| packages/shared/src/lib/automation/flows/util/piece-palette-utils.ts | packages/shared/test/flow/piece-palette-utils.test.ts | 11+ |

Total new tests: >= 11
Expected total after step: 227 + 11 = 238+
