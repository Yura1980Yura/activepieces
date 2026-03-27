import {
    FlowActionType,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    RouterExecutionType,
    BranchExecutionType,
    BranchOperator,
    NoteColorVariant,
} from '../../src'
import {
    buildGraphFromFlowVersion,
    getStepNameFromNode,
    GRAPH_NODE_TYPE_KEYS,
} from '../../src/lib/automation/flows/util/graph-canvas-utils'
import { NOTE_NODE_TYPE } from '../../src/lib/automation/flows/util/graph-note-node-utils'
import {
    createInitialGraphData,
    syncGraphFromFlowVersion,
    autoLayoutGraphNodes,
} from '../../src/lib/automation/flows/util/graph-state-utils'
import type { FlowTrigger, FlowAction, LoopOnItemsAction, RouterAction, Note, GraphNode } from '../../src'

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

// === getStepNameFromNode ===

describe('getStepNameFromNode', () => {
    it('should return step name for action node', () => {
        const node: GraphNode = {
            id: 'step_1',
            type: GRAPH_NODE_TYPE_KEYS.ACTION,
            position: { x: 0, y: 0 },
            data: { stepName: 'step_1', step: makeCodeAction('step_1'), actionType: FlowActionType.CODE },
        }
        expect(getStepNameFromNode(node)).toBe('step_1')
    })

    it('should return step name for trigger node', () => {
        const node: GraphNode = {
            id: 'trigger',
            type: GRAPH_NODE_TYPE_KEYS.TRIGGER,
            position: { x: 0, y: 0 },
            data: { stepName: 'trigger', step: baseTrigger, actionType: undefined },
        }
        expect(getStepNameFromNode(node)).toBe('trigger')
    })

    it('should return null for note node', () => {
        const node: GraphNode = {
            id: 'note-1',
            type: NOTE_NODE_TYPE,
            position: { x: 100, y: 200 },
            data: { noteId: 'note-1', note: { id: 'note-1', content: 'test', position: { x: 100, y: 200 } } } as unknown as GraphNode['data'],
        }
        expect(getStepNameFromNode(node)).toBeNull()
    })

    it('should return null for node without data', () => {
        const node: GraphNode = {
            id: 'unknown',
            type: 'action',
            position: { x: 0, y: 0 },
            data: undefined as unknown as GraphNode['data'],
        }
        expect(getStepNameFromNode(node)).toBeNull()
    })

    it('should handle loop node type', () => {
        const loopAction = makeLoopAction('loop_1')
        const node: GraphNode = {
            id: 'loop_1',
            type: GRAPH_NODE_TYPE_KEYS.LOOP,
            position: { x: 0, y: 0 },
            data: { stepName: 'loop_1', step: loopAction, actionType: FlowActionType.LOOP_ON_ITEMS },
        }
        expect(getStepNameFromNode(node)).toBe('loop_1')
    })

    it('should handle router node type', () => {
        const routerAction = makeRouterAction('router_1', [null, null])
        const node: GraphNode = {
            id: 'router_1',
            type: GRAPH_NODE_TYPE_KEYS.ROUTER,
            position: { x: 0, y: 0 },
            data: { stepName: 'router_1', step: routerAction, actionType: FlowActionType.ROUTER },
        }
        expect(getStepNameFromNode(node)).toBe('router_1')
    })
})

// === buildGraphFromFlowVersion integration with builder patterns ===

describe('buildGraphFromFlowVersion for builder integration', () => {
    it('should produce nodes with stepName in data', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const result = buildGraphFromFlowVersion(flowVersion)
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        const actionNode = result.nodes.find(n => n.id === 'step_1')

        expect(triggerNode).toBeDefined()
        expect(triggerNode!.data.stepName).toBe('trigger')
        expect(actionNode).toBeDefined()
        expect(actionNode!.data.stepName).toBe('step_1')
    })

    it('should include note nodes from FlowVersion.notes', () => {
        const notes: Note[] = [
            {
                id: 'note-1',
                content: 'Test note',
                position: { x: 100, y: 200 },
                color: NoteColorVariant.DEFAULT,
            },
        ]
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            notes,
        }
        const result = buildGraphFromFlowVersion(flowVersion)
        const noteNode = result.nodes.find(n => n.type === NOTE_NODE_TYPE)

        expect(noteNode).toBeDefined()
        expect(noteNode!.id).toBe('note-1')
        expect(noteNode!.position).toEqual({ x: 100, y: 200 })
    })

    it('should apply auto-layout when canvasLayout is null', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: null,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const result = buildGraphFromFlowVersion(flowVersion)

        // Dagre should have assigned positions (not all at 0,0)
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        const actionNode = result.nodes.find(n => n.id === 'step_1')
        expect(triggerNode).toBeDefined()
        expect(actionNode).toBeDefined()
        // At least one node should have non-zero position from auto-layout
        const hasPositions = (triggerNode!.position.x !== 0 || triggerNode!.position.y !== 0) ||
            (actionNode!.position.x !== 0 || actionNode!.position.y !== 0)
        expect(hasPositions).toBe(true)
    })

    it('should use stored positions when canvasLayout exists', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: {
                positions: {
                    trigger: { x: 50, y: 100 },
                    step_1: { x: 150, y: 300 },
                },
            },
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const result = buildGraphFromFlowVersion(flowVersion)
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        const actionNode = result.nodes.find(n => n.id === 'step_1')

        expect(triggerNode!.position).toEqual({ x: 50, y: 100 })
        expect(actionNode!.position).toEqual({ x: 150, y: 300 })
    })
})

// === createInitialGraphData matches buildGraphFromFlowVersion ===

describe('createInitialGraphData integration', () => {
    it('should match buildGraphFromFlowVersion output structure', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const buildResult = buildGraphFromFlowVersion(flowVersion)
        const initResult = createInitialGraphData(flowVersion)

        // Both should have the same number of nodes (trigger + step_1)
        expect(initResult.nodes.length).toBe(buildResult.nodes.length)
        // Both should have the same node IDs
        const buildIds = buildResult.nodes.map(n => n.id).sort()
        const initIds = initResult.nodes.map(n => n.id).sort()
        expect(initIds).toEqual(buildIds)
    })
})

// === syncGraphFromFlowVersion ===

describe('syncGraphFromFlowVersion for builder rebuild', () => {
    it('should rebuild correctly after structural change', () => {
        const flowVersionBefore: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const flowVersionAfter: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1', makeCodeAction('step_2')),
            },
        }

        const beforeData = syncGraphFromFlowVersion(flowVersionBefore)
        const afterData = syncGraphFromFlowVersion(flowVersionAfter)

        // Before: trigger + step_1 = 2 nodes
        expect(beforeData.nodes.length).toBe(2)
        // After: trigger + step_1 + step_2 = 3 nodes
        expect(afterData.nodes.length).toBe(3)
        expect(afterData.nodes.find(n => n.id === 'step_2')).toBeDefined()
    })
})

// === autoLayoutGraphNodes ===

describe('autoLayoutGraphNodes for builder auto-layout callback', () => {
    it('should produce valid positions', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeCodeAction('step_1'),
            },
        }
        const data = createInitialGraphData(flowVersion)
        const layoutedNodes = autoLayoutGraphNodes(data.nodes, data.edges)

        expect(layoutedNodes.length).toBe(data.nodes.length)
        for (const node of layoutedNodes) {
            expect(typeof node.position.x).toBe('number')
            expect(typeof node.position.y).toBe('number')
            expect(isNaN(node.position.x)).toBe(false)
            expect(isNaN(node.position.y)).toBe(false)
        }
    })
})

// === Loop and Router integration ===

describe('getStepNameFromNode with complex flow types', () => {
    it('should extract step name from loop flow graph node', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeLoopAction('loop_1', makeCodeAction('inner_1')),
            },
        }
        const result = buildGraphFromFlowVersion(flowVersion)
        const loopNode = result.nodes.find(n => n.id === 'loop_1')

        expect(loopNode).toBeDefined()
        expect(getStepNameFromNode(loopNode!)).toBe('loop_1')
    })

    it('should extract step name from router flow graph node', () => {
        const flowVersion: FlowVersion = {
            ...baseFlowVersion,
            trigger: {
                ...baseTrigger,
                nextAction: makeRouterAction('router_1', [makeCodeAction('branch_step_1'), null]),
            },
        }
        const result = buildGraphFromFlowVersion(flowVersion)
        const routerNode = result.nodes.find(n => n.id === 'router_1')

        expect(routerNode).toBeDefined()
        expect(getStepNameFromNode(routerNode!)).toBe('router_1')
    })
})

// === Empty flow rendering ===

describe('empty flow rendering for builder', () => {
    it('should render trigger-only flow correctly', () => {
        const result = buildGraphFromFlowVersion(baseFlowVersion)
        expect(result.nodes.length).toBe(1)
        expect(result.nodes[0].id).toBe('trigger')
        expect(result.nodes[0].type).toBe(GRAPH_NODE_TYPE_KEYS.TRIGGER)
        expect(result.edges.length).toBe(0)
    })
})
