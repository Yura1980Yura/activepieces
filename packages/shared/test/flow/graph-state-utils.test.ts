import {
    FlowActionType,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    RouterExecutionType,
    BranchExecutionType,
    BranchOperator,
} from '../../src'
import {
    createInitialGraphData,
    syncGraphFromFlowVersion,
    syncGraphToFlowVersion,
    autoLayoutGraphNodes,
    removeGraphNodes,
    removeGraphEdges,
    addGraphNode,
    applyGraphConnect,
} from '../../src/lib/automation/flows/util/graph-state-utils'
import { GRAPH_EDGE_TYPES } from '../../src/lib/automation/flows/util/graph-edge-utils'
import type { FlowTrigger, FlowAction, LoopOnItemsAction, RouterAction } from '../../src'
import type { GraphNode, GraphEdge } from '../../src/lib/automation/flows/util/graph-converter'
import type { ClassifiedGraphEdge } from '../../src/lib/automation/flows/util/graph-state-utils'

// === Test Fixtures ===

const baseTrigger: FlowTrigger = {
    name: 'trigger',
    type: FlowTriggerType.EMPTY,
    valid: false,
    displayName: 'Empty Trigger',
    lastUpdatedDate: '2026-03-27T00:00:00.000Z',
    settings: {},
}

const baseFlowVersion: FlowVersion = {
    id: 'test-flow-version-id',
    created: '2026-03-27T00:00:00.000Z',
    updated: '2026-03-27T00:00:00.000Z',
    flowId: 'test-flow-id',
    updatedBy: null,
    displayName: 'Test Flow',
    agentIds: [],
    notes: [],
    trigger: baseTrigger,
    valid: false,
    schemaVersion: null,
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
}

function makeCodeAction(name: string, nextAction?: FlowAction): FlowAction {
    return {
        name,
        type: FlowActionType.CODE,
        valid: true,
        displayName: `Code ${name}`,
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {
            sourceCode: { code: 'test', packageJson: '{}' },
            input: {},
        },
        nextAction,
    }
}

function makeLoopAction(name: string, firstLoopAction?: FlowAction, nextAction?: FlowAction): FlowAction {
    return {
        name,
        type: FlowActionType.LOOP_ON_ITEMS,
        valid: true,
        displayName: `Loop ${name}`,
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {
            items: '{{trigger.items}}',
        },
        firstLoopAction,
        nextAction,
    } as LoopOnItemsAction
}

function makeRouterAction(
    name: string,
    children: (FlowAction | null)[],
    nextAction?: FlowAction,
): FlowAction {
    return {
        name,
        type: FlowActionType.ROUTER,
        valid: true,
        displayName: `Router ${name}`,
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {
            branches: children.map((_, i) => ({
                conditions: [[{ operator: BranchOperator.TEXT_CONTAINS, firstValue: '1', secondValue: '1' }]],
                branchType: BranchExecutionType.CONDITION,
                branchName: `Branch ${i}`,
            })),
            executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        },
        children,
        nextAction,
    } as RouterAction
}

function makeNode(id: string, type: string, actionType: string, position = { x: 0, y: 0 }): GraphNode {
    return {
        id,
        type,
        position,
        data: {
            step: { name: id, type: actionType, valid: true, displayName: id, lastUpdatedDate: '2026-03-27T00:00:00.000Z', settings: {} } as unknown as FlowAction,
            stepName: id,
            actionType,
        },
    }
}

function makeClassifiedEdge(source: string, target: string, sourceHandle: string, edgeType: string = 'default'): ClassifiedGraphEdge {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle: 'input',
        type: edgeType as ClassifiedGraphEdge['type'],
    }
}

// === createInitialGraphData ===

describe('createInitialGraphData', () => {
    it('should return nodes and edges for trigger-only flow', () => {
        const result = createInitialGraphData(baseFlowVersion)
        expect(result.nodes).toHaveLength(1)
        expect(result.edges).toHaveLength(0)
        expect(result.nodes[0].id).toBe('trigger')
    })

    it('should apply auto-layout when no canvasLayout', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = createInitialGraphData(flow)
        // Dagre assigns non-zero positions
        const hasNonZeroPosition = result.nodes.some(
            n => n.position.x !== 0 || n.position.y !== 0,
        )
        expect(hasNonZeroPosition).toBe(true)
    })

    it('should use stored positions when canvasLayout exists', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: {
                positions: {
                    trigger: { x: 50, y: 100 },
                    step_1: { x: 200, y: 300 },
                },
            },
        }
        const result = createInitialGraphData(flow)
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        const step1Node = result.nodes.find(n => n.id === 'step_1')
        expect(triggerNode!.position).toEqual({ x: 50, y: 100 })
        expect(step1Node!.position).toEqual({ x: 200, y: 300 })
    })

    it('should classify edges correctly', () => {
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('loop_1', loopChild)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = createInitialGraphData(flow)
        const loopEdge = result.edges.find(e => e.sourceHandle === 'loop-output')
        const defaultEdge = result.edges.find(e => e.source === 'trigger' && e.sourceHandle === 'output')
        expect(loopEdge).toBeDefined()
        expect(loopEdge!.type).toBe(GRAPH_EDGE_TYPES.LOOP)
        expect(defaultEdge).toBeDefined()
        expect(defaultEdge!.type).toBe(GRAPH_EDGE_TYPES.DEFAULT)
    })
})

// === syncGraphFromFlowVersion ===

describe('syncGraphFromFlowVersion', () => {
    it('should return same result as createInitialGraphData', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const initial = createInitialGraphData(flow)
        const synced = syncGraphFromFlowVersion(flow)

        expect(synced.nodes).toHaveLength(initial.nodes.length)
        expect(synced.edges).toHaveLength(initial.edges.length)
        expect(synced.nodes.map(n => n.id).sort()).toEqual(initial.nodes.map(n => n.id).sort())
    })
})

// === syncGraphToFlowVersion ===

describe('syncGraphToFlowVersion', () => {
    it('should produce valid trigger with nextAction chain', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const { nodes, edges } = createInitialGraphData(flow)
        const result = syncGraphToFlowVersion(nodes, edges)

        expect(result.trigger.name).toBe('trigger')
        expect(result.trigger.nextAction).toBeDefined()
        expect(result.trigger.nextAction!.name).toBe('step_1')
    })

    it('should produce canvasLayout with positions', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const { nodes, edges } = createInitialGraphData(flow)
        const result = syncGraphToFlowVersion(nodes, edges)

        expect(result.canvasLayout).toBeDefined()
        expect(result.canvasLayout.positions['trigger']).toBeDefined()
        expect(result.canvasLayout.positions['step_1']).toBeDefined()
    })

    it('should round-trip: from -> to -> from matches', () => {
        const step1 = makeCodeAction('step_1', makeCodeAction('step_2'))
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const data1 = createInitialGraphData(flow)
        const result = syncGraphToFlowVersion(data1.nodes, data1.edges)

        // Create new FlowVersion with the synced trigger + layout
        const flow2: FlowVersion = {
            ...baseFlowVersion,
            trigger: result.trigger,
            canvasLayout: result.canvasLayout,
        }
        const data2 = createInitialGraphData(flow2)

        // Same number of nodes and edges
        expect(data2.nodes).toHaveLength(data1.nodes.length)
        expect(data2.edges).toHaveLength(data1.edges.length)
        // Same node IDs
        expect(data2.nodes.map(n => n.id).sort()).toEqual(data1.nodes.map(n => n.id).sort())
    })

    it('should handle loop with firstLoopAction', () => {
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('loop_1', loopChild)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const { nodes, edges } = createInitialGraphData(flow)
        const result = syncGraphToFlowVersion(nodes, edges)

        const loopAction = result.trigger.nextAction as LoopOnItemsAction
        expect(loopAction.name).toBe('loop_1')
        expect(loopAction.firstLoopAction).toBeDefined()
        expect(loopAction.firstLoopAction!.name).toBe('loop_child')
    })

    it('should handle router with children', () => {
        const child0 = makeCodeAction('child_0')
        const child1 = makeCodeAction('child_1')
        const router = makeRouterAction('router_1', [child0, child1])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }
        const { nodes, edges } = createInitialGraphData(flow)
        const result = syncGraphToFlowVersion(nodes, edges)

        const routerAction = result.trigger.nextAction as RouterAction
        expect(routerAction.name).toBe('router_1')
        expect(routerAction.children).toHaveLength(2)
        expect(routerAction.children[0]!.name).toBe('child_0')
        expect(routerAction.children[1]!.name).toBe('child_1')
    })
})

// === autoLayoutGraphNodes ===

describe('autoLayoutGraphNodes', () => {
    it('should reposition all nodes via Dagre', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: {
                positions: {
                    trigger: { x: 999, y: 999 },
                    step_1: { x: 999, y: 999 },
                },
            },
        }
        const { nodes, edges } = createInitialGraphData(flow)
        // Verify initial positions are stored positions (999, 999)
        expect(nodes[0].position.x).toBe(999)

        const repositioned = autoLayoutGraphNodes(nodes, edges)
        // After Dagre, positions should change
        expect(repositioned[0].position.x).not.toBe(999)
        expect(repositioned).toHaveLength(nodes.length)
    })
})

// === removeGraphNodes ===

describe('removeGraphNodes', () => {
    it('should remove node and connected edges', () => {
        const nodeA = makeNode('a', 'action', FlowActionType.CODE)
        const nodeB = makeNode('b', 'action', FlowActionType.CODE)
        const nodeC = makeNode('c', 'action', FlowActionType.CODE)
        const edges: ClassifiedGraphEdge[] = [
            makeClassifiedEdge('a', 'b', 'output'),
            makeClassifiedEdge('b', 'c', 'output'),
        ]

        const result = removeGraphNodes([nodeA, nodeB, nodeC], edges, ['b'])
        expect(result.nodes).toHaveLength(2)
        expect(result.nodes.map(n => n.id)).toEqual(['a', 'c'])
    })

    it('should relink edges: A->B->C, remove B => A->C', () => {
        const nodeA = makeNode('a', 'action', FlowActionType.CODE)
        const nodeB = makeNode('b', 'action', FlowActionType.CODE)
        const nodeC = makeNode('c', 'action', FlowActionType.CODE)
        const edges: ClassifiedGraphEdge[] = [
            makeClassifiedEdge('a', 'b', 'output'),
            makeClassifiedEdge('b', 'c', 'output'),
        ]

        const result = removeGraphNodes([nodeA, nodeB, nodeC], edges, ['b'])
        expect(result.edges).toHaveLength(1)
        expect(result.edges[0].source).toBe('a')
        expect(result.edges[0].target).toBe('c')
        expect(result.edges[0].sourceHandle).toBe('output')
    })
})

// === removeGraphEdges ===

describe('removeGraphEdges', () => {
    it('should remove edges by id', () => {
        const edges: ClassifiedGraphEdge[] = [
            makeClassifiedEdge('a', 'b', 'output'),
            makeClassifiedEdge('b', 'c', 'output'),
        ]
        const result = removeGraphEdges(edges, ['a-output-b'])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('b-output-c')
    })
})

// === addGraphNode ===

describe('addGraphNode', () => {
    it('should add node at specified position', () => {
        const existingNodes: GraphNode[] = [
            makeNode('trigger', 'trigger', FlowTriggerType.EMPTY),
        ]
        const step = makeCodeAction('new_step')
        const result = addGraphNode(existingNodes, step, { x: 150, y: 250 })

        expect(result).toHaveLength(2)
        const newNode = result.find(n => n.id === 'new_step')
        expect(newNode).toBeDefined()
        expect(newNode!.position).toEqual({ x: 150, y: 250 })
        expect(newNode!.type).toBe('action')
    })

    it('should preserve existing nodes', () => {
        const existingNodes: GraphNode[] = [
            makeNode('trigger', 'trigger', FlowTriggerType.EMPTY),
            makeNode('step_1', 'action', FlowActionType.CODE),
        ]
        const step = makeCodeAction('new_step')
        const result = addGraphNode(existingNodes, step, { x: 100, y: 200 })

        expect(result).toHaveLength(3)
        expect(result[0].id).toBe('trigger')
        expect(result[1].id).toBe('step_1')
        expect(result[2].id).toBe('new_step')
    })
})

// === applyGraphConnect ===

describe('applyGraphConnect', () => {
    it('should validate and add edge for valid connection', () => {
        const nodes: GraphNode[] = [
            makeNode('a', 'action', FlowActionType.CODE),
            makeNode('b', 'action', FlowActionType.CODE),
        ]
        const edges: ClassifiedGraphEdge[] = []
        const result = applyGraphConnect(nodes, edges, {
            source: 'a',
            target: 'b',
            sourceHandle: 'output',
            targetHandle: 'input',
        })

        expect(result).not.toBeNull()
        expect(result).toHaveLength(1)
        expect(result![0].source).toBe('a')
        expect(result![0].target).toBe('b')
        expect(result![0].type).toBe(GRAPH_EDGE_TYPES.DEFAULT)
    })

    it('should reject cycle', () => {
        const nodes: GraphNode[] = [
            makeNode('a', 'action', FlowActionType.CODE),
            makeNode('b', 'action', FlowActionType.CODE),
        ]
        const edges: ClassifiedGraphEdge[] = [
            makeClassifiedEdge('a', 'b', 'output'),
        ]
        const result = applyGraphConnect(nodes, edges, {
            source: 'b',
            target: 'a',
            sourceHandle: 'output',
            targetHandle: 'input',
        })

        expect(result).toBeNull()
    })

    it('should reject duplicate edge (max 1 per handle)', () => {
        const nodes: GraphNode[] = [
            makeNode('a', 'action', FlowActionType.CODE),
            makeNode('b', 'action', FlowActionType.CODE),
            makeNode('c', 'action', FlowActionType.CODE),
        ]
        const edges: ClassifiedGraphEdge[] = [
            makeClassifiedEdge('a', 'b', 'output'),
        ]
        // a->output already has edge, cannot add another
        const result = applyGraphConnect(nodes, edges, {
            source: 'a',
            target: 'c',
            sourceHandle: 'output',
            targetHandle: 'input',
        })

        expect(result).toBeNull()
    })

    it('should return null for invalid connection (null source)', () => {
        const nodes: GraphNode[] = [
            makeNode('a', 'action', FlowActionType.CODE),
        ]
        const result = applyGraphConnect(nodes, [], {
            source: null,
            target: 'a',
            sourceHandle: 'output',
            targetHandle: 'input',
        })

        expect(result).toBeNull()
    })
})
