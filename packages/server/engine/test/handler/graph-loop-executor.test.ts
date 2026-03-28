import { FlowActionType, FlowRunStatus, GraphData, LoopStepOutput, StepOutputStatus } from '@activepieces/shared'
import { FlowExecutorContext } from '../../src/lib/handler/context/flow-execution-context'
import { graphFlowExecutor } from '../../src/lib/handler/graph-flow-executor'
import { generateMockEngineConstants } from './test-helper'

/**
 * Тесты для graph-loop-executor.
 * Проверяют исполнение LOOP_ON_ITEMS через edges графа:
 * - loop-body по edge с sourceHandle 'loop-output'
 * - итерации, path tracking, пустые items, не-массив items
 * - прерывание при ошибке внутри тела цикла
 * - цепочка: нода после loop (по edge 'output')
 */

/**
 * Построить GraphData с loop нодой.
 * trigger -> loop_step (LOOP_ON_ITEMS) -> afterLoop (CODE)
 * loop_step --[loop-output]--> loopBody (CODE)
 */
function buildLoopGraphData(opts: {
    loopItems: string
    loopBodySteps?: { name: string, input: Record<string, unknown> }[]
    afterLoopSteps?: { name: string, input: Record<string, unknown> }[]
    skipLoop?: boolean
}): GraphData {
    const nodes: GraphData['nodes'] = [
        {
            id: 'trigger',
            type: 'trigger',
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
        },
        {
            id: 'loop_step',
            type: 'loop',
            position: { x: 0, y: 100 },
            displayName: 'Loop',
            valid: true,
            skip: opts.skipLoop,
            actionType: FlowActionType.LOOP_ON_ITEMS,
            settings: {
                items: opts.loopItems,
            },
        },
    ]

    const edges: GraphData['edges'] = [
        {
            id: 'trigger-output-loop_step',
            source: 'trigger',
            target: 'loop_step',
            sourceHandle: 'output',
            targetHandle: 'input',
        },
    ]

    // Тело цикла: loop_step --[loop-output]--> body[0] --[output]--> body[1] ...
    const bodySteps = opts.loopBodySteps ?? []
    for (let i = 0; i < bodySteps.length; i++) {
        const step = bodySteps[i]
        nodes.push({
            id: step.name,
            type: 'action',
            position: { x: 100, y: (i + 1) * 100 },
            displayName: `Body ${step.name}`,
            valid: true,
            actionType: FlowActionType.CODE,
            settings: {
                input: step.input,
                sourceCode: { packageJson: '', code: '' },
            },
        })

        if (i === 0) {
            // loop_step --[loop-output]--> первая нода тела
            edges.push({
                id: `loop_step-loop-output-${step.name}`,
                source: 'loop_step',
                target: step.name,
                sourceHandle: 'loop-output',
                targetHandle: 'input',
            })
        }
        else {
            // body[i-1] --[output]--> body[i]
            edges.push({
                id: `${bodySteps[i - 1].name}-output-${step.name}`,
                source: bodySteps[i - 1].name,
                target: step.name,
                sourceHandle: 'output',
                targetHandle: 'input',
            })
        }
    }

    // Ноды после loop: loop_step --[output]--> afterLoop[0] --[output]--> afterLoop[1] ...
    const afterSteps = opts.afterLoopSteps ?? []
    for (let i = 0; i < afterSteps.length; i++) {
        const step = afterSteps[i]
        nodes.push({
            id: step.name,
            type: 'action',
            position: { x: 0, y: (nodes.length + 1) * 100 },
            displayName: `After ${step.name}`,
            valid: true,
            actionType: FlowActionType.CODE,
            settings: {
                input: step.input,
                sourceCode: { packageJson: '', code: '' },
            },
        })

        if (i === 0) {
            // loop_step --[output]--> первая нода после цикла
            edges.push({
                id: `loop_step-output-${step.name}`,
                source: 'loop_step',
                target: step.name,
                sourceHandle: 'output',
                targetHandle: 'input',
            })
        }
        else {
            edges.push({
                id: `${afterSteps[i - 1].name}-output-${step.name}`,
                source: afterSteps[i - 1].name,
                target: step.name,
                sourceHandle: 'output',
                targetHandle: 'input',
            })
        }
    }

    return { nodes, edges }
}

function buildAdjacencyForTest(graphData: GraphData) {
    const { buildAdjacencyMap } = require('@activepieces/shared')
    const adjacency = buildAdjacencyMap(graphData)
    return { adjacency }
}

describe('graphLoopExecutor', () => {

    describe('базовое исполнение', () => {
        it('должен исполнить loop с одной CODE нодой в теле цикла (3 итерации)', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [1, 2, 3] }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Проверяем что loop_step есть в результате
            const loopOutput = result.steps.loop_step
            expect(loopOutput).toBeDefined()
            expect(loopOutput.type).toBe(FlowActionType.LOOP_ON_ITEMS)

            // Проверяем количество итераций
            const loopResult = loopOutput as LoopStepOutput
            expect(loopResult.output?.iterations).toHaveLength(3)

            // Проверяем что каждая итерация содержит echo_step
            for (let i = 0; i < 3; i++) {
                const iteration = loopResult.output!.iterations[i]
                expect(iteration.echo_step).toBeDefined()
                expect(iteration.echo_step.output).toEqual({ key: 3 })
            }
        })

        it('должен исполнить loop с двумя CODE нодами в теле цикла', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [10, 20] }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 5 + 5 }}' } },
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            const loopResult = result.steps.loop_step as LoopStepOutput
            expect(loopResult.output?.iterations).toHaveLength(2)

            // Обе ноды выполнены в каждой итерации
            for (let i = 0; i < 2; i++) {
                const iteration = loopResult.output!.iterations[i]
                expect(iteration.echo_step).toBeDefined()
                expect(iteration.echo_step.output).toEqual({ key: 10 })
                expect(iteration.echo_step_1).toBeDefined()
                expect(iteration.echo_step_1.output).toEqual({ key: 7 })
            }
        })
    })

    describe('пустой и невалидный items', () => {
        it('должен корректно обработать пустой массив items', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [] }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            const loopResult = result.steps.loop_step as LoopStepOutput
            expect(loopResult.output?.iterations).toHaveLength(0)
        })

        it('должен вернуть FAILED когда items не массив', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ "not-an-array" }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
            expect(result.steps.loop_step.status).toBe(StepOutputStatus.FAILED)
        })
    })

    describe('loop без тела (нет edge loop-output)', () => {
        it('должен исполнить loop без тела (нет loop-output edge)', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [1, 2] }}',
                loopBodySteps: [], // Нет тела цикла
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            const loopResult = result.steps.loop_step as LoopStepOutput
            // Итерации создаются, но пустые (без шагов внутри)
            expect(loopResult.output?.iterations).toHaveLength(2)
        })
    })

    describe('прерывание при ошибке', () => {
        it('должен прервать loop при ошибке в теле цикла', async () => {
            // runtime — тест-нода без sourceCode.code, которая вызывает ошибку
            const graphData = buildLoopGraphData({
                loopItems: '{{ [1, 2, 3] }}',
                loopBodySteps: [
                    { name: 'runtime', input: {} },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)

            const loopResult = result.steps.loop_step as LoopStepOutput
            // Первая итерация имеет ошибку, остальные не исполнены
            expect(loopResult.output?.iterations).toHaveLength(1)
            expect(loopResult.output!.iterations[0].runtime).toBeDefined()
            expect(loopResult.output!.iterations[0].runtime.status).toBe(StepOutputStatus.FAILED)
        })
    })

    describe('нода после loop', () => {
        it('должен исполнить ноду после loop (по edge output)', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [1, 2] }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
                afterLoopSteps: [
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Loop выполнился
            const loopResult = result.steps.loop_step as LoopStepOutput
            expect(loopResult.output?.iterations).toHaveLength(2)

            // Нода после loop тоже выполнилась
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })

        it('НЕ должен исполнить ноду после loop если loop упал', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ "not-an-array" }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
                afterLoopSteps: [
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
            // Нода после loop НЕ выполнена
            expect(result.steps.echo_step_1).toBeUndefined()
        })
    })

    describe('skip loop', () => {
        it('должен пропустить loop с skip=true и исполнить ноду после', async () => {
            const graphData = buildLoopGraphData({
                loopItems: '{{ [1, 2, 3] }}',
                loopBodySteps: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
                afterLoopSteps: [
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
                skipLoop: true,
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'loop_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            // Loop пропущен — нет в steps
            expect(result.steps.loop_step).toBeUndefined()
            // Нода после loop выполнена
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })
    })
})
