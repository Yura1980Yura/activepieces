import { CANVAS_CONTROL_ACTIONS } from '@activepieces/shared';
import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import { Fullscreen, LayoutGrid, Minus, Plus } from 'lucide-react';
import React, { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

/**
 * Props for the GraphCanvasControls component.
 *
 * onAutoLayout is passed as a callback rather than importing builder-hooks
 * directly, keeping the component decoupled from the state layer. The parent
 * (builder/index.tsx or GraphCanvas) wires this to autoLayoutGraph() from
 * the graph state slice.
 */
export type GraphCanvasControlsProps = {
  /** Callback to trigger Dagre auto-layout on all graph nodes */
  onAutoLayout?: () => void;
};

/**
 * Wrapper component for canvas control buttons with tooltip.
 * Follows the same pattern as the existing flow-canvas/canvas-controls.tsx.
 */
const ControlButtonWrapper = ({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

/**
 * GraphCanvasControls -- zoom, fit-to-view, and auto-layout controls
 * for the graph canvas.
 *
 * Architecture doc section 3: "canvas-controls.tsx -- Zoom, fit, auto-layout buttons"
 * Architecture doc section 5: P1-D06 -- "Canvas controls: zoom, fit, auto-layout button"
 *
 * Features:
 * - Zoom in / zoom out via useReactFlow().zoomIn/zoomOut
 * - Fit to view via useReactFlow().fitView (animated)
 * - Auto-layout button that triggers Dagre re-layout of all nodes
 *
 * Rendered as a floating toolbar at the bottom-center of the graph canvas.
 * Must be rendered inside a ReactFlowProvider (provided by GraphCanvasProvider).
 */
export const GraphCanvasControls = React.memo(
  ({ onAutoLayout }: GraphCanvasControlsProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();

    const handleZoomIn = useCallback(() => {
      zoomIn({ duration: 200 });
    }, [zoomIn]);

    const handleZoomOut = useCallback(() => {
      zoomOut({ duration: 200 });
    }, [zoomOut]);

    const handleFitView = useCallback(() => {
      fitView({ duration: 300, padding: 0.15 });
    }, [fitView]);

    const handleAutoLayout = useCallback(() => {
      if (onAutoLayout) {
        onAutoLayout();
      }
    }, [onAutoLayout]);

    return (
      <div className="z-50 absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
        <div className="bg-background gap-1 flex items-center shadow-lg justify-center border border-sidebar-border p-1.5 rounded-lg pointer-events-auto">
          <ControlButtonWrapper tooltip={t('Zoom in')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              data-testid={CANVAS_CONTROL_ACTIONS.ZOOM_IN}
            >
              <Plus className="size-4" />
            </Button>
          </ControlButtonWrapper>

          <ControlButtonWrapper tooltip={t('Zoom out')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              data-testid={CANVAS_CONTROL_ACTIONS.ZOOM_OUT}
            >
              <Minus className="size-4" />
            </Button>
          </ControlButtonWrapper>

          <ControlButtonWrapper tooltip={t('Fit to view')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFitView}
              data-testid={CANVAS_CONTROL_ACTIONS.FIT_VIEW}
            >
              <Fullscreen className="size-4" />
            </Button>
          </ControlButtonWrapper>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          <ControlButtonWrapper tooltip={t('Auto-layout')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAutoLayout}
              data-testid={CANVAS_CONTROL_ACTIONS.AUTO_LAYOUT}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </ControlButtonWrapper>
        </div>
      </div>
    );
  },
);

GraphCanvasControls.displayName = 'GraphCanvasControls';
