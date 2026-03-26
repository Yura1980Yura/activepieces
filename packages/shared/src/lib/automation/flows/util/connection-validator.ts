import { GraphNode, GraphEdge } from './graph-converter'
import {
    ConnectionValidationResult,
    HANDLE_IDS,
    NO_INPUT_TYPES,
    LOOP_OUTPUT_TYPES,
    BRANCH_OUTPUT_TYPES,
    isBranchHandle,
} from './connection-rules'

/**
 * Detect if adding an edge from sourceId to targetId would create a cycle
 * in the directed graph.
 *
 * Algorithm: BFS from targetId following existing outgoing edges.
 * If sourceId is reachable from targetId, adding source→target creates a cycle.
 *
 * @param sourceId - the proposed edge source node
 * @param targetId - the proposed edge target node
 * @param existingEdges - current edges in the graph
 * @returns true if a cycle would be created
 */
export function detectCycle(
    sourceId: string,
    targetId: string,
    existingEdges: GraphEdge[],
): boolean {
    // Build adjacency list: nodeId → [reachable nodeIds via outgoing edges]
    const adjacency = new Map<string, string[]>()
    for (const edge of existingEdges) {
        const neighbors = adjacency.get(edge.source) ?? []
        neighbors.push(edge.target)
        adjacency.set(edge.source, neighbors)
    }

    // BFS from targetId: can we reach sourceId?
    const visited = new Set<string>()
    const queue: string[] = [targetId]
    visited.add(targetId)

    while (queue.length > 0) {
        const current = queue.shift()!
        if (current === sourceId) {
            return true // Cycle detected
        }
        const neighbors = adjacency.get(current) ?? []
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor)
                queue.push(neighbor)
            }
        }
    }

    return false
}

/**
 * Validate whether a proposed connection is valid according to the
 * Architecture doc section 6.2 connection rules.
 *
 * Rules enforced:
 * 1. No self-connections (source === target)
 * 2. No cycles (BFS reachability check)
 * 3. Max 1 edge per input handle (target cannot already have incoming edge on same handle)
 * 4. Max 1 edge per output handle (source cannot already have outgoing edge on same handle)
 * 5. Trigger node cannot be a target (no input handle on triggers)
 * 6. Source handle must be valid for the source node type
 *
 * @param sourceId - source node ID
 * @param targetId - target node ID
 * @param sourceHandle - source handle ID (e.g. 'output', 'loop-output', 'branch-0')
 * @param targetHandle - target handle ID (should be 'input')
 * @param nodes - all nodes in the graph
 * @param existingEdges - current edges in the graph
 * @returns ConnectionValidationResult with valid=true or valid=false with reason
 */
export function validateConnection(
    sourceId: string,
    targetId: string,
    sourceHandle: string,
    targetHandle: string,
    nodes: GraphNode[],
    existingEdges: GraphEdge[],
): ConnectionValidationResult {
    // Find source and target nodes
    const sourceNode = nodes.find(n => n.id === sourceId)
    const targetNode = nodes.find(n => n.id === targetId)

    if (!sourceNode) {
        return { valid: false, reason: `Source node '${sourceId}' not found` }
    }
    if (!targetNode) {
        return { valid: false, reason: `Target node '${targetId}' not found` }
    }

    // Rule 1: No self-connections
    if (sourceId === targetId) {
        return { valid: false, reason: 'Self-connections are not allowed' }
    }

    // Rule 5: Trigger cannot be a target (no input handle)
    if (NO_INPUT_TYPES.has(targetNode.data.actionType)) {
        return { valid: false, reason: 'Trigger nodes cannot have incoming connections' }
    }

    // Rule: Target handle must be 'input'
    if (targetHandle !== HANDLE_IDS.INPUT) {
        return { valid: false, reason: `Invalid target handle '${targetHandle}'; must be '${HANDLE_IDS.INPUT}'` }
    }

    // Rule 6: Source handle must be valid for the source node type
    const handleValidation = validateSourceHandle(sourceHandle, sourceNode)
    if (!handleValidation.valid) {
        return handleValidation
    }

    // Rule 3: Max 1 edge per input handle on target
    const existingInputEdge = existingEdges.find(
        e => e.target === targetId && e.targetHandle === targetHandle,
    )
    if (existingInputEdge) {
        return {
            valid: false,
            reason: `Target node '${targetId}' already has an incoming connection on handle '${targetHandle}'`,
        }
    }

    // Rule 4: Max 1 edge per output handle on source
    const existingOutputEdge = existingEdges.find(
        e => e.source === sourceId && e.sourceHandle === sourceHandle,
    )
    if (existingOutputEdge) {
        return {
            valid: false,
            reason: `Source node '${sourceId}' already has an outgoing connection on handle '${sourceHandle}'`,
        }
    }

    // Rule 2: No cycles
    if (detectCycle(sourceId, targetId, existingEdges)) {
        return { valid: false, reason: 'Connection would create a cycle' }
    }

    return { valid: true }
}

/**
 * Validate that the source handle is valid for the given source node type.
 *
 * - All nodes can use 'output' handle
 * - Only LOOP_ON_ITEMS nodes can use 'loop-output' handle
 * - Only ROUTER nodes can use 'branch-N' handles
 */
function validateSourceHandle(
    sourceHandle: string,
    sourceNode: GraphNode,
): ConnectionValidationResult {
    const nodeType = sourceNode.data.actionType

    // 'output' handle is valid for all node types
    if (sourceHandle === HANDLE_IDS.OUTPUT) {
        return { valid: true }
    }

    // 'loop-output' handle is valid only for LOOP_ON_ITEMS
    if (sourceHandle === HANDLE_IDS.LOOP_OUTPUT) {
        if (LOOP_OUTPUT_TYPES.has(nodeType)) {
            return { valid: true }
        }
        return {
            valid: false,
            reason: `Handle '${HANDLE_IDS.LOOP_OUTPUT}' is only valid for loop nodes, not '${nodeType}'`,
        }
    }

    // 'branch-N' handles are valid only for ROUTER
    if (isBranchHandle(sourceHandle)) {
        if (BRANCH_OUTPUT_TYPES.has(nodeType)) {
            return { valid: true }
        }
        return {
            valid: false,
            reason: `Branch handles are only valid for router nodes, not '${nodeType}'`,
        }
    }

    return { valid: false, reason: `Unknown source handle '${sourceHandle}'` }
}
