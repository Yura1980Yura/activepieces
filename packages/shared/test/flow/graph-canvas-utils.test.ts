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
    createNodeTypesConfig,
    createEdgeTypesConfig,
    buildGraphFromFlowVersion,
    createIsValidConnection,
    GRAPH_NODE_TYPE_KEYS,
    CANVAS_CONTROL_ACTIONS,
    getCanvasControlActions,
} from '../../src/lib/automation/flows/util/graph-canvas-utils'
import { GRAPH_EDGE_TYPES } from '../../src/lib/automation/flows/util/graph-edge-utils'
import { NOTE_NODE_TYPE } from '../../src/lib/automation/flows/util/graph-note-node-utils'
import type { FlowTrigger, FlowAction, LoopOnItemsAction, RouterAction, Note } from '../../src'

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

// === CANVAS_CONTROL_ACTIONS ===

describe('CANVAS_CONTROL_ACTIONS', () => {
    it('should have exactly 4 control actions', () => {
        const keys = Object.keys(CANVAS_CONTROL_ACTIONS)
        expect(keys).toHaveLength(4)
    })

    it('should include ZOOM_IN with value "zoom-in"', () => {
        expect(CANVAS_CONTROL_ACTIONS.ZOOM_IN).toBe('zoom-in')
    })

    it('should include ZOOM_OUT with value "zoom-out"', () => {
        expect(CANVAS_CONTROL_ACTIONS.ZOOM_OUT).toBe('zoom-out')
    })

    it('should include FIT_VIEW with value "fit-view"', () => {
        expect(CANVAS_CONTROL_ACTIONS.FIT_VIEW).toBe('fit-view')
    })

    it('should include AUTO_LAYOUT with value "auto-layout"', () => {
        expect(CANVAS_CONTROL_ACTIONS.AUTO_LAYOUT).toBe('auto-layout')
    })
})

// === getCanvasControlActions ===

describe('getCanvasControlActions', () => {
    it('should return 4 actions', () => {
        const actions = getCanvasControlActions()
        expect(actions).toHaveLength(4)
    })

    it('should return actions in toolbar order: zoom-in, zoom-out, fit-view, auto-layout', () => {
        const actions = getCanvasControlActions()
        expect(actions).toEqual([
            'zoom-in',
            'zoom-out',
            'fit-view',
            'auto-layout',
        ])
    })

    it('should return all values from CANVAS_CONTROL_ACTIONS', () => {
        const actions = getCanvasControlActions()
        const allValues = Object.values(CANVAS_CONTROL_ACTIONS)
        for (const value of allValues) {
            expect(actions).toContain(value)
        }
    })

    it('should return a new array each call (no shared reference)', () => {
        const a = getCanvasControlActions()
        const b = getCanvasControlActions()
        expect(a).not.toBe(b)
        expect(a).toEqual(b)
    })
})

// === createNodeTypesConfig ===

describe('createNodeTypesConfig', () => {
    it('should return exactly 5 keys: trigger, action, loop, router, note', () => {
        const config = createNodeTypesConfig()
        const keys = Object.keys(config).sort()
        expect(keys).toEqual(['action', 'loop', 'note', 'router', 'trigger'])
    })

    it('should have trigger key mapping to "trigger"', () => {
        const config = createNodeTypesConfig()
        expect(config[GRAPH_NODE_TYPE_KEYS.TRIGGER]).toBe('trigger')
    })

    it('should have action key mapping to "action"', () => {
        const config = createNodeTypesConfig()
        expect(config[GRAPH_NODE_TYPE_KEYS.ACTION]).toBe('action')
    })

    it('should have loop key mapping to "loop"', () => {
        const config = createNodeTypesConfig()
        expect(config[GRAPH_NODE_TYPE_KEYS.LOOP]).toBe('loop')
    })

    it('should have router key mapping to "router"', () => {
        const config = createNodeTypesConfig()
        expect(config[GRAPH_NODE_TYPE_KEYS.ROUTER]).toBe('router')
    })

    it('should have note key mapping to "note"', () => {
        const config = createNodeTypesConfig()
        expect(config[GRAPH_NODE_TYPE_KEYS.NOTE]).toBe('note')
    })

    it('should have note key equal to NOTE_NODE_TYPE constant', () => {
        expect(GRAPH_NODE_TYPE_KEYS.NOTE).toBe(NOTE_NODE_TYPE)
    })
})

// === createEdgeTypesConfig ===

describe('createEdgeTypesConfig', () => {
    it('should return exactly 3 keys: default, loop, branch', () => {
        const config = createEdgeTypesConfig()
        const keys = Object.keys(config).sort()
        expect(keys).toEqual(['branch', 'default', 'loop'])
    })

    it('should map default key to GRAPH_EDGE_TYPES.DEFAULT', () => {
        const config = createEdgeTypesConfig()
        expect(config[GRAPH_EDGE_TYPES.DEFAULT]).toBe(GRAPH_EDGE_TYPES.DEFAULT)
    })

    it('should map loop key to GRAPH_EDGE_TYPES.LOOP', () => {
        const config = createEdgeTypesConfig()
        expect(config[GRAPH_EDGE_TYPES.LOOP]).toBe(GRAPH_EDGE_TYPES.LOOP)
    })

    it('should map branch key to GRAPH_EDGE_TYPES.BRANCH', () => {
        const config = createEdgeTypesConfig()
        expect(config[GRAPH_EDGE_TYPES.BRANCH]).toBe(GRAPH_EDGE_TYPES.BRANCH)
    })
})

// === buildGraphFromFlowVersion ===

describe('buildGraphFromFlowVersion', () => {
    it('should convert trigger-only flow to 1 node and 0 edges', () => {
        const result = buildGraphFromFlowVersion(baseFlowVersion)
        expect(result.nodes).toHaveLength(1)
        expect(result.edges).toHaveLength(0)
        expect(result.nodes[0].id).toBe('trigger')
        expect(result.nodes[0].type).toBe('trigger')
    })

    it('should convert trigger+action flow to 2 nodes and 1 typed edge', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = buildGraphFromFlowVersion(flow)
        expect(result.nodes).toHaveLength(2)
        expect(result.edges).toHaveLength(1)
        // Edge should have type='default' from classifyEdges
        expect(result.edges[0].type).toBe(GRAPH_EDGE_TYPES.DEFAULT)
    })

    it('should apply auto-layout when canvasLayout is null', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = buildGraphFromFlowVersion(flow)
        // At least one node should have non-zero position after auto-layout
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
                    trigger: { x: 100, y: 200 },
                    step_1: { x: 300, y: 400 },
                },
            },
        }
        const result = buildGraphFromFlowVersion(flow)
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        const step1Node = result.nodes.find(n => n.id === 'step_1')
        expect(triggerNode!.position).toEqual({ x: 100, y: 200 })
        expect(step1Node!.position).toEqual({ x: 300, y: 400 })
    })

    it('should classify loop edges as loop type', () => {
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('step_1', loopChild)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = buildGraphFromFlowVersion(flow)
        const loopEdge = result.edges.find(e => e.sourceHandle === 'loop-output')
        expect(loopEdge).toBeDefined()
        expect(loopEdge!.type).toBe(GRAPH_EDGE_TYPES.LOOP)
    })

    it('should classify branch edges as branch type', () => {
        const branchChild = makeCodeAction('branch_child')
        const router = makeRouterAction('step_1', [branchChild, null])
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: router },
        }
        const result = buildGraphFromFlowVersion(flow)
        const branchEdge = result.edges.find(e => e.sourceHandle === 'branch-0')
        expect(branchEdge).toBeDefined()
        expect(branchEdge!.type).toBe(GRAPH_EDGE_TYPES.BRANCH)
    })

    it('should handle complex flow: trigger -> loop(child) -> router(2 branches)', () => {
        const branch0Child = makeCodeAction('b0_child')
        const branch1Child = makeCodeAction('b1_child')
        const router = makeRouterAction('router_1', [branch0Child, branch1Child])
        const loopChild = makeCodeAction('loop_child')
        const loop = makeLoopAction('loop_1', loopChild, router)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: loop },
        }
        const result = buildGraphFromFlowVersion(flow)
        // Nodes: trigger, loop_1, loop_child, router_1, b0_child, b1_child = 6
        expect(result.nodes).toHaveLength(6)
        // Edges: trigger->loop_1(output), loop_1->loop_child(loop-output),
        //        loop_1->router_1(output), router_1->b0_child(branch-0),
        //        router_1->b1_child(branch-1) = 5
        expect(result.edges).toHaveLength(5)
    })

    it('should include note nodes from FlowVersion.notes[]', () => {
        const testNote: Note = {
            id: 'note-1',
            content: 'A sticky note',
            ownerId: 'user-1',
            color: NoteColorVariant.YELLOW,
            position: { x: 500, y: 300 },
            size: { width: 200, height: 150 },
            createdAt: '2026-03-27T00:00:00Z',
            updatedAt: '2026-03-27T00:00:00Z',
        }
        const flow: FlowVersion = {
            ...baseFlowVersion,
            notes: [testNote],
        }
        const result = buildGraphFromFlowVersion(flow)
        // 1 trigger + 1 note = 2 nodes
        expect(result.nodes).toHaveLength(2)
        const noteNode = result.nodes.find(n => n.type === 'note')
        expect(noteNode).toBeDefined()
        expect(noteNode!.id).toBe('note-1')
        expect(noteNode!.position).toEqual({ x: 500, y: 300 })
    })

    it('should include multiple notes alongside action nodes', () => {
        const step1 = makeCodeAction('step_1')
        const notes: Note[] = [
            {
                id: 'note-a',
                content: 'First note',
                ownerId: null,
                color: NoteColorVariant.BLUE,
                position: { x: 400, y: 100 },
                size: { width: 150, height: 100 },
                createdAt: '2026-03-27T00:00:00Z',
                updatedAt: '2026-03-27T00:00:00Z',
            },
            {
                id: 'note-b',
                content: 'Second note',
                ownerId: null,
                color: NoteColorVariant.RED,
                position: { x: 600, y: 200 },
                size: { width: 180, height: 120 },
                createdAt: '2026-03-27T00:00:00Z',
                updatedAt: '2026-03-27T00:00:00Z',
            },
        ]
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            notes,
        }
        const result = buildGraphFromFlowVersion(flow)
        // 2 flow nodes (trigger + step_1) + 2 notes = 4
        expect(result.nodes).toHaveLength(4)
        const noteNodes = result.nodes.filter(n => n.type === 'note')
        expect(noteNodes).toHaveLength(2)
    })

    it('should not add edges for note nodes', () => {
        const testNote: Note = {
            id: 'note-1',
            content: 'Orphan note',
            ownerId: null,
            color: NoteColorVariant.GREEN,
            position: { x: 200, y: 200 },
            size: { width: 200, height: 150 },
            createdAt: '2026-03-27T00:00:00Z',
            updatedAt: '2026-03-27T00:00:00Z',
        }
        const flow: FlowVersion = {
            ...baseFlowVersion,
            notes: [testNote],
        }
        const result = buildGraphFromFlowVersion(flow)
        // No edges for notes
        expect(result.edges).toHaveLength(0)
    })

    it('should handle empty notes array', () => {
        const flow: FlowVersion = {
            ...baseFlowVersion,
            notes: [],
        }
        const result = buildGraphFromFlowVersion(flow)
        expect(result.nodes).toHaveLength(1) // trigger only
    })
})

// === createIsValidConnection ===

describe('createIsValidConnection', () => {
    it('should reject connection with null source', () => {
        const isValid = createIsValidConnection([], [])
        expect(isValid({ source: null, target: 'b', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should reject connection with null target', () => {
        const isValid = createIsValidConnection([], [])
        expect(isValid({ source: 'a', target: null, sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should reject self-connections', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
        ]
        const isValid = createIsValidConnection(nodes, [])
        expect(isValid({ source: 'a', target: 'a', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should reject connections targeting trigger nodes', () => {
        const nodes = [
            { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { step: baseTrigger as any, stepName: 'trigger', actionType: FlowTriggerType.EMPTY } },
            { id: 'a', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
        ]
        const isValid = createIsValidConnection(nodes, [])
        expect(isValid({ source: 'a', target: 'trigger', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should accept valid connection between action nodes', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
            { id: 'b', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'b', actionType: FlowActionType.CODE } },
        ]
        const isValid = createIsValidConnection(nodes, [])
        expect(isValid({ source: 'a', target: 'b', sourceHandle: 'output', targetHandle: 'input' })).toBe(true)
    })

    it('should reject duplicate connection on same output handle', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
            { id: 'b', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'b', actionType: FlowActionType.CODE } },
            { id: 'c', type: 'action', position: { x: 100, y: 100 }, data: { step: {} as FlowAction, stepName: 'c', actionType: FlowActionType.CODE } },
        ]
        const existingEdges = [
            { id: 'a-output-b', source: 'a', target: 'b', sourceHandle: 'output', targetHandle: 'input' },
        ]
        const isValid = createIsValidConnection(nodes, existingEdges)
        // a->output already has edge to b, cannot add another from same output
        expect(isValid({ source: 'a', target: 'c', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should reject duplicate connection on same input handle', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
            { id: 'b', type: 'action', position: { x: 100, y: 0 }, data: { step: {} as FlowAction, stepName: 'b', actionType: FlowActionType.CODE } },
            { id: 'c', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'c', actionType: FlowActionType.CODE } },
        ]
        const existingEdges = [
            { id: 'a-output-c', source: 'a', target: 'c', sourceHandle: 'output', targetHandle: 'input' },
        ]
        const isValid = createIsValidConnection(nodes, existingEdges)
        // c->input already has edge from a, cannot add another to same input
        expect(isValid({ source: 'b', target: 'c', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should reject cycle-creating connections', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
            { id: 'b', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'b', actionType: FlowActionType.CODE } },
        ]
        const existingEdges = [
            { id: 'a-output-b', source: 'a', target: 'b', sourceHandle: 'output', targetHandle: 'input' },
        ]
        const isValid = createIsValidConnection(nodes, existingEdges)
        // b->a would create cycle a->b->a
        expect(isValid({ source: 'b', target: 'a', sourceHandle: 'output', targetHandle: 'input' })).toBe(false)
    })

    it('should accept loop-output connection from LOOP_ON_ITEMS node', () => {
        const loopStep = {
            name: 'loop_1',
            type: FlowActionType.LOOP_ON_ITEMS,
            valid: true,
            displayName: 'Loop 1',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { items: '' },
        } as unknown as FlowAction
        const nodes = [
            { id: 'loop_1', type: 'loop', position: { x: 0, y: 0 }, data: { step: loopStep, stepName: 'loop_1', actionType: FlowActionType.LOOP_ON_ITEMS } },
            { id: 'child', type: 'action', position: { x: 100, y: 0 }, data: { step: {} as FlowAction, stepName: 'child', actionType: FlowActionType.CODE } },
        ]
        const isValid = createIsValidConnection(nodes, [])
        expect(isValid({ source: 'loop_1', target: 'child', sourceHandle: 'loop-output', targetHandle: 'input' })).toBe(true)
    })

    it('should reject loop-output connection from non-loop node', () => {
        const nodes = [
            { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { step: {} as FlowAction, stepName: 'a', actionType: FlowActionType.CODE } },
            { id: 'b', type: 'action', position: { x: 0, y: 100 }, data: { step: {} as FlowAction, stepName: 'b', actionType: FlowActionType.CODE } },
        ]
        const isValid = createIsValidConnection(nodes, [])
        expect(isValid({ source: 'a', target: 'b', sourceHandle: 'loop-output', targetHandle: 'input' })).toBe(false)
    })
})
