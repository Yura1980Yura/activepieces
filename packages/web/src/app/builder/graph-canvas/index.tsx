import {
  createIsValidConnection,
  parsePaletteDragData,
  PALETTE_DRAG_TYPE,
  GRAPH_DELETE_KEY_CODE,
  GRAPH_MULTI_SELECTION_KEY,
  GRAPH_KEYBOARD_SHORTCUTS,
  GRAPH_SHORTCUT_IDS,
  matchesShortcut,
  type PaletteDragData,
} from '@activepieces/shared';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodeDrag,
  type IsValidConnection,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useEffect, useRef } from 'react';

import { GraphCanvasControls } from './canvas-controls';
import {
  GraphCanvasProvider,
  useGraphCanvasContext,
} from './graph-canvas-provider';

/**
 * Props for the GraphCanvas component.
 *
 * GraphCanvas is a standalone component that does NOT import from
 * builder-hooks.ts or state/ directory. All data flows through props.
 * Integration with builder state is deferred to P1-D05/P1-F01.
 */
export type GraphCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeClick?: NodeMouseHandler;
  /** Callback for auto-layout button, wired to autoLayoutGraph() in graph state */
  onAutoLayout?: () => void;
  /** Callback when a piece is dropped from the palette sidebar onto the canvas (P1-E01) */
  onPieceDrop?: (
    dragData: PaletteDragData,
    position: { x: number; y: number },
  ) => void;
  /** Callback for right-click on a node (P1-E02) */
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  /** Callback for right-click on an edge (P1-E02) */
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  /** Callback for right-click on canvas background (P1-E02) */
  onPaneContextMenu?: (event: React.MouseEvent | MouseEvent) => void;
  /** P2-B04: Callback для удаления ноды через контекстное меню → GRAPH_REMOVE_NODE */
  onDeleteNode?: (nodeId: string) => void;
  /** P2-B04: Callback для удаления ребра через контекстное меню → GRAPH_REMOVE_EDGE */
  onDeleteEdge?: (edgeId: string) => void;
  /** P2-B06: Callback для сохранения позиции ноды после перетаскивания → GRAPH_MOVE_NODE */
  onMoveNode?: (nodeId: string, position: { x: number; y: number }) => void;
};

/**
 * Inner component that uses the GraphCanvasContext.
 * Must be rendered inside GraphCanvasProvider to access nodeTypes/edgeTypes.
 */
const GraphCanvasInner = React.memo(
  ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onAutoLayout,
    onPieceDrop,
    onNodeContextMenu,
    onEdgeContextMenu,
    onPaneContextMenu,
    onDeleteNode,
    onDeleteEdge,
    onMoveNode,
  }: GraphCanvasProps) => {
    const { nodeTypes, edgeTypes } = useGraphCanvasContext();
    const reactFlowInstance = useReactFlow();

    /**
     * Connection validation callback.
     * Wraps validateConnection() from connection-validator.ts.
     *
     * Enforces:
     * - No self-connections
     * - No cycles (BFS reachability)
     * - Max 1 edge per input/output handle
     * - Trigger cannot be target
     * - Source handle valid for node type
     */
    const isValidConnection: IsValidConnection = useCallback(
      (connection: Edge | Connection) => {
        return createIsValidConnection(
          nodes as Parameters<typeof createIsValidConnection>[0],
          edges as Parameters<typeof createIsValidConnection>[1],
        )({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
        });
      },
      [nodes, edges],
    );

    /**
     * Handle drag over events from the piece palette sidebar.
     * Sets the drop effect to 'move' to indicate the canvas accepts drops.
     */
    const handleDragOver = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }, []);

    /**
     * P2-B04: Handle ReactFlow delete events (Delete key, Backspace).
     *
     * Intercepts ReactFlow's built-in delete mechanism and dispatches
     * through GRAPH_REMOVE_NODE / GRAPH_REMOVE_EDGE operations instead
     * of directly mutating local state. This ensures the flow pipeline
     * (syncTriggerFromGraphData, operation listeners) processes removals.
     */
    const handleDelete = useCallback(
      ({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[]; edges: Edge[] }) => {
        for (const node of deletedNodes) {
          onDeleteNode?.(node.id);
        }
        for (const edge of deletedEdges) {
          onDeleteEdge?.(edge.id);
        }
      },
      [onDeleteNode, onDeleteEdge],
    );

    /**
     * P2-B06: Авто-сохранение позиций при dragEnd с debounce 500ms.
     *
     * При перетаскивании ноды ReactFlow обновляет позицию локально через
     * onNodesChange. При dragEnd нужно сохранить новую позицию в graphData
     * через GRAPH_MOVE_NODE для серверной персистенции.
     *
     * Debounce 500ms предотвращает частые dispatch операций при быстрых
     * перетаскиваниях нескольких нод. Используем useRef + setTimeout
     * для debounce без внешних зависимостей.
     */
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    const flushPendingMoves = useCallback(() => {
      const moves = pendingMovesRef.current;
      if (moves.size === 0) return;
      for (const [nodeId, position] of moves.entries()) {
        onMoveNode?.(nodeId, position);
      }
      moves.clear();
    }, [onMoveNode]);

    const handleNodeDragStop: OnNodeDrag = useCallback(
      (_event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
        // Собираем позиции всех перемещённых нод (при multi-select draggedNodes > 1)
        const nodesToMove = draggedNodes.length > 0 ? draggedNodes : [node];
        for (const n of nodesToMove) {
          pendingMovesRef.current.set(n.id, { x: n.position.x, y: n.position.y });
        }

        // Сбрасываем предыдущий таймер и ставим новый (debounce 500ms)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(flushPendingMoves, 500);
      },
      [flushPendingMoves],
    );

    // Очистка таймера при размонтировании + flush оставшихся moves
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        // Flush при размонтировании чтобы не потерять последний drag
        const moves = pendingMovesRef.current;
        if (moves.size > 0) {
          flushPendingMoves();
        }
      };
    }, [flushPendingMoves]);

    /**
     * P2-B05: Ctrl+A (Cmd+A на macOS) — выделить все ноды и рёбра.
     *
     * ReactFlow не имеет встроенного Ctrl+A, поэтому реализуем через
     * document keydown listener. Используем matchesShortcut() из shared
     * для единообразной проверки клавиш.
     *
     * Вызывает onNodesChange и onEdgesChange с type='select' + selected=true
     * для каждого элемента, что корректно обновляет ReactFlow internal state.
     */
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Игнорируем если фокус внутри input/textarea
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        const selectAllShortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.SELECT_ALL];
        if (matchesShortcut(event.key, event.ctrlKey || event.metaKey, event.shiftKey, selectAllShortcut)) {
          event.preventDefault();
          event.stopPropagation();

          // Выделяем все ноды
          onNodesChange?.(
            nodes.map((node) => ({
              type: 'select' as const,
              id: node.id,
              selected: true,
            })),
          );

          // Выделяем все рёбра
          onEdgesChange?.(
            edges.map((edge) => ({
              type: 'select' as const,
              id: edge.id,
              selected: true,
            })),
          );
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [nodes, edges, onNodesChange, onEdgesChange]);

    /**
     * Handle drop events from the piece palette sidebar.
     *
     * Pipeline:
     * 1. Extract palette drag data from HTML5 DataTransfer
     * 2. Parse and validate the data using parsePaletteDragData
     * 3. Convert screen coordinates to flow position via screenToFlowPosition
     * 4. Call onPieceDrop callback with parsed data and flow position
     */
    const handleDrop = useCallback(
      (event: React.DragEvent) => {
        event.preventDefault();
        const data = event.dataTransfer.getData(PALETTE_DRAG_TYPE);
        if (!data) return;
        const dragData = parsePaletteDragData(data);
        if (!dragData) return;
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        onPieceDrop?.(dragData, position);
      },
      [reactFlowInstance, onPieceDrop],
    );

    return (
      <div className="size-full relative overflow-hidden bg-builder-background">
        <ReactFlow
          className="bg-builder-background"
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onDelete={handleDelete}
          onNodeDragStop={handleNodeDragStop}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          isValidConnection={isValidConnection}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectionOnDrag={true}
          deleteKeyCode={GRAPH_DELETE_KEY_CODE}
          multiSelectionKeyCode={GRAPH_MULTI_SELECTION_KEY}
          maxZoom={1.5}
          minZoom={0.5}
          fitView={true}
          zoomOnDoubleClick={false}
        >
          <Background
            gap={10}
            size={1}
            variant={BackgroundVariant.Dots}
            bgColor="var(--builder-background)"
            color="var(--builder-background-pattern)"
          />
          <GraphCanvasControls onAutoLayout={onAutoLayout} />
        </ReactFlow>
      </div>
    );
  },
);

GraphCanvasInner.displayName = 'GraphCanvasInner';

/**
 * GraphCanvas — main graph canvas component with free node positioning.
 *
 * Architecture doc section 3: "Main GraphCanvas component with ReactFlow"
 * Architecture doc section 5: P1-D04 — "ReactFlow with free positioning + edges"
 *
 * Features:
 * - Free node dragging (nodesDraggable={true})
 * - Handle-to-handle edge creation (nodesConnectable={true})
 * - Connection validation (cycle detection, max 1 edge per handle, etc.)
 * - Auto-layout via Dagre when canvasLayout is null
 * - Classified edges (default/loop/branch) with distinct visual styles
 * - Background with dots pattern
 * - Canvas controls: zoom in/out, fit-to-view, auto-layout button (P1-D06)
 * - Piece palette drop target: accepts HTML5 drag from sidebar (P1-E01)
 * - Context menu events: node, edge, canvas right-click handlers (P1-E02)
 * - Keyboard shortcuts: Delete/Backspace (remove selected), Ctrl+A (select all),
 *   Shift+click (multi-select), rectangle selection on drag (P2-B05)
 * - Auto-save node positions: onNodeDragStop with 500ms debounce → GRAPH_MOVE_NODE (P2-B06)
 *
 * Wraps GraphCanvasInner with GraphCanvasProvider to supply
 * nodeTypes, edgeTypes, and ReactFlowProvider.
 */
export const GraphCanvas = React.memo(
  (props: GraphCanvasProps) => {
    return (
      <GraphCanvasProvider>
        <GraphCanvasInner {...props} />
      </GraphCanvasProvider>
    );
  },
);

GraphCanvas.displayName = 'GraphCanvas';
