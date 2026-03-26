# ADJUDICATION — P1-D01

## FINDING-1 (MEDIUM): Clarify types.ts vs connection-rules.ts split
**Decision: ACCEPTED**
- types.ts will contain: handle type constants, `ApGraphNode`/`ApGraphEdge` type aliases (wrapping GraphNode/GraphEdge from graph-converter.ts with React Flow compatibility), and `ConnectionValidationResult` type.
- connection-rules.ts will contain: `ConnectionRule` type, `DEFAULT_CONNECTION_RULES` array, and `branchHandle()` helper.
- Note: ApGraphNode/ApGraphEdge are deferred to P1-D04 (GraphCanvas main component which needs React Flow Node<>/Edge<> generics). For P1-D01, types.ts focuses on handle types and validation result types. This keeps P1-D01 focused on connection rules/validation without pulling in React Flow dependencies to shared/.

## FINDING-2 (LOW): Specify cycle detection algorithm
**Decision: ACCEPTED**
- Algorithm: DFS reachability check — given proposed edge (source→target), verify that `source` is NOT reachable from `target` by traversing existing edges. If source IS reachable from target, adding this edge would create a cycle.
- Implementation: BFS/DFS from target following existing edges. If source is encountered → cycle.

## FINDING-3 (LOW): Add router dynamic branch handle test
**Decision: ACCEPTED**
- Add AC-10: Test that `branchHandle(N)` produces correct handle IDs for router branch handles matching architecture doc pattern `branch-{index}`.
- This is a simple helper function test, fits well in connection-rules.test.ts.
