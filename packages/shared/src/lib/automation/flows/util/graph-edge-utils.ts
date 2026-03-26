import { HANDLE_IDS, isBranchHandle } from './connection-rules'
import type { GraphEdge } from './graph-converter'

/**
 * Edge type classification based on sourceHandle.
 * Maps to ReactFlow edgeTypes registry keys used by graph-canvas-provider.tsx.
 *
 * - 'default': standard output→input edge (nextAction)
 * - 'loop': loop-output→input edge (firstLoopAction)
 * - 'branch': branch-N→input edge (children[N])
 */
export type GraphEdgeType = 'default' | 'loop' | 'branch'

/**
 * Constants for registering edge types with ReactFlow.
 * Used by graph-canvas-provider.tsx in P1-D04 to map type strings
 * to React components:
 *   edgeTypes = {
 *     [GRAPH_EDGE_TYPES.DEFAULT]: GraphEdge,
 *     [GRAPH_EDGE_TYPES.LOOP]: GraphLoopEdge,
 *     [GRAPH_EDGE_TYPES.BRANCH]: GraphBranchEdge,
 *   }
 */
export const GRAPH_EDGE_TYPES = {
    DEFAULT: 'default' as const,
    LOOP: 'loop' as const,
    BRANCH: 'branch' as const,
}

/**
 * Style configuration for each edge type.
 * Colors match handle styles from handles.tsx:
 * - default: #94a3b8 (slate, matches handleBaseStyle)
 * - loop: #8b5cf6 (purple, matches GraphLoopOutputHandle)
 * - branch: #f59e0b (amber, matches GraphBranchHandle)
 */
export type GraphEdgeStyle = {
    stroke: string
    strokeWidth: number
    strokeDasharray?: string
}

const EDGE_STYLES: Record<GraphEdgeType, GraphEdgeStyle> = {
    default: {
        stroke: '#94a3b8',
        strokeWidth: 2,
    },
    loop: {
        stroke: '#8b5cf6',
        strokeWidth: 2,
        strokeDasharray: '5 3',
    },
    branch: {
        stroke: '#f59e0b',
        strokeWidth: 2,
    },
}

/**
 * Classify an edge by its sourceHandle.
 *
 * Architecture doc section 6.3 defines three handle types that produce edges:
 * - output (bottom-center) → maps to nextAction → 'default' edge
 * - loop-output (right of loop) → maps to firstLoopAction → 'loop' edge
 * - branch-N (right of router) → maps to children[N] → 'branch' edge
 *
 * @param sourceHandle - the handle ID the edge originates from
 * @returns the GraphEdgeType classification
 */
export function getEdgeType(sourceHandle: string): GraphEdgeType {
    if (sourceHandle === HANDLE_IDS.LOOP_OUTPUT) {
        return GRAPH_EDGE_TYPES.LOOP
    }
    if (isBranchHandle(sourceHandle)) {
        return GRAPH_EDGE_TYPES.BRANCH
    }
    return GRAPH_EDGE_TYPES.DEFAULT
}

/**
 * Get display label for an edge based on sourceHandle.
 *
 * Branch edges display "Branch N" (1-based index for user-friendly display).
 * All other edge types have no label.
 *
 * @param sourceHandle - the handle ID the edge originates from
 * @returns label string or empty string
 */
export function getEdgeLabel(sourceHandle: string): string {
    if (isBranchHandle(sourceHandle)) {
        const match = sourceHandle.match(/^branch-(\d+)$/)
        if (match) {
            const index = parseInt(match[1], 10)
            return `Branch ${index + 1}`
        }
    }
    return ''
}

/**
 * Get style configuration for an edge based on its type.
 *
 * @param edgeType - the GraphEdgeType classification
 * @returns GraphEdgeStyle with stroke, strokeWidth, and optional strokeDasharray
 */
export function getEdgeStyle(edgeType: GraphEdgeType): GraphEdgeStyle {
    return EDGE_STYLES[edgeType]
}

/**
 * Annotate a GraphEdge array with computed type information.
 *
 * Each edge gets an additional 'type' field derived from its sourceHandle.
 * This 'type' field is used by ReactFlow to select the correct edge component
 * from the edgeTypes registry.
 *
 * @param edges - array of GraphEdge from graph-converter.ts
 * @returns edges with added 'type' field
 */
export function classifyEdges(
    edges: GraphEdge[],
): Array<GraphEdge & { type: GraphEdgeType }> {
    return edges.map((edge) => ({
        ...edge,
        type: getEdgeType(edge.sourceHandle),
    }))
}
