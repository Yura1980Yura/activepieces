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
import { CircleAlert, X } from 'lucide-react';
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
 * - Delete button (×) when selected
 * - Error icon + tooltip for FAILED nodes (P2-D03)
 * - Output handle (bottom-center) for nextAction connections
 * - Loop-output handle (right) for LOOP_ON_ITEMS nodes (firstLoopAction)
 * - Branch handles (right) for ROUTER nodes (children[N])
 * - Execution status overlay (P2-D01): border color based on executionStatus
 * - Selection highlight (ring) when node is selected
 *
 * Architecture doc section 6.3 defines the handle layout.
 * Handle IDs match HANDLE_IDS constants from connection-rules.ts.
 */
const GraphStepNode = React.memo(
  ({ data, selected }: NodeProps & { data: GraphNodeData }) => {
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

    // Selection highlight
    const selectedCssClass = selected ? 'ring-2 ring-primary border-primary shadow-md' : '';

    // Error state (P2-D03)
    const showError = isNodeInErrorState(visualStatus) && !!errorMessage;

    return (
      <div
        data-step-name={stepName}
        {...{ [NODE_EXECUTION_STATUS_ATTR]: visualStatus }}
        className={`relative rounded-md border border-solid border-border bg-background px-3 py-2 transition-all duration-300 ${executionCssClass} ${selectedCssClass}`}
        style={{
          minWidth: 200,
          minHeight: 60,
        }}
      >
        <GraphInputHandle />

        {/* Delete button — visible when selected */}
        {selected && (
          <button
            className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // Dispatch delete key event — ReactFlow onDelete handler will pick it up
              const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
              e.currentTarget.closest('.react-flow')?.dispatchEvent(deleteEvent);
            }}
            title="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        )}

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
