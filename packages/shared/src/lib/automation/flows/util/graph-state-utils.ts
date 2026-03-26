import { FlowActionType } from '../actions/action'
import { CanvasLayout, FlowVersion } from '../flow-version'
import { FlowTrigger } from '../triggers/trigger'
import { computeAutoLayout } from './auto-layout'
import { validateConnection } from './connection-validator'
import { ConnectionParams } from './graph-canvas-utils'
import {
    GraphNode,
    GraphEdge,
    linkedListToGraph,
    graphToLinkedList,
    extractPositions,
} from './graph-converter'
import { classifyEdges, GraphEdgeType } from './graph-edge-utils'
import { flowStructureUtil, Step } from './flow-structure-util'

/**
 * Typed edge with classification for ReactFlow.
 */
export type ClassifiedGraphEdge = GraphEdge & { type: GraphEdgeType }

/**
 * Result of graph state initialization or sync.
 */
export type GraphStateData = {
    nodes: GraphNode[]
    edges: ClassifiedGraphEdge[]
}

/**
 * Result of syncing graph to flow version format.
 */
export type GraphToFlowResult = {
    trigger: FlowTrigger
    canvasLayout: CanvasLayout
}

/**
 * Create initial graph data from a FlowVersion.
 *
 * Pipeline:
 * 1. linkedListToGraph() - traverse linked-list to nodes+edges
 * 2. classifyEdges() - annotate edges with type (default/loop/branch)
 * 3. computeAutoLayout() - apply Dagre when canvasLayout is null
 *
 * When canvasLayout exists, stored positions are used directly.
 * When null, Dagre computes initial positions.
 */
export function createInitialGraphData(flowVersion: FlowVersion): GraphStateData {
    const { nodes, edges } = linkedListToGraph(flowVersion)
    const typedEdges = classifyEdges(edges)

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
 * Rebuild graph data from a FlowVersion.
 * Used when flow state changes externally (operation listener).
 *
 * Semantically distinct from createInitialGraphData but uses the same logic.
 */
export function syncGraphFromFlowVersion(flowVersion: FlowVersion): GraphStateData {
    return createInitialGraphData(flowVersion)
}

/**
 * Convert current graph nodes and edges back to FlowTrigger + CanvasLayout.
 *
 * Uses graphToLinkedList to rebuild the trigger chain and extractPositions
 * to capture current node positions for persistence.
 */
export function syncGraphToFlowVersion(
    nodes: GraphNode[],
    edges: GraphEdge[],
): GraphToFlowResult {
    const trigger = graphToLinkedList(nodes, edges)
    const positions = extractPositions(nodes)
    const canvasLayout: CanvasLayout = { positions }

    return { trigger, canvasLayout }
}

/**
 * Recompute auto-layout positions for all nodes using Dagre.
 *
 * Returns a new array of nodes with updated positions.
 * Edges are unchanged (layout only affects positions).
 */
export function autoLayoutGraphNodes(
    nodes: GraphNode[],
    edges: GraphEdge[],
): GraphNode[] {
    const layout = computeAutoLayout(nodes, edges)
    return nodes.map((node) => {
        const pos = layout.positions[node.id]
        if (pos) {
            return { ...node, position: { x: pos.x, y: pos.y } }
        }
        return node
    })
}

/**
 * Remove nodes by ID and all edges connected to them.
 *
 * Relinking logic: if a deleted node B had an incoming edge from A (via output handle)
 * and an outgoing edge to C (via output handle), create a new edge A->C.
 * This preserves the chain continuity when a middle node is removed.
 *
 * Does NOT relink loop-output or branch-N edges (these are structural and
 * removing a node from a loop/branch body should not auto-relink).
 */
export function removeGraphNodes(
    nodes: GraphNode[],
    edges: GraphEdge[],
    nodeIds: string[],
): { nodes: GraphNode[]; edges: ClassifiedGraphEdge[] } {
    const removeSet = new Set(nodeIds)

    // Collect relink edges before removal
    const newEdges: GraphEdge[] = []
    for (const nodeId of nodeIds) {
        // Find the incoming edge to this node on 'input' handle via 'output' handle
        const incomingEdge = edges.find(
            (e) => e.target === nodeId && e.targetHandle === 'input' && e.sourceHandle === 'output',
        )
        // Find the outgoing edge from this node on 'output' handle
        const outgoingEdge = edges.find(
            (e) => e.source === nodeId && e.sourceHandle === 'output',
        )

        if (incomingEdge && outgoingEdge && !removeSet.has(incomingEdge.source) && !removeSet.has(outgoingEdge.target)) {
            newEdges.push({
                id: `${incomingEdge.source}-output-${outgoingEdge.target}`,
                source: incomingEdge.source,
                target: outgoingEdge.target,
                sourceHandle: 'output',
                targetHandle: 'input',
            })
        }
    }

    // Remove nodes
    const filteredNodes = nodes.filter((n) => !removeSet.has(n.id))

    // Remove edges connected to deleted nodes, add relink edges
    const filteredEdges = edges.filter(
        (e) => !removeSet.has(e.source) && !removeSet.has(e.target),
    )
    const allEdges = [...filteredEdges, ...newEdges]

    return {
        nodes: filteredNodes,
        edges: classifyEdges(allEdges),
    }
}

/**
 * Remove edges by ID.
 *
 * Returns a new array of classified edges with the specified edges removed.
 */
export function removeGraphEdges(
    edges: ClassifiedGraphEdge[],
    edgeIds: string[],
): ClassifiedGraphEdge[] {
    const removeSet = new Set(edgeIds)
    return edges.filter((e) => !removeSet.has(e.id))
}

/**
 * Add a new graph node from a Step at a given position.
 *
 * Creates a GraphNode with the step data and appends to the nodes array.
 * Does NOT create any edges (caller must connect the node separately).
 */
export function addGraphNode(
    nodes: GraphNode[],
    step: Step,
    position: { x: number; y: number },
): GraphNode[] {
    const nodeType = stepToNodeType(step)
    const newNode: GraphNode = {
        id: step.name,
        type: nodeType,
        position: { x: position.x, y: position.y },
        data: {
            step,
            stepName: step.name,
            actionType: step.type,
        },
    }
    return [...nodes, newNode]
}

/**
 * Validate and apply a connection (new edge).
 *
 * Uses validateConnection to check the proposed connection against
 * all connection rules (no cycles, max 1 per handle, trigger protection, etc.).
 *
 * Returns a new edges array with the connection added, or null if invalid.
 */
export function applyGraphConnect(
    nodes: GraphNode[],
    edges: ClassifiedGraphEdge[],
    connection: ConnectionParams,
): ClassifiedGraphEdge[] | null {
    const { source, target, sourceHandle, targetHandle } = connection
    if (!source || !target || !sourceHandle || !targetHandle) {
        return null
    }

    const result = validateConnection(
        source,
        target,
        sourceHandle,
        targetHandle,
        nodes,
        edges,
    )

    if (!result.valid) {
        return null
    }

    const newEdge: GraphEdge = {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle,
    }

    const classified = classifyEdges([newEdge])
    return [...edges, ...classified]
}

/**
 * Determine the node type string from a Step.
 * Mirrors the logic in graph-converter.ts stepTypeToNodeType.
 */
function stepToNodeType(step: Step): string {
    if (flowStructureUtil.isTrigger(step.type)) {
        return 'trigger'
    }
    switch (step.type) {
        case FlowActionType.LOOP_ON_ITEMS:
            return 'loop'
        case FlowActionType.ROUTER:
            return 'router'
        default:
            return 'action'
    }
}
