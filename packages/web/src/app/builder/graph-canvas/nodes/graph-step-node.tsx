import {
  FlowActionType,
  LOOP_OUTPUT_TYPES,
  BRANCH_OUTPUT_TYPES,
  NodeExecutionVisualStatus,
  NODE_EXECUTION_CSS_CLASSES,
  NODE_EXECUTION_STATUS_ATTR,
  isNodeInErrorState,
  NODE_ERROR_ICON_ATTR,
  NODE_ERROR_TOOLTIP_ATTR,
} from '@activepieces/shared';
import { type NodeProps } from '@xyflow/react';
import { CircleAlert } from 'lucide-react';
import React from 'react';

import type { GraphNodeData } from '@activepieces/shared';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
 * - Error icon + tooltip for FAILED nodes (P2-D03)
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
    const { step, stepName, actionType, executionStatus, errorMessage } = data;
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

    // Error state (P2-D03)
    const showError = isNodeInErrorState(visualStatus) && !!errorMessage;

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
          {showError && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  {...{ [NODE_ERROR_ICON_ATTR]: 'true' }}
                  {...{ [NODE_ERROR_TOOLTIP_ATTR]: errorMessage }}
                  className="flex-shrink-0"
                >
                  <CircleAlert className="h-4 w-4 text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs break-words bg-destructive text-destructive-foreground">
                {errorMessage}
              </TooltipContent>
            </Tooltip>
          )}
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
