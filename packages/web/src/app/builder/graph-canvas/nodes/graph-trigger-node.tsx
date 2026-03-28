import {
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

import { GraphOutputHandle } from './handles';

/**
 * GraphTriggerNode — custom ReactFlow node for the trigger step in the graph canvas.
 *
 * Renders:
 * - NO input handle (triggers are root nodes, per NO_INPUT_TYPES in connection-rules.ts)
 * - Trigger badge indicator
 * - Node body with step displayName
 * - Error icon + tooltip for FAILED nodes (P2-D03)
 * - Output handle (bottom-center) for nextAction connections
 * - Execution status overlay (P2-D01): border color based on executionStatus
 *
 * Architecture doc section 6.3 defines:
 *   Trigger: output only (no input handle)
 */
const GraphTriggerNode = React.memo(
  ({ data }: NodeProps & { data: GraphNodeData }) => {
    const { step, stepName, executionStatus, errorMessage } = data;

    // Execution overlay CSS class (P2-D01)
    const visualStatus = (executionStatus as NodeExecutionVisualStatus) || NodeExecutionVisualStatus.IDLE;
    const executionCssClass = NODE_EXECUTION_CSS_CLASSES[visualStatus] || '';

    // Error state (P2-D03)
    const showError = isNodeInErrorState(visualStatus) && !!errorMessage;

    return (
      <div
        data-step-name={stepName}
        {...{ [NODE_EXECUTION_STATUS_ATTR]: visualStatus }}
        className={`relative rounded-md rounded-tl-none border border-solid border-border bg-background px-3 py-2 transition-all duration-300 ${executionCssClass}`}
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
      </div>
    );
  },
);

GraphTriggerNode.displayName = 'GraphTriggerNode';
export { GraphTriggerNode };
