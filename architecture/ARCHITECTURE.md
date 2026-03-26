# Architecture Document — Phase 1: Free Canvas Graph Editor

## 1. Overview

**Phase:** 1 — Free Canvas
**Goal:** Replace the linear flow editor with a full graph editor featuring drag-and-drop nodes, manual edge creation via handle-to-handle connections, and free-form node positioning (like python_converter on @xyflow/react).

**Current state:** Activepieces uses @xyflow/react 12.3.5 with a deterministic layout engine. Steps are stored as a linked-list tree (trigger → nextAction → ...). Positions are computed at render time. `nodesDraggable={false}`, `nodesConnectable={false}`. MOVE_ACTION is a semantic operation (re-parent in tree), not positional.

**Target state:** Full graph editor where nodes can be freely positioned, edges created by dragging handle-to-handle, and a sidebar palette enables drag-and-drop addition of new nodes. A bidirectional converter translates between graph model (frontend) and linked-list model (backend/execution engine).

---

## 2. Architecture Decision: Dual-Layer Model

### Problem
The backend execution engine (packages/engine) traverses flows as a linked-list tree. Changing this would require rewriting the engine, flow operations, and all server-side flow processing. This is impractical for Phase 1.

### Decision
**Dual-layer model** — graph positions live in a new `canvasLayout` field of FlowVersion; the linked-list tree remains the source of truth for execution.

```
┌────────────────────────────────────┐
│  Frontend (Graph Model)            │
│  nodes[] + edges[] + positions     │
│  @xyflow/react + connection rules  │
├────────────────────────────────────┤
│  Converter Layer                   │
│  graph → linked-list (on save)     │
│  linked-list → graph (on load)     │
├────────────────────────────────────┤
│  Backend (Linked-List Model)       │
│  trigger.nextAction chain          │
│  Execution engine unchanged        │
└────────────────────────────────────┘
```

### canvasLayout field
```typescript
// Added to FlowVersion
type CanvasLayout = {
  positions: Record<string, { x: number; y: number }>;  // stepName → position
  viewport?: { x: number; y: number; zoom: number };     // saved viewport
};
```

- When `canvasLayout` is null → compute positions via auto-layout (Dagre)
- When `canvasLayout` exists → use stored positions
- On structural change (add/delete/move node) → update both linked-list AND positions
- Migration: existing flows get null canvasLayout → auto-layout on first open

---

## 3. File Structure

### NEW files
```
packages/web/src/app/builder/
├── graph-canvas/                        # NEW — graph-based canvas (replaces flow-canvas)
│   ├── index.tsx                        # Main GraphCanvas component with ReactFlow
│   ├── graph-canvas-provider.tsx        # Context: nodeTypes, edgeTypes, connection rules
│   ├── canvas-controls.tsx              # Zoom, fit, auto-layout buttons
│   ├── connection-validator.ts          # Connection rules (what can connect to what)
│   ├── nodes/
│   │   ├── graph-step-node.tsx          # Step node with input/output handles
│   │   ├── graph-trigger-node.tsx       # Trigger node (output handle only)
│   │   ├── graph-note-node.tsx          # Sticky note node
│   │   └── handles.tsx                  # Shared handle components
│   ├── edges/
│   │   ├── graph-edge.tsx               # Default edge with delete button
│   │   ├── graph-loop-edge.tsx          # Loop edge (visual indicator)
│   │   └── graph-branch-edge.tsx        # Branch edge with label
│   ├── sidebar/
│   │   ├── piece-palette.tsx            # Draggable pieces sidebar
│   │   └── piece-palette-item.tsx       # Single draggable piece
│   ├── context-menu/
│   │   ├── node-context-menu.tsx        # Right-click on node
│   │   ├── edge-context-menu.tsx        # Right-click on edge
│   │   └── canvas-context-menu.tsx      # Right-click on canvas
│   └── utils/
│       ├── connection-rules.ts         # Connection validation rules
│       └── types.ts                    # Graph-specific types
│
├── state/
│   ├── graph-state.ts                  # NEW — graph-specific Zustand slice
│   └── ...existing...
```

### Shared utility files (packages/shared)
```
packages/shared/src/lib/automation/flows/util/
├── graph-converter.ts                  # NEW (P1-PRE-02) — graph ↔ linked-list converter
├── auto-layout.ts                      # NEW (P1-PRE-02) — Dagre auto-layout
├── connection-rules.ts                 # NEW (P1-D01) — handle types, ConnectionRule, DEFAULT_CONNECTION_RULES
├── connection-validator.ts             # NEW (P1-D01) — validateConnection(), detectCycle()
├── graph-node-handles.ts              # NEW (P1-D02) — getHandlesForNodeType(), HandleConfig type
├── flow-structure-util.ts              # existing — linked-list traversal
├── flow-canvas-util.ts                 # existing — legacy position computation
├── flow-piece-util.ts                  # existing — piece version utils
```

### MODIFY files
```
packages/shared/src/lib/automation/flows/
├── flow-version.ts                     # ADD canvasLayout field to FlowVersion type (P1-PRE-01)
├── operations/index.ts                 # ADD UPDATE_CANVAS_LAYOUT operation (P1-PRE-01)

packages/web/src/app/builder/
├── index.tsx                           # REPLACE FlowCanvas with GraphCanvas in ResizablePanel
│                                       # KEEP ResizablePanel layout + StepSettingsContainer sidebar
│                                       # StepSettingsContainer stays unchanged — selectStepByName wires it
├── builder-hooks.ts                    # ADD graph state slice
├── state/flow-state.ts                # ADD canvasLayout to flow state + operationListener for graph sync

packages/server/api/src/app/flows/
├── flow-version/                       # ADD canvasLayout to flow version schema
```

### DEPRECATE files (kept as fallback behind feature flag, deletion deferred to Phase 2)
```
packages/web/src/app/builder/flow-canvas/  # Old canvas — kept behind feature flag useGraphCanvas=false
```

---

## 4. Dependency Map (Adjacency List)

```
graph-canvas/index.tsx
  → graph-canvas-provider.tsx
  → nodes/graph-step-node.tsx
  → nodes/graph-trigger-node.tsx
  → nodes/graph-note-node.tsx
  → edges/graph-edge.tsx
  → edges/graph-loop-edge.tsx
  → edges/graph-branch-edge.tsx
  → sidebar/piece-palette.tsx
  → context-menu/*
  → utils/auto-layout.ts
  → utils/connection-rules.ts
  → utils/types.ts
  → state/graph-state.ts

shared/util/graph-converter.ts
  → shared/actions/action (FlowAction, FlowActionType, LoopOnItemsAction, RouterAction)
  → shared/flow-version (FlowVersion)
  → shared/triggers/trigger (FlowTrigger, FlowTriggerType)
  → shared/util/flow-structure-util (flowStructureUtil, Step)

shared/util/auto-layout.ts
  → @dagrejs/dagre
  → shared/flow-version (CanvasLayout)

state/graph-state.ts
  → utils/graph-converter.ts
  → state/flow-state.ts (existing)
  → @activepieces/shared (FlowOperationType)

shared/util/connection-rules.ts (P1-D01)
  → shared/actions/action (FlowActionType)
  → shared/triggers/trigger (FlowTriggerType)

shared/util/connection-validator.ts (P1-D01)
  → shared/util/graph-converter (GraphNode, GraphEdge)
  → shared/util/connection-rules (ConnectionValidationResult, HANDLE_IDS, NO_INPUT_TYPES, LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES, isBranchHandle)

shared/util/graph-node-handles.ts (P1-D02)
  → shared/actions/action (FlowActionType)
  → shared/triggers/trigger (FlowTriggerType)
  → shared/util/connection-rules (HANDLE_IDS, LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES, branchHandle)

graph-canvas/nodes/handles.tsx (P1-D02)
  → @xyflow/react (Handle, Position)
  → @activepieces/shared (HANDLE_IDS, branchHandle)

graph-canvas/nodes/graph-step-node.tsx (P1-D02)
  → @xyflow/react (NodeProps)
  → @activepieces/shared (FlowActionType, LOOP_OUTPUT_TYPES, BRANCH_OUTPUT_TYPES, GraphNodeData)
  → graph-canvas/nodes/handles.tsx (GraphInputHandle, GraphOutputHandle, GraphLoopOutputHandle, GraphBranchHandle)

graph-canvas/nodes/graph-trigger-node.tsx (P1-D02)
  → @xyflow/react (NodeProps)
  → @activepieces/shared (GraphNodeData)
  → graph-canvas/nodes/handles.tsx (GraphOutputHandle)
```

---

## 5. Step Decomposition

### PRE — Foundation & Data Model
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-PRE-01 | Add canvasLayout field to FlowVersion type + operation | standard | flow-version.ts, operations/ |
| P1-PRE-02 | Create graph↔linked-list converter with tests | full | graph-converter.ts, auto-layout.ts |

### D — Core Graph Canvas
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-D01 | Graph types + connection rules | standard | types.ts, connection-rules.ts, connection-validator.ts |
| P1-D02 | GraphStepNode + GraphTriggerNode with handles | standard | graph-step-node.tsx, graph-trigger-node.tsx, handles.tsx |
| P1-D03 | Graph edges (default, loop, branch) | standard | graph-edge.tsx, graph-loop-edge.tsx, graph-branch-edge.tsx |
| P1-D04 | GraphCanvas main component — ReactFlow with free positioning + edges | full | graph-canvas/index.tsx, graph-canvas-provider.tsx |
| P1-D05 | Graph state management (Zustand slice) | standard | graph-state.ts, builder-hooks.ts |
| P1-D06 | Canvas controls: zoom, fit, auto-layout button | light | canvas-controls.tsx |

### E — Enhanced Features
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-E01 | Piece palette sidebar with drag-and-drop | standard | piece-palette.tsx, piece-palette-item.tsx |
| P1-E02 | Context menus (node, edge, canvas) | standard | context-menu/*.tsx |
| P1-E03 | Note node integration (free-form notes) | light | graph-note-node.tsx |

### F — Integration
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-F01 | Wire GraphCanvas into builder (replace FlowCanvas) | full | builder/index.tsx, flow-state.ts |
| P1-F02 | Save/load canvasLayout — server integration | standard | flow-version schema, API |
| P1-F03 | Migration: auto-layout for existing flows (null positions) | standard | graph-converter.ts |

### G — Stabilization
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-G01 | Add feature flag (useGraphCanvas) + keep flow-canvas/ as fallback | light | builder/index.tsx, feature-flags |

### POST — Phase Gate
| Step | Description | Profile | Files |
|------|------------|---------|-------|
| P1-POST | Phase Gate: full integration + E2E + compliance | full | All |

---

## 6. Key Technical Decisions

### 6.1 Graph ↔ Linked-List Converter

**On Load (linked-list → graph):**
1. Traverse trigger → nextAction → ... recursively
2. Create nodes[] with stepName as id
3. Create edges[] from nextAction pointers + loop/router children
4. If canvasLayout exists → apply stored positions
5. If canvasLayout is null → run Dagre auto-layout

**On Save (graph → linked-list):**
1. Find trigger node (no incoming edges)
2. Walk graph from trigger following outgoing edges
3. Rebuild nextAction chain — each `output` handle has MAX 1 outgoing edge, so the next step is always unambiguous
4. For Loop nodes: find child connected to `loop-output` handle → set `firstLoopAction`
5. For Router nodes: find children connected to `branch-N` handles → set `children[N]`
6. Validate: every node reachable from trigger (warn about orphans)
7. Extract positions → update canvasLayout

**Determinism guarantee:** Each output-type handle (output, loop-output, branch-N) allows MAX 1 outgoing edge. This ensures linked-list reconstruction is always unambiguous — there is exactly one path from trigger through the graph.

**Edge Cases:**
- Orphan nodes (not connected to trigger) → warning + exclude from execution
- Cycles → reject at connection validation time
- Multiple edges to same input → reject (one input only)
- Multiple edges from same output → reject (one output only, except branch handles which are distinct)

### 6.2 Connection Rules

```typescript
type ConnectionRule = {
  sourceType: FlowActionType | FlowTriggerType | '*';
  sourceHandle: 'output' | 'loop-output' | `branch-${number}`;
  targetType: FlowActionType | FlowTriggerType | '*';
  targetHandle: 'input';
  maxConnections?: number;  // default 1 for ALL handles (input AND output)
};

// Core rules:
// - Trigger: output only (no input handle)
// - Action (Code/Piece): 1 input + 1 output
// - Loop: 1 input + 1 output (next) + 1 loop-output (first loop action)
// - Router: 1 input + N branch-outputs (one per branch, dynamic from settings.branches)
// - No cycles allowed
// - Max 1 edge per input handle
// - Max 1 edge per output handle (guarantees linked-list determinism)
// - Trigger must be root (no incoming edges)
```

**Dynamic branch handles for Router:**
Router nodes read `settings.branches.length` to determine the number of branch output handles.
When `ADD_BRANCH` or `DELETE_BRANCH` operations fire, the Router node re-renders with
updated handle count. Each branch handle ID follows the pattern `branch-{index}`.

### 6.3 Handle Layout

```
┌──────────────────────────────┐
│  ● input (top-center)        │
│                              │
│  [Logo] Step Name            │
│                              │
│  ● output (bottom-center)    │
└──────────────────────────────┘

Loop node:
┌──────────────────────────────────────────────┐
│  ● input (top-center)                        │
│                                              │
│  [⟳] Loop on Items                           │
│                                              │
│  ● output (bottom)  ● loop-output (right)    │
└──────────────────────────────────────────────┘
Handle semantics:
  - input       → source of data flowing INTO this loop step
  - output      → maps to nextAction (step AFTER loop completes)
  - loop-output → maps to firstLoopAction (first step INSIDE loop body)

Router node:
┌─────────────────────────────────────────────────────────┐
│  ● input (top-center)                                   │
│                                                         │
│  [⚡] Router                                             │
│                                                         │
│  ● output (bottom) ● branch-0 ● branch-1 ● branch-2 (right) │
└─────────────────────────────────────────────────────────┘
Handle semantics:
  - input     → source of data flowing INTO this router step
  - output    → maps to nextAction (step AFTER all branches merge)
  - branch-N  → maps to children[N] (first step of branch N)
  - Handle count = settings.branches.length (dynamic)
```

### 6.4 Auto-Layout (Dagre)

- Direction: TB (top-to-bottom), same as current vertical flow
- Node separation: 80px vertical, 140px horizontal
- Used for: initial layout of flows without canvasLayout, "Auto-layout" button
- Library: @dagrejs/dagre (already in ecosystem, used by python_converter)

### 6.5 State Management

New Zustand slice `GraphState`:
```typescript
type GraphState = {
  // ReactFlow state
  nodes: ApGraphNode[];
  edges: ApGraphEdge[];

  // Actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Graph operations
  addNodeFromPalette: (piece: PieceMetadata, position: XYPosition) => void;
  deleteSelectedNodes: () => void;
  deleteSelectedEdges: () => void;
  autoLayout: () => void;

  // Sync with flow state
  syncToFlowState: () => void;   // graph → linked-list + update flow
  syncFromFlowState: () => void; // linked-list → graph (on flow load)
};
```

### 6.6 Operation-to-Graph Mapping

Every `FlowOperationType` dispatched through `flowOperations.apply` must produce corresponding graph mutations. The graph state subscribes to flow operations via `operationListeners` (existing pattern in flow-state.ts).

| Operation | Linked-List Effect | Graph Effect |
|-----------|-------------------|--------------|
| `ADD_ACTION` | Insert step into nextAction/firstLoopAction/children chain | Add node at drop position (or auto-position near parent). Add edge from parent's output handle to new node's input. |
| `DELETE_ACTION` | Remove step, relink chain | Remove node + all connected edges. Relink: if deleted node had input edge from A and output edge to B, create new edge A→B. |
| `MOVE_ACTION` | DELETE + ADD (re-parent in tree) | Remove edges to/from moved node. Keep node position (user dragged it). Add new edges based on new parent. |
| `UPDATE_ACTION` | Update step settings | No graph structure change. Node re-renders with new data. |
| `UPDATE_TRIGGER` | Update trigger settings | No graph structure change. Trigger node re-renders. |
| `ADD_BRANCH` | Add branch to router.children[] | Add new `branch-N` handle to Router node. |
| `DELETE_BRANCH` | Remove branch from router.children[] | Remove `branch-N` handle + edges from it. Reindex remaining handles. |
| `MOVE_BRANCH` | Reorder children[] | Reindex branch handle IDs + reconnect edges. |
| `DUPLICATE_ACTION` | Clone step + insert | Add new node near original (offset +50px, +50px). Copy edges pattern. |
| `ADD_NOTE` | Add note to flowVersion.notes[] | Add note node at specified position. |
| `UPDATE_NOTE` | Update note content/color/size | Note node re-renders. |
| `DELETE_NOTE` | Remove note from notes[] | Remove note node. |
| `UPDATE_CANVAS_LAYOUT` | No linked-list change | Update positions in canvasLayout. |

**Sync direction:** Operations originate from EITHER the graph canvas (user drags edge) OR the existing UI (step settings panel). In both cases:
1. Graph action → convert to FlowOperation → apply to linked-list → sync back to graph
2. Flow operation (from settings) → apply to linked-list → graph state listener updates graph

This ensures linked-list is always the authoritative source.

---

## 7. Migration Strategy

1. **No DB migration needed initially** — canvasLayout=null for all existing flows
2. On first open in graph editor → auto-layout computes positions → saved to canvasLayout on first edit
3. Existing API contract unchanged — server stores canvasLayout as JSON field
4. Backward compatibility: if canvasLayout is stripped (e.g., API consumer doesn't send it) → auto-layout regenerates

---

## 8. Risk Register

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R1 | Graph→linked-list converter produces invalid flow | Execution breaks | Extensive converter tests with all flow patterns (loop, router, nested) |
| R2 | Cycles in graph | Infinite execution loop | Cycle detection in connection validator + on-save validation |
| R3 | Orphan nodes (not connected to trigger) | Silent data loss | Warning UI + orphans excluded from execution, not deleted |
| R4 | Performance with large flows (100+ nodes) | Canvas lag | React.memo on nodes, virtualization, batched position updates |
| R5 | Upstream merge conflicts | Cannot sync with activepieces upstream | canvasLayout is additive field; converter is new code; old flow-canvas deleted cleanly |
| R6 | @dagrejs/dagre dependency | Bundle size | Already used by ecosystem; treeshakeable |

---

## 9. Acceptance Criteria (Phase Level)

| ID | Criteria | Verification |
|----|----------|-------------|
| AC-1 | Nodes can be freely dragged to any position on canvas | Manual: drag node, release, position persists |
| AC-2 | Edges created by dragging from output handle to input handle | Manual: drag handle, connect nodes |
| AC-3 | Connection rules enforced (no cycles, no multi-input, type-valid) | Automated: connection-validator tests |
| AC-4 | Graph→linked-list converter produces valid flow for execution | Automated: converter round-trip tests |
| AC-5 | Piece palette sidebar: drag piece onto canvas creates node | Manual: drag from sidebar, node appears |
| AC-6 | Auto-layout button arranges nodes via Dagre | Manual: click auto-layout, nodes rearranged |
| AC-7 | Existing flows open correctly (auto-layout from linked-list) | Automated: converter test with sample flows |
| AC-8 | Context menus work for nodes, edges, canvas | Manual: right-click each element |
| AC-9 | Save/load preserves canvasLayout positions | Automated: save, reload, positions match |
| AC-10 | Notes remain free-form draggable | Manual: drag note |

---

## 10. Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Graph rendering | @xyflow/react | 12.3.5 (existing) |
| Auto-layout | @dagrejs/dagre | NEW dependency |
| Drag-and-drop (palette) | @dnd-kit/core | 6.1.0 (existing) |
| State management | zustand | 4.5.4 (existing) |
| UI components | Radix UI + Tailwind | existing |
| Testing | vitest | existing |

---

## 11. Out of Scope (Phase 1)

- Backend execution engine changes
- Flow version migration (DB schema change for canvasLayout is additive)
- Multi-user collaborative editing
- Undo/redo for canvas operations (existing undo/redo covers flow operations)
- Custom edge routing (bezier/step/smoothstep selection)
- Sub-flows / grouping nodes
- Copy-paste across flows
