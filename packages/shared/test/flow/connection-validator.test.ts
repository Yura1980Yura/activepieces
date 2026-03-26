import { detectCycle, validateConnection } from '../../src/lib/automation/flows/util/connection-validator'
import { FlowActionType, FlowTriggerType } from '../../src'
import type { GraphNode, GraphEdge } from '../../src/lib/automation/flows/util/graph-converter'
import type { Step } from '../../src/lib/automation/flows/util/flow-structure-util'

// === Test Helpers ===

function makeTriggerNode(id: string = 'trigger'): GraphNode {
    return {
        id,
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
            step: {
                name: id,
                type: FlowTriggerType.EMPTY,
                valid: false,
                displayName: 'Empty Trigger',
                lastUpdatedDate: '2026-03-27T00:00:00.000Z',
                settings: {},
            } as Step,
            stepName: id,
            actionType: FlowTriggerType.EMPTY,
        },
    }
}

function makeActionNode(id: string, actionType: FlowActionType = FlowActionType.CODE): GraphNode {
    return {
        id,
        type: 'action',
        position: { x: 0, y: 0 },
        data: {
            step: {
                name: id,
                type: actionType,
                valid: true,
                displayName: `Action ${id}`,
                lastUpdatedDate: '2026-03-27T00:00:00.000Z',
                settings: {
                    sourceCode: { code: 'test', packageJson: '{}' },
                    input: {},
                },
            } as Step,
            stepName: id,
            actionType,
        },
    }
}

function makeLoopNode(id: string): GraphNode {
    return {
        id,
        type: 'loop',
        position: { x: 0, y: 0 },
        data: {
            step: {
                name: id,
                type: FlowActionType.LOOP_ON_ITEMS,
                valid: true,
                displayName: `Loop ${id}`,
                lastUpdatedDate: '2026-03-27T00:00:00.000Z',
                settings: { items: '[]' },
            } as Step,
            stepName: id,
            actionType: FlowActionType.LOOP_ON_ITEMS,
        },
    }
}

function makeRouterNode(id: string): GraphNode {
    return {
        id,
        type: 'router',
        position: { x: 0, y: 0 },
        data: {
            step: {
                name: id,
                type: FlowActionType.ROUTER,
                valid: true,
                displayName: `Router ${id}`,
                lastUpdatedDate: '2026-03-27T00:00:00.000Z',
                settings: {
                    branches: [
                        { branchType: 'CONDITION', branchName: 'Branch 1', conditions: [[]] },
                        { branchType: 'FALLBACK', branchName: 'Fallback' },
                    ],
                    executionType: 'EXECUTE_FIRST_MATCH',
                },
            } as Step,
            stepName: id,
            actionType: FlowActionType.ROUTER,
        },
    }
}

function makeEdge(source: string, target: string, sourceHandle: string = 'output'): GraphEdge {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle: 'input',
    }
}

// === Tests ===

describe('detectCycle', () => {
    it('should detect a direct cycle (A→B, proposing B→A)', () => {
        const edges: GraphEdge[] = [makeEdge('A', 'B')]
        expect(detectCycle('B', 'A', edges)).toBe(true)
    })

    it('should detect an indirect cycle (A→B→C, proposing C→A)', () => {
        const edges: GraphEdge[] = [makeEdge('A', 'B'), makeEdge('B', 'C')]
        expect(detectCycle('C', 'A', edges)).toBe(true)
    })

    it('should detect a long indirect cycle', () => {
        const edges: GraphEdge[] = [
            makeEdge('A', 'B'),
            makeEdge('B', 'C'),
            makeEdge('C', 'D'),
            makeEdge('D', 'E'),
        ]
        expect(detectCycle('E', 'A', edges)).toBe(true)
    })

    it('should return false when no cycle would be created', () => {
        const edges: GraphEdge[] = [makeEdge('A', 'B')]
        expect(detectCycle('A', 'C', edges)).toBe(false)
    })

    it('should return false for an empty graph', () => {
        expect(detectCycle('A', 'B', [])).toBe(false)
    })

    it('should return false for parallel paths (no cycle)', () => {
        const edges: GraphEdge[] = [
            makeEdge('A', 'B'),
            makeEdge('A', 'C', 'branch-0'),
        ]
        expect(detectCycle('B', 'C', edges)).toBe(false)
    })
})

describe('validateConnection', () => {
    describe('self connection', () => {
        it('should reject self-connections', () => {
            const nodes: GraphNode[] = [makeActionNode('A')]
            const result = validateConnection('A', 'A', 'output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('Self-connection')
        })
    })

    describe('trigger no input', () => {
        it('should reject connections targeting a trigger node (EMPTY)', () => {
            const nodes: GraphNode[] = [makeActionNode('A'), makeTriggerNode('trigger')]
            const result = validateConnection('A', 'trigger', 'output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('Trigger')
        })

        it('should reject connections targeting a PIECE trigger node', () => {
            const triggerNode: GraphNode = {
                ...makeTriggerNode('trigger'),
                data: {
                    ...makeTriggerNode('trigger').data,
                    actionType: FlowTriggerType.PIECE,
                },
            }
            const nodes: GraphNode[] = [makeActionNode('A'), triggerNode]
            const result = validateConnection('A', 'trigger', 'output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('Trigger')
        })
    })

    describe('cycle', () => {
        it('should reject connections that would create a direct cycle', () => {
            const nodes: GraphNode[] = [makeTriggerNode('trigger'), makeActionNode('A')]
            const edges: GraphEdge[] = [makeEdge('trigger', 'A')]
            const result = validateConnection('A', 'trigger', 'output', 'input', nodes, edges)
            // trigger is a NO_INPUT_TYPE, so it will fail on trigger check first
            expect(result.valid).toBe(false)
        })

        it('should reject connections that would create an indirect cycle between actions', () => {
            // Graph: A→B→C, propose C→A (A has no existing incoming edge)
            const nodes: GraphNode[] = [
                makeActionNode('A'),
                makeActionNode('B'),
                makeActionNode('C'),
            ]
            const edges: GraphEdge[] = [
                makeEdge('A', 'B'),
                makeEdge('B', 'C'),
            ]
            const result = validateConnection('C', 'A', 'output', 'input', nodes, edges)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('cycle')
        })
    })

    describe('max connections input', () => {
        it('should reject second connection to same input handle', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeActionNode('A'),
                makeActionNode('B'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'B')]
            const result = validateConnection('A', 'B', 'output', 'input', nodes, edges)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('incoming connection')
        })
    })

    describe('max connections output', () => {
        it('should reject second connection from same output handle', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeActionNode('A'),
                makeActionNode('B'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'A')]
            const result = validateConnection('trigger', 'B', 'output', 'input', nodes, edges)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('outgoing connection')
        })
    })

    describe('valid connection', () => {
        it('should accept trigger → action connection', () => {
            const nodes: GraphNode[] = [makeTriggerNode('trigger'), makeActionNode('A')]
            const result = validateConnection('trigger', 'A', 'output', 'input', nodes, [])
            expect(result.valid).toBe(true)
        })

        it('should accept action → action connection', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeActionNode('A'),
                makeActionNode('B'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'A')]
            const result = validateConnection('A', 'B', 'output', 'input', nodes, edges)
            expect(result.valid).toBe(true)
        })

        it('should accept loop → action via loop-output', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeLoopNode('loop1'),
                makeActionNode('loopBody'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'loop1')]
            const result = validateConnection('loop1', 'loopBody', 'loop-output', 'input', nodes, edges)
            expect(result.valid).toBe(true)
        })

        it('should accept router → action via branch-0', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeRouterNode('router1'),
                makeActionNode('branch0Action'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'router1')]
            const result = validateConnection('router1', 'branch0Action', 'branch-0', 'input', nodes, edges)
            expect(result.valid).toBe(true)
        })

        it('should accept router → action via branch-1', () => {
            const nodes: GraphNode[] = [
                makeTriggerNode('trigger'),
                makeRouterNode('router1'),
                makeActionNode('branch1Action'),
            ]
            const edges: GraphEdge[] = [makeEdge('trigger', 'router1')]
            const result = validateConnection('router1', 'branch1Action', 'branch-1', 'input', nodes, edges)
            expect(result.valid).toBe(true)
        })
    })

    describe('source handle validation', () => {
        it('should reject loop-output handle on non-loop node', () => {
            const nodes: GraphNode[] = [makeActionNode('A'), makeActionNode('B')]
            const result = validateConnection('A', 'B', 'loop-output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('loop')
        })

        it('should reject branch handle on non-router node', () => {
            const nodes: GraphNode[] = [makeActionNode('A'), makeActionNode('B')]
            const result = validateConnection('A', 'B', 'branch-0', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('router')
        })

        it('should reject unknown source handle', () => {
            const nodes: GraphNode[] = [makeActionNode('A'), makeActionNode('B')]
            const result = validateConnection('A', 'B', 'unknown-handle', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('Unknown')
        })

        it('should reject invalid target handle', () => {
            const nodes: GraphNode[] = [makeTriggerNode('trigger'), makeActionNode('A')]
            const result = validateConnection('trigger', 'A', 'output', 'output', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('target handle')
        })
    })

    describe('missing nodes', () => {
        it('should reject if source node not found', () => {
            const nodes: GraphNode[] = [makeActionNode('B')]
            const result = validateConnection('A', 'B', 'output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('not found')
        })

        it('should reject if target node not found', () => {
            const nodes: GraphNode[] = [makeActionNode('A')]
            const result = validateConnection('A', 'B', 'output', 'input', nodes, [])
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('not found')
        })
    })
})
