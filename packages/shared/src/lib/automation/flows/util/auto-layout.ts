import dagre from '@dagrejs/dagre'
import { CanvasLayout } from '../flow-version'

const DEFAULT_NODE_WIDTH = 232
const DEFAULT_NODE_HEIGHT = 60
const DEFAULT_RANK_SEP = 80
const DEFAULT_NODE_SEP = 140

export type AutoLayoutOptions = {
    nodeWidth?: number
    nodeHeight?: number
    rankSep?: number
    nodeSep?: number
}

type LayoutNode = {
    id: string
    width?: number
    height?: number
}

type LayoutEdge = {
    source: string
    target: string
}

/**
 * Compute auto-layout positions for a set of nodes and edges using Dagre.
 *
 * Uses top-to-bottom (TB) direction with configurable spacing.
 * Default spacing: 80px vertical (rankSep), 140px horizontal (nodeSep).
 * Default node size: 232x60 (matching FLOW_CANVAS_STEP_WIDTH/HEIGHT).
 *
 * Returns a CanvasLayout with positions for each node (top-left corner).
 */
export function computeAutoLayout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options?: AutoLayoutOptions,
): CanvasLayout {
    const nodeWidth = options?.nodeWidth ?? DEFAULT_NODE_WIDTH
    const nodeHeight = options?.nodeHeight ?? DEFAULT_NODE_HEIGHT
    const rankSep = options?.rankSep ?? DEFAULT_RANK_SEP
    const nodeSep = options?.nodeSep ?? DEFAULT_NODE_SEP

    const g = new dagre.graphlib.Graph()
    g.setGraph({
        rankdir: 'TB',
        ranksep: rankSep,
        nodesep: nodeSep,
    })
    g.setDefaultEdgeLabel(() => ({}))

    for (const node of nodes) {
        g.setNode(node.id, {
            width: node.width ?? nodeWidth,
            height: node.height ?? nodeHeight,
        })
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    const positions: Record<string, { x: number; y: number }> = {}

    for (const nodeId of g.nodes()) {
        const nodeData = g.node(nodeId)
        if (nodeData) {
            // Dagre returns center positions; convert to top-left
            positions[nodeId] = {
                x: nodeData.x - (nodeData.width / 2),
                y: nodeData.y - (nodeData.height / 2),
            }
        }
    }

    return {
        positions,
    }
}
