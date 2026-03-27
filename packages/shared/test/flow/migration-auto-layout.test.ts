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
    migrateCanvasLayout,
    linkedListToGraph,
    GraphNode,
    GraphEdge,
} from '../../src/lib/automation/flows/util/graph-converter'
import {
    buildGraphFromFlowVersion,
} from '../../src/lib/automation/flows/util/graph-canvas-utils'
import {
    createInitialGraphData,
    syncGraphFromFlowVersion,
} from '../../src/lib/automation/flows/util/graph-state-utils'
import type { FlowTrigger, FlowAction, LoopOnItemsAction, RouterAction, CanvasLayout } from '../../src'

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

// Helper to build nodes+edges from a flow for migrateCanvasLayout tests
function buildNodesAndEdges(flowVersion: FlowVersion): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const { nodes, edges } = linkedListToGraph(flowVersion)
    return { nodes, edges }
}

// === migrateCanvasLayout ===

describe('migrateCanvasLayout', () => {
    describe('null canvasLayout (full migration)', () => {
        it('should compute auto-layout positions for all nodes', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, null)

            expect(result.shouldPersistLayout).toBe(true)
            expect(Object.keys(result.positions)).toHaveLength(2)
            // All nodes should have positions
            expect(result.positions['trigger']).toBeDefined()
            expect(result.positions['step_1']).toBeDefined()
        })

        it('should produce non-zero positions via Dagre', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, null)

            // At least one node should have a non-zero position (Dagre output)
            const hasNonZero = Object.values(result.positions).some(
                (p) => p.x !== 0 || p.y !== 0,
            )
            expect(hasNonZero).toBe(true)
        })

        it('should handle trigger-only flow', () => {
            const { nodes, edges } = buildNodesAndEdges(baseFlowVersion)
            const result = migrateCanvasLayout(nodes, edges, null)

            expect(result.shouldPersistLayout).toBe(true)
            expect(Object.keys(result.positions)).toHaveLength(1)
            expect(result.positions['trigger']).toBeDefined()
        })

        it('should handle undefined canvasLayout same as null', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, undefined)

            expect(result.shouldPersistLayout).toBe(true)
            expect(Object.keys(result.positions)).toHaveLength(2)
        })
    })

    describe('complete canvasLayout (no migration needed)', () => {
        it('should return existing positions unchanged', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: { x: 100, y: 50 },
                    step_1: { x: 100, y: 200 },
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(false)
            expect(result.positions['trigger']).toEqual({ x: 100, y: 50 })
            expect(result.positions['step_1']).toEqual({ x: 100, y: 200 })
        })

        it('should return shouldPersistLayout=false', () => {
            const { nodes, edges } = buildNodesAndEdges(baseFlowVersion)
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: { x: 50, y: 50 },
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(false)
        })
    })

    describe('partial canvasLayout (merge migration)', () => {
        it('should preserve existing positions and fill missing ones', () => {
            const step2 = makeCodeAction('step_2')
            const step1 = makeCodeAction('step_1', step2)
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)

            // Only trigger has a saved position; step_1 and step_2 are missing
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: { x: 500, y: 300 },
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(true)
            // Existing position preserved
            expect(result.positions['trigger']).toEqual({ x: 500, y: 300 })
            // Missing positions filled with Dagre values (should be defined and non-default)
            expect(result.positions['step_1']).toBeDefined()
            expect(result.positions['step_2']).toBeDefined()
        })

        it('should not overwrite existing positions with Dagre values', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)

            const savedPosition = { x: 999, y: 888 }
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: savedPosition,
                    // step_1 missing -- will be filled by Dagre
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            // The saved position must be exactly preserved
            expect(result.positions['trigger']).toEqual(savedPosition)
            // step_1 gets a Dagre-computed position (NOT the saved one)
            expect(result.positions['step_1']).toBeDefined()
            // step_1 position should be different from the saved trigger position
            // (Dagre computes different positions for different nodes)
        })

        it('should handle partial layout with loop nodes', () => {
            const loopChild = makeCodeAction('loop_child')
            const loop = makeLoopAction('loop_step', loopChild)
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: loop },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)

            // Only trigger and loop have saved positions
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: { x: 100, y: 0 },
                    loop_step: { x: 100, y: 150 },
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(true)
            expect(result.positions['trigger']).toEqual({ x: 100, y: 0 })
            expect(result.positions['loop_step']).toEqual({ x: 100, y: 150 })
            expect(result.positions['loop_child']).toBeDefined()
        })

        it('should handle partial layout with router nodes', () => {
            const branch0Child = makeCodeAction('b0_child')
            const branch1Child = makeCodeAction('b1_child')
            const router = makeRouterAction('router_1', [branch0Child, branch1Child])
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: router },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)

            // Only trigger has position
            const canvasLayout: CanvasLayout = {
                positions: {
                    trigger: { x: 200, y: 100 },
                },
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(true)
            expect(result.positions['trigger']).toEqual({ x: 200, y: 100 })
            expect(result.positions['router_1']).toBeDefined()
            expect(result.positions['b0_child']).toBeDefined()
            expect(result.positions['b1_child']).toBeDefined()
        })
    })

    describe('empty positions record', () => {
        it('should compute full auto-layout when positions is {}', () => {
            const step1 = makeCodeAction('step_1')
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const canvasLayout: CanvasLayout = {
                positions: {},
            }
            const result = migrateCanvasLayout(nodes, edges, canvasLayout)

            expect(result.shouldPersistLayout).toBe(true)
            expect(Object.keys(result.positions)).toHaveLength(2)
            expect(result.positions['trigger']).toBeDefined()
            expect(result.positions['step_1']).toBeDefined()
        })
    })

    describe('all flow patterns', () => {
        it('should handle linear chain (3 steps)', () => {
            const step3 = makeCodeAction('step_3')
            const step2 = makeCodeAction('step_2', step3)
            const step1 = makeCodeAction('step_1', step2)
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: step1 },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, null)

            expect(Object.keys(result.positions)).toHaveLength(4)
            expect(result.shouldPersistLayout).toBe(true)
        })

        it('should handle loop with child and nextAction', () => {
            const loopChild = makeCodeAction('child')
            const afterLoop = makeCodeAction('after')
            const loop = makeLoopAction('loop', loopChild, afterLoop)
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: loop },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, null)

            expect(Object.keys(result.positions)).toHaveLength(4)
        })

        it('should handle nested flow (router inside loop)', () => {
            const branchChild = makeCodeAction('branch_child')
            const router = makeRouterAction('inner_router', [branchChild])
            const loop = makeLoopAction('outer_loop', router)
            const flow: FlowVersion = {
                ...baseFlowVersion,
                trigger: { ...baseTrigger, nextAction: loop },
            }
            const { nodes, edges } = buildNodesAndEdges(flow)
            const result = migrateCanvasLayout(nodes, edges, null)

            expect(Object.keys(result.positions)).toHaveLength(4)
            expect(result.positions['trigger']).toBeDefined()
            expect(result.positions['outer_loop']).toBeDefined()
            expect(result.positions['inner_router']).toBeDefined()
            expect(result.positions['branch_child']).toBeDefined()
        })
    })
})

// === buildGraphFromFlowVersion shouldPersistLayout ===

describe('buildGraphFromFlowVersion shouldPersistLayout', () => {
    it('should signal shouldPersistLayout=true when canvasLayout is null', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = buildGraphFromFlowVersion(flow)
        expect(result.shouldPersistLayout).toBe(true)
    })

    it('should signal shouldPersistLayout=false when canvasLayout has all positions', () => {
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
        expect(result.shouldPersistLayout).toBe(false)
    })

    it('should signal shouldPersistLayout=true when canvasLayout has partial positions', () => {
        const step2 = makeCodeAction('step_2')
        const step1 = makeCodeAction('step_1', step2)
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: {
                positions: {
                    trigger: { x: 100, y: 200 },
                    // step_1 and step_2 missing
                },
            },
        }
        const result = buildGraphFromFlowVersion(flow)
        expect(result.shouldPersistLayout).toBe(true)
        // Existing position preserved
        const triggerNode = result.nodes.find(n => n.id === 'trigger')
        expect(triggerNode!.position).toEqual({ x: 100, y: 200 })
    })
})

// === createInitialGraphData shouldPersistLayout ===

describe('createInitialGraphData shouldPersistLayout', () => {
    it('should signal shouldPersistLayout=true when canvasLayout is null', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = createInitialGraphData(flow)
        expect(result.shouldPersistLayout).toBe(true)
    })

    it('should signal shouldPersistLayout=false when canvasLayout has all positions', () => {
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
        const result = createInitialGraphData(flow)
        expect(result.shouldPersistLayout).toBe(false)
    })
})

// === syncGraphFromFlowVersion shouldPersistLayout ===

describe('syncGraphFromFlowVersion shouldPersistLayout', () => {
    it('should signal shouldPersistLayout=true when canvasLayout is null', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
        }
        const result = syncGraphFromFlowVersion(flow)
        expect(result.shouldPersistLayout).toBe(true)
    })

    it('should signal shouldPersistLayout=false when canvasLayout is complete', () => {
        const step1 = makeCodeAction('step_1')
        const flow: FlowVersion = {
            ...baseFlowVersion,
            trigger: { ...baseTrigger, nextAction: step1 },
            canvasLayout: {
                positions: {
                    trigger: { x: 10, y: 20 },
                    step_1: { x: 30, y: 40 },
                },
            },
        }
        const result = syncGraphFromFlowVersion(flow)
        expect(result.shouldPersistLayout).toBe(false)
    })
})
