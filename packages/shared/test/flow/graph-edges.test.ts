import {
    HANDLE_IDS,
    branchHandle,
} from '../../src/lib/automation/flows/util/connection-rules'
import {
    getEdgeType,
    getEdgeLabel,
    getEdgeStyle,
    classifyEdges,
    GRAPH_EDGE_TYPES,
} from '../../src/lib/automation/flows/util/graph-edge-utils'
import type {
    GraphEdgeType,
    GraphEdgeStyle,
} from '../../src/lib/automation/flows/util/graph-edge-utils'
import type { GraphEdge } from '../../src/lib/automation/flows/util/graph-converter'

describe('graph-edge-utils', () => {
    describe('getEdgeType', () => {
        it('should return "default" for output sourceHandle', () => {
            expect(getEdgeType(HANDLE_IDS.OUTPUT)).toBe('default')
        })

        it('should return "loop" for loop-output sourceHandle', () => {
            expect(getEdgeType(HANDLE_IDS.LOOP_OUTPUT)).toBe('loop')
        })

        it('should return "branch" for branch-0 sourceHandle', () => {
            expect(getEdgeType(branchHandle(0))).toBe('branch')
        })

        it('should return "branch" for branch-1 sourceHandle', () => {
            expect(getEdgeType(branchHandle(1))).toBe('branch')
        })

        it('should return "branch" for branch-99 sourceHandle', () => {
            expect(getEdgeType(branchHandle(99))).toBe('branch')
        })

        it('should return "default" for unknown sourceHandle', () => {
            expect(getEdgeType('unknown-handle')).toBe('default')
        })

        it('should return "default" for empty string sourceHandle', () => {
            expect(getEdgeType('')).toBe('default')
        })
    })

    describe('getEdgeLabel', () => {
        it('should return empty string for output sourceHandle', () => {
            expect(getEdgeLabel(HANDLE_IDS.OUTPUT)).toBe('')
        })

        it('should return empty string for loop-output sourceHandle', () => {
            expect(getEdgeLabel(HANDLE_IDS.LOOP_OUTPUT)).toBe('')
        })

        it('should return "Branch 1" for branch-0 sourceHandle', () => {
            expect(getEdgeLabel(branchHandle(0))).toBe('Branch 1')
        })

        it('should return "Branch 2" for branch-1 sourceHandle', () => {
            expect(getEdgeLabel(branchHandle(1))).toBe('Branch 2')
        })

        it('should return "Branch 10" for branch-9 sourceHandle', () => {
            expect(getEdgeLabel(branchHandle(9))).toBe('Branch 10')
        })

        it('should return empty string for unknown sourceHandle', () => {
            expect(getEdgeLabel('unknown')).toBe('')
        })
    })

    describe('getEdgeStyle', () => {
        it('should return solid stroke for default type', () => {
            const style = getEdgeStyle('default')
            expect(style.strokeDasharray).toBeUndefined()
        })

        it('should return dashed stroke for loop type', () => {
            const style = getEdgeStyle('loop')
            expect(style.strokeDasharray).toBeDefined()
            expect(style.strokeDasharray).toBe('5 3')
        })

        it('should return solid stroke for branch type', () => {
            const style = getEdgeStyle('branch')
            expect(style.strokeDasharray).toBeUndefined()
        })

        it('should have stroke #94a3b8 for default type', () => {
            const style = getEdgeStyle('default')
            expect(style.stroke).toBe('#94a3b8')
        })

        it('should have stroke #8b5cf6 for loop type', () => {
            const style = getEdgeStyle('loop')
            expect(style.stroke).toBe('#8b5cf6')
        })

        it('should have stroke #f59e0b for branch type', () => {
            const style = getEdgeStyle('branch')
            expect(style.stroke).toBe('#f59e0b')
        })

        it('should have strokeWidth 2 for all types', () => {
            const types: GraphEdgeType[] = ['default', 'loop', 'branch']
            for (const type of types) {
                expect(getEdgeStyle(type).strokeWidth).toBe(2)
            }
        })
    })

    describe('GRAPH_EDGE_TYPES', () => {
        it('should have DEFAULT, LOOP, BRANCH keys', () => {
            expect(GRAPH_EDGE_TYPES).toHaveProperty('DEFAULT')
            expect(GRAPH_EDGE_TYPES).toHaveProperty('LOOP')
            expect(GRAPH_EDGE_TYPES).toHaveProperty('BRANCH')
        })

        it('should have DEFAULT value "default"', () => {
            expect(GRAPH_EDGE_TYPES.DEFAULT).toBe('default')
        })

        it('should have LOOP value "loop"', () => {
            expect(GRAPH_EDGE_TYPES.LOOP).toBe('loop')
        })

        it('should have BRANCH value "branch"', () => {
            expect(GRAPH_EDGE_TYPES.BRANCH).toBe('branch')
        })
    })

    describe('classifyEdges', () => {
        function makeEdge(sourceHandle: string, id?: string): GraphEdge {
            return {
                id: id ?? `edge-${sourceHandle}`,
                source: 'node-a',
                target: 'node-b',
                sourceHandle,
                targetHandle: 'input',
            }
        }

        it('should classify output edges as "default"', () => {
            const edges = [makeEdge(HANDLE_IDS.OUTPUT)]
            const classified = classifyEdges(edges)
            expect(classified).toHaveLength(1)
            expect(classified[0].type).toBe('default')
        })

        it('should classify loop-output edges as "loop"', () => {
            const edges = [makeEdge(HANDLE_IDS.LOOP_OUTPUT)]
            const classified = classifyEdges(edges)
            expect(classified[0].type).toBe('loop')
        })

        it('should classify branch-N edges as "branch"', () => {
            const edges = [makeEdge(branchHandle(0)), makeEdge(branchHandle(2))]
            const classified = classifyEdges(edges)
            expect(classified[0].type).toBe('branch')
            expect(classified[1].type).toBe('branch')
        })

        it('should handle empty edge array', () => {
            const classified = classifyEdges([])
            expect(classified).toHaveLength(0)
        })

        it('should preserve original edge properties', () => {
            const edge = makeEdge(HANDLE_IDS.OUTPUT, 'custom-id')
            const classified = classifyEdges([edge])
            expect(classified[0].id).toBe('custom-id')
            expect(classified[0].source).toBe('node-a')
            expect(classified[0].target).toBe('node-b')
            expect(classified[0].sourceHandle).toBe(HANDLE_IDS.OUTPUT)
            expect(classified[0].targetHandle).toBe('input')
        })

        it('should classify mixed edges correctly', () => {
            const edges = [
                makeEdge(HANDLE_IDS.OUTPUT, 'e1'),
                makeEdge(HANDLE_IDS.LOOP_OUTPUT, 'e2'),
                makeEdge(branchHandle(0), 'e3'),
                makeEdge(branchHandle(1), 'e4'),
            ]
            const classified = classifyEdges(edges)
            expect(classified).toHaveLength(4)
            expect(classified[0].type).toBe('default')
            expect(classified[1].type).toBe('loop')
            expect(classified[2].type).toBe('branch')
            expect(classified[3].type).toBe('branch')
        })
    })

    describe('type exports', () => {
        it('should allow creating GraphEdgeType values', () => {
            const t: GraphEdgeType = 'default'
            expect(t).toBe('default')
        })

        it('should allow creating GraphEdgeStyle objects', () => {
            const s: GraphEdgeStyle = {
                stroke: '#000',
                strokeWidth: 1,
            }
            expect(s.stroke).toBe('#000')
            expect(s.strokeWidth).toBe(1)
        })

        it('should allow GraphEdgeStyle with optional strokeDasharray', () => {
            const s: GraphEdgeStyle = {
                stroke: '#000',
                strokeWidth: 1,
                strokeDasharray: '5 5',
            }
            expect(s.strokeDasharray).toBe('5 5')
        })
    })
})
