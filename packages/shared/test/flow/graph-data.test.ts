import {
    GraphNodePosition,
    GraphNodeErrorHandling,
    GraphNodeType,
    GraphNodeDefinition,
    GraphEdgeDefinition,
    GraphData,
} from '../../src/lib/automation/flows/graph-data'

describe('graph-data zod-схемы', () => {
    // === Валидные данные для повторного использования ===
    const validNode: unknown = {
        id: 'trigger',
        type: 'trigger',
        position: { x: 100, y: 200 },
        displayName: 'Manual Trigger',
        valid: true,
        actionType: 'PIECE_TRIGGER',
        settings: { pieceName: 'schedule' },
    }

    const validNodeFull: unknown = {
        id: 'step_1',
        type: 'action',
        position: { x: 300, y: 400 },
        displayName: 'Code Node',
        valid: true,
        skip: false,
        errorHandling: {
            continueOnFailure: true,
            retryOnFailure: false,
        },
        actionType: 'CODE',
        settings: { input: { key: 'value' }, sourceCode: { code: 'return 1' } },
        sampleData: { result: 42 },
    }

    const validEdge: unknown = {
        id: 'trigger-output-step_1',
        source: 'trigger',
        target: 'step_1',
        sourceHandle: 'output',
        targetHandle: 'input',
    }

    // === GraphNodePosition ===
    describe('GraphNodePosition', () => {
        it('принимает валидную позицию', () => {
            const result = GraphNodePosition.safeParse({ x: 100, y: 200 })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.x).toBe(100)
                expect(result.data.y).toBe(200)
            }
        })

        it('принимает отрицательные координаты', () => {
            const result = GraphNodePosition.safeParse({ x: -50, y: -100 })
            expect(result.success).toBe(true)
        })

        it('принимает нулевые координаты', () => {
            const result = GraphNodePosition.safeParse({ x: 0, y: 0 })
            expect(result.success).toBe(true)
        })

        it('принимает дробные координаты', () => {
            const result = GraphNodePosition.safeParse({ x: 10.5, y: 20.3 })
            expect(result.success).toBe(true)
        })

        it('отклоняет отсутствующее поле x', () => {
            const result = GraphNodePosition.safeParse({ y: 200 })
            expect(result.success).toBe(false)
        })

        it('отклоняет отсутствующее поле y', () => {
            const result = GraphNodePosition.safeParse({ x: 100 })
            expect(result.success).toBe(false)
        })

        it('отклоняет строковые координаты', () => {
            const result = GraphNodePosition.safeParse({ x: '100', y: '200' })
            expect(result.success).toBe(false)
        })
    })

    // === GraphNodeErrorHandling ===
    describe('GraphNodeErrorHandling', () => {
        it('принимает пустой объект (все поля опциональны)', () => {
            const result = GraphNodeErrorHandling.safeParse({})
            expect(result.success).toBe(true)
        })

        it('принимает continueOnFailure=true', () => {
            const result = GraphNodeErrorHandling.safeParse({ continueOnFailure: true })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.continueOnFailure).toBe(true)
            }
        })

        it('принимает оба поля', () => {
            const result = GraphNodeErrorHandling.safeParse({
                continueOnFailure: false,
                retryOnFailure: true,
            })
            expect(result.success).toBe(true)
        })

        it('отклоняет строковое значение continueOnFailure', () => {
            const result = GraphNodeErrorHandling.safeParse({ continueOnFailure: 'yes' })
            expect(result.success).toBe(false)
        })
    })

    // === GraphNodeType ===
    describe('GraphNodeType', () => {
        it.each(['trigger', 'action', 'loop', 'router'])('принимает тип "%s"', (type) => {
            const result = GraphNodeType.safeParse(type)
            expect(result.success).toBe(true)
        })

        it('отклоняет неизвестный тип', () => {
            const result = GraphNodeType.safeParse('unknown')
            expect(result.success).toBe(false)
        })

        it('отклоняет пустую строку', () => {
            const result = GraphNodeType.safeParse('')
            expect(result.success).toBe(false)
        })
    })

    // === GraphNodeDefinition ===
    describe('GraphNodeDefinition', () => {
        it('принимает минимальную валидную ноду (только обязательные поля)', () => {
            const result = GraphNodeDefinition.safeParse(validNode)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.id).toBe('trigger')
                expect(result.data.type).toBe('trigger')
                expect(result.data.position.x).toBe(100)
                expect(result.data.position.y).toBe(200)
                expect(result.data.displayName).toBe('Manual Trigger')
                expect(result.data.valid).toBe(true)
                expect(result.data.actionType).toBe('PIECE_TRIGGER')
                expect(result.data.settings).toEqual({ pieceName: 'schedule' })
                expect(result.data.skip).toBeUndefined()
                expect(result.data.errorHandling).toBeUndefined()
                expect(result.data.sampleData).toBeUndefined()
            }
        })

        it('принимает полную ноду со всеми полями', () => {
            const result = GraphNodeDefinition.safeParse(validNodeFull)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.skip).toBe(false)
                expect(result.data.errorHandling?.continueOnFailure).toBe(true)
                expect(result.data.errorHandling?.retryOnFailure).toBe(false)
                expect(result.data.sampleData).toEqual({ result: 42 })
            }
        })

        it('принимает все 4 типа нод', () => {
            for (const type of ['trigger', 'action', 'loop', 'router']) {
                const result = GraphNodeDefinition.safeParse({ ...validNode, type })
                expect(result.success).toBe(true)
            }
        })

        it('отклоняет ноду без id', () => {
            const { id: _id, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без type', () => {
            const { type: _type, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без position', () => {
            const { position: _pos, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без displayName', () => {
            const { displayName: _dn, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без valid', () => {
            const { valid: _v, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без actionType', () => {
            const { actionType: _at, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ноду без settings', () => {
            const { settings: _s, ...rest } = validNode as Record<string, unknown>
            const result = GraphNodeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет невалидный тип ноды', () => {
            const result = GraphNodeDefinition.safeParse({
                ...validNode,
                type: 'invalid_type',
            })
            expect(result.success).toBe(false)
        })

        it('отклоняет невалидную позицию', () => {
            const result = GraphNodeDefinition.safeParse({
                ...validNode,
                position: { x: 'not_a_number', y: 200 },
            })
            expect(result.success).toBe(false)
        })
    })

    // === GraphEdgeDefinition ===
    describe('GraphEdgeDefinition', () => {
        it('принимает валидное ребро', () => {
            const result = GraphEdgeDefinition.safeParse(validEdge)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.id).toBe('trigger-output-step_1')
                expect(result.data.source).toBe('trigger')
                expect(result.data.target).toBe('step_1')
                expect(result.data.sourceHandle).toBe('output')
                expect(result.data.targetHandle).toBe('input')
            }
        })

        it('принимает ребро с loop-output handle', () => {
            const result = GraphEdgeDefinition.safeParse({
                id: 'loop_1-loop-output-step_2',
                source: 'loop_1',
                target: 'step_2',
                sourceHandle: 'loop-output',
                targetHandle: 'input',
            })
            expect(result.success).toBe(true)
        })

        it('принимает ребро с branch-N handle', () => {
            const result = GraphEdgeDefinition.safeParse({
                id: 'router_1-branch-0-step_3',
                source: 'router_1',
                target: 'step_3',
                sourceHandle: 'branch-0',
                targetHandle: 'input',
            })
            expect(result.success).toBe(true)
        })

        it('отклоняет ребро без id', () => {
            const { id: _id, ...rest } = validEdge as Record<string, unknown>
            const result = GraphEdgeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ребро без source', () => {
            const { source: _s, ...rest } = validEdge as Record<string, unknown>
            const result = GraphEdgeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ребро без target', () => {
            const { target: _t, ...rest } = validEdge as Record<string, unknown>
            const result = GraphEdgeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ребро без sourceHandle', () => {
            const { sourceHandle: _sh, ...rest } = validEdge as Record<string, unknown>
            const result = GraphEdgeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет ребро без targetHandle', () => {
            const { targetHandle: _th, ...rest } = validEdge as Record<string, unknown>
            const result = GraphEdgeDefinition.safeParse(rest)
            expect(result.success).toBe(false)
        })

        it('отклоняет числовой id', () => {
            const result = GraphEdgeDefinition.safeParse({ ...validEdge, id: 123 })
            expect(result.success).toBe(false)
        })
    })

    // === GraphData ===
    describe('GraphData', () => {
        it('принимает валидный граф с нодами и рёбрами', () => {
            const graphData = {
                nodes: [validNode, validNodeFull],
                edges: [validEdge],
            }
            const result = GraphData.safeParse(graphData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.nodes).toHaveLength(2)
                expect(result.data.edges).toHaveLength(1)
            }
        })

        it('принимает пустой граф (0 нод, 0 рёбер)', () => {
            const result = GraphData.safeParse({ nodes: [], edges: [] })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.nodes).toHaveLength(0)
                expect(result.data.edges).toHaveLength(0)
            }
        })

        it('принимает граф с нодами без рёбер (orphan-ноды)', () => {
            const result = GraphData.safeParse({
                nodes: [validNode],
                edges: [],
            })
            expect(result.success).toBe(true)
        })

        it('отклоняет граф без поля nodes', () => {
            const result = GraphData.safeParse({ edges: [] })
            expect(result.success).toBe(false)
        })

        it('отклоняет граф без поля edges', () => {
            const result = GraphData.safeParse({ nodes: [] })
            expect(result.success).toBe(false)
        })

        it('отклоняет граф с невалидной нодой внутри nodes', () => {
            const result = GraphData.safeParse({
                nodes: [{ id: 'broken' }],
                edges: [],
            })
            expect(result.success).toBe(false)
        })

        it('отклоняет граф с невалидным ребром внутри edges', () => {
            const result = GraphData.safeParse({
                nodes: [validNode],
                edges: [{ id: 'broken' }],
            })
            expect(result.success).toBe(false)
        })

        it('принимает сложный граф (trigger -> loop -> code, с loop-output)', () => {
            const complexGraph = {
                nodes: [
                    {
                        id: 'trigger',
                        type: 'trigger',
                        position: { x: 0, y: 0 },
                        displayName: 'Manual Trigger',
                        valid: true,
                        actionType: 'EMPTY_TRIGGER',
                        settings: {},
                    },
                    {
                        id: 'loop_1',
                        type: 'loop',
                        position: { x: 0, y: 200 },
                        displayName: 'Loop',
                        valid: true,
                        actionType: 'LOOP_ON_ITEMS',
                        settings: { items: '{{trigger.output}}' },
                    },
                    {
                        id: 'step_1',
                        type: 'action',
                        position: { x: 200, y: 200 },
                        displayName: 'Code',
                        valid: true,
                        actionType: 'CODE',
                        settings: { sourceCode: { code: 'return 1' } },
                    },
                ],
                edges: [
                    {
                        id: 'trigger-output-loop_1',
                        source: 'trigger',
                        target: 'loop_1',
                        sourceHandle: 'output',
                        targetHandle: 'input',
                    },
                    {
                        id: 'loop_1-loop-output-step_1',
                        source: 'loop_1',
                        target: 'step_1',
                        sourceHandle: 'loop-output',
                        targetHandle: 'input',
                    },
                ],
            }
            const result = GraphData.safeParse(complexGraph)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.nodes).toHaveLength(3)
                expect(result.data.edges).toHaveLength(2)
            }
        })
    })
})
