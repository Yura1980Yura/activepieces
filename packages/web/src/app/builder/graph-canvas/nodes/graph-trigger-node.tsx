import { type NodeProps } from '@xyflow/react';
import React from 'react';

import type { GraphNodeData } from '@activepieces/shared';

import { GraphOutputHandle } from './handles';

/**
 * GraphTriggerNode — custom ReactFlow node for the trigger step in the graph canvas.
 *
 * Renders:
 * - NO input handle (triggers are root nodes, per NO_INPUT_TYPES in connection-rules.ts)
 * - Trigger badge indicator
 * - Node body with step displayName
 * - Output handle (bottom-center) for nextAction connections
 *
 * Architecture doc section 6.3 defines:
 *   Trigger: output only (no input handle)
 */
const GraphTriggerNode = React.memo(
  ({ data }: NodeProps & { data: GraphNodeData }) => {
    const { step, stepName } = data;

    return (
      <div
        data-step-name={stepName}
        className="relative rounded-md rounded-tl-none border border-solid border-border bg-background px-3 py-2"
        style={{
          minWidth: 200,
          minHeight: 60,
        }}
      >
        {/* Trigger badge — visual indicator that this is the flow start */}
        <div className="absolute -top-5 left-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-t-sm">
          Trigger
        </div>

        {/* NO GraphInputHandle — triggers have no input per Architecture doc 6.2 */}

        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">
            {step.displayName}
          </div>
        </div>

        <GraphOutputHandle />
      </div>
    );
  },
);

GraphTriggerNode.displayName = 'GraphTriggerNode';
export { GraphTriggerNode };
