import { getEdgeStyle, GRAPH_EDGE_TYPES } from '@activepieces/shared';
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';
import React from 'react';

/**
 * GraphLoopEdge — edge component for loop-output→input connections.
 *
 * Visually distinguished from default edges by:
 * - Dashed stroke pattern (strokeDasharray: '5 3')
 * - Purple color (#8b5cf6) matching GraphLoopOutputHandle from handles.tsx
 *
 * Architecture doc section 6.3: loop-output handle maps to firstLoopAction.
 * This edge represents the connection from a Loop node's loop-output handle
 * to the first step inside the loop body.
 */
const GraphLoopEdge = React.memo(
  ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  }: EdgeProps) => {
    const [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    const style = getEdgeStyle(GRAPH_EDGE_TYPES.LOOP);

    return (
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
        }}
      />
    );
  },
);

GraphLoopEdge.displayName = 'GraphLoopEdge';
export { GraphLoopEdge };
