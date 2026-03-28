import {
  FlowAction,
  FlowActionType,
  FlowOperationType,
  FlowTrigger,
  FlowTriggerType,
  FlowVersionState,
  flowStructureUtil,
  getStepNameFromNode,
  getUseGraphCanvas,
  createGraphAddNodeFromDrop,
  createGraphRemoveNodeOperation,
  createGraphRemoveEdgeOperation,
  createGraphMoveNodeOperation,
  type PaletteDragData,
} from '@activepieces/shared';
import { type Node } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { DataSelector } from '@/app/builder/data-selector';
import { StepSettingsProvider } from '@/app/builder/step-settings/step-settings-context';
import { RightSideBarType } from '@/app/builder/types';
import { ChatDrawer } from '@/app/routes/chat/chat-drawer';
import { ShowPoweredBy } from '@/components/custom/show-powered-by';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable-panel';
import { piecesHooks } from '@/features/pieces';
import { platformHooks } from '@/hooks/platform-hooks';
import { useElementSize } from '@/hooks/use-element-size';
import { cn } from '@/lib/utils';

import { BuilderHeader } from './builder-header/builder-header';
import { CanvasControls } from './flow-canvas/canvas-controls';
import { FlowCanvas } from './flow-canvas';
import { flowCanvasHooks } from './flow-canvas/hooks';
import { flowCanvasConsts } from './flow-canvas/utils/consts';
import PublishFlowReminderWidget from './flow-canvas/widgets/publish-flow-reminder-widget';
import { RunInfoWidget } from './flow-canvas/widgets/run-info-widget';
import { ViewingOldVersionWidget } from './flow-canvas/widgets/viewing-old-version-widget';
import { FlowVersionsList } from './flow-versions';
import { GraphCanvas } from './graph-canvas';
import { ConnectedPiecePalette } from './graph-canvas/sidebar/piece-palette';
import { RunsList } from './run-list';
import { CursorPositionProvider } from './state/cursor-position-context';
import { StepSettingsContainer } from './step-settings';
import { ResizableVerticalPanelsProvider } from './step-settings/resizable-vertical-panels-context';
const animateResizeClassName = `transition-all `;

const BuilderPage = () => {
  const { platform } = platformHooks.useCurrentPlatform();
  // Feature flag: read once on mount. Toggle via localStorage.setItem('useGraphCanvas', 'false')
  const useGraphCanvas = useMemo(
    () => getUseGraphCanvas(window.localStorage),
    [],
  );
  const [
    flowVersion,
    rightSidebar,
    selectedStepName,
    removeAllStepTestsListeners,
    selectedStep,
    selectStepByName,
    graphNodes,
    graphEdges,
    onGraphNodesChange,
    onGraphEdgesChange,
    onGraphConnect,
    autoLayoutGraph,
    applyOperation,
  ] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.rightSidebar,
    state.selectedStep,
    state.removeAllStepTestsListeners,
    flowStructureUtil.getStep(
      state.selectedStep ?? '',
      state.flowVersion.trigger,
    ),
    state.selectStepByName,
    state.graphNodes,
    state.graphEdges,
    state.onGraphNodesChange,
    state.onGraphEdgesChange,
    state.onGraphConnect,
    state.autoLayoutGraph,
    state.applyOperation,
  ]);
  useEffect(() => {
    return () => {
      removeAllStepTestsListeners();
    };
  }, [removeAllStepTestsListeners]);
  flowCanvasHooks.useShowBuilderIsSavingWarningBeforeLeaving();
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const middlePanelSize = useElementSize(middlePanelRef);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  useEffect(() => {
    const handlePointerUp = () => setIsDraggingHandle(false);
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);
  const rightHandleRef = flowCanvasHooks.useAnimateSidebar(rightSidebar);
  const rightSidePanelRef = useRef<HTMLDivElement>(null);
  const { pieceModel, refetch: refetchPiece } =
    piecesHooks.usePieceModelForStepSettings({
      name: selectedStep?.settings.pieceName,
      version: selectedStep?.settings.pieceVersion,
      enabled:
        selectedStep?.type === FlowActionType.PIECE ||
        selectedStep?.type === FlowTriggerType.PIECE,
      getExactVersion: flowVersion.state === FlowVersionState.LOCKED,
    });
  flowCanvasHooks.useSetSocketListener(refetchPiece);
  flowCanvasHooks.useListenToExistingRun();

  // FlowCanvas (legacy) needs hasCanvasBeenInitialised state
  const [hasCanvasBeenInitialised, setHasCanvasBeenInitialised] =
    useState(false);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stepName = getStepNameFromNode(node as Record<string, unknown> as Parameters<typeof getStepNameFromNode>[0]);
      if (stepName) {
        selectStepByName(stepName);
      }
    },
    [selectStepByName],
  );

  /**
   * Handle piece drop from palette sidebar onto graph canvas.
   *
   * P2-B02: Uses GRAPH_ADD_NODE instead of legacy ADD_ACTION.
   * Creates an orphan node at the drop position. User connects it
   * via handle-to-handle edge creation (GRAPH_ADD_EDGE).
   */
  const handlePieceDrop = useCallback(
    (dragData: PaletteDragData, position: { x: number; y: number }) => {
      const operation = createGraphAddNodeFromDrop(dragData, position);
      applyOperation({
        type: FlowOperationType.GRAPH_ADD_NODE,
        request: operation.request,
      });
    },
    [applyOperation],
  );

  /**
   * P2-B04: Удалить ноду через GRAPH_REMOVE_NODE.
   *
   * Используется контекстным меню (правый клик → Delete) и Delete-клавишей.
   * Заменяет legacy DELETE_ACTION для graph canvas режима.
   */
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const operation = createGraphRemoveNodeOperation(nodeId);
      applyOperation({
        type: FlowOperationType.GRAPH_REMOVE_NODE,
        request: operation.request,
      });
    },
    [applyOperation],
  );

  /**
   * P2-B04: Удалить ребро через GRAPH_REMOVE_EDGE.
   *
   * Используется контекстным меню ребра (правый клик → Delete) и Delete-клавишей.
   */
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const operation = createGraphRemoveEdgeOperation(edgeId);
      applyOperation({
        type: FlowOperationType.GRAPH_REMOVE_EDGE,
        request: operation.request,
      });
    },
    [applyOperation],
  );

  /**
   * P2-B06: Сохранить позицию ноды через GRAPH_MOVE_NODE.
   *
   * Вызывается из GraphCanvas onNodeDragStop (с debounce 500ms).
   * Обновляет позицию ноды в graphData для серверной персистенции.
   */
  const handleMoveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      const operation = createGraphMoveNodeOperation(nodeId, position);
      applyOperation({
        type: FlowOperationType.GRAPH_MOVE_NODE,
        request: operation.request,
      });
    },
    [applyOperation],
  );

  return (
    <div className="flex h-full w-full flex-col relative max-h-[100vh]">
      <div className="z-40">
        <BuilderHeader />
      </div>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="100%" id="flow-canvas">
          <div ref={middlePanelRef} className="relative h-full w-full">
            {useGraphCanvas ? (
              <div className="flex h-full w-full">
                <ConnectedPiecePalette onPieceClick={handlePieceDrop} />
                <div className="flex-1 h-full min-w-0">
                  <GraphCanvas
                    nodes={graphNodes}
                    edges={graphEdges}
                    onNodesChange={onGraphNodesChange}
                    onEdgesChange={onGraphEdgesChange}
                    onConnect={onGraphConnect}
                    onNodeClick={handleNodeClick}
                    onAutoLayout={autoLayoutGraph}
                    onPieceDrop={handlePieceDrop}
                    onDeleteNode={handleDeleteNode}
                    onDeleteEdge={handleDeleteEdge}
                    onMoveNode={handleMoveNode}
                  />
                </div>
              </div>
            ) : (
              <CursorPositionProvider>
                <FlowCanvas
                  setHasCanvasBeenInitialised={setHasCanvasBeenInitialised}
                />
              </CursorPositionProvider>
            )}

            <PublishFlowReminderWidget />
            <RunInfoWidget />
            <ViewingOldVersionWidget />

            {!useGraphCanvas &&
              middlePanelRef.current &&
              middlePanelRef.current.clientWidth > 0 && (
                <CanvasControls
                  canvasHeight={middlePanelRef.current?.clientHeight ?? 0}
                  canvasWidth={middlePanelRef.current?.clientWidth ?? 0}
                  hasCanvasBeenInitialised={hasCanvasBeenInitialised}
                  selectedStep={selectedStepName}
                />
              )}

            <ShowPoweredBy
              position="absolute"
              show={platform?.plan.showPoweredBy}
            />
            <DataSelector
              parentHeight={middlePanelSize.height}
              parentWidth={middlePanelSize.width}
            ></DataSelector>
          </div>
        </ResizablePanel>

        <ResizableHandle
          disabled={rightSidebar === RightSideBarType.NONE}
          withHandle={rightSidebar !== RightSideBarType.NONE}
          onPointerDown={() => setIsDraggingHandle(true)}
          className={
            rightSidebar === RightSideBarType.NONE ? 'bg-transparent' : ''
          }
        />

        <ResizablePanel
          panelRef={rightHandleRef}
          id="right-sidebar"
          collapsedSize="0%"
          defaultSize="0%"
          minSize={rightSidebar === RightSideBarType.NONE ? '0%' : '400px'}
          maxSize={rightSidebar === RightSideBarType.NONE ? '0%' : '60%'}
          className={cn('min-w-0 bg-background z-30', {
            [animateResizeClassName]: !isDraggingHandle,
          })}
          style={{
            transitionDuration: `${
              isDraggingHandle ? 0 : flowCanvasConsts.SIDEBAR_ANIMATION_DURATION
            }ms`,
          }}
        >
          <div ref={rightSidePanelRef} className="h-full w-full">
            {rightSidebar === RightSideBarType.PIECE_SETTINGS &&
              selectedStep && (
                <ResizableVerticalPanelsProvider>
                  <StepSettingsProvider
                    pieceModel={pieceModel}
                    selectedStep={selectedStep}
                    key={constructContainerKey({
                      flowVersionId: flowVersion.id,
                      step: selectedStep,
                      hasPieceModelLoaded: !!pieceModel,
                    })}
                  >
                    <StepSettingsContainer />
                  </StepSettingsProvider>
                </ResizableVerticalPanelsProvider>
              )}
            {rightSidebar === RightSideBarType.RUNS && <RunsList />}
            {rightSidebar === RightSideBarType.VERSIONS && <FlowVersionsList />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ChatDrawer />
    </div>
  );
};

BuilderPage.displayName = 'BuilderPage';
export { BuilderPage };

function constructContainerKey({
  flowVersionId,
  step,
  hasPieceModelLoaded,
}: {
  flowVersionId: string;
  step?: FlowAction | FlowTrigger;
  hasPieceModelLoaded: boolean;
}) {
  const stepName = step?.name;
  const triggerOrActionName =
    step?.type === FlowTriggerType.PIECE
      ? step?.settings.triggerName
      : step?.settings.actionName;
  const pieceName =
    step?.type === FlowTriggerType.PIECE || step?.type === FlowActionType.PIECE
      ? step?.settings.pieceName
      : undefined;
  //we need to re-render the step settings form when the step is skipped, so when the user edits the settings after setting it to skipped the changes are reflected in the update request
  const isSkipped =
    step?.type != FlowTriggerType.EMPTY &&
    step?.type != FlowTriggerType.PIECE &&
    step?.skip;
  return `${flowVersionId}-${stepName ?? ''}-${triggerOrActionName ?? ''}-${
    pieceName ?? ''
  }-${'skipped-' + !!isSkipped}-${
    hasPieceModelLoaded ? 'loaded' : 'not-loaded'
  }`;
}
