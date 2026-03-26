import { GRAPH_EDGE_TYPES } from '@activepieces/shared';
import { ReactFlowProvider } from '@xyflow/react';
import React, { createContext, useContext, useMemo } from 'react';

import { GraphEdge } from './edges/graph-edge';
import { GraphBranchEdge } from './edges/graph-branch-edge';
import { GraphLoopEdge } from './edges/graph-loop-edge';
import { GraphStepNode } from './nodes/graph-step-node';
import { GraphTriggerNode } from './nodes/graph-trigger-node';

/**
 * Node types registry for ReactFlow.
 *
 * Maps node type strings (produced by graph-converter.ts stepTypeToNodeType)
 * to React components:
 * - 'trigger' -> GraphTriggerNode (output-only, no input handle)
 * - 'action'  -> GraphStepNode   (input + output)
 * - 'loop'    -> GraphStepNode   (input + output + loop-output, handles differ via action type)
 * - 'router'  -> GraphStepNode   (input + output + branch-N, handles differ via action type)
 *
 * GraphStepNode handles all non-trigger types because it inspects
 * LOOP_OUTPUT_TYPES and BRANCH_OUTPUT_TYPES to render conditional handles.
 */
type GraphCanvasContextValue = {
  nodeTypes: Record<string, React.ComponentType<any>>;
  edgeTypes: Record<string, React.ComponentType<any>>;
};

const GraphCanvasContext = createContext<GraphCanvasContextValue | null>(null);

/**
 * Hook to access the GraphCanvas context (nodeTypes and edgeTypes).
 * Must be called within a GraphCanvasProvider.
 *
 * @throws Error if used outside of GraphCanvasProvider
 */
export function useGraphCanvasContext(): GraphCanvasContextValue {
  const ctx = useContext(GraphCanvasContext);
  if (!ctx) {
    throw new Error(
      'useGraphCanvasContext must be used within a GraphCanvasProvider',
    );
  }
  return ctx;
}

/**
 * GraphCanvasProvider — wraps children with ReactFlowProvider and provides
 * the nodeTypes and edgeTypes registries.
 *
 * The registries are memoized since the component mappings never change
 * during the lifecycle of the application.
 *
 * Architecture doc section 3: "Context: nodeTypes, edgeTypes, connection rules"
 */
export const GraphCanvasProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const nodeTypes = useMemo(
    () => ({
      trigger: GraphTriggerNode,
      action: GraphStepNode,
      loop: GraphStepNode,
      router: GraphStepNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      [GRAPH_EDGE_TYPES.DEFAULT]: GraphEdge,
      [GRAPH_EDGE_TYPES.LOOP]: GraphLoopEdge,
      [GRAPH_EDGE_TYPES.BRANCH]: GraphBranchEdge,
    }),
    [],
  );

  const contextValue = useMemo(
    () => ({ nodeTypes, edgeTypes }),
    [nodeTypes, edgeTypes],
  );

  return (
    <GraphCanvasContext.Provider value={contextValue}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </GraphCanvasContext.Provider>
  );
};

GraphCanvasProvider.displayName = 'GraphCanvasProvider';
