import { FlowVersion } from '../flow-version'
import { validateConnection } from './connection-validator'
import { classifyEdges, GRAPH_EDGE_TYPES } from './graph-edge-utils'
import { linkedListToGraph, migrateCanvasLayout, GraphNode, GraphEdge } from './graph-converter'
import { notesToGraphNodes, NOTE_NODE_TYPE } from './graph-note-node-utils'

/**
 * Node type keys for the ReactFlow nodeTypes registry.
 *
 * These keys must match the values returned by stepTypeToNodeType()
 * in graph-converter.ts. ReactFlow uses them to select the correct
 * React component for each node.
 *
 * Mapping:
 * - 'trigger' -> GraphTriggerNode (P1-D02)
 * - 'action'  -> GraphStepNode   (P1-D02)
 * - 'loop'    -> GraphStepNode   (P1-D02, same component, different handles)
 * - 'router'  -> GraphStepNode   (P1-D02, same component, branch handles)
 * - 'note'    -> GraphNoteNode   (P1-E03, free-form sticky note, no handles)
 */
export const GRAPH_NODE_TYPE_KEYS = {
    TRIGGER: 'trigger',
    ACTION: 'action',
    LOOP: 'loop',
    ROUTER: 'router',
    NOTE: NOTE_NODE_TYPE,
} as const

/**
 * Returns the configuration mapping for ReactFlow nodeTypes.
 *
 * Each key corresponds to a node type string produced by
 * graph-converter.ts stepTypeToNodeType(). The React component
 * for each key is registered in graph-canvas-provider.tsx.
 *
 * @returns Record with node type keys
 */
export function createNodeTypesConfig(): Record<string, string> {
    return {
        [GRAPH_NODE_TYPE_KEYS.TRIGGER]: GRAPH_NODE_TYPE_KEYS.TRIGGER,
        [GRAPH_NODE_TYPE_KEYS.ACTION]: GRAPH_NODE_TYPE_KEYS.ACTION,
        [GRAPH_NODE_TYPE_KEYS.LOOP]: GRAPH_NODE_TYPE_KEYS.LOOP,
        [GRAPH_NODE_TYPE_KEYS.ROUTER]: GRAPH_NODE_TYPE_KEYS.ROUTER,
        [GRAPH_NODE_TYPE_KEYS.NOTE]: GRAPH_NODE_TYPE_KEYS.NOTE,
    }
}

/**
 * Returns the configuration mapping for ReactFlow edgeTypes.
 *
 * Each key corresponds to an edge type produced by classifyEdges()
 * in graph-edge-utils.ts. The React component for each key is
 * registered in graph-canvas-provider.tsx.
 *
 * @returns Record with edge type keys matching GRAPH_EDGE_TYPES
 */
export function createEdgeTypesConfig(): Record<string, string> {
    return {
        [GRAPH_EDGE_TYPES.DEFAULT]: GRAPH_EDGE_TYPES.DEFAULT,
        [GRAPH_EDGE_TYPES.LOOP]: GRAPH_EDGE_TYPES.LOOP,
        [GRAPH_EDGE_TYPES.BRANCH]: GRAPH_EDGE_TYPES.BRANCH,
    }
}

/**
 * Result of building a graph from a FlowVersion.
 * Contains nodes and edges ready for ReactFlow consumption.
 *
 * `shouldPersistLayout` is true when the layout was computed or partially filled
 * (P1-F03 migration) and should be saved back via UPDATE_CANVAS_LAYOUT.
 */
export type GraphCanvasData = {
    nodes: GraphNode[]
    edges: Array<GraphEdge & { type: string }>
    shouldPersistLayout: boolean
}

/**
 * Convert a FlowVersion to ReactFlow-ready graph data.
 *
 * Pipeline:
 * 1. linkedListToGraph() -- traverse trigger->nextAction chain to build nodes + edges
 * 2. classifyEdges() -- annotate each edge with a type (default/loop/branch)
 * 3. migrateCanvasLayout() -- compute Dagre layout when canvasLayout is null or partial (P1-F03)
 * 4. notesToGraphNodes() -- convert FlowVersion.notes[] to note-type graph nodes (P1-E03)
 *
 * When canvasLayout exists with all node positions, stored positions are used directly.
 * When null or partial, Dagre auto-layout fills missing positions and signals
 * shouldPersistLayout=true so the caller can save computed positions.
 *
 * Note nodes are appended after action/trigger nodes. They use their own stored
 * positions from Note.position and are excluded from auto-layout (they are not
 * part of the execution flow).
 *
 * @param flowVersion - the FlowVersion to convert
 * @returns GraphCanvasData with nodes (including notes), typed edges, and persistence flag
 */
export function buildGraphFromFlowVersion(flowVersion: FlowVersion): GraphCanvasData {
    const { nodes, edges } = linkedListToGraph(flowVersion)
    const typedEdges = classifyEdges(edges)

    // Migrate canvas layout: compute auto-layout for null/partial canvasLayout (P1-F03)
    const migration = migrateCanvasLayout(nodes, edges, flowVersion.canvasLayout ?? null)
    for (const node of nodes) {
        const pos = migration.positions[node.id]
        if (pos) {
            node.position = { x: pos.x, y: pos.y }
        }
    }

    // Append note nodes from FlowVersion.notes[] (P1-E03)
    // Notes have their own stored positions and are not part of the execution graph.
    const noteNodes = notesToGraphNodes(flowVersion.notes ?? [])
    const allNodes = [...nodes, ...noteNodes]

    return { nodes: allNodes, edges: typedEdges, shouldPersistLayout: migration.shouldPersistLayout }
}

/**
 * Canvas control action identifiers.
 *
 * Defines the standard set of controls available in the graph canvas toolbar.
 * Used by canvas-controls.tsx (P1-D06) to build the control buttons.
 *
 * This pure-data constant lives in shared for testability: the React component
 * in packages/web references these identifiers, and tests in packages/shared
 * can verify the expected set of controls without requiring a DOM environment.
 */
export const CANVAS_CONTROL_ACTIONS = {
    ZOOM_IN: 'zoom-in',
    ZOOM_OUT: 'zoom-out',
    FIT_VIEW: 'fit-view',
    AUTO_LAYOUT: 'auto-layout',
} as const

export type CanvasControlAction = typeof CANVAS_CONTROL_ACTIONS[keyof typeof CANVAS_CONTROL_ACTIONS]

/**
 * Returns the list of canvas control action identifiers in toolbar order.
 *
 * The order matches the visual layout of the controls toolbar:
 * zoom-in, zoom-out, fit-view, [separator], auto-layout.
 *
 * @returns array of CanvasControlAction identifiers
 */
export function getCanvasControlActions(): CanvasControlAction[] {
    return [
        CANVAS_CONTROL_ACTIONS.ZOOM_IN,
        CANVAS_CONTROL_ACTIONS.ZOOM_OUT,
        CANVAS_CONTROL_ACTIONS.FIT_VIEW,
        CANVAS_CONTROL_ACTIONS.AUTO_LAYOUT,
    ]
}

/**
 * Connection parameters matching ReactFlow's Connection type.
 */
export type ConnectionParams = {
    source: string | null
    target: string | null
    sourceHandle: string | null
    targetHandle: string | null
}

/**
 * Create a connection validation callback for ReactFlow's isValidConnection prop.
 *
 * Wraps validateConnection() from connection-validator.ts into the shape
 * expected by ReactFlow: (connection) => boolean.
 *
 * @param nodes - current graph nodes
 * @param edges - current graph edges
 * @returns callback that returns true for valid connections, false otherwise
 */
/**
 * Extract the step name from a graph node for step selection.
 *
 * Used by the builder's onNodeClick handler to map a ReactFlow node click
 * to a step selection via selectStepByName(). Returns null for note nodes
 * (notes are not execution steps and cannot be selected in the step settings panel).
 *
 * @param node - the clicked GraphNode
 * @returns step name string, or null if the node is a note or has no step data
 */
export function getStepNameFromNode(node: GraphNode): string | null {
    if (node.type === NOTE_NODE_TYPE) {
        return null
    }
    const data = node.data as Record<string, unknown> | undefined
    if (!data || typeof data['stepName'] !== 'string') {
        return null
    }
    return data['stepName']
}

export function createIsValidConnection(
    nodes: GraphNode[],
    edges: GraphEdge[],
): (connection: ConnectionParams) => boolean {
    return (connection: ConnectionParams): boolean => {
        const { source, target, sourceHandle, targetHandle } = connection
        if (!source || !target || !sourceHandle || !targetHandle) {
            return false
        }

        const result = validateConnection(
            source,
            target,
            sourceHandle,
            targetHandle,
            nodes,
            edges,
        )
        return result.valid
    }
}
