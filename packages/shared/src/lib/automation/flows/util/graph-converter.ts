import { FlowAction, FlowActionType, LoopOnItemsAction, RouterAction } from '../actions/action'
import { CanvasLayout, FlowVersion } from '../flow-version'
import { FlowTrigger, FlowTriggerType } from '../triggers/trigger'
import { computeAutoLayout } from './auto-layout'
import { flowStructureUtil, Step } from './flow-structure-util'

/**
 * Data attached to each graph node — carries the original step.
 */
export type GraphNodeData = {
    step: Step
    stepName: string
    actionType: string
}

/**
 * A graph node in the ReactFlow-compatible format.
 * `id` = step.name, `type` maps to the node component.
 */
export type GraphNode = {
    id: string
    type: string
    position: { x: number; y: number }
    data: GraphNodeData
}

/**
 * A graph edge in the ReactFlow-compatible format.
 * sourceHandle and targetHandle identify which port the edge connects.
 */
export type GraphEdge = {
    id: string
    source: string
    target: string
    sourceHandle: string
    targetHandle: string
}

/**
 * Result of converting a linked-list FlowVersion to a graph representation.
 */
export type GraphConversionResult = {
    nodes: GraphNode[]
    edges: GraphEdge[]
    orphanNodeIds: string[]
}

function stepTypeToNodeType(step: Step): string {
    if (flowStructureUtil.isTrigger(step.type)) {
        return 'trigger'
    }
    switch (step.type) {
        case FlowActionType.LOOP_ON_ITEMS:
            return 'loop'
        case FlowActionType.ROUTER:
            return 'router'
        case FlowActionType.CODE:
        case FlowActionType.PIECE:
        default:
            return 'action'
    }
}

function createNode(step: Step): GraphNode {
    return {
        id: step.name,
        type: stepTypeToNodeType(step),
        position: { x: 0, y: 0 },
        data: {
            step,
            stepName: step.name,
            actionType: step.type,
        },
    }
}

function createEdge(source: string, target: string, sourceHandle: string): GraphEdge {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle: 'input',
    }
}

/**
 * Recursively traverse the linked-list step tree and collect nodes + edges.
 */
function traverseStep(
    step: Step | FlowAction | undefined | null,
    nodes: GraphNode[],
    edges: GraphEdge[],
    parentName?: string,
    parentHandle?: string,
): void {
    if (!step) return

    nodes.push(createNode(step))

    if (parentName && parentHandle) {
        edges.push(createEdge(parentName, step.name, parentHandle))
    }

    // Handle Loop children
    if (step.type === FlowActionType.LOOP_ON_ITEMS) {
        const loopStep = step as LoopOnItemsAction
        if (loopStep.firstLoopAction) {
            traverseStep(loopStep.firstLoopAction, nodes, edges, step.name, 'loop-output')
        }
    }

    // Handle Router children
    if (step.type === FlowActionType.ROUTER) {
        const routerStep = step as RouterAction
        if (routerStep.children) {
            routerStep.children.forEach((child, index) => {
                if (child) {
                    traverseStep(child, nodes, edges, step.name, `branch-${index}`)
                }
            })
        }
    }

    // Handle nextAction (the main chain)
    if (step.nextAction) {
        traverseStep(step.nextAction, nodes, edges, step.name, 'output')
    }
}

/**
 * Convert a FlowVersion (linked-list model) to a graph representation (nodes + edges).
 *
 * On Load (linked-list -> graph):
 * 1. Traverse trigger -> nextAction -> ... recursively
 * 2. Create nodes[] with stepName as id
 * 3. Create edges[] from nextAction pointers + loop/router children
 * 4. If canvasLayout exists -> apply stored positions
 * 5. If canvasLayout is null -> positions remain {0,0} (apply auto-layout separately)
 */
export function linkedListToGraph(flowVersion: FlowVersion): GraphConversionResult {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    traverseStep(flowVersion.trigger, nodes, edges)

    // Apply stored positions from canvasLayout if available
    if (flowVersion.canvasLayout?.positions) {
        for (const node of nodes) {
            const storedPos = flowVersion.canvasLayout.positions[node.id]
            if (storedPos) {
                node.position = { x: storedPos.x, y: storedPos.y }
            }
        }
    }

    // Detect orphan nodes (nodes with no incoming edges and not the trigger)
    const orphanNodeIds = findOrphanNodes(nodes, edges)

    return { nodes, edges, orphanNodeIds }
}

/**
 * Find nodes that have no incoming edges AND are not the trigger.
 * These are "orphan" nodes that won't be part of the execution flow.
 */
export function findOrphanNodes(nodes: GraphNode[], edges: GraphEdge[]): string[] {
    const nodesWithIncoming = new Set(edges.map(e => e.target))
    return nodes
        .filter(n => n.type !== 'trigger' && !nodesWithIncoming.has(n.id))
        .map(n => n.id)
}

/**
 * Rebuild a single step (action) from graph data, recursively attaching
 * nextAction, firstLoopAction, or children based on edges.
 */
function rebuildStep(
    nodeId: string,
    nodeMap: Map<string, GraphNode>,
    edgesBySource: Map<string, GraphEdge[]>,
    visited: Set<string>,
): FlowAction | undefined {
    if (visited.has(nodeId)) return undefined
    const node = nodeMap.get(nodeId)
    if (!node) return undefined

    visited.add(nodeId)

    const step = node.data.step
    const outEdges = edgesBySource.get(nodeId) || []

    // Find nextAction (output handle)
    const outputEdge = outEdges.find(e => e.sourceHandle === 'output')
    const nextAction = outputEdge
        ? rebuildStep(outputEdge.target, nodeMap, edgesBySource, visited)
        : undefined

    if (step.type === FlowActionType.LOOP_ON_ITEMS) {
        const loopOutputEdge = outEdges.find(e => e.sourceHandle === 'loop-output')
        const firstLoopAction = loopOutputEdge
            ? rebuildStep(loopOutputEdge.target, nodeMap, edgesBySource, visited)
            : undefined

        return {
            ...step,
            nextAction,
            firstLoopAction,
        } as FlowAction
    }

    if (step.type === FlowActionType.ROUTER) {
        const routerStep = step as RouterAction
        const branchEdges = outEdges
            .filter(e => e.sourceHandle.startsWith('branch-'))
            .sort((a, b) => {
                const aIdx = parseInt(a.sourceHandle.replace('branch-', ''), 10)
                const bIdx = parseInt(b.sourceHandle.replace('branch-', ''), 10)
                return aIdx - bIdx
            })

        // Determine the number of branches from the original step settings
        const branchCount = routerStep.settings.branches.length
        const children: (FlowAction | null)[] = new Array(branchCount).fill(null)

        for (const edge of branchEdges) {
            const branchIndex = parseInt(edge.sourceHandle.replace('branch-', ''), 10)
            if (branchIndex >= 0 && branchIndex < branchCount) {
                const child = rebuildStep(edge.target, nodeMap, edgesBySource, visited)
                children[branchIndex] = child ?? null
            }
        }

        return {
            ...step,
            nextAction,
            children,
        } as FlowAction
    }

    // Code or Piece action
    return {
        ...step,
        nextAction,
    } as FlowAction
}

/**
 * Convert a graph (nodes + edges) back to a linked-list FlowTrigger.
 *
 * On Save (graph -> linked-list):
 * 1. Find trigger node (no incoming edges, type = 'trigger')
 * 2. Walk graph from trigger following outgoing edges
 * 3. Rebuild nextAction chain from 'output' handle edges
 * 4. For Loop: set firstLoopAction from 'loop-output' handle
 * 5. For Router: set children[N] from 'branch-N' handle
 */
export function graphToLinkedList(nodes: GraphNode[], edges: GraphEdge[]): FlowTrigger {
    const nodeMap = new Map<string, GraphNode>()
    for (const node of nodes) {
        nodeMap.set(node.id, node)
    }

    const edgesBySource = new Map<string, GraphEdge[]>()
    for (const edge of edges) {
        const existing = edgesBySource.get(edge.source) || []
        existing.push(edge)
        edgesBySource.set(edge.source, existing)
    }

    // Find trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode) {
        throw new Error('No trigger node found in graph')
    }

    const visited = new Set<string>()
    visited.add(triggerNode.id)

    const triggerStep = triggerNode.data.step as FlowTrigger
    const outEdges = edgesBySource.get(triggerNode.id) || []
    const outputEdge = outEdges.find(e => e.sourceHandle === 'output')

    const nextAction = outputEdge
        ? rebuildStep(outputEdge.target, nodeMap, edgesBySource, visited)
        : undefined

    return {
        ...triggerStep,
        nextAction,
    } as FlowTrigger
}

/**
 * Extract positions from graph nodes into a CanvasLayout-compatible record.
 */
export function extractPositions(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const node of nodes) {
        positions[node.id] = { x: node.position.x, y: node.position.y }
    }
    return positions
}

/**
 * Result of canvas layout migration.
 *
 * `positions` contains the final positions for all nodes.
 * `shouldPersistLayout` is true when the layout was computed (partially or fully)
 * and should be saved back to the server via UPDATE_CANVAS_LAYOUT.
 */
export type MigrationResult = {
    positions: Record<string, { x: number; y: number }>
    shouldPersistLayout: boolean
}

/**
 * Migrate canvas layout for backward compatibility with existing flows.
 *
 * Handles three scenarios:
 * 1. canvasLayout is null: compute full auto-layout via Dagre for all nodes.
 *    Returns shouldPersistLayout=true so the caller can save the computed positions.
 * 2. canvasLayout exists but some nodes are missing from positions (e.g., a new step
 *    was added after layout was saved): compute Dagre layout for all nodes, then
 *    merge -- preserving existing positions for nodes that have them, filling in
 *    Dagre-computed positions for nodes that don't.
 *    Returns shouldPersistLayout=true.
 * 3. canvasLayout exists and ALL nodes have positions: return existing positions
 *    unchanged. Returns shouldPersistLayout=false (no persistence needed).
 *
 * @param nodes - graph nodes (from linkedListToGraph, positions may be {0,0})
 * @param edges - graph edges
 * @param canvasLayout - the flow version's canvasLayout (null for migrated flows)
 * @returns MigrationResult with final positions and persistence flag
 */
export function migrateCanvasLayout(
    nodes: GraphNode[],
    edges: GraphEdge[],
    canvasLayout: CanvasLayout | null | undefined,
): MigrationResult {
    // Case 1: No canvas layout at all -- full auto-layout
    if (!canvasLayout) {
        const layout = computeAutoLayout(nodes, edges)
        return {
            positions: layout.positions,
            shouldPersistLayout: true,
        }
    }

    const existingPositions = canvasLayout.positions ?? {}

    // Check if all nodes have positions in the existing layout
    const missingNodeIds = nodes.filter(
        (node) => !existingPositions[node.id],
    ).map((node) => node.id)

    // Case 3: All nodes have positions -- no migration needed
    if (missingNodeIds.length === 0) {
        return {
            positions: existingPositions,
            shouldPersistLayout: false,
        }
    }

    // Case 2: Partial layout -- compute Dagre for all, then merge
    // Dagre is run on all nodes/edges to produce a coherent layout.
    // We then use the Dagre positions ONLY for nodes missing from the
    // existing layout, preserving user-saved positions for the rest.
    const layout = computeAutoLayout(nodes, edges)
    const mergedPositions: Record<string, { x: number; y: number }> = {}

    for (const node of nodes) {
        const existing = existingPositions[node.id]
        if (existing) {
            mergedPositions[node.id] = { x: existing.x, y: existing.y }
        }
        else {
            const computed = layout.positions[node.id]
            if (computed) {
                mergedPositions[node.id] = { x: computed.x, y: computed.y }
            }
        }
    }

    return {
        positions: mergedPositions,
        shouldPersistLayout: true,
    }
}
