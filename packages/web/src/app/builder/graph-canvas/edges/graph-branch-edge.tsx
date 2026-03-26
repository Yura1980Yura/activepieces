import { getEdgeStyle, GRAPH_EDGE_TYPES } from '@activepieces/shared';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import React from 'react';

/**
 * Data passed to GraphBranchEdge via ReactFlow edge.data.
 * label is derived from getEdgeLabel() in graph-edge-utils.ts.
 */
type GraphBranchEdgeData = {
  label?: string;
};

/**
 * GraphBranchEdge — edge component for branch-N→input connections.
 *
 * Visually distinguished from default edges by:
 * - Amber color (#f59e0b) matching GraphBranchHandle from handles.tsx
 * - Optional branch label badge at the edge midpoint
 *
 * Architecture doc section 6.3: branch-N handles map to children[N] in the
 * linked-list model. Each branch handle on a Router node connects to the
 * first step of that branch.
 *
 * The label (e.g., "Branch 1") is computed by getEdgeLabel() and passed
 * through edge.data.label by the graph state manager (P1-D05).
 */
const GraphBranchEdge = React.memo(
  ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  }: EdgeProps & { data?: GraphBranchEdgeData }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    const style = getEdgeStyle(GRAPH_EDGE_TYPES.BRANCH);

    return (
      <>
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
          }}
        />
        {data?.label && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
                fontSize: '12px',
                backgroundColor: '#f59e0b',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              className="nodrag nopan"
            >
              {data.label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

GraphBranchEdge.displayName = 'GraphBranchEdge';
export { GraphBranchEdge };
export type { GraphBranchEdgeData };
