# Adjudication — P1-D05

## RCC-1: addGraphNode parameterization
**Decision:** ACCEPTED
**Rationale:** Correct. The shared utility `addGraphNode` should accept `Step` (from @activepieces/shared), not `PieceMetadata` (web-only). The Zustand slice in web will convert PieceMetadata -> Step before calling the shared utility.

## RCC-2: ReactFlow types in shared package
**Decision:** ACCEPTED
**Rationale:** This is a valid HIGH-severity concern. `@xyflow/react` is NOT a dependency of packages/shared. The `applyNodesChange` and `applyEdgesChange` functions use `NodeChange[]`/`EdgeChange[]` types from ReactFlow and MUST live in packages/web, not packages/shared. The shared utility will only contain:
- `createInitialGraphData(flowVersion)` -> nodes + edges
- `syncGraphFromFlowVersion(flowVersion)` -> nodes + edges
- `syncGraphToFlowVersion(nodes, edges)` -> trigger + canvasLayout
- `autoLayoutGraphNodes(nodes, edges)` -> repositioned nodes
- `removeGraphNodes(nodes, edges, nodeIds)` -> filtered nodes + edges
- `removeGraphEdges(edges, edgeIds)` -> filtered edges
- `addGraphNode(nodes, step, position)` -> nodes with new node
- `applyGraphConnect(nodes, edges, connection)` -> edges with new edge (using our own ConnectionParams type, not ReactFlow's)

## RCC-3: Operation listener specifics
**Decision:** ACCEPTED
**Rationale:** Good catch. The operation listener should explicitly handle structural operations that change graph topology. Will add explicit list to final plan.

## RCC-4: Test file naming
**Decision:** ACCEPTED
**Rationale:** Consistency with existing pattern. Test file: `graph-state-utils.test.ts` to match `graph-state-utils.ts`.

## RCC-5: createGraphState signature
**Decision:** ACCEPTED
**Rationale:** The Zustand slice must follow the exact pattern of `createFlowState(initialState, get, set)`. Will specify in final plan.
