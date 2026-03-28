import {
  FlowActionType,
  LOOP_OUTPUT_TYPES,
  BRANCH_OUTPUT_TYPES,
  NodeExecutionVisualStatus,
  NODE_EXECUTION_CSS_CLASSES,
  NODE_EXECUTION_STATUS_ATTR,
} from '@activepieces/shared';
import { type NodeProps } from '@xyflow/react';
import React from 'react';

import type { GraphNodeData } from '@activepieces/shared';

import {
  GraphInputHandle,
  GraphOutputHandle,
  GraphLoopOutputHandle,
  GraphBranchHandle,
} from './handles';

/**
 * GraphStepNode — custom ReactFlow node for action steps in the graph canvas.
 *
 * Renders:
 * - Input handle (top-center) for incoming connections
 * - Node body with step displayName
 * - Output handle (bottom-center) for nextAction connections
 * - Loop-output handle (right) for LOOP_ON_ITEMS nodes (firstLoopAction)
 * - Branch handles (right) for ROUTER nodes (children[N])
 * - Execution status overlay (P2-D01): border color based on executionStatus
 *
 * Architecture doc section 6.3 defines the handle layout.
 * Handle IDs match HANDLE_IDS constants from connection-rules.ts.
 */
const GraphStepNode = React.memo(
  ({ data }: NodeProps & { data: GraphNodeData }) => {
    const { step, stepName, actionType, executionStatus } = data;
    const isLoop = LOOP_OUTPUT_TYPES.has(actionType);
    const isRouter = BRANCH_OUTPUT_TYPES.has(actionType);

    // Determine branch count for router nodes
    let branchCount = 0;
    if (isRouter && step && 'settings' in step) {
      const settings = step.settings as { branches?: unknown[] };
      if (settings?.branches) {
        branchCount = settings.branches.length;
      }
    }

    // Execution overlay CSS class (P2-D01)
    const visualStatus = (executionStatus as NodeExecutionVisualStatus) || NodeExecutionVisualStatus.IDLE;
    const executionCssClass = NODE_EXECUTION_CSS_CLASSES[visualStatus] || '';

    return (
      <div
        data-step-name={stepName}
        {...{ [NODE_EXECUTION_STATUS_ATTR]: visualStatus }}
        className={`relative rounded-md border border-solid border-border bg-background px-3 py-2 transition-all duration-300 ${executionCssClass}`}
        style={{
          minWidth: 200,
          minHeight: 60,
        }}
      >
        <GraphInputHandle />

        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">
            {step.displayName}
          </div>
        </div>

        <GraphOutputHandle />

        {isLoop && <GraphLoopOutputHandle />}

        {isRouter &&
          Array.from({ length: branchCount }, (_, i) => (
            <GraphBranchHandle key={`branch-${i}`} index={i} />
          ))}
      </div>
    );
  },
);

GraphStepNode.displayName = 'GraphStepNode';
export { GraphStepNode };
