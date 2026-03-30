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
import { CircleAlert, Play, Trash2 } from 'lucide-react';
import React, { useState, useCallback } from 'react';

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
 * P3-B01: Расширенный тип данных ноды с UI callbacks для hover controls.
 * Callbacks передаются через enrichedNodes в GraphCanvasInner.
 */
type GraphStepNodeData = GraphNodeData & {
  onTestStep?: (stepName: string) => void;
  onDeleteNode?: (nodeId: string) => void;
};

/**
 * GraphStepNode — custom ReactFlow node for action steps in the graph canvas.
 *
 * Renders:
 * - Input handle (top-center) for incoming connections
 * - Node body with step displayName
 * - Hover controls: Play (test step) and Delete (P3-B01) — visible on hover
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
  ({ data, selected, id }: NodeProps & { data: GraphStepNodeData }) => {
    const { step, stepName, actionType, executionStatus, errorMessage, onTestStep, onDeleteNode } = data;
    const isLoop = LOOP_OUTPUT_TYPES.has(actionType);
    const isRouter = BRANCH_OUTPUT_TYPES.has(actionType);

    // P3-B01: Hover state для показа Play/Delete controls
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = useCallback(() => setIsHovered(true), []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);

    // P3-B01: Play (test step) handler
    const handleTestStep = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onTestStep?.(stepName);
      },
      [onTestStep, stepName],
    );

    // P3-B01: Delete handler — вызывает onDeleteNode напрямую (вместо dispatch Delete key)
    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onDeleteNode?.(id);
      },
      [onDeleteNode, id],
    );

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

    // P3-B01: Показываем hover controls при hover ИЛИ при selected
    const showHoverControls = isHovered || selected;

    return (
      <div
        data-step-name={stepName}
        {...{ [NODE_EXECUTION_STATUS_ATTR]: visualStatus }}
        className={`relative rounded-md border border-solid border-border bg-background px-3 py-2 transition-all duration-300 ${executionCssClass} ${selectedCssClass}`}
        style={{
          minWidth: 200,
          minHeight: 60,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <GraphInputHandle />

        {/* P3-B01: Hover controls — Play (test step) + Delete */}
        {showHoverControls && (
          <div
            className="absolute -top-3 right-0 z-10 flex items-center gap-1"
            data-testid="node-hover-controls"
          >
            {/* Play (test step) button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  onMouseDown={handleTestStep}
                  data-testid="node-play-button"
                  title="Test step"
                >
                  <Play className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Test step</TooltipContent>
            </Tooltip>
            {/* Delete button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                  onMouseDown={handleDelete}
                  data-testid="node-delete-button"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
          </div>
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
