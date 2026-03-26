import {
  buildGraphFromFlowVersion,
  createIsValidConnection,
  type FlowVersion,
} from '@activepieces/shared';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useMemo } from 'react';

import {
  GraphCanvasProvider,
  useGraphCanvasContext,
} from './graph-canvas-provider';

/**
 * Props for the GraphCanvas component.
 *
 * GraphCanvas is a standalone component that does NOT import from
 * builder-hooks.ts or state/ directory. All data flows through props.
 * Integration with builder state is deferred to P1-D05/P1-F01.
 */
export type GraphCanvasProps = {
  flowVersion: FlowVersion;
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeClick?: NodeMouseHandler;
};

/**
 * Inner component that uses the GraphCanvasContext.
 * Must be rendered inside GraphCanvasProvider to access nodeTypes/edgeTypes.
 */
const GraphCanvasInner = React.memo(
  ({
    flowVersion,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
  }: GraphCanvasProps) => {
    const { nodeTypes, edgeTypes } = useGraphCanvasContext();

    /**
     * Convert FlowVersion to ReactFlow-ready graph data.
     * Memoized on flowVersion reference identity.
     *
     * Pipeline:
     * 1. linkedListToGraph() - traverse linked-list to nodes+edges
     * 2. classifyEdges() - annotate edges with type (default/loop/branch)
     * 3. computeAutoLayout() - apply Dagre when canvasLayout is null
     */
    const graphData = useMemo(
      () => buildGraphFromFlowVersion(flowVersion),
      [flowVersion],
    );

    /**
     * Connection validation callback.
     * Wraps validateConnection() from connection-validator.ts.
     *
     * Enforces:
     * - No self-connections
     * - No cycles (BFS reachability)
     * - Max 1 edge per input/output handle
     * - Trigger cannot be target
     * - Source handle valid for node type
     */
    const isValidConnection = useCallback(
      (connection: {
        source: string | null;
        target: string | null;
        sourceHandle: string | null;
        targetHandle: string | null;
      }) => {
        return createIsValidConnection(
          graphData.nodes,
          graphData.edges,
        )(connection);
      },
      [graphData.nodes, graphData.edges],
    );

    return (
      <div className="size-full relative overflow-hidden bg-builder-background">
        <ReactFlow
          className="bg-builder-background"
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={graphData.nodes}
          edges={graphData.edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          isValidConnection={isValidConnection}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          maxZoom={1.5}
          minZoom={0.5}
          fitView={true}
          zoomOnDoubleClick={false}
        >
          <Background
            gap={10}
            size={1}
            variant={BackgroundVariant.Dots}
            bgColor="var(--builder-background)"
            color="var(--builder-background-pattern)"
          />
        </ReactFlow>
      </div>
    );
  },
);

GraphCanvasInner.displayName = 'GraphCanvasInner';

/**
 * GraphCanvas — main graph canvas component with free node positioning.
 *
 * Architecture doc section 3: "Main GraphCanvas component with ReactFlow"
 * Architecture doc section 5: P1-D04 — "ReactFlow with free positioning + edges"
 *
 * Features:
 * - Free node dragging (nodesDraggable={true})
 * - Handle-to-handle edge creation (nodesConnectable={true})
 * - Connection validation (cycle detection, max 1 edge per handle, etc.)
 * - Auto-layout via Dagre when canvasLayout is null
 * - Classified edges (default/loop/branch) with distinct visual styles
 * - Background with dots pattern
 *
 * Wraps GraphCanvasInner with GraphCanvasProvider to supply
 * nodeTypes, edgeTypes, and ReactFlowProvider.
 */
export const GraphCanvas = React.memo(
  (props: GraphCanvasProps) => {
    return (
      <GraphCanvasProvider>
        <GraphCanvasInner {...props} />
      </GraphCanvasProvider>
    );
  },
);

GraphCanvas.displayName = 'GraphCanvas';
