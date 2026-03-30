import {
  FlowVersion,
  FlowOperationRequest,
  FlowOperationType,
  createInitialGraphData,
  syncGraphFromFlowVersion,
  syncGraphToFlowVersion,
  autoLayoutGraphNodes,
  createIsValidConnection,
  createGraphAddEdgeFromConnection,
  createGraphRemoveNodeOperation,
  createGraphRemoveEdgeOperation,
  createGraphMoveNodeOperation,
  getNodeVisualStatus,
  getNodeErrorMessage,
  NodeExecutionVisualStatus,
  type GraphNode,
  type ClassifiedGraphEdge,
} from '@activepieces/shared';
import {
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import { StoreApi } from 'zustand';

import { BuilderState } from '../builder-hooks';

/**
 * The set of FlowOperationType values that represent structural changes
 * requiring a graph rebuild via syncGraphFromFlowVersion.
 *
 * Non-structural operations (UPDATE_ACTION, UPDATE_NOTE, SAVE_SAMPLE_DATA,
 * UPDATE_CANVAS_LAYOUT, etc.) do NOT trigger graph rebuild because they
 * only change step settings or metadata, not the graph topology.
 */
const STRUCTURAL_OPERATIONS = new Set<FlowOperationType>([
  FlowOperationType.ADD_ACTION,
  FlowOperationType.DELETE_ACTION,
  FlowOperationType.MOVE_ACTION,
  FlowOperationType.ADD_BRANCH,
  FlowOperationType.DELETE_BRANCH,
  FlowOperationType.MOVE_BRANCH,
  FlowOperationType.DUPLICATE_ACTION,
  FlowOperationType.DUPLICATE_BRANCH,
  FlowOperationType.IMPORT_FLOW,
  FlowOperationType.UPDATE_TRIGGER,
  FlowOperationType.SET_SKIP_ACTION,
  FlowOperationType.GRAPH_ADD_NODE,
  FlowOperationType.GRAPH_REMOVE_NODE,
  FlowOperationType.GRAPH_ADD_EDGE,
  FlowOperationType.GRAPH_REMOVE_EDGE,
]);

/**
 * Graph state slice for the builder Zustand store.
 *
 * Manages ReactFlow nodes and edges for the graph canvas.
 * Wraps pure shared utilities (graph-state-utils.ts) with
 * ReactFlow-specific change handlers (applyNodeChanges, applyEdgeChanges).
 *
 * Listens to flow state operation listeners for structural changes
 * and rebuilds the graph when the linked-list structure changes.
 */
export type GraphState = {
  /** Current ReactFlow nodes */
  graphNodes: GraphNode[];
  /** Current ReactFlow edges with type classification */
  graphEdges: ClassifiedGraphEdge[];
  /** Handler for ReactFlow node changes (drag, select, remove) */
  onGraphNodesChange: OnNodesChange;
  /** Handler for ReactFlow edge changes (select, remove) */
  onGraphEdgesChange: OnEdgesChange;
  /** Handler for ReactFlow new connections */
  onGraphConnect: OnConnect;
  /** Rebuild graph from current flowVersion */
  syncGraphFromFlow: () => void;
  /** Push current graph state to flow state (trigger + canvasLayout) */
  syncGraphToFlow: () => void;
  /** Recompute auto-layout for all nodes */
  autoLayoutGraph: () => void;
  /** Remove selected nodes and relink edges */
  deleteSelectedGraphNodes: (nodeIds: string[]) => void;
  /** Remove selected edges */
  deleteSelectedGraphEdges: (edgeIds: string[]) => void;
  /** P2-B06: Сохранить позицию ноды через GRAPH_MOVE_NODE */
  moveGraphNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
};

type GraphStateInitialState = Pick<BuilderState, 'flowVersion'>;

/**
 * Create the graph state slice for the builder Zustand store.
 *
 * Follows the same pattern as createFlowState and createCanvasState:
 * receives (initialState, get, set) from createBuilderStore.
 *
 * On initialization:
 * 1. Converts the initial FlowVersion to graph nodes+edges
 * 2. Registers an operation listener for structural changes
 */
export const createGraphState = (
  initialState: GraphStateInitialState,
  get: StoreApi<BuilderState>['getState'],
  set: StoreApi<BuilderState>['setState'],
  api?: StoreApi<BuilderState>,
): GraphState => {
  const initialData = createInitialGraphData(initialState.flowVersion);

  // Auto-persist computed layout when shouldPersistLayout is true (P1-F03 migration)
  if (initialData.shouldPersistLayout) {
    setTimeout(() => {
      const state = get();
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of initialData.nodes) {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      }
      state.applyOperation({
        type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
        request: { canvasLayout: { positions } },
      });
    }, 0);
  }

  // Register operation listener for structural changes.
  // When the flow's linked-list structure changes, rebuild the graph.
  // This is deferred to next tick to avoid circular set() during initialization.
  setTimeout(() => {
    const state = get();
    state.addOperationListener(
      (flowVersion: FlowVersion, operation: FlowOperationRequest) => {
        if (STRUCTURAL_OPERATIONS.has(operation.type)) {
          const newData = syncGraphFromFlowVersion(flowVersion);
          set({
            graphNodes: newData.nodes,
            graphEdges: newData.edges,
          });
        }
      },
    );
  }, 0);

  /**
   * P3-A03: Синхронизация execution overlay.
   *
   * Подписываемся на изменения state.run через Zustand api.subscribe().
   * Когда run обновляется (WebSocket progress или setRun),
   * пересчитываем executionStatus и errorMessage для каждой ноды
   * используя shared утилиты getNodeVisualStatus() и getNodeErrorMessage().
   *
   * Подписка через api.subscribe с селектором state.run — реагирует
   * только на изменения run, не на каждое обновление store.
   */
  const syncExecutionOverlay = () => {
    const state = get();
    const run = state.run;
    const runSteps = run?.steps ?? null;
    const runStatus = run?.status ?? null;

    const currentNodes = state.graphNodes;
    let hasChanges = false;
    const updatedNodes = currentNodes.map((node) => {
      const newStatus = getNodeVisualStatus(node.id, runSteps, runStatus);
      const newErrorMessage = getNodeErrorMessage(node.id, runSteps) ?? undefined;
      const currentStatus = (node.data.executionStatus as NodeExecutionVisualStatus) || NodeExecutionVisualStatus.IDLE;
      const currentError = node.data.errorMessage;

      if (currentStatus !== newStatus || currentError !== newErrorMessage) {
        hasChanges = true;
        return {
          ...node,
          data: {
            ...node.data,
            executionStatus: newStatus,
            errorMessage: newErrorMessage,
          },
        };
      }
      return node;
    });

    if (hasChanges) {
      set({ graphNodes: updatedNodes });
    }
  };

  // Подписка через Zustand store api.subscribe — реагирует на изменения run.
  // Deferred для избежания circular set() при инициализации.
  if (api) {
    setTimeout(() => {
      let prevRun = get().run;
      api.subscribe((state) => {
        if (state.run !== prevRun) {
          prevRun = state.run;
          syncExecutionOverlay();
        }
      });
    }, 0);
  }

  return {
    graphNodes: initialData.nodes,
    graphEdges: initialData.edges,

    onGraphNodesChange: (changes: NodeChange[]) => {
      set((state) => ({
        graphNodes: applyNodeChanges(
          changes,
          state.graphNodes,
        ) as GraphNode[],
      }));
    },

    onGraphEdgesChange: (changes: EdgeChange[]) => {
      set((state) => ({
        graphEdges: applyEdgeChanges(
          changes,
          state.graphEdges,
        ) as ClassifiedGraphEdge[],
      }));
    },

    onGraphConnect: (connection: Connection) => {
      const state = get();
      const connectionParams = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      };

      // Валидация через connection-validator (cycle, handle rules, max 1 per handle)
      const isValid = createIsValidConnection(
        state.graphNodes,
        state.graphEdges,
      );
      if (!isValid(connectionParams)) {
        return;
      }

      // Создать GRAPH_ADD_EDGE операцию и dispatch через applyOperation
      const operation = createGraphAddEdgeFromConnection(connectionParams);
      if (!operation) {
        return;
      }

      state.applyOperation({
        type: FlowOperationType.GRAPH_ADD_EDGE,
        request: operation.request,
      });
    },

    syncGraphFromFlow: () => {
      set((state) => {
        const newData = syncGraphFromFlowVersion(state.flowVersion);
        return {
          graphNodes: newData.nodes,
          graphEdges: newData.edges,
        };
      });
    },

    syncGraphToFlow: () => {
      const state = get();
      const result = syncGraphToFlowVersion(
        state.graphNodes,
        state.graphEdges,
      );
      state.applyOperation({
        type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
        request: {
          canvasLayout: result.canvasLayout,
        },
      });
    },

    autoLayoutGraph: () => {
      set((state) => ({
        graphNodes: autoLayoutGraphNodes(state.graphNodes, state.graphEdges),
      }));
    },

    deleteSelectedGraphNodes: (nodeIds: string[]) => {
      const state = get();
      for (const nodeId of nodeIds) {
        const operation = createGraphRemoveNodeOperation(nodeId);
        state.applyOperation({
          type: FlowOperationType.GRAPH_REMOVE_NODE,
          request: operation.request,
        });
      }
    },

    deleteSelectedGraphEdges: (edgeIds: string[]) => {
      const state = get();
      for (const edgeId of edgeIds) {
        const operation = createGraphRemoveEdgeOperation(edgeId);
        state.applyOperation({
          type: FlowOperationType.GRAPH_REMOVE_EDGE,
          request: operation.request,
        });
      }
    },

    moveGraphNodePosition: (nodeId: string, position: { x: number; y: number }) => {
      const state = get();
      const operation = createGraphMoveNodeOperation(nodeId, position);
      state.applyOperation({
        type: FlowOperationType.GRAPH_MOVE_NODE,
        request: operation.request,
      });
    },
  };
};
