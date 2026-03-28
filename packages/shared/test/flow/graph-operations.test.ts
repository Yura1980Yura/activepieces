import {
    _graphAddNode,
    _graphRemoveNode,
    _graphAddEdge,
    _graphRemoveEdge,
    _graphMoveNode,
} from '../../src/lib/automation/flows/operations/graph-operations'
import { FlowVersion, FlowVersionState } from '../../src/lib/automation/flows/flow-version'
import { GraphNodeDefinition, GraphEdgeDefinition, GraphData } from '../../src/lib/automation/flows/graph-data'

// === Фабрика FlowVersion для тестов ===

function createBaseFlowVersion(graphData?: GraphData): FlowVersion {
    return {
        id: 'version-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        flowId: 'flow-1',
        displayName: 'Test Flow',
        trigger: {
            type: 'EMPTY' as any,
            name: 'trigger',
            displayName: 'Empty Trigger',
            valid: false,
            settings: {},
            nextAction: undefined,
        },
        graphData,
        updatedBy: null,
        valid: true,
        schemaVersion: '20',
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
    } as unknown as FlowVersion
}

function makeNode(overrides: Partial<GraphNodeDefinition> & { id: string }): GraphNodeDefinition {
    return {
        type: 'action',
        position: { x: 0, y: 0 },
        displayName: `Node ${overrides.id}`,
        valid: true,
        actionType: 'CODE',
        settings: {},
        ...overrides,
    } as GraphNodeDefinition
}

function makeEdge(overrides: Partial<GraphEdgeDefinition> & { id: string; source: string; target: string }): GraphEdgeDefinition {
    return {
        sourceHandle: 'output',
        targetHandle: 'input',
        ...overrides,
    } as GraphEdgeDefinition
}

// === Тестовые данные ===

const triggerNode = makeNode({
    id: 'trigger',
    type: 'trigger' as any,
    position: { x: 100, y: 50 },
    displayName: 'Manual Trigger',
    actionType: 'PIECE_TRIGGER',
    settings: { pieceName: 'schedule' },
})

const codeNode = makeNode({
    id: 'step_1',
    position: { x: 100, y: 250 },
    displayName: 'Code Node',
    actionType: 'CODE',
    settings: { sourceCode: { code: 'return 1' } },
})

const httpNode = makeNode({
    id: 'step_2',
    position: { x: 300, y: 250 },
    displayName: 'HTTP Request',
    actionType: 'PIECE',
    settings: { pieceName: 'http' },
})

const edgeTriggerToCode = makeEdge({
    id: 'trigger-output-step_1',
    source: 'trigger',
    target: 'step_1',
})

const edgeCodeToHttp = makeEdge({
    id: 'step_1-output-step_2',
    source: 'step_1',
    target: 'step_2',
})

describe('graph-operations', () => {

    // ========================
    // GRAPH_ADD_NODE
    // ========================
    describe('GRAPH_ADD_NODE', () => {
        it('добавляет ноду в пустой graphData', () => {
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const result = _graphAddNode(version, { node: codeNode })
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.nodes[0].id).toBe('step_1')
            expect(result.graphData!.nodes[0].displayName).toBe('Code Node')
        })

        it('добавляет вторую ноду к существующим', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            const result = _graphAddNode(version, { node: codeNode })
            expect(result.graphData!.nodes).toHaveLength(2)
            expect(result.graphData!.nodes[0].id).toBe('trigger')
            expect(result.graphData!.nodes[1].id).toBe('step_1')
        })

        it('создаёт graphData если оно отсутствует (undefined)', () => {
            const version = createBaseFlowVersion(undefined)
            const result = _graphAddNode(version, { node: triggerNode })
            expect(result.graphData).toBeDefined()
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('бросает ошибку при дублировании id ноды', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            expect(() => _graphAddNode(version, { node: triggerNode }))
                .toThrow('Нода с id="trigger" уже существует')
        })

        it('не мутирует исходный FlowVersion', () => {
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const result = _graphAddNode(version, { node: codeNode })
            expect(version.graphData!.nodes).toHaveLength(0)
            expect(result.graphData!.nodes).toHaveLength(1)
        })

        it('глубоко клонирует добавляемую ноду', () => {
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const mutableNode = makeNode({ id: 'mutable', settings: { key: 'value' } })
            const result = _graphAddNode(version, { node: mutableNode })
            mutableNode.settings.key = 'changed'
            expect((result.graphData!.nodes[0].settings as any).key).toBe('value')
        })
    })

    // ========================
    // GRAPH_REMOVE_NODE
    // ========================
    describe('GRAPH_REMOVE_NODE', () => {
        it('удаляет ноду по id', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [],
            })
            const result = _graphRemoveNode(version, { nodeId: 'step_1' })
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.nodes[0].id).toBe('trigger')
        })

        it('удаляет все рёбра, связанные с удалённой нодой (source)', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode, httpNode],
                edges: [edgeTriggerToCode, edgeCodeToHttp],
            })
            const result = _graphRemoveNode(version, { nodeId: 'step_1' })
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('удаляет все рёбра, связанные с удалённой нодой (target)', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = _graphRemoveNode(version, { nodeId: 'step_1' })
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('сохраняет рёбра, не связанные с удалённой нодой', () => {
            const thirdEdge = makeEdge({
                id: 'trigger-output-step_2',
                source: 'trigger',
                target: 'step_2',
            })
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode, httpNode],
                edges: [edgeTriggerToCode, thirdEdge],
            })
            const result = _graphRemoveNode(version, { nodeId: 'step_1' })
            expect(result.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.edges[0].id).toBe('trigger-output-step_2')
        })

        it('бросает ошибку если graphData отсутствует', () => {
            const version = createBaseFlowVersion(undefined)
            expect(() => _graphRemoveNode(version, { nodeId: 'step_1' }))
                .toThrow('graphData отсутствует')
        })

        it('бросает ошибку если нода не найдена', () => {
            const version = createBaseFlowVersion({ nodes: [triggerNode], edges: [] })
            expect(() => _graphRemoveNode(version, { nodeId: 'nonexistent' }))
                .toThrow('Нода с id="nonexistent" не найдена')
        })

        it('не мутирует исходный FlowVersion', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = _graphRemoveNode(version, { nodeId: 'step_1' })
            expect(version.graphData!.nodes).toHaveLength(2)
            expect(version.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.edges).toHaveLength(0)
        })
    })

    // ========================
    // GRAPH_ADD_EDGE
    // ========================
    describe('GRAPH_ADD_EDGE', () => {
        it('добавляет ребро в пустой edges[]', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [],
            })
            const result = _graphAddEdge(version, { edge: edgeTriggerToCode })
            expect(result.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.edges[0].id).toBe('trigger-output-step_1')
            expect(result.graphData!.edges[0].source).toBe('trigger')
            expect(result.graphData!.edges[0].target).toBe('step_1')
        })

        it('добавляет второе ребро к существующим', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode, httpNode],
                edges: [edgeTriggerToCode],
            })
            const result = _graphAddEdge(version, { edge: edgeCodeToHttp })
            expect(result.graphData!.edges).toHaveLength(2)
        })

        it('создаёт graphData если оно отсутствует (undefined)', () => {
            const version = createBaseFlowVersion(undefined)
            const result = _graphAddEdge(version, { edge: edgeTriggerToCode })
            expect(result.graphData).toBeDefined()
            expect(result.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.nodes).toHaveLength(0)
        })

        it('бросает ошибку при дублировании id ребра', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            expect(() => _graphAddEdge(version, { edge: edgeTriggerToCode }))
                .toThrow('Ребро с id="trigger-output-step_1" уже существует')
        })

        it('не мутирует исходный FlowVersion', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [],
            })
            const result = _graphAddEdge(version, { edge: edgeTriggerToCode })
            expect(version.graphData!.edges).toHaveLength(0)
            expect(result.graphData!.edges).toHaveLength(1)
        })

        it('поддерживает loop-output handle', () => {
            const loopEdge = makeEdge({
                id: 'loop_1-loop-output-step_1',
                source: 'loop_1',
                target: 'step_1',
                sourceHandle: 'loop-output',
            })
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const result = _graphAddEdge(version, { edge: loopEdge })
            expect(result.graphData!.edges[0].sourceHandle).toBe('loop-output')
        })

        it('поддерживает branch-N handle', () => {
            const branchEdge = makeEdge({
                id: 'router_1-branch-0-step_1',
                source: 'router_1',
                target: 'step_1',
                sourceHandle: 'branch-0',
            })
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const result = _graphAddEdge(version, { edge: branchEdge })
            expect(result.graphData!.edges[0].sourceHandle).toBe('branch-0')
        })
    })

    // ========================
    // GRAPH_REMOVE_EDGE
    // ========================
    describe('GRAPH_REMOVE_EDGE', () => {
        it('удаляет ребро по id', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = _graphRemoveEdge(version, { edgeId: 'trigger-output-step_1' })
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('сохраняет остальные рёбра', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode, httpNode],
                edges: [edgeTriggerToCode, edgeCodeToHttp],
            })
            const result = _graphRemoveEdge(version, { edgeId: 'trigger-output-step_1' })
            expect(result.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.edges[0].id).toBe('step_1-output-step_2')
        })

        it('бросает ошибку если graphData отсутствует', () => {
            const version = createBaseFlowVersion(undefined)
            expect(() => _graphRemoveEdge(version, { edgeId: 'some-edge' }))
                .toThrow('graphData отсутствует')
        })

        it('бросает ошибку если ребро не найдено', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [edgeTriggerToCode],
            })
            expect(() => _graphRemoveEdge(version, { edgeId: 'nonexistent' }))
                .toThrow('Ребро с id="nonexistent" не найдено')
        })

        it('не мутирует исходный FlowVersion', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = _graphRemoveEdge(version, { edgeId: 'trigger-output-step_1' })
            expect(version.graphData!.edges).toHaveLength(1)
            expect(result.graphData!.edges).toHaveLength(0)
        })
    })

    // ========================
    // GRAPH_MOVE_NODE
    // ========================
    describe('GRAPH_MOVE_NODE', () => {
        it('обновляет позицию ноды', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            const result = _graphMoveNode(version, {
                nodeId: 'trigger',
                position: { x: 500, y: 600 },
            })
            expect(result.graphData!.nodes[0].position.x).toBe(500)
            expect(result.graphData!.nodes[0].position.y).toBe(600)
        })

        it('обновляет позицию конкретной ноды, не затрагивая остальные', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [],
            })
            const result = _graphMoveNode(version, {
                nodeId: 'step_1',
                position: { x: 999, y: 888 },
            })
            expect(result.graphData!.nodes[0].position.x).toBe(100) // trigger не изменился
            expect(result.graphData!.nodes[0].position.y).toBe(50)
            expect(result.graphData!.nodes[1].position.x).toBe(999)
            expect(result.graphData!.nodes[1].position.y).toBe(888)
        })

        it('поддерживает отрицательные координаты', () => {
            const version = createBaseFlowVersion({
                nodes: [codeNode],
                edges: [],
            })
            const result = _graphMoveNode(version, {
                nodeId: 'step_1',
                position: { x: -100, y: -200 },
            })
            expect(result.graphData!.nodes[0].position.x).toBe(-100)
            expect(result.graphData!.nodes[0].position.y).toBe(-200)
        })

        it('поддерживает дробные координаты', () => {
            const version = createBaseFlowVersion({
                nodes: [codeNode],
                edges: [],
            })
            const result = _graphMoveNode(version, {
                nodeId: 'step_1',
                position: { x: 10.5, y: 20.7 },
            })
            expect(result.graphData!.nodes[0].position.x).toBe(10.5)
            expect(result.graphData!.nodes[0].position.y).toBe(20.7)
        })

        it('бросает ошибку если graphData отсутствует', () => {
            const version = createBaseFlowVersion(undefined)
            expect(() => _graphMoveNode(version, {
                nodeId: 'step_1',
                position: { x: 0, y: 0 },
            }))
                .toThrow('graphData отсутствует')
        })

        it('бросает ошибку если нода не найдена', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            expect(() => _graphMoveNode(version, {
                nodeId: 'nonexistent',
                position: { x: 0, y: 0 },
            }))
                .toThrow('Нода с id="nonexistent" не найдена')
        })

        it('не мутирует исходный FlowVersion', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            const result = _graphMoveNode(version, {
                nodeId: 'trigger',
                position: { x: 999, y: 888 },
            })
            expect(version.graphData!.nodes[0].position.x).toBe(100)
            expect(version.graphData!.nodes[0].position.y).toBe(50)
            expect(result.graphData!.nodes[0].position.x).toBe(999)
            expect(result.graphData!.nodes[0].position.y).toBe(888)
        })
    })

    // ========================
    // Интеграция через flowOperations.apply()
    // ========================
    describe('интеграция через flowOperations.apply()', () => {
        // Импортируем flowOperations и FlowOperationType
        let flowOperations: typeof import('../../src/lib/automation/flows/operations')['flowOperations']
        let FlowOperationType: typeof import('../../src/lib/automation/flows/operations')['FlowOperationType']

        beforeAll(async () => {
            const mod = await import('../../src/lib/automation/flows/operations')
            flowOperations = mod.flowOperations
            FlowOperationType = mod.FlowOperationType
        })

        it('GRAPH_ADD_NODE через apply()', () => {
            const version = createBaseFlowVersion({ nodes: [], edges: [] })
            const result = flowOperations.apply(version, {
                type: FlowOperationType.GRAPH_ADD_NODE,
                request: { node: codeNode },
            })
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.nodes[0].id).toBe('step_1')
        })

        it('GRAPH_REMOVE_NODE через apply()', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = flowOperations.apply(version, {
                type: FlowOperationType.GRAPH_REMOVE_NODE,
                request: { nodeId: 'step_1' },
            })
            expect(result.graphData!.nodes).toHaveLength(1)
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('GRAPH_ADD_EDGE через apply()', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [],
            })
            const result = flowOperations.apply(version, {
                type: FlowOperationType.GRAPH_ADD_EDGE,
                request: { edge: edgeTriggerToCode },
            })
            expect(result.graphData!.edges).toHaveLength(1)
        })

        it('GRAPH_REMOVE_EDGE через apply()', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode, codeNode],
                edges: [edgeTriggerToCode],
            })
            const result = flowOperations.apply(version, {
                type: FlowOperationType.GRAPH_REMOVE_EDGE,
                request: { edgeId: 'trigger-output-step_1' },
            })
            expect(result.graphData!.edges).toHaveLength(0)
        })

        it('GRAPH_MOVE_NODE через apply()', () => {
            const version = createBaseFlowVersion({
                nodes: [triggerNode],
                edges: [],
            })
            const result = flowOperations.apply(version, {
                type: FlowOperationType.GRAPH_MOVE_NODE,
                request: { nodeId: 'trigger', position: { x: 777, y: 888 } },
            })
            expect(result.graphData!.nodes[0].position.x).toBe(777)
            expect(result.graphData!.nodes[0].position.y).toBe(888)
        })
    })
})
