import { describe, it, expect } from 'vitest'
import { FlowActionType, GraphData, GraphNodeDefinition } from '../../src'
import {
    extractNodeFromGraphData,
    createStepTestGraphData,
    createStepTestRequest,
    isNodeTestable,
    getTestableNodes,
} from '../../src/lib/automation/flows/util/step-test-utils'

// === Тестовые фикстуры ===

const triggerNode: GraphNodeDefinition = {
    id: 'trigger',
    type: 'trigger',
    position: { x: 0, y: 0 },
    displayName: 'Webhook Trigger',
    valid: true,
    actionType: 'PIECE',
    settings: {
        pieceName: 'webhook',
        pieceVersion: '1.0.0',
        triggerName: 'catch',
        input: {},
    },
}

const codeNode: GraphNodeDefinition = {
    id: 'step_1',
    type: 'action',
    position: { x: 100, y: 200 },
    displayName: 'Transform Data',
    valid: true,
    actionType: FlowActionType.CODE,
    settings: {
        input: { key: '{{ trigger.body.name }}' },
        sourceCode: { packageJson: '{}', code: 'return { key: inputs.key }' },
    },
}

const pieceNode: GraphNodeDefinition = {
    id: 'step_2',
    type: 'action',
    position: { x: 100, y: 400 },
    displayName: 'Send HTTP Request',
    valid: true,
    actionType: FlowActionType.PIECE,
    settings: {
        pieceName: '@activepieces/piece-http',
        pieceVersion: '1.0.0',
        actionName: 'send_request',
        input: { url: 'https://example.com', method: 'GET' },
    },
}

const loopNode: GraphNodeDefinition = {
    id: 'loop_1',
    type: 'loop',
    position: { x: 100, y: 300 },
    displayName: 'Loop Items',
    valid: true,
    actionType: FlowActionType.LOOP_ON_ITEMS,
    settings: { items: '{{ [1,2,3] }}' },
}

const routerNode: GraphNodeDefinition = {
    id: 'router_1',
    type: 'router',
    position: { x: 100, y: 300 },
    displayName: 'Router',
    valid: true,
    actionType: FlowActionType.ROUTER,
    settings: {
        branches: [
            { conditions: [], branchType: 'CONDITION', branchName: 'Branch 1' },
        ],
        executionType: 'EXECUTE_FIRST_MATCH',
    },
}

const skippedNode: GraphNodeDefinition = {
    id: 'step_skip',
    type: 'action',
    position: { x: 100, y: 500 },
    displayName: 'Skipped Step',
    valid: true,
    skip: true,
    actionType: FlowActionType.CODE,
    settings: {
        input: { key: 'value' },
        sourceCode: { packageJson: '{}', code: 'return {}' },
    },
}

const sampleGraphData: GraphData = {
    nodes: [triggerNode, codeNode, pieceNode, loopNode, routerNode, skippedNode],
    edges: [
        { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e3', source: 'step_2', target: 'loop_1', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e4', source: 'loop_1', target: 'router_1', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e5', source: 'router_1', target: 'step_skip', sourceHandle: 'output', targetHandle: 'input' },
    ],
}

// === Тесты ===

describe('step-test-utils', () => {

    describe('extractNodeFromGraphData', () => {
        it('должен найти существующую ноду по ID', () => {
            const result = extractNodeFromGraphData(sampleGraphData, 'step_1')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.node.id).toBe('step_1')
                expect(result.node.displayName).toBe('Transform Data')
                expect(result.node.actionType).toBe(FlowActionType.CODE)
            }
        })

        it('должен найти trigger-ноду', () => {
            const result = extractNodeFromGraphData(sampleGraphData, 'trigger')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.node.id).toBe('trigger')
                expect(result.node.type).toBe('trigger')
            }
        })

        it('должен найти PIECE-ноду', () => {
            const result = extractNodeFromGraphData(sampleGraphData, 'step_2')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.node.id).toBe('step_2')
                expect(result.node.actionType).toBe(FlowActionType.PIECE)
            }
        })

        it('должен вернуть ошибку для несуществующей ноды', () => {
            const result = extractNodeFromGraphData(sampleGraphData, 'nonexistent')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('nonexistent')
                expect(result.error).toContain('not found')
            }
        })

        it('должен перечислить доступные ноды в сообщении об ошибке', () => {
            const result = extractNodeFromGraphData(sampleGraphData, 'missing_id')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('trigger')
                expect(result.error).toContain('step_1')
                expect(result.error).toContain('step_2')
            }
        })

        it('должен работать с пустым графом', () => {
            const emptyGraph: GraphData = { nodes: [], edges: [] }
            const result = extractNodeFromGraphData(emptyGraph, 'step_1')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('not found')
            }
        })
    })

    describe('createStepTestGraphData', () => {
        it('должен создать минимальный граф с trigger + одной action нодой', () => {
            const graphData = createStepTestGraphData(codeNode)

            expect(graphData.nodes).toHaveLength(2)
            expect(graphData.edges).toHaveLength(1)
        })

        it('должен содержать trigger-ноду с ID __step_test_trigger__', () => {
            const graphData = createStepTestGraphData(codeNode)
            const trigger = graphData.nodes.find(n => n.type === 'trigger')

            expect(trigger).toBeDefined()
            expect(trigger!.id).toBe('__step_test_trigger__')
            expect(trigger!.actionType).toBe('EMPTY')
            expect(trigger!.displayName).toBe('Step Test Trigger')
        })

        it('должен содержать тестируемую ноду с оригинальным ID', () => {
            const graphData = createStepTestGraphData(codeNode)
            const testNode = graphData.nodes.find(n => n.id === 'step_1')

            expect(testNode).toBeDefined()
            expect(testNode!.displayName).toBe('Transform Data')
            expect(testNode!.actionType).toBe(FlowActionType.CODE)
        })

        it('должен создать ребро от trigger к тестируемой ноде', () => {
            const graphData = createStepTestGraphData(codeNode)
            const edge = graphData.edges[0]

            expect(edge.source).toBe('__step_test_trigger__')
            expect(edge.target).toBe('step_1')
            expect(edge.sourceHandle).toBe('output')
            expect(edge.targetHandle).toBe('input')
        })

        it('должен сбросить skip=false для тестируемой ноды', () => {
            const graphData = createStepTestGraphData(skippedNode)
            const testNode = graphData.nodes.find(n => n.id === 'step_skip')

            expect(testNode).toBeDefined()
            expect(testNode!.skip).toBe(false)
        })

        it('должен подставить mockInput в settings.input', () => {
            const mockInput = { url: 'https://mock.example.com', method: 'POST' }
            const graphData = createStepTestGraphData(pieceNode, mockInput)
            const testNode = graphData.nodes.find(n => n.id === 'step_2')

            expect(testNode).toBeDefined()
            expect(testNode!.settings.input).toEqual(mockInput)
            // Остальные settings должны сохраниться
            expect(testNode!.settings.pieceName).toBe('@activepieces/piece-http')
        })

        it('должен сохранить оригинальные settings без mockInput', () => {
            const graphData = createStepTestGraphData(codeNode)
            const testNode = graphData.nodes.find(n => n.id === 'step_1')

            expect(testNode).toBeDefined()
            expect(testNode!.settings.input).toEqual({ key: '{{ trigger.body.name }}' })
            expect(testNode!.settings.sourceCode).toEqual({ packageJson: '{}', code: 'return { key: inputs.key }' })
        })

        it('должен не мутировать оригинальную ноду', () => {
            const originalSettings = { ...codeNode.settings }
            const mockInput = { key: 'mocked_value' }
            createStepTestGraphData(codeNode, mockInput)

            // Оригинальная нода не изменилась
            expect(codeNode.settings).toEqual(originalSettings)
        })

        it('должен корректно работать с PIECE нодой', () => {
            const graphData = createStepTestGraphData(pieceNode)

            expect(graphData.nodes).toHaveLength(2)
            const testNode = graphData.nodes.find(n => n.id === 'step_2')
            expect(testNode!.actionType).toBe(FlowActionType.PIECE)
        })
    })

    describe('createStepTestRequest', () => {
        it('должен создать request с корректными полями', () => {
            const request = createStepTestRequest({
                nodeId: 'step_1',
                flowVersionId: 'fv-123',
                projectId: 'proj-456',
            })

            expect(request.stepName).toBe('step_1')
            expect(request.flowVersionId).toBe('fv-123')
            expect(request.projectId).toBe('proj-456')
        })

        it('должен использовать nodeId как stepName', () => {
            const request = createStepTestRequest({
                nodeId: 'custom_action_42',
                flowVersionId: 'fv-abc',
                projectId: 'proj-def',
            })

            expect(request.stepName).toBe('custom_action_42')
        })

        it('должен быть совместим с CreateStepRunRequestBody', () => {
            const request = createStepTestRequest({
                nodeId: 'step_1',
                flowVersionId: 'fv-123',
                projectId: 'proj-456',
            })

            // Проверяем что все обязательные поля CreateStepRunRequestBody присутствуют
            expect(request).toHaveProperty('projectId')
            expect(request).toHaveProperty('flowVersionId')
            expect(request).toHaveProperty('stepName')
            expect(typeof request.projectId).toBe('string')
            expect(typeof request.flowVersionId).toBe('string')
            expect(typeof request.stepName).toBe('string')
        })
    })

    describe('isNodeTestable', () => {
        it('должен вернуть true для CODE ноды', () => {
            expect(isNodeTestable(codeNode)).toBe(true)
        })

        it('должен вернуть true для PIECE ноды', () => {
            expect(isNodeTestable(pieceNode)).toBe(true)
        })

        it('должен вернуть false для trigger ноды', () => {
            expect(isNodeTestable(triggerNode)).toBe(false)
        })

        it('должен вернуть false для LOOP_ON_ITEMS ноды', () => {
            expect(isNodeTestable(loopNode)).toBe(false)
        })

        it('должен вернуть false для ROUTER ноды', () => {
            expect(isNodeTestable(routerNode)).toBe(false)
        })

        it('должен вернуть true для skip=true ноды (skip не влияет на testability)', () => {
            expect(isNodeTestable(skippedNode)).toBe(true)
        })
    })

    describe('getTestableNodes', () => {
        it('должен вернуть только CODE и PIECE ноды', () => {
            const testable = getTestableNodes(sampleGraphData)

            expect(testable).toHaveLength(3) // step_1 (CODE), step_2 (PIECE), step_skip (CODE)
            const ids = testable.map(n => n.id)
            expect(ids).toContain('step_1')
            expect(ids).toContain('step_2')
            expect(ids).toContain('step_skip')
        })

        it('должен исключить trigger, loop, router', () => {
            const testable = getTestableNodes(sampleGraphData)
            const ids = testable.map(n => n.id)

            expect(ids).not.toContain('trigger')
            expect(ids).not.toContain('loop_1')
            expect(ids).not.toContain('router_1')
        })

        it('должен вернуть пустой массив для графа без action нод', () => {
            const triggerOnly: GraphData = {
                nodes: [triggerNode],
                edges: [],
            }
            const testable = getTestableNodes(triggerOnly)

            expect(testable).toHaveLength(0)
        })

        it('должен вернуть пустой массив для пустого графа', () => {
            const emptyGraph: GraphData = { nodes: [], edges: [] }
            const testable = getTestableNodes(emptyGraph)

            expect(testable).toHaveLength(0)
        })
    })

    describe('интеграция: extractNode -> createStepTestGraphData', () => {
        it('должен создать тестовый граф из извлечённой ноды', () => {
            const extractResult = extractNodeFromGraphData(sampleGraphData, 'step_1')
            expect(extractResult.success).toBe(true)

            if (extractResult.success) {
                const testGraphData = createStepTestGraphData(extractResult.node)

                expect(testGraphData.nodes).toHaveLength(2)
                expect(testGraphData.edges).toHaveLength(1)

                const trigger = testGraphData.nodes.find(n => n.type === 'trigger')
                const action = testGraphData.nodes.find(n => n.id === 'step_1')

                expect(trigger).toBeDefined()
                expect(action).toBeDefined()
                expect(action!.actionType).toBe(FlowActionType.CODE)
            }
        })

        it('должен создать тестовый граф с mock input из извлечённой ноды', () => {
            const extractResult = extractNodeFromGraphData(sampleGraphData, 'step_2')
            expect(extractResult.success).toBe(true)

            if (extractResult.success) {
                const mockInput = { url: 'https://test.local', method: 'PUT' }
                const testGraphData = createStepTestGraphData(extractResult.node, mockInput)

                const action = testGraphData.nodes.find(n => n.id === 'step_2')
                expect(action).toBeDefined()
                expect(action!.settings.input).toEqual(mockInput)
            }
        })
    })
})
