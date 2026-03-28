import { ExecutionType, FlowActionType, FlowRunStatus, FlowVersionState, GraphData, ProgressUpdateType, RunEnvironment } from '@activepieces/shared'
import { vi } from 'vitest'
import { FlowExecutorContext } from '../../src/lib/handler/context/flow-execution-context'
import { graphFlowExecutor } from '../../src/lib/handler/graph-flow-executor'
import { flowExecutor } from '../../src/lib/handler/flow-executor'
import { triggerHelper } from '../../src/lib/helper/trigger-helper'
import { generateMockEngineConstants } from './test-helper'

/**
 * Тесты для graph-flow-executor.
 * Проверяют обход графа по edges, пропуск нод, ошибки,
 * маршрутизацию из flow-executor, и запрещённые типы (LOOP/ROUTER).
 */

// Вспомогательная функция: создать GraphData с trigger + линейной цепочкой CODE-нод
function buildLinearGraphData(codeSteps: { name: string, input: Record<string, unknown>, skip?: boolean }[]): GraphData {
    const triggerNode = {
        id: 'trigger',
        type: 'trigger' as const,
        position: { x: 0, y: 0 },
        displayName: 'Test Trigger',
        valid: true,
        actionType: 'PIECE',
        settings: {
            pieceName: 'webhook',
            pieceVersion: '1.0.0',
            triggerName: 'webhook_trigger',
            input: {},
            propertySettings: {},
        },
    }

    const actionNodes = codeSteps.map((step, index) => ({
        id: step.name,
        type: 'action' as const,
        position: { x: 0, y: (index + 1) * 100 },
        displayName: `Action ${step.name}`,
        valid: true,
        skip: step.skip,
        actionType: FlowActionType.CODE,
        settings: {
            input: step.input,
            sourceCode: { packageJson: '', code: '' },
        },
    }))

    const nodes = [triggerNode, ...actionNodes]

    // Рёбра: trigger -> step[0] -> step[1] -> ...
    const edges = []
    edges.push({
        id: `trigger-output-${codeSteps[0]?.name ?? 'none'}`,
        source: 'trigger',
        target: codeSteps[0]?.name ?? '',
        sourceHandle: 'output',
        targetHandle: 'input',
    })

    for (let i = 0; i < codeSteps.length - 1; i++) {
        edges.push({
            id: `${codeSteps[i].name}-output-${codeSteps[i + 1].name}`,
            source: codeSteps[i].name,
            target: codeSteps[i + 1].name,
            sourceHandle: 'output',
            targetHandle: 'input',
        })
    }

    return { nodes, edges }
}

// Вспомогательная функция: создать mock ExecuteFlowOperation с graphData
function buildGraphFlowInput(graphData: GraphData) {
    return {
        projectId: 'projectId',
        engineToken: 'engineToken',
        internalApiUrl: 'http://127.0.0.1:3000/',
        publicApiUrl: 'http://127.0.0.1:4200/api/',
        timeoutInSeconds: 10,
        platformId: 'platformId',
        flowRunId: 'flowRunId',
        executionType: ExecutionType.BEGIN as const,
        runEnvironment: RunEnvironment.TESTING,
        executionState: { steps: {}, tags: [] },
        serverHandlerId: null,
        httpRequestId: null,
        progressUpdateType: ProgressUpdateType.NONE,
        stepNameToTest: null,
        triggerPayload: {},
        executeTrigger: false,
        flowVersion: {
            id: 'flowVersionId',
            flowId: 'flowId',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            displayName: 'Test Flow',
            valid: true,
            state: FlowVersionState.DRAFT,
            updatedBy: null,
            schemaVersion: '20',
            agentIds: [],
            connectionIds: [],
            backupFiles: null,
            notes: [],
            graphData,
            trigger: {
                name: 'trigger',
                type: 'PIECE_TRIGGER' as const,
                displayName: 'Test Trigger',
                valid: true,
                settings: {
                    pieceName: 'webhook',
                    pieceVersion: '1.0.0',
                    triggerName: 'catch',
                    input: {},
                    inputUiInfo: {},
                    propertySettings: {},
                },
            },
        },
    }
}

describe('graphFlowExecutor', () => {

    describe('executeGraph', () => {
        it('должен исполнить линейный граф с одной CODE нодой', async () => {
            const graphData = buildLinearGraphData([
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
            ])

            const { adjacency } = buildAdjacencyForTest(graphData)
            const firstActionId = 'echo_step'

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: firstActionId,
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.echo_step).toBeDefined()
            expect(result.steps.echo_step.output).toEqual({ key: 3 })
        })

        it('должен исполнить линейный граф с двумя CODE нодами последовательно', async () => {
            const graphData = buildLinearGraphData([
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
            ])

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'echo_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.echo_step.output).toEqual({ key: 3 })
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })

        it('должен пропустить ноду с skip=true', async () => {
            const graphData = buildLinearGraphData([
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' }, skip: true },
                { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
            ])

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'echo_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.echo_step).toBeUndefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })

        it('должен вернуть результат без шагов когда startNodeId = null', async () => {
            const graphData = buildLinearGraphData([
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
            ])

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: null,
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(Object.keys(result.steps)).toHaveLength(0)
        })

        it('должен обработать ошибку в CODE ноде и остановить исполнение', async () => {
            const graphData = buildLinearGraphData([
                { name: 'runtime', input: {} },
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
            ])

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'runtime',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
            expect(result.steps.runtime.status).toBe('FAILED')
            // Вторая нода не должна быть исполнена
            expect(result.steps.echo_step).toBeUndefined()
        })

        it('должен исполнить LOOP_ON_ITEMS ноду (базовая проверка wiring)', async () => {
            const graphData: GraphData = {
                nodes: [
                    {
                        id: 'trigger',
                        type: 'trigger',
                        position: { x: 0, y: 0 },
                        displayName: 'Trigger',
                        valid: true,
                        actionType: 'PIECE',
                        settings: {},
                    },
                    {
                        id: 'loop_step',
                        type: 'loop',
                        position: { x: 0, y: 100 },
                        displayName: 'Loop',
                        valid: true,
                        actionType: FlowActionType.LOOP_ON_ITEMS,
                        settings: { items: '{{ [1,2,3] }}' },
                    },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'loop_step', sourceHandle: 'output', targetHandle: 'input' },
                ],
            }

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            // Loop без тела (нет loop-output edge) — должен пройти 3 итерации без ошибок
            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.loop_step).toBeDefined()
            expect(result.steps.loop_step.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        })

        it('должен исполнить ROUTER ноду (базовая проверка wiring)', async () => {
            const graphData: GraphData = {
                nodes: [
                    {
                        id: 'trigger',
                        type: 'trigger',
                        position: { x: 0, y: 0 },
                        displayName: 'Trigger',
                        valid: true,
                        actionType: 'PIECE',
                        settings: {},
                    },
                    {
                        id: 'router_step',
                        type: 'router',
                        position: { x: 0, y: 100 },
                        displayName: 'Router',
                        valid: true,
                        actionType: FlowActionType.ROUTER,
                        settings: {
                            branches: [
                                {
                                    conditions: [[{ firstValue: 'a', secondValue: 'a', operator: 'TEXT_EXACTLY_MATCHES' }]],
                                    branchType: 'CONDITION',
                                    branchName: 'Branch 1',
                                },
                            ],
                            executionType: 'EXECUTE_FIRST_MATCH',
                        },
                    },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'router_step', sourceHandle: 'output', targetHandle: 'input' },
                ],
            }

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.router_step).toBeDefined()
            expect(result.steps.router_step.type).toBe(FlowActionType.ROUTER)
        })
    })

    describe('flow-executor роутинг', () => {
        it('должен делегировать graph executor когда flowVersion.graphData определён', async () => {
            // Мокаем triggerHelper.executeOnStart чтобы не загружать настоящие pieces
            const executeOnStartSpy = vi.spyOn(triggerHelper, 'executeOnStart').mockResolvedValue(undefined)

            const graphData = buildLinearGraphData([
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
            ])

            const input = buildGraphFlowInput(graphData)

            const result = await flowExecutor.executeFromTrigger({
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
                input: input as any,
            })

            // Graph executor должен был исполнить echo_step
            expect(result.steps.echo_step).toBeDefined()
            expect(result.steps.echo_step.output).toEqual({ key: 3 })

            // Проверяем что triggerHelper.executeOnStart был вызван
            expect(executeOnStartSpy).toHaveBeenCalledOnce()

            executeOnStartSpy.mockRestore()
        })
    })
})

// Вспомогательная функция: построить adjacency map для тестов
function buildAdjacencyForTest(graphData: GraphData) {
    const { buildAdjacencyMap } = require('@activepieces/shared')
    const adjacency = buildAdjacencyMap(graphData)
    return { adjacency }
}
