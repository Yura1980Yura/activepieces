import { BranchExecutionType, BranchOperator, FlowActionType, FlowRunStatus, GraphData, RouterExecutionType, RouterStepOutput, StepOutputStatus } from '@activepieces/shared'
import { FlowExecutorContext } from '../../src/lib/handler/context/flow-execution-context'
import { graphFlowExecutor } from '../../src/lib/handler/graph-flow-executor'
import { generateMockEngineConstants } from './test-helper'

/**
 * Тесты для graph-router-executor.
 * Проверяют исполнение ROUTER через edges графа:
 * - branch-target по edge с sourceHandle 'branch-{index}'
 * - EXECUTE_FIRST_MATCH vs EXECUTE_ALL_MATCH режимы
 * - FALLBACK ветка
 * - ветка без edge (пустая ветка)
 * - прерывание при ошибке внутри ветки
 * - нода после router (по edge 'output')
 */

/**
 * Построить GraphData с router нодой.
 * trigger -> router_step (ROUTER) -> afterRouter (CODE)
 * router_step --[branch-0]--> branch0Steps[0] -> branch0Steps[1] -> ...
 * router_step --[branch-1]--> branch1Steps[0] -> branch1Steps[1] -> ...
 */
function buildRouterGraphData(opts: {
    branches: {
        branchName: string
        branchType: BranchExecutionType
        conditions?: { firstValue: string, secondValue: string, operator: BranchOperator }[][]
    }[]
    executionType: RouterExecutionType
    branchSteps?: { name: string, input: Record<string, unknown> }[][]
    afterRouterSteps?: { name: string, input: Record<string, unknown> }[]
    skipRouter?: boolean
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
            id: 'router_step',
            type: 'router',
            position: { x: 0, y: 100 },
            displayName: 'Router',
            valid: true,
            skip: opts.skipRouter,
            actionType: FlowActionType.ROUTER,
            settings: {
                branches: opts.branches.map((branch) => {
                    if (branch.branchType === BranchExecutionType.FALLBACK) {
                        return {
                            branchType: BranchExecutionType.FALLBACK,
                            branchName: branch.branchName,
                        }
                    }
                    return {
                        conditions: branch.conditions ?? [],
                        branchType: BranchExecutionType.CONDITION,
                        branchName: branch.branchName,
                    }
                }),
                executionType: opts.executionType,
            },
        },
    ]

    const edges: GraphData['edges'] = [
        {
            id: 'trigger-output-router_step',
            source: 'trigger',
            target: 'router_step',
            sourceHandle: 'output',
            targetHandle: 'input',
        },
    ]

    // Ноды для каждой ветки: router_step --[branch-i]--> branchSteps[i][0] -> branchSteps[i][1] -> ...
    const allBranchSteps = opts.branchSteps ?? []
    for (let branchIdx = 0; branchIdx < allBranchSteps.length; branchIdx++) {
        const steps = allBranchSteps[branchIdx]
        for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
            const step = steps[stepIdx]
            nodes.push({
                id: step.name,
                type: 'action',
                position: { x: (branchIdx + 1) * 200, y: (stepIdx + 1) * 100 },
                displayName: `Branch${branchIdx} ${step.name}`,
                valid: true,
                actionType: FlowActionType.CODE,
                settings: {
                    input: step.input,
                    sourceCode: { packageJson: '', code: '' },
                },
            })

            if (stepIdx === 0) {
                // router_step --[branch-{branchIdx}]--> первая нода ветки
                edges.push({
                    id: `router_step-branch-${branchIdx}-${step.name}`,
                    source: 'router_step',
                    target: step.name,
                    sourceHandle: `branch-${branchIdx}`,
                    targetHandle: 'input',
                })
            }
            else {
                // steps[stepIdx-1] --[output]--> steps[stepIdx]
                edges.push({
                    id: `${steps[stepIdx - 1].name}-output-${step.name}`,
                    source: steps[stepIdx - 1].name,
                    target: step.name,
                    sourceHandle: 'output',
                    targetHandle: 'input',
                })
            }
        }
    }

    // Ноды после router: router_step --[output]--> afterRouter[0] --[output]--> afterRouter[1] ...
    const afterSteps = opts.afterRouterSteps ?? []
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
            // router_step --[output]--> первая нода после роутера
            edges.push({
                id: `router_step-output-${step.name}`,
                source: 'router_step',
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

describe('graphRouterExecutor', () => {

    describe('EXECUTE_FIRST_MATCH', () => {
        it('должен исполнить первую ветку с true-condition и остановиться', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'hello', secondValue: 'hello', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Branch 2',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

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

            // Первая ветка исполнена
            expect(result.steps.echo_step).toBeDefined()
            expect(result.steps.echo_step.output).toEqual({ key: 3 })

            // Вторая ветка НЕ исполнена (EXECUTE_FIRST_MATCH)
            expect(result.steps.echo_step_1).toBeUndefined()
        })

        it('должен пропустить ветку с false-condition и исполнить следующую', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1 (false)',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'hello', secondValue: 'world', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Branch 2 (true)',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Первая ветка не исполнена (condition=false)
            expect(result.steps.echo_step).toBeUndefined()

            // Вторая ветка исполнена
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })
    })

    describe('EXECUTE_ALL_MATCH', () => {
        it('должен исполнить все ветки с true-condition', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Branch 2',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'b', secondValue: 'b', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_ALL_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Обе ветки исполнены
            expect(result.steps.echo_step).toBeDefined()
            expect(result.steps.echo_step.output).toEqual({ key: 3 })
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })
    })

    describe('FALLBACK ветка', () => {
        it('должен исполнить FALLBACK ветку когда все CONDITION ветки false', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1 (false)',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'hello', secondValue: 'world', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Fallback',
                        branchType: BranchExecutionType.FALLBACK,
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Branch 1 не исполнена (false)
            expect(result.steps.echo_step).toBeUndefined()

            // Fallback исполнена
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })

        it('НЕ должен исполнить FALLBACK ветку когда хотя бы одна CONDITION true', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1 (true)',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Fallback',
                        branchType: BranchExecutionType.FALLBACK,
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_ALL_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Branch 1 исполнена
            expect(result.steps.echo_step).toBeDefined()

            // Fallback НЕ исполнена (Branch 1 = true)
            expect(result.steps.echo_step_1).toBeUndefined()
        })
    })

    describe('пустая ветка (нет edge)', () => {
        it('должен обработать ветку без edge (нет branch-N edge)', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [], // Нет нод для ветки — нет edge branch-0
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)
            expect(result.steps.router_step).toBeDefined()

            // Проверяем evaluation результат
            const routerOutput = result.steps.router_step as RouterStepOutput
            expect(routerOutput.output?.branches).toHaveLength(1)
            expect(routerOutput.output?.branches[0].evaluation).toBe(true)
        })
    })

    describe('прерывание при ошибке', () => {
        it('должен прервать исполнение при ошибке внутри ветки', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Branch 2',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'b', secondValue: 'b', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_ALL_MATCH,
                branchSteps: [
                    [{ name: 'runtime', input: {} }], // runtime вызовет ошибку
                    [{ name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } }],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
            expect(result.steps.runtime).toBeDefined()
            expect(result.steps.runtime.status).toBe(StepOutputStatus.FAILED)

            // Вторая ветка НЕ исполнена (прерывание из-за ошибки)
            expect(result.steps.echo_step_1).toBeUndefined()
        })
    })

    describe('нода после router', () => {
        it('должен исполнить ноду после router (по edge output)', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 2 }}' } }],
                ],
                afterRouterSteps: [
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            // Ветка исполнена
            expect(result.steps.echo_step).toBeDefined()
            expect(result.steps.echo_step.output).toEqual({ key: 3 })

            // Нода после router тоже исполнена
            expect(result.steps.echo_step_1).toBeDefined()
            expect(result.steps.echo_step_1.output).toEqual({ key: 7 })
        })

        it('НЕ должен исполнить ноду после router если ветка упала', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'Branch 1',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'a', secondValue: 'a', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
                branchSteps: [
                    [{ name: 'runtime', input: {} }], // runtime вызовет ошибку
                ],
                afterRouterSteps: [
                    { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.FAILED)
            // Нода после router НЕ исполнена
            expect(result.steps.echo_step_1).toBeUndefined()
        })
    })

    describe('evaluation output', () => {
        it('должен корректно записать evaluation результаты в RouterStepOutput', async () => {
            const graphData = buildRouterGraphData({
                branches: [
                    {
                        branchName: 'True Branch',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'x', secondValue: 'x', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'False Branch',
                        branchType: BranchExecutionType.CONDITION,
                        conditions: [[{ firstValue: 'x', secondValue: 'y', operator: BranchOperator.TEXT_EXACTLY_MATCHES }]],
                    },
                    {
                        branchName: 'Fallback',
                        branchType: BranchExecutionType.FALLBACK,
                    },
                ],
                executionType: RouterExecutionType.EXECUTE_ALL_MATCH,
                branchSteps: [
                    [{ name: 'echo_step', input: { key: '{{ 1 + 1 }}' } }],
                    [],
                    [],
                ],
            })

            const { adjacency } = buildAdjacencyForTest(graphData)

            const result = await graphFlowExecutor.executeGraph({
                startNodeId: 'router_step',
                adjacency,
                executionState: FlowExecutorContext.empty(),
                constants: generateMockEngineConstants(),
            })

            expect(result.verdict.status).toBe(FlowRunStatus.RUNNING)

            const routerOutput = result.steps.router_step as RouterStepOutput
            expect(routerOutput.output?.branches).toHaveLength(3)

            // Branch 0: true (x === x)
            expect(routerOutput.output?.branches[0].branchName).toBe('True Branch')
            expect(routerOutput.output?.branches[0].evaluation).toBe(true)

            // Branch 1: false (x !== y)
            expect(routerOutput.output?.branches[1].branchName).toBe('False Branch')
            expect(routerOutput.output?.branches[1].evaluation).toBe(false)

            // Branch 2 (fallback): false (потому что Branch 0 = true)
            expect(routerOutput.output?.branches[2].branchName).toBe('Fallback')
            expect(routerOutput.output?.branches[2].evaluation).toBe(false)
        })
    })
})
