import { FlowVersion } from '../flow-version'
import { computeAutoLayout } from './auto-layout'
import { validateConnection } from './connection-validator'
import { classifyEdges, GRAPH_EDGE_TYPES } from './graph-edge-utils'
import { linkedListToGraph, GraphNode, GraphEdge } from './graph-converter'

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
 */
export const GRAPH_NODE_TYPE_KEYS = {
    TRIGGER: 'trigger',
    ACTION: 'action',
    LOOP: 'loop',
    ROUTER: 'router',
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
 */
export type GraphCanvasData = {
    nodes: GraphNode[]
    edges: Array<GraphEdge & { type: string }>
}

/**
 * Convert a FlowVersion to ReactFlow-ready graph data.
 *
 * Pipeline:
 * 1. linkedListToGraph() -- traverse trigger->nextAction chain to build nodes + edges
 * 2. classifyEdges() -- annotate each edge with a type (default/loop/branch)
 * 3. computeAutoLayout() -- apply Dagre layout when canvasLayout is null
 *
 * When canvasLayout exists in the FlowVersion, stored positions are used directly
 * (applied by linkedListToGraph). When null, Dagre computes initial positions.
 *
 * @param flowVersion - the FlowVersion to convert
 * @returns GraphCanvasData with nodes and typed edges
 */
export function buildGraphFromFlowVersion(flowVersion: FlowVersion): GraphCanvasData {
    const { nodes, edges } = linkedListToGraph(flowVersion)
    const typedEdges = classifyEdges(edges)

    // Apply auto-layout when no stored positions are available
    if (!flowVersion.canvasLayout) {
        const layout = computeAutoLayout(nodes, edges)
        for (const node of nodes) {
            const pos = layout.positions[node.id]
            if (pos) {
                node.position = { x: pos.x, y: pos.y }
            }
        }
    }

    return { nodes, edges: typedEdges }
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
