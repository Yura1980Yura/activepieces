import { getEdgeStyle, GRAPH_EDGE_TYPES } from '@activepieces/shared';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import React from 'react';

/**
 * Data passed to GraphEdge via ReactFlow edge.data.
 * onDelete callback is wired by graph state in P1-D05.
 */
type GraphEdgeData = {
  onDelete?: (edgeId: string) => void;
};

/**
 * GraphEdge — default edge component for the graph canvas.
 *
 * Renders a bezier curve between two nodes with an optional delete button.
 * Used for standard output→input connections (nextAction edges).
 *
 * Architecture doc section 3: "Default edge with delete button"
 *
 * Style: solid line, #94a3b8 (slate), matching handleBaseStyle from handles.tsx.
 * Delete button appears at the midpoint of the edge, rendered via EdgeLabelRenderer
 * to avoid SVG foreignObject issues.
 */
const GraphEdge = React.memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data,
  }: EdgeProps & { data?: GraphEdgeData }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    const style = getEdgeStyle(GRAPH_EDGE_TYPES.DEFAULT);

    return (
      <>
        <BaseEdge
          path={edgePath}
          style={{
            stroke: selected ? '#6366f1' : style.stroke,
            strokeWidth: selected ? 3 : style.strokeWidth,
          }}
        />
        {data?.onDelete && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <button
                onClick={() => data.onDelete?.(id)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                type="button"
              >
                &times;
              </button>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

GraphEdge.displayName = 'GraphEdge';
export { GraphEdge };
export type { GraphEdgeData };
