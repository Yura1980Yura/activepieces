# Adjudication -- P1-D04

## Summary
Reviewer verdict: APPROVED with minor changes. 4 findings reviewed.

## Decisions

### R-1: Shared utility naming clarity — ACCEPTED
The shared utility `graph-canvas-utils.ts` will contain exactly these pure-logic functions:
- `createNodeTypesConfig()` -- returns `Record<string, string>` mapping node type keys to component names (not React components themselves)
- `createEdgeTypesConfig()` -- returns `Record<string, string>` mapping edge type keys to component names
- `buildGraphFromFlowVersion(flowVersion)` -- wraps linkedListToGraph + classifyEdges + auto-layout
- `createIsValidConnection(nodes, edges)` -- returns a callback that wraps validateConnection

React components stay in packages/web. Pure configuration/logic goes to packages/shared.

### R-2: Test strategy reframing — ACCEPTED
ACs will be reframed to test pure-logic configuration functions rather than React rendering behavior. Specifically:
- AC-1 reframed: "createNodeTypesConfig returns correct keys" (pure function test)
- AC-6 reframed: "buildGraphFromFlowVersion applies auto-layout when canvasLayout is null" (pure function test)
- React rendering tests deferred to P1-F01.

### R-3: DP-MIGRATE missing index.ts — ACCEPTED
`packages/shared/src/index.ts` will be added to DP-MIGRATE as a MODIFY file. The export line `export * from './lib/automation/flows/util/graph-canvas-utils'` will be added. No existing consumers are affected (new module).

### R-4: Builder state isolation — ACCEPTED
Explicit constraint added: GraphCanvas in P1-D04 does NOT import from builder-hooks.ts or state/ directory. It receives its data via props (nodes, edges, onNodesChange, etc.). Integration with builder state is P1-D05/P1-F01.
