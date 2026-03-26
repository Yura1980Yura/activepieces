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
    linkedListToGraph,
    graphToLinkedList,
    findOrphanNodes,
    extractPositions,
    GraphNode,
    GraphEdge,
} from '../../src/lib/automation/flows/util/graph-converter'
import type { FlowTrigger, FlowAction, LoopOnItemsAction, RouterAction } from '../../src'

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

function makePieceAction(name: string, nextAction?: FlowAction): FlowAction {
    return {
        name,
        type: FlowActionType.PIECE,
        valid: true,
        displayName: `Piece ${name}`,
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {
            pieceName: 'test-piece',
            pieceVersion: '1.0.0',
            actionName: 'test-action',
            input: {},
            propertySettings: {},
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

// === Tests ===

describe('linked-list to graph', () => {
    it('should convert trigger-only flow to 1 node and 0 edges', () => {
        const result = linkedListToGraph(baseFlowVersion)
        expect(result.nodes).toHaveLength(1)
        expect(result.edges).toHaveLength(0)
        expect(result.nodes[0].id).toBe('trigger')
        expect(result.nodes[0].type).toBe('trigger')
    })

    it('should convert linear chain: trigger -> step_1 -> step_2 to 3 nodes and 2 edges', () => {
        const step2 = makeCodeAction('step_2')
        const step1 = makeCodeAction('step_1', step2)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = linkedListToGraph(flow)
        expect(result.nodes).toHaveLength(3)
        expect(result.edges).toHaveLength(2)

        // Edge from trigger to step_1
        const edge1 = result.edges.find(e => e.source === 'trigger' && e.target === 'step_1')
        expect(edge1).toBeDefined()
        expect(edge1!.sourceHandle).toBe('output')

        // Edge from step_1 to step_2
        const edge2 = result.edges.find(e => e.source === 'step_1' && e.target === 'step_2')
        expect(edge2).toBeDefined()
        expect(edge2!.sourceHandle).toBe('output')
    })

    it('should convert flow with LoopOnItems and loop child', () => {
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('step_1', loopChild)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = linkedListToGraph(flow)

        // trigger + loop + loop_child = 3 nodes
        expect(result.nodes).toHaveLength(3)

        // trigger->step_1 (output), step_1->loop_child (loop-output) = 2 edges
        expect(result.edges).toHaveLength(2)

        const loopOutputEdge = result.edges.find(e => e.sourceHandle === 'loop-output')
        expect(loopOutputEdge).toBeDefined()
        expect(loopOutputEdge!.source).toBe('step_1')
        expect(loopOutputEdge!.target).toBe('loop_child')
    })

    it('should convert flow with Router and branch children', () => {
        const branchChild0 = makeCodeAction('branch_0_child')
        const branchChild1 = makePieceAction('branch_1_child')
        const router = makeRouterAction('step_1', [branchChild0, branchChild1])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }
        const result = linkedListToGraph(flow)

        // trigger + router + 2 branch children = 4 nodes
        expect(result.nodes).toHaveLength(4)

        // trigger->router(output) + router->branch_0(branch-0) + router->branch_1(branch-1) = 3 edges
        expect(result.edges).toHaveLength(3)

        const branch0Edge = result.edges.find(e => e.sourceHandle === 'branch-0')
        expect(branch0Edge).toBeDefined()
        expect(branch0Edge!.target).toBe('branch_0_child')

        const branch1Edge = result.edges.find(e => e.sourceHandle === 'branch-1')
        expect(branch1Edge).toBeDefined()
        expect(branch1Edge!.target).toBe('branch_1_child')
    })

    it('should convert nested flow: router inside loop', () => {
        const branchChild = makeCodeAction('branch_child')
        const router = makeRouterAction('inner_router', [branchChild])
        const loop = makeLoopAction('outer_loop', router)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = linkedListToGraph(flow)

        // trigger + loop + router + branch_child = 4 nodes
        expect(result.nodes).toHaveLength(4)

        // trigger->loop(output), loop->router(loop-output), router->branch_child(branch-0) = 3 edges
        expect(result.edges).toHaveLength(3)

        expect(result.nodes.find(n => n.id === 'outer_loop')!.type).toBe('loop')
        expect(result.nodes.find(n => n.id === 'inner_router')!.type).toBe('router')
    })

    it('should apply stored positions from canvasLayout', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: {
                positions: {
                    trigger: { x: 100, y: 50 },
                    step_1: { x: 100, y: 200 },
                },
            },
        }
        const result = linkedListToGraph(flow)
        expect(result.nodes.find(n => n.id === 'trigger')!.position).toEqual({ x: 100, y: 50 })
        expect(result.nodes.find(n => n.id === 'step_1')!.position).toEqual({ x: 100, y: 200 })
    })

    it('should use default positions when canvasLayout is null', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: null,
        }
        const result = linkedListToGraph(flow)
        expect(result.nodes.find(n => n.id === 'trigger')!.position).toEqual({ x: 0, y: 0 })
        expect(result.nodes.find(n => n.id === 'step_1')!.position).toEqual({ x: 0, y: 0 })
    })
})

describe('action types', () => {
    it('should map Code action to "action" node type', () => {
        const step = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step },
        }
        const result = linkedListToGraph(flow)
        const node = result.nodes.find(n => n.id === 'step_1')
        expect(node!.type).toBe('action')
        expect(node!.data.actionType).toBe(FlowActionType.CODE)
    })

    it('should map Piece action to "action" node type', () => {
        const step = makePieceAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step },
        }
        const result = linkedListToGraph(flow)
        const node = result.nodes.find(n => n.id === 'step_1')
        expect(node!.type).toBe('action')
        expect(node!.data.actionType).toBe(FlowActionType.PIECE)
    })

    it('should map Loop action to "loop" node type', () => {
        const step = makeLoopAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step },
        }
        const result = linkedListToGraph(flow)
        const node = result.nodes.find(n => n.id === 'step_1')
        expect(node!.type).toBe('loop')
        expect(node!.data.actionType).toBe(FlowActionType.LOOP_ON_ITEMS)
    })

    it('should map Router action to "router" node type', () => {
        const step = makeRouterAction('step_1', [null])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step },
        }
        const result = linkedListToGraph(flow)
        const node = result.nodes.find(n => n.id === 'step_1')
        expect(node!.type).toBe('router')
        expect(node!.data.actionType).toBe(FlowActionType.ROUTER)
    })

    it('should map Empty trigger to "trigger" node type', () => {
        const result = linkedListToGraph(baseFlowVersion)
        const node = result.nodes.find(n => n.id === 'trigger')
        expect(node!.type).toBe('trigger')
    })
})

describe('graph to linked-list', () => {
    it('should rebuild simple chain from graph', () => {
        const step2 = makeCodeAction('step_2')
        const step1 = makeCodeAction('step_1', step2)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const { nodes, edges } = linkedListToGraph(flow)
        const trigger = graphToLinkedList(nodes, edges)

        expect(trigger.name).toBe('trigger')
        expect(trigger.nextAction).toBeDefined()
        expect(trigger.nextAction!.name).toBe('step_1')
        expect(trigger.nextAction!.nextAction).toBeDefined()
        expect(trigger.nextAction!.nextAction!.name).toBe('step_2')
        expect(trigger.nextAction!.nextAction!.nextAction).toBeUndefined()
    })

    it('should rebuild Loop with firstLoopAction from graph', () => {
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('step_1', loopChild)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const { nodes, edges } = linkedListToGraph(flow)
        const trigger = graphToLinkedList(nodes, edges)

        expect(trigger.nextAction).toBeDefined()
        const rebuiltLoop = trigger.nextAction as LoopOnItemsAction
        expect(rebuiltLoop.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        expect(rebuiltLoop.firstLoopAction).toBeDefined()
        expect(rebuiltLoop.firstLoopAction!.name).toBe('loop_child')
    })

    it('should rebuild Router with correct children[] from graph', () => {
        const child0 = makeCodeAction('branch_0_child')
        const child1 = makePieceAction('branch_1_child')
        const router = makeRouterAction('step_1', [child0, child1])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }
        const { nodes, edges } = linkedListToGraph(flow)
        const trigger = graphToLinkedList(nodes, edges)

        expect(trigger.nextAction).toBeDefined()
        const rebuiltRouter = trigger.nextAction as RouterAction
        expect(rebuiltRouter.type).toBe(FlowActionType.ROUTER)
        expect(rebuiltRouter.children).toHaveLength(2)
        expect(rebuiltRouter.children[0]!.name).toBe('branch_0_child')
        expect(rebuiltRouter.children[1]!.name).toBe('branch_1_child')
    })

    it('should preserve step properties (name, type, settings, displayName)', () => {
        const step1 = makePieceAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const { nodes, edges } = linkedListToGraph(flow)
        const trigger = graphToLinkedList(nodes, edges)

        const rebuilt = trigger.nextAction!
        expect(rebuilt.name).toBe('step_1')
        expect(rebuilt.type).toBe(FlowActionType.PIECE)
        expect(rebuilt.displayName).toBe('Piece step_1')
        expect(rebuilt.valid).toBe(true)
    })
})

describe('round-trip', () => {
    it('should preserve structure for linear 3-step chain', () => {
        const step3 = makeCodeAction('step_3')
        const step2 = makePieceAction('step_2', step3)
        const step1 = makeCodeAction('step_1', step2)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }

        const { nodes, edges } = linkedListToGraph(flow)
        const rebuilt = graphToLinkedList(nodes, edges)

        expect(rebuilt.name).toBe('trigger')
        expect(rebuilt.nextAction!.name).toBe('step_1')
        expect(rebuilt.nextAction!.type).toBe(FlowActionType.CODE)
        expect(rebuilt.nextAction!.nextAction!.name).toBe('step_2')
        expect(rebuilt.nextAction!.nextAction!.type).toBe(FlowActionType.PIECE)
        expect(rebuilt.nextAction!.nextAction!.nextAction!.name).toBe('step_3')
        expect(rebuilt.nextAction!.nextAction!.nextAction!.nextAction).toBeUndefined()
    })

    it('should preserve structure for flow with LoopOnItems + child', () => {
        const loopChild = makeCodeAction('inner_step')
        const loop = makeLoopAction('loop_step', loopChild, makeCodeAction('after_loop'))
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }

        const { nodes, edges } = linkedListToGraph(flow)
        const rebuilt = graphToLinkedList(nodes, edges)

        const rebuiltLoop = rebuilt.nextAction as LoopOnItemsAction
        expect(rebuiltLoop.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        expect(rebuiltLoop.firstLoopAction!.name).toBe('inner_step')
        expect(rebuiltLoop.nextAction!.name).toBe('after_loop')
    })

    it('should preserve structure for flow with Router + 2 branches', () => {
        const branch0Child = makeCodeAction('b0_child')
        const branch1Child = makePieceAction('b1_child')
        const router = makeRouterAction('router_step', [branch0Child, branch1Child], makeCodeAction('after_router'))
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }

        const { nodes, edges } = linkedListToGraph(flow)
        const rebuilt = graphToLinkedList(nodes, edges)

        const rebuiltRouter = rebuilt.nextAction as RouterAction
        expect(rebuiltRouter.type).toBe(FlowActionType.ROUTER)
        expect(rebuiltRouter.children).toHaveLength(2)
        expect(rebuiltRouter.children[0]!.name).toBe('b0_child')
        expect(rebuiltRouter.children[1]!.name).toBe('b1_child')
        expect(rebuiltRouter.nextAction!.name).toBe('after_router')
    })
})

describe('edge count verification', () => {
    it('should have 0 edges for trigger-only flow', () => {
        const result = linkedListToGraph(baseFlowVersion)
        expect(result.edges).toHaveLength(0)
    })

    it('should have 2 edges for 3-step linear chain', () => {
        const step2 = makeCodeAction('step_2')
        const step1 = makeCodeAction('step_1', step2)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = linkedListToGraph(flow)
        expect(result.edges).toHaveLength(2)
    })

    it('should have correct edge count for loop with child and nextAction', () => {
        const loopChild = makeCodeAction('child')
        const afterLoop = makeCodeAction('after')
        const loop = makeLoopAction('loop', loopChild, afterLoop)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = linkedListToGraph(flow)
        // trigger->loop(output) + loop->child(loop-output) + loop->after(output) = 3 edges
        expect(result.edges).toHaveLength(3)
    })

    it('should have correct edge count for router with 2 branches', () => {
        const child0 = makeCodeAction('c0')
        const child1 = makeCodeAction('c1')
        const router = makeRouterAction('router', [child0, child1])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }
        const result = linkedListToGraph(flow)
        // trigger->router(output) + router->c0(branch-0) + router->c1(branch-1) = 3 edges
        expect(result.edges).toHaveLength(3)
    })
})

describe('orphan detection', () => {
    it('should return empty array when all nodes are connected', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = linkedListToGraph(flow)
        expect(result.orphanNodeIds).toHaveLength(0)
    })

    it('should detect orphan nodes not reachable from trigger', () => {
        // Manually create a graph with an orphan node
        const nodes: GraphNode[] = [
            { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { step: baseTrigger, stepName: 'trigger', actionType: FlowTriggerType.EMPTY } },
            { id: 'step_1', type: 'action', position: { x: 0, y: 100 }, data: { step: makeCodeAction('step_1'), stepName: 'step_1', actionType: FlowActionType.CODE } },
            { id: 'orphan', type: 'action', position: { x: 200, y: 100 }, data: { step: makeCodeAction('orphan'), stepName: 'orphan', actionType: FlowActionType.CODE } },
        ]
        const edges: GraphEdge[] = [
            { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' },
        ]
        const orphans = findOrphanNodes(nodes, edges)
        expect(orphans).toContain('orphan')
        expect(orphans).not.toContain('trigger')
        expect(orphans).not.toContain('step_1')
    })
})

describe('extractPositions', () => {
    it('should extract positions from graph nodes', () => {
        const nodes: GraphNode[] = [
            { id: 'trigger', type: 'trigger', position: { x: 100, y: 50 }, data: { step: baseTrigger, stepName: 'trigger', actionType: FlowTriggerType.EMPTY } },
            { id: 'step_1', type: 'action', position: { x: 100, y: 200 }, data: { step: makeCodeAction('step_1'), stepName: 'step_1', actionType: FlowActionType.CODE } },
        ]
        const positions = extractPositions(nodes)
        expect(positions['trigger']).toEqual({ x: 100, y: 50 })
        expect(positions['step_1']).toEqual({ x: 100, y: 200 })
    })
})
